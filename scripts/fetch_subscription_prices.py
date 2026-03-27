"""
fetch_subscription_prices.py

Monitors AI provider pricing pages for changes using content fingerprinting.

Workflow:
1. Fetch each pricing page HTML using urllib (with User-Agent header)
2. Compute SHA256 hash of relevant content (filter to body text, ignore scripts/styles)
3. Load existing fingerprints from data/subscriptions_fingerprints.json
4. Compare hashes - detect changes
5. Update fingerprints file with new hashes and timestamps
6. Print JSON output to stdout with changes detected

Optional: If GEMINI_API_KEY is set, use Gemini Flash to extract structured pricing
         when changes are detected, saving to data/subscriptions_suggestions.json
"""

import hashlib
import html.parser
import json
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).parent.parent
FINGERPRINTS_FILE = ROOT / "data" / "subscriptions_fingerprints.json"
SUGGESTIONS_FILE = ROOT / "data" / "subscriptions_suggestions.json"
HISTORY_FILE = ROOT / "data" / "history" / "changes.json"

# Provider URLs to monitor
PROVIDER_URLS = {
    "chatgpt": "https://openai.com/chatgpt/pricing",
    "claude": "https://claude.ai/pricing",
    "gemini": "https://ai.google.dev/pricing",
    "grok": "https://x.ai/",
    "perplexity": "https://www.perplexity.ai/pro",
    "mistral": "https://mistral.ai/technology/#pricing",
    "copilot": "https://github.com/features/copilot#pricing",
    "deepseek": "https://www.deepseek.com/",
    "meta-ai": "https://ai.meta.com/",
}

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


class TextExtractor(html.parser.HTMLParser):
    """Extract visible text from HTML, ignoring scripts, styles, and tags."""

    def __init__(self):
        super().__init__()
        self.text_parts: list[str] = []
        self.skip_tags = {"script", "style", "noscript", "svg", "head", "meta", "link"}
        self.current_skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag.lower() in self.skip_tags:
            self.current_skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.skip_tags and self.current_skip_depth > 0:
            self.current_skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.current_skip_depth == 0:
            text = data.strip()
            if text:
                self.text_parts.append(text)

    def get_text(self) -> str:
        return " ".join(self.text_parts)


def fetch_page(url: str, timeout: int = 30) -> Optional[str]:
    """Fetch a web page and return its HTML content."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            return resp.read().decode(charset, errors="replace")
    except urllib.error.HTTPError as e:
        print(f"  [warn] HTTP {e.code} for {url}", file=sys.stderr)
        return None
    except urllib.error.URLError as e:
        print(f"  [warn] URL error for {url}: {e.reason}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [warn] Failed to fetch {url}: {e}", file=sys.stderr)
        return None


def extract_body_text(html_content: str) -> str:
    """Extract visible text content from HTML, filtering out scripts/styles."""
    # Extract body content if present
    body_match = re.search(r"<body[^>]*>(.*?)</body>", html_content, re.DOTALL | re.IGNORECASE)
    if body_match:
        html_content = body_match.group(1)

    # Parse and extract text
    parser = TextExtractor()
    try:
        parser.feed(html_content)
    except Exception:
        # Fallback: strip all tags
        text = re.sub(r"<[^>]+>", " ", html_content)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    return parser.get_text()


def compute_hash(content: str) -> str:
    """Compute SHA256 hash of content."""
    # Normalize whitespace for more stable hashing
    normalized = re.sub(r"\s+", " ", content.strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def load_fingerprints() -> dict:
    """Load existing fingerprints from JSON file."""
    if FINGERPRINTS_FILE.exists():
        try:
            return json.loads(FINGERPRINTS_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  [warn] Failed to load fingerprints: {e}", file=sys.stderr)
    return {"version": "1.0", "last_checked": None, "providers": {}}


def save_fingerprints(data: dict) -> None:
    """Save fingerprints to JSON file."""
    FINGERPRINTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    FINGERPRINTS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_history() -> list:
    """Load existing change history from JSON file."""
    if HISTORY_FILE.exists():
        try:
            return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  [warn] Failed to load history: {e}", file=sys.stderr)
    return []


def save_history(data: list) -> None:
    """Save change history to JSON file."""
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def validate_extracted_plan(plan: dict) -> tuple[bool, list[str]]:
    """Validate a plan against the PlanSchema rules.
    
    Returns (is_valid, list_of_errors)
    """
    errors = []
    
    # Required fields
    if not plan.get("name"):
        errors.append("name is required")
    
    # price_monthly: number or null
    price = plan.get("price_monthly")
    if price is not None and not isinstance(price, (int, float)):
        errors.append("price_monthly must be a number or null")
    
    # tier must be one of consumer/team/enterprise
    tier = plan.get("tier", "consumer")
    if tier not in ("consumer", "team", "enterprise"):
        errors.append(f"tier must be consumer/team/enterprise, got: {tier}")
    
    # is_free should be boolean
    if "is_free" in plan and not isinstance(plan["is_free"], bool):
        errors.append("is_free must be boolean")
    
    # key_features should be list
    features = plan.get("key_features", [])
    if not isinstance(features, list):
        errors.append("key_features must be a list")
    
    # per_seat should be boolean
    if "per_seat" in plan and not isinstance(plan["per_seat"], bool):
        errors.append("per_seat must be boolean")
    
    # min_seats should be number if present
    min_seats = plan.get("min_seats")
    if min_seats is not None and not isinstance(min_seats, (int, float)):
        errors.append("min_seats must be a number")
    
    return (len(errors) == 0, errors)


def validate_extracted_data(data: dict) -> tuple[bool, list[str]]:
    """Validate entire extraction against ProviderSubscriptionSchema rules."""
    errors = []
    
    if not data.get("provider"):
        errors.append("provider is required")
    
    plans = data.get("plans", [])
    if not isinstance(plans, list):
        errors.append("plans must be a list")
        return (False, errors)
    
    for i, plan in enumerate(plans):
        is_valid, plan_errors = validate_extracted_plan(plan)
        if not plan_errors:
            continue
        errors.extend([f"plan[{i}].{e}" for e in plan_errors])
    
    return (len(errors) == 0, errors)


def parse_gemini_json_response(response_text: str) -> Optional[dict]:
    """Parse JSON from Gemini response, handling markdown code blocks and malformed responses."""
    if not response_text:
        return None

    # Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleaned = response_text.strip()
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if code_block_match:
        cleaned = code_block_match.group(1).strip()

    # Try to extract JSON object
    json_match = re.search(r"\{[\s\S]*\}", cleaned)
    if not json_match:
        return None

    json_str = json_match.group()

    # Try parsing as-is first
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # Try fixing common issues: trailing commas
    try:
        fixed = re.sub(r",\s*([}\]])", r"\1", json_str)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Try fixing incomplete JSON by closing brackets
    try:
        open_braces = json_str.count("{") - json_str.count("}")
        open_brackets = json_str.count("[") - json_str.count("]")
        fixed = json_str + ("]" * open_brackets) + ("}" * open_braces)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    return None


def extract_pricing_with_gemini(provider: str, url: str, html_content: str) -> Optional[dict]:
    """Use Gemini Flash API to extract structured pricing from HTML."""
    try:
        import google.generativeai as genai
    except ImportError:
        print("  [info] google-generativeai not installed, skipping extraction", file=sys.stderr)
        return None

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    today = datetime.now().strftime("%Y-%m-%d")

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Truncate HTML to avoid token limits
        body_text = extract_body_text(html_content)[:15000]

        prompt = f"""Analyze this pricing page content for {provider} ({url}) and extract subscription pricing information.

Return a JSON object with this EXACT structure (matching our Zod schema):
{{
  "provider": "{provider}",
  "plans": [
    {{
      "name": "Plan Name",
      "price_monthly": 20,
      "price_annual_monthly": 16,
      "billing_period": "month",
      "tier": "consumer",
      "is_free": false,
      "highlighted": true,
      "model_access": "GPT-4o, Claude 3.5, etc",
      "usage_limits": "100 messages/day",
      "key_features": ["feature1", "feature2"],
      "best_for": "Professionals and developers",
      "per_seat": false,
      "min_seats": null,
      "notes": null
    }}
  ],
  "description": "Brief description of the service",
  "last_updated": "{today}"
}}

Rules:
- tier must be one of: "consumer", "team", "enterprise"
- Use "consumer" for individual plans (Free, Plus, Pro)
- Use "team" for team/business plans
- Use "enterprise" for enterprise/custom pricing plans
- is_free: true only if price_monthly is 0
- highlighted: true if plan is marked as "Popular", "Recommended", or "Best Value"
- per_seat: true if pricing shows "/seat" or "/user"
- price_monthly: null for "Contact Sales" plans
- price_annual_monthly: the monthly rate when billed annually (different from yearly total)
- Use null for unknown values, not empty strings

Content:
{body_text}
"""

        response = model.generate_content(prompt)
        response_text = response.text

        parsed = parse_gemini_json_response(response_text)
        if parsed:
            # Validate against Zod-equivalent schema rules
            is_valid, validation_errors = validate_extracted_data(parsed)
            if not is_valid:
                for err in validation_errors:
                    print(f"  [warn] Validation error for {provider}: {err}", file=sys.stderr)
            
            # Attach validation metadata to the result
            parsed["_validation"] = {
                "valid": is_valid,
                "errors": validation_errors,
            }
            return parsed

        print(f"  [warn] Failed to parse Gemini response for {provider}", file=sys.stderr)
    except Exception as e:
        print(f"  [warn] Gemini extraction failed for {provider}: {e}", file=sys.stderr)

    return None


def check_provider(provider: str, url: str, existing_hash: Optional[str]) -> dict:
    """Check a single provider's pricing page for changes."""
    result = {
        "provider": provider,
        "url": url,
        "status": "unknown",
        "old_hash": existing_hash,
        "new_hash": None,
        "changed": False,
        "error": None,
    }

    html_content = fetch_page(url)
    if html_content is None:
        result["status"] = "fetch_failed"
        result["error"] = "Failed to fetch page"
        return result

    body_text = extract_body_text(html_content)
    if not body_text or len(body_text) < 100:
        result["status"] = "no_content"
        result["error"] = "Page has insufficient content"
        return result

    new_hash = compute_hash(body_text)
    result["new_hash"] = new_hash
    result["status"] = "ok"

    if existing_hash is None:
        result["changed"] = True  # First time seeing this provider
    elif existing_hash != new_hash:
        result["changed"] = True

    # Store HTML for potential Gemini extraction
    result["_html"] = html_content

    return result


def main():
    """Main function to check all providers and output results."""
    print("🔍 Checking subscription pricing pages...", file=sys.stderr)

    fingerprints = load_fingerprints()
    providers_data = fingerprints.get("providers", {})
    history = load_history()
    now = datetime.now(timezone.utc).isoformat()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    results = []
    changed_providers = []
    details = []

    for provider, url in PROVIDER_URLS.items():
        print(f"  Checking {provider}...", file=sys.stderr)

        existing_entry = providers_data.get(provider, {})
        existing_hash = existing_entry.get("hash")

        result = check_provider(provider, url, existing_hash)
        results.append(result)

        if result["status"] == "ok":
            # Update fingerprint
            providers_data[provider] = {
                "url": url,
                "hash": result["new_hash"],
                "last_checked": now,
                "last_changed": now if result["changed"] else existing_entry.get("last_changed"),
            }

            if result["changed"]:
                changed_providers.append(provider)
                details.append({
                    "provider": provider,
                    "url": url,
                    "old_hash": result["old_hash"],
                    "new_hash": result["new_hash"],
                })
                # Log change to history
                history.append({
                    "date": today,
                    "provider": provider.title() if provider != "meta-ai" else "Meta AI",
                    "model_or_plan": "pricing_page",
                    "type": "subscription",
                    "field": "content_hash",
                    "old_value": None,
                    "new_value": None,
                    "change_pct": None,
                    "source_url": url,
                })
                print(f"    ⚡ Change detected!", file=sys.stderr)
            else:
                print(f"    ✓ No change", file=sys.stderr)
        else:
            print(f"    ⚠ {result['error']}", file=sys.stderr)

    # Save updated fingerprints
    fingerprints["last_checked"] = now
    fingerprints["providers"] = providers_data
    save_fingerprints(fingerprints)

    # Save history if there were changes
    if changed_providers:
        save_history(history)
        print(f"  💾 Updated history with {len(changed_providers)} change(s)", file=sys.stderr)

    # Optional: Extract pricing with Gemini for changed providers
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_key and changed_providers:
        print(f"\n🤖 Extracting pricing with Gemini for {len(changed_providers)} changed provider(s)...", file=sys.stderr)

        suggestions = {}
        if SUGGESTIONS_FILE.exists():
            try:
                suggestions = json.loads(SUGGESTIONS_FILE.read_text(encoding="utf-8"))
            except Exception:
                suggestions = {}

        for result in results:
            if result["provider"] in changed_providers and result.get("_html"):
                print(f"  Extracting {result['provider']}...", file=sys.stderr)
                extracted = extract_pricing_with_gemini(
                    result["provider"],
                    result["url"],
                    result["_html"]
                )
                if extracted:
                    # Extract validation metadata from the data
                    validation = extracted.pop("_validation", {"valid": True, "errors": []})
                    suggestions[result["provider"]] = {
                        "extracted_at": now,
                        "url": result["url"],
                        "data": extracted,
                        "validation": validation,
                    }
                    if validation["valid"]:
                        print(f"    ✓ Extracted (validated)", file=sys.stderr)
                    else:
                        print(f"    ⚠ Extracted with {len(validation['errors'])} validation error(s)", file=sys.stderr)

        if suggestions:
            suggestions["_meta"] = {
                "last_updated": now,
                "version": "1.0",
            }
            SUGGESTIONS_FILE.write_text(json.dumps(suggestions, indent=2), encoding="utf-8")
            print(f"  💾 Saved suggestions to {SUGGESTIONS_FILE}", file=sys.stderr)

    # Output JSON result to stdout
    output = {
        "changes_detected": len(changed_providers) > 0,
        "changed_providers": changed_providers,
        "details": details,
    }

    print(json.dumps(output, indent=2))

    # Summary
    print(f"\n✅ Checked {len(PROVIDER_URLS)} providers", file=sys.stderr)
    if changed_providers:
        print(f"   ⚡ Changes detected: {', '.join(changed_providers)}", file=sys.stderr)
    else:
        print("   No changes detected", file=sys.stderr)


if __name__ == "__main__":
    main()
