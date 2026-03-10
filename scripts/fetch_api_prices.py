"""
fetch_api_prices.py

Primary source:  Artificial Analysis API  https://artificialanalysis.ai/api/v2/data/llms/models
                 Requires env var: AA_API_KEY

Fallback source: OpenRouter API  https://openrouter.ai/api/v1/models
                 No API key required

Writes to: data/api_pricing.json (includes data_source field for the UI banner)
Changes:   data/history/changes.json
"""

import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
API_PRICING_FILE = ROOT / "data" / "api_pricing.json"
HISTORY_FILE = ROOT / "data" / "history" / "changes.json"

AA_URL = "https://artificialanalysis.ai/api/v2/data/llms/models"
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"

CHANGE_THRESHOLD_PCT = 0.5  # flag changes >= 0.5%


def fetch_json(url: str, headers: dict | None = None) -> dict | list | None:
    try:
        req_headers = {"User-Agent": "ai-pricing-tracker/1.0"}
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  [warn] Failed to fetch {url}: {e}")
        return None


def make_slug(name: str) -> str:
    return name.lower().replace(" ", "-").replace("_", "-")


def normalize_aa(data: dict) -> list[dict]:
    today = datetime.now(timezone.utc).date().isoformat()
    models = []
    for m in data.get("data", []):
        pricing = m.get("pricing") or {}
        creator = m.get("model_creator") or {}
        evals = m.get("evaluations") or {}

        model_id = (
            m.get("model_id") or m.get("id") or
            m.get("huggingface_id") or m.get("slug") or ""
        )
        model_name = m.get("model_name") or m.get("name") or model_id
        provider_name = creator.get("name") or creator.get("model_creator") or "Unknown"
        provider_slug_val = make_slug(provider_name)

        input_p = pricing.get("price_1m_input_tokens")
        output_p = pricing.get("price_1m_output_tokens")
        blended_p = pricing.get("price_1m_blended_3_to_1")
        speed = m.get("median_output_tokens_per_second")
        intelligence = evals.get("artificial_analysis_intelligence_index")

        ctx = m.get("context_window")
        ctx_k = round(ctx / 1000) if ctx else None
        is_free = (
            input_p == 0 and output_p == 0
            if (input_p is not None and output_p is not None) else False
        )

        entry: dict = {
            "id": (
                f"{provider_slug_val}/{model_id}"
                if model_id else f"{provider_slug_val}/{make_slug(model_name)}"
            ),
            "name": model_name,
            "provider": provider_name,
            "provider_slug": provider_slug_val,
            "input_price_per_1m": input_p,
            "output_price_per_1m": output_p,
            "context_window_k": ctx_k,
            "modality": "multimodal" if m.get("modality") == "multimodal" else "text",
            "is_free": is_free,
            "source": "artificial-analysis",
            "last_updated": today,
        }
        if blended_p is not None:
            entry["blended_price_per_1m"] = blended_p
        if speed is not None:
            entry["speed_tok_per_s"] = round(speed, 1)
        if intelligence is not None:
            entry["intelligence_score"] = round(intelligence, 1)

        models.append(entry)
    return models


def normalize_openrouter(data: dict) -> list[dict]:
    today = datetime.now(timezone.utc).date().isoformat()
    models = []
    for m in data.get("data", []):
        pricing = m.get("pricing", {})
        try:
            prompt_raw = float(pricing.get("prompt", 0) or 0)
            completion_raw = float(pricing.get("completion", 0) or 0)
        except (ValueError, TypeError):
            prompt_raw, completion_raw = 0.0, 0.0

        input_p = round(prompt_raw * 1_000_000, 6) if prompt_raw else None
        output_p = round(completion_raw * 1_000_000, 6) if completion_raw else None
        is_free = input_p == 0 and output_p == 0

        ctx = m.get("context_length")
        ctx_k = round(ctx / 1000) if ctx else None
        provider_raw = (
            m.get("id", "").split("/")[0] if "/" in m.get("id", "") else "unknown"
        )

        models.append({
            "id": m.get("id", ""),
            "name": m.get("name", m.get("id", "")),
            "provider": provider_raw.capitalize(),
            "provider_slug": provider_raw.lower(),
            "input_price_per_1m": input_p if not is_free else 0.0,
            "output_price_per_1m": output_p if not is_free else 0.0,
            "context_window_k": ctx_k,
            "modality": (
                "multimodal"
                if m.get("architecture", {}).get("modality") == "multimodal"
                else "text"
            ),
            "is_free": is_free,
            "source": "openrouter",
            "last_updated": today,
        })
    return models


def detect_changes(old_models: list[dict], new_models: list[dict]) -> list[dict]:
    old_map = {m["id"]: m for m in old_models}
    changes = []
    today = datetime.now(timezone.utc).date().isoformat()

    for m in new_models:
        old = old_map.get(m["id"])
        if not old:
            continue
        for field in ("input_price_per_1m", "output_price_per_1m"):
            old_val = old.get(field)
            new_val = m.get(field)
            if old_val is None or new_val is None or old_val == 0:
                continue
            pct = ((new_val - old_val) / old_val) * 100
            if abs(pct) >= CHANGE_THRESHOLD_PCT:
                changes.append({
                    "date": today,
                    "provider": m["provider"],
                    "model_or_plan": m["name"],
                    "type": "api",
                    "field": field,
                    "old_value": old_val,
                    "new_value": new_val,
                    "change_pct": round(pct, 2),
                })
    return changes


def main():
    aa_key = os.environ.get("AA_API_KEY", "").strip()
    models: list[dict] = []
    data_source = "unknown"

    # ── Primary: Artificial Analysis ──────────────────────────────────────────
    if aa_key:
        print("🔑 AA_API_KEY found — using Artificial Analysis as primary source")
        print(f"   Fetching {AA_URL} ...")
        aa_raw = fetch_json(AA_URL, headers={"x-api-key": aa_key})
        if aa_raw and aa_raw.get("data"):
            models = normalize_aa(aa_raw)
            data_source = "artificial-analysis"
            print(f"   ✅ Got {len(models)} models from Artificial Analysis")
        else:
            print("   ⚠️  AA API returned no data — falling back to OpenRouter")
    else:
        print("ℹ️  No AA_API_KEY set — using OpenRouter (fallback)")

    # ── Fallback: OpenRouter ───────────────────────────────────────────────────
    if not models:
        print(f"   Fetching {OPENROUTER_URL} ...")
        or_raw = fetch_json(OPENROUTER_URL)
        if or_raw:
            models = normalize_openrouter(or_raw)
            data_source = "openrouter"
            print(f"   ✅ Got {len(models)} models from OpenRouter")
        else:
            print("   ❌ OpenRouter also failed. Keeping existing data.")
            return

    # ── Change detection ───────────────────────────────────────────────────────
    old_models: list[dict] = []
    if API_PRICING_FILE.exists():
        try:
            old_data = json.loads(API_PRICING_FILE.read_text(encoding="utf-8"))
            old_models = old_data.get("models", [])
        except Exception:
            pass

    changes = detect_changes(old_models, models)
    if changes:
        print(f"   📊 Detected {len(changes)} price change(s)!")
        existing_history: list = []
        if HISTORY_FILE.exists():
            try:
                existing_history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        existing_history.extend(changes)
        HISTORY_FILE.write_text(json.dumps(existing_history, indent=2), encoding="utf-8")
    else:
        print("   No significant price changes detected.")

    # ── Write output ───────────────────────────────────────────────────────────
    output = {
        "version": "1.0",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "data_source": data_source,
        "models": models,
    }
    API_PRICING_FILE.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\n✅ Saved {len(models)} models  [source: {data_source}]  →  {API_PRICING_FILE}")


if __name__ == "__main__":
    main()