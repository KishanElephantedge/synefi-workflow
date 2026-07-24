import json
import subprocess

from app.config import settings


class DeeplineError(Exception):
    pass


def execute_tool(tool_id: str, payload: dict) -> dict:
    """Run `deepline tools execute <tool_id> --input '<json>' --json` and return the parsed response."""
    result = subprocess.run(
        [
            settings.deepline_cli_path,
            "tools",
            "execute",
            tool_id,
            "--input",
            json.dumps(payload),
            "--json",
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise DeeplineError(f"{tool_id} failed: {result.stderr or result.stdout}")
    # The CLI sometimes prints a non-JSON notice (e.g. "update available") before the
    # actual JSON payload. Find the first '{' and parse from there instead of assuming
    # stdout is pure JSON.
    stdout = result.stdout
    brace_index = stdout.find("{")
    if brace_index == -1:
        raise DeeplineError(f"{tool_id} returned no JSON output: {stdout[:500]}")
    try:
        return json.loads(stdout[brace_index:])
    except json.JSONDecodeError as e:
        raise DeeplineError(f"{tool_id} returned malformed JSON: {stdout[:500]}") from e


def extract_rows(response: dict, *keys: str) -> list[dict]:
    """Pull the row list out of a tool response. Deepline tools are inconsistent about
    shape: `raw` is sometimes the list itself, sometimes a dict with the list under a
    tool-specific key (e.g. "companies", "job_listings", "persons", "data"). Try each
    candidate key in order, but only after confirming raw isn't already the list."""
    raw = response.get("toolResponse", {}).get("raw", {})
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in keys:
            value = raw.get(key)
            if isinstance(value, list):
                return value
    return []


def get_rows(tool_id: str, payload: dict) -> list[dict]:
    """Convenience wrapper: execute a tool and extract the row list from its response."""
    response = execute_tool(tool_id, payload)
    return extract_rows(response, "rows", "persons")


def get_credit_balance_usd() -> float:
    """Current Deepline account balance in USD, used to enforce the daily spend cap --
    checked before/after the paid phases rather than trusting a per-call cost estimate,
    since actual spend depends on how many results each call actually returns."""
    result = subprocess.run(
        [settings.deepline_cli_path, "billing", "balance", "--json"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise DeeplineError(f"billing balance failed: {result.stderr or result.stdout}")
    stdout = result.stdout
    brace_index = stdout.find("{")
    if brace_index == -1:
        raise DeeplineError(f"billing balance returned no JSON output: {stdout[:500]}")
    data = json.loads(stdout[brace_index:])
    return float(data["rough_usd_balance"])
