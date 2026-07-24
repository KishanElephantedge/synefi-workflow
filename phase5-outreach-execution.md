# Synefi — Phase 5: Outreach Execution

Purpose: take Phase 4's `automated_execution` package (LinkedIn + email only — the platform-automatable subset of the full Contact Map) and actually send it, safely and at sustainable volume, without getting accounts flagged/restricted.

---

## Open Risk — HeyReach specifically (needs a decision before locking execution tooling)

In March 2026, LinkedIn permanently removed HeyReach's company page and banned its founder's personal profile — not for individual users exceeding daily limits, but because **LinkedIn's detection systems classified HeyReach's cloud-proxy architecture itself as policy-violating infrastructure**. The software still runs for existing customers, but ~40% of accounts using tools in this category (HeyReach, Expandi, Dripify, Waalaxy named explicitly) received some form of restriction between January and March 2026. This is a materially higher risk than "just stay under the daily limit" — it's architectural, not usage-based.

**Decision needed**: keep HeyReach with mitigations (fewer seats, close monitoring), evaluate alternative LinkedIn execution tools, or flag this risk to the team lead/Synefi before committing further build effort around it. Not resolved yet — noted here so it isn't lost.

---

## Rule-1 (Execution Channels)
- LinkedIn sends via HeyReach (pending the risk decision above).
- Email sends via Deepline's Instantly integration.
- No other channel is executed by this platform — everything else from Phase 4's Contact Map is a manual dossier, out of scope here.

## Rule-2 (Rate / Capacity Model)
- Safe LinkedIn limit: 20–25 connection requests per seat per day, 100–200/week — restriction risk climbs quickly beyond this.
- Total daily LinkedIn throughput = number of seats provisioned × per-seat cap. Scaling volume means provisioning more seats, not pushing one account harder — this is a resourcing decision for Synefi, not a pure software one.
- Email requires domain warm-up and a per-inbox daily send cap to avoid spam-filter flags — not unlimited just because it's email.

## Rule-3 (Send Timing)
- Queue sends for Tuesday–Thursday, 9:30–11:30 AM in the **recipient's local timezone** — untimed sending underperforms this window by 30–45%.
- Never send Friday afternoon or on weekends (35–75% worse reply rates).

## Rule-4 (Queue Priority)
- Within each day's available capacity, Hot-tier leads (Phase 2) are queued before Warm-tier.
- Each individual contact's sequence follows Phase 4's Rule-4 cadence: LinkedIn connect (day 1) → email (day 3) → LinkedIn message (day 7) → email follow-up (day 10).

## Rule-5 (Reply / Bounce Handling)
- Stop a sequence immediately on any reply, on any channel.
- On email bounce, switch that contact to LinkedIn-only for the remainder of the sequence (per Phase 4's Rule-3 fallback) rather than retrying the bad address.

## Rule-6 (Suppression & Logging)
- Every send is logged: contact, channel, timestamp, status.
- This log enforces Phase 3's Rule-7 suppression (never re-target a contacted company/person) and provides an audit trail.

---

## Output
Sent outreach, logged per contact/channel/status — the last stage of the six-phase pipeline (Phase 1 Signal Discovery → Phase 2 Scoring → Phase 3 Decision-Maker ID → Phase 4 Enrichment & Approach → Phase 5 Execution → Phase 6 Orchestration wraps all of it on a continuous cadence).

## Status note
Decision-complete design spec, not yet executable code — same status as the other phase docs. The HeyReach risk above is the one open item blocking a fully locked execution layer.
