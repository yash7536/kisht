# Results

**Not run yet.**

No eval has been run against a live model. This file will hold only numbers produced by actual runs, each with:

- run id, date, model id, temperature, thinking budget, k, app git SHA;
- scenario set version and how many were `reviewed: true` at run time;
- the run JSON saved under `results/` (and committed deliberately);
- the human-labelling kappa and judge-calibration kappa for the run;
- a note on anything excluded (API errors, partial runs).

| Section | Status |
|---|---|
| Scripted eval (88 scenarios × 3) | not run yet |
| Breakdown by language / persona / disruption | not run yet |
| Failure taxonomy counts | not run yet |
| Human labelling (25%, 2 labellers, κ) | not run yet |
| LLM judge calibration | not run yet |
| Real-user test (~60 calls) | not run yet |
| Scripted vs real gap | not run yet |
| ₹ per resolved call vs human baseline | not run yet |

What *has* been verified: the deterministic parts. `npm test` covers the number guard, handoff detector, promise-date parser, state machine, scenario schema/consistency, the turn engine on hand-written drafts, and the runner against a stubbed API. These are code tests, not model results.
