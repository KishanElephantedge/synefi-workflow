# Lessons Learned — Deepline / HeyReach execution

## 2026-07-17 — Validate the AI-filter prompt on the pilot before scaling
When running the find-qualified-titles pipeline, the LLM title-filtering step (Step 2) was run on all 14 companies, found to be too loose (42 generic titles for one company), then had to be re-run a second time at full scale after tightening the prompt. That doubled the filtering cost unnecessarily (~$0.35-0.40 wasted out of $1.88 total).
**Fix going forward**: always re-validate the tightened prompt against the SAME pilot row(s) used originally before running it at full company-list scale again. Don't scale until the pilot output looks clean.

## 2026-07-17 — Deepline CSV column shape gotcha
Deepline enrich CSV columns use literal dotted names like `"titles.output"` (a flat string key), not nested objects (`row.titles.output`). Always access via bracket notation: `row["titles.output"]`. Confirmed by dumping `Object.keys(row)` when in doubt.

## 2026-07-17 — Array-typed fields must stay "live" within the same run
`search_contact`'s `title_lists[].titles` needs a real JS array at execution time. If a prior step JSON.stringify's the array and writes it to CSV, then a later `deepline enrich` command reads that CSV back, the array becomes a string again and the call fails validation (422) before billing. Fix: do the parse step and the tool call that needs the array in the SAME `deepline enrich` command (multiple `--with` flags), so the array stays a live in-memory value and never round-trips through CSV as a string.
