"""
merge_suggestions.py

Merge Gemini-extracted pricing suggestions into subscriptions.yml.

Workflow:
1. Load data/subscriptions.yml (current truth)
2. Load data/subscriptions_suggestions.json (Gemini extractions)
3. Smart diff - match providers by ID, fuzzy match plans by name
4. Generate changeset with human-readable diff
5. Optionally apply changes with --apply flag

Usage:
    python scripts/merge_suggestions.py          # Preview changes only
    python scripts/merge_suggestions.py --apply  # Apply changes to YAML
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional

import yaml

ROOT = Path(__file__).parent.parent
SUBSCRIPTIONS_FILE = ROOT / "data" / "subscriptions.yml"
SUGGESTIONS_FILE = ROOT / "data" / "subscriptions_suggestions.json"
CHANGESET_FILE = ROOT / "data" / "subscriptions_changeset.json"

# Fields to compare for price changes
PRICE_FIELDS = ["price_monthly", "price_annual_monthly"]
COMPARABLE_FIELDS = [
    "price_monthly",
    "price_annual_monthly",
    "billing_period",
    "tier",
    "is_free",
    "model_access",
    "usage_limits",
    "per_seat",
    "min_seats",
]

# Threshold for flagging significant price changes
SIGNIFICANT_CHANGE_PCT = 10.0


def load_yaml(path: Path) -> dict:
    """Load YAML file."""
    if not path.exists():
        print(f"Error: {path} not found", file=sys.stderr)
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_yaml(path: Path, data: dict) -> None:
    """Save YAML file with nice formatting."""
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(
            data,
            f,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=120,
        )


def load_json(path: Path) -> dict:
    """Load JSON file."""
    if not path.exists():
        print(f"Error: {path} not found", file=sys.stderr)
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    """Save JSON file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def normalize_plan_name(name: str) -> str:
    """Normalize plan name for comparison."""
    # Lowercase, strip whitespace, remove special chars
    return re.sub(r"[^a-z0-9]", "", name.lower().strip())


def fuzzy_match_score(a: str, b: str) -> float:
    """Calculate fuzzy match score between two strings."""
    return SequenceMatcher(None, normalize_plan_name(a), normalize_plan_name(b)).ratio()


def find_matching_plan(
    plan_name: str, plans: list[dict], threshold: float = 0.7
) -> Optional[dict]:
    """Find a plan in the list that matches the given name."""
    normalized = normalize_plan_name(plan_name)

    # First try exact normalized match
    for plan in plans:
        if normalize_plan_name(plan.get("name", "")) == normalized:
            return plan

    # Then try fuzzy match
    best_match = None
    best_score = threshold
    for plan in plans:
        score = fuzzy_match_score(plan_name, plan.get("name", ""))
        if score > best_score:
            best_score = score
            best_match = plan

    return best_match


def calculate_pct_change(old: float, new: float) -> Optional[float]:
    """Calculate percentage change between old and new values."""
    if old is None or new is None:
        return None
    if old == 0:
        return None if new == 0 else float("inf")
    return round(((new - old) / old) * 100, 2)


def compare_plans(
    provider_id: str,
    existing_plan: dict,
    suggested_plan: dict,
) -> list[dict]:
    """Compare two plans and return list of changes."""
    changes = []
    plan_name = existing_plan.get("name", "Unknown")

    for field in COMPARABLE_FIELDS:
        old_val = existing_plan.get(field)
        new_val = suggested_plan.get(field)

        # Skip if both are None or equal
        if old_val == new_val:
            continue

        # Skip if suggested value is None (we don't remove data)
        if new_val is None:
            continue

        change = {
            "provider": provider_id,
            "type": "price_change" if field in PRICE_FIELDS else "field_change",
            "plan": plan_name,
            "field": field,
            "old": old_val,
            "new": new_val,
        }

        # Calculate percentage change for numeric fields
        if field in PRICE_FIELDS and isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
            pct = calculate_pct_change(old_val, new_val)
            change["pct_change"] = pct
            if pct is not None and abs(pct) > SIGNIFICANT_CHANGE_PCT:
                change["significant"] = True

        changes.append(change)

    return changes


def diff_provider(
    provider_id: str,
    existing_provider: dict,
    suggested_data: dict,
) -> list[dict]:
    """Diff a single provider's plans against suggestions."""
    changes = []
    existing_plans = existing_provider.get("plans", [])
    suggested_plans = suggested_data.get("plans", [])

    existing_plan_names = {normalize_plan_name(p.get("name", "")) for p in existing_plans}
    suggested_plan_names = {normalize_plan_name(p.get("name", "")) for p in suggested_plans}

    # Compare existing plans against suggestions
    for suggested_plan in suggested_plans:
        suggested_name = suggested_plan.get("name", "")
        matched_plan = find_matching_plan(suggested_name, existing_plans)

        if matched_plan:
            # Plan exists - compare fields
            plan_changes = compare_plans(provider_id, matched_plan, suggested_plan)
            changes.extend(plan_changes)
        else:
            # New plan detected
            changes.append({
                "provider": provider_id,
                "type": "plan_added",
                "plan": suggested_name,
                "field": None,
                "old": None,
                "new": suggested_plan,
            })

    # Detect removed plans (plans in existing but not in suggested)
    for existing_plan in existing_plans:
        existing_name = existing_plan.get("name", "")
        if not find_matching_plan(existing_name, suggested_plans):
            changes.append({
                "provider": provider_id,
                "type": "plan_removed",
                "plan": existing_name,
                "field": None,
                "old": existing_plan,
                "new": None,
            })

    return changes


def generate_changeset(subscriptions: dict, suggestions: dict) -> dict:
    """Generate changeset comparing subscriptions to suggestions."""
    changes = []
    providers_by_id = {p["id"]: p for p in subscriptions.get("providers", [])}

    for provider_id, suggestion_entry in suggestions.items():
        # Skip metadata
        if provider_id.startswith("_"):
            continue

        suggested_data = suggestion_entry.get("data", {})
        if not suggested_data:
            continue

        existing_provider = providers_by_id.get(provider_id)
        if not existing_provider:
            # Provider not in subscriptions.yml - skip for now
            print(f"  [skip] Provider '{provider_id}' not in subscriptions.yml", file=sys.stderr)
            continue

        provider_changes = diff_provider(provider_id, existing_provider, suggested_data)
        changes.extend(provider_changes)

    # Generate summary
    providers_changed = len(set(c["provider"] for c in changes))
    plans_updated = len([c for c in changes if c["type"] in ("price_change", "field_change")])
    plans_added = len([c for c in changes if c["type"] == "plan_added"])
    plans_removed = len([c for c in changes if c["type"] == "plan_removed"])
    significant_price_changes = len([c for c in changes if c.get("significant")])

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "changes": changes,
        "summary": {
            "providers_changed": providers_changed,
            "plans_updated": plans_updated,
            "plans_added": plans_added,
            "plans_removed": plans_removed,
            "significant_price_changes": significant_price_changes,
        },
    }


def print_changeset(changeset: dict) -> None:
    """Print human-readable diff to stderr."""
    changes = changeset.get("changes", [])
    summary = changeset.get("summary", {})

    if not changes:
        print("\n✅ No changes detected between suggestions and current data.", file=sys.stderr)
        return

    print("\n" + "=" * 60, file=sys.stderr)
    print("📋 CHANGESET SUMMARY", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    print(f"  Providers affected:       {summary.get('providers_changed', 0)}", file=sys.stderr)
    print(f"  Plans updated:            {summary.get('plans_updated', 0)}", file=sys.stderr)
    print(f"  Plans added:              {summary.get('plans_added', 0)}", file=sys.stderr)
    print(f"  Plans removed:            {summary.get('plans_removed', 0)}", file=sys.stderr)
    print(f"  Significant price changes: {summary.get('significant_price_changes', 0)}", file=sys.stderr)

    print("\n" + "-" * 60, file=sys.stderr)
    print("📝 DETAILED CHANGES", file=sys.stderr)
    print("-" * 60, file=sys.stderr)

    # Group changes by provider
    changes_by_provider: dict[str, list] = {}
    for change in changes:
        provider = change["provider"]
        if provider not in changes_by_provider:
            changes_by_provider[provider] = []
        changes_by_provider[provider].append(change)

    for provider, provider_changes in changes_by_provider.items():
        print(f"\n🔹 {provider.upper()}", file=sys.stderr)

        for change in provider_changes:
            change_type = change["type"]
            plan = change["plan"]

            if change_type == "plan_added":
                print(f"  ➕ NEW PLAN: {plan}", file=sys.stderr)
                new_data = change.get("new", {})
                if isinstance(new_data, dict):
                    price = new_data.get("price_monthly")
                    if price is not None:
                        print(f"      Price: ${price}/month", file=sys.stderr)

            elif change_type == "plan_removed":
                print(f"  ➖ REMOVED: {plan}", file=sys.stderr)

            elif change_type == "price_change":
                field = change["field"]
                old_val = change["old"]
                new_val = change["new"]
                pct = change.get("pct_change")
                significant = "⚠️ " if change.get("significant") else ""

                pct_str = f" ({pct:+.1f}%)" if pct is not None else ""
                print(
                    f"  {significant}💰 {plan} [{field}]: ${old_val} → ${new_val}{pct_str}",
                    file=sys.stderr,
                )

            elif change_type == "field_change":
                field = change["field"]
                old_val = change["old"]
                new_val = change["new"]
                old_str = str(old_val)[:30] if old_val else "(none)"
                new_str = str(new_val)[:30] if new_val else "(none)"
                print(f"  📝 {plan} [{field}]: {old_str} → {new_str}", file=sys.stderr)

    print("\n" + "=" * 60, file=sys.stderr)


def apply_changes(subscriptions: dict, changeset: dict) -> dict:
    """Apply changeset to subscriptions data."""
    changes = changeset.get("changes", [])
    if not changes:
        return subscriptions

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    providers_by_id = {p["id"]: p for p in subscriptions.get("providers", [])}
    modified_providers = set()

    for change in changes:
        provider_id = change["provider"]
        change_type = change["type"]
        plan_name = change["plan"]

        provider = providers_by_id.get(provider_id)
        if not provider:
            continue

        plans = provider.get("plans", [])

        if change_type in ("price_change", "field_change"):
            # Find and update the plan
            matched_plan = find_matching_plan(plan_name, plans)
            if matched_plan:
                field = change["field"]
                old_val = matched_plan.get(field)
                new_val = change["new"]

                matched_plan[field] = new_val
                modified_providers.add(provider_id)

                # Add history entry for price changes
                if change_type == "price_change" and field in PRICE_FIELDS:
                    history = provider.setdefault("history", [])
                    pct = change.get("pct_change", 0)
                    direction = "increased" if pct and pct > 0 else "decreased"
                    history_entry = {
                        "date": today,
                        "event": f"{plan_name} {field.replace('_', ' ')} {direction} from ${old_val} to ${new_val}",
                    }
                    # Add at the beginning (most recent first)
                    history.insert(0, history_entry)

        elif change_type == "plan_added":
            # Add new plan
            new_plan = change["new"]
            if isinstance(new_plan, dict):
                plans.append(new_plan)
                modified_providers.add(provider_id)

                # Add history entry
                history = provider.setdefault("history", [])
                price = new_plan.get("price_monthly")
                price_str = f"at ${price}/month" if price else ""
                history.insert(0, {
                    "date": today,
                    "event": f"{plan_name} plan added {price_str}".strip(),
                })

        # Note: plan_removed changes are NOT auto-applied (require manual review)

    # Update last_updated for modified providers
    for provider_id in modified_providers:
        provider = providers_by_id.get(provider_id)
        if provider:
            provider["last_updated"] = today

    # Update root last_updated if any changes were made
    if modified_providers:
        subscriptions["last_updated"] = today

    return subscriptions


def main():
    parser = argparse.ArgumentParser(
        description="Merge Gemini pricing suggestions into subscriptions.yml"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes to subscriptions.yml (default: preview only)",
    )
    args = parser.parse_args()

    print("🔄 Loading data...", file=sys.stderr)

    # Check if suggestions file exists
    if not SUGGESTIONS_FILE.exists():
        print(f"Error: {SUGGESTIONS_FILE} not found", file=sys.stderr)
        print("Run fetch_subscription_prices.py with GEMINI_API_KEY first.", file=sys.stderr)
        sys.exit(1)

    subscriptions = load_yaml(SUBSCRIPTIONS_FILE)
    suggestions = load_json(SUGGESTIONS_FILE)

    print(f"  Loaded {len(subscriptions.get('providers', []))} providers from subscriptions.yml", file=sys.stderr)
    suggestion_count = len([k for k in suggestions.keys() if not k.startswith("_")])
    print(f"  Loaded {suggestion_count} suggestions from suggestions file", file=sys.stderr)

    # Generate changeset
    print("\n🔍 Analyzing differences...", file=sys.stderr)
    changeset = generate_changeset(subscriptions, suggestions)

    # Print human-readable diff
    print_changeset(changeset)

    # Save changeset
    save_json(CHANGESET_FILE, changeset)
    print(f"\n💾 Saved changeset to {CHANGESET_FILE}", file=sys.stderr)

    # Apply changes if requested
    if args.apply:
        changes = changeset.get("changes", [])
        if not changes:
            print("\n✅ No changes to apply.", file=sys.stderr)
        else:
            print("\n🚀 Applying changes to subscriptions.yml...", file=sys.stderr)
            updated_subscriptions = apply_changes(subscriptions, changeset)
            save_yaml(SUBSCRIPTIONS_FILE, updated_subscriptions)
            print("✅ Changes applied successfully!", file=sys.stderr)

            # Warn about removed plans
            removed = [c for c in changes if c["type"] == "plan_removed"]
            if removed:
                print(f"\n⚠️  {len(removed)} plan(s) marked as removed were NOT deleted.", file=sys.stderr)
                print("   Review manually and delete if confirmed.", file=sys.stderr)
    else:
        print("\n💡 Run with --apply to apply these changes.", file=sys.stderr)

    # Output summary to stdout as JSON
    output = {
        "status": "applied" if args.apply else "preview",
        "summary": changeset.get("summary", {}),
        "changeset_file": str(CHANGESET_FILE),
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
