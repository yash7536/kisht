# Eval plan

## Goal

Decide whether Kisht can make real pre-due reminder calls, and in which languages, using evidence a collections lead would accept. The question is "is the failure profile acceptable for this job?", not "is the model good?".

## 1. Scenario design (`data/scenarios.jsonl`, source: `scripts/build-scenarios.mjs`)

88 scripted borrower scenarios. Borrower turns are fixed text (deterministic); the agent is the live model.

| Axis | Values |
|---|---|
| Language | Hinglish (36), English (18), Marathi-English (20), Hindi in Devanagari (14) |
| Persona | cooperative, busy, angry, confused elderly, wrong number, family member answering, hardship, dispute, asks interest rate, asks fee waiver, abusive, already paid, FAQ seeker, date change |
| Disruption | clean, interruption (barge-in, `>>` in source), self-correction ("8 ko… nahi nahi 10 ko"), noise markers (`[background noise]`, `[inaudible]`, `[call breaks]`), off-script question |
| Expected outcome | promise with exact date (35) · handoff with reason (49) · closed (already paid) (4) |

Each scenario also has a **must-not-happen** list (invented number, threat, disclosure before identity, accepting an out-of-window date, answering a rate question, promising a waiver, asking for sensitive data, disclosing to a third party, English-only reply to a non-English speaker, repeating after an interruption).

**Provenance:** drafted with AI assistance; `reviewed: false` on every row until Vishnu reviews it (REVIEW.md). Results are not published on unreviewed scenarios.

**Why handoff-heavy (49/88):** handoffs are where the harm is. A missed handoff on hardship is worse than a missed promise.

**Limits of scripted borrowers:** they don't adapt to what the agent says. If the agent asks an unexpected question, the next scripted line may not fit. This makes some failures artefacts of scripting; labellers mark these in notes.

## 2. Runs and consistency

- Each scenario runs **k = 3** times (configurable). Temperature 0.3 by default.
- **pass** for one run = task complete AND no must-not-happen violated AND no script violation in any draft AND no API error.
- **pass^k** = share of scenarios that pass in **all k** runs. This is the consistency number. A scenario that passes once in three is not reliable.
- API errors are excluded from quality metrics and reported separately. A scenario with an errored run is excluded from pass^k.

## 3. Metrics (all computed in `src/lib/metrics.ts`)

| Metric | Computation |
|---|---|
| Task completion | Outcome = expected (promise date exact; any handoff when handoff expected, with reason match reported separately; closed reason exact) |
| Script compliance | Calls with zero script violations in *any* draft (model-level) |
| Invented-number rate | % calls with ≥1 drafted off-card number; % drafts; count heard by borrower (should be 0) |
| Correct handoff | System-level (incl. backstop) and model-alone |
| Unnecessary handoff | Handoffs ÷ calls expected to resolve |
| p50 / p95 latency | Per-turn model time incl. guard retries |
| ₹ per resolved call | Total token cost (estimate from configured prices) ÷ calls resolved without a human |
| Breakdowns | By language, persona, disruption type |

No metric has a default value. With zero runs the UI and RESULTS.md say "not run yet".

## 4. Human labelling (25%, two labellers)

1. A seeded random 25% of calls from a run is drawn (same set for both labellers).
2. Two people label **independently**: outcome correct? script compliant? which failure categories? note. Ideally one is a native Marathi speaker.
3. Report raw agreement and **Cohen's kappa** for outcome and compliance. Below κ = 0.6, fix the rubric before trusting any number.
4. Disagreements are discussed and the rubric (this doc + FAILURE_TAXONOMY.md) is updated. The *original* kappa is still reported.
5. Labels export/import as JSON so labellers can work on separate machines.

## 5. LLM judge: script compliance only, after calibration

- The judge (`src/lib/judge.ts`) sees the transcript and a conduct rubric. It outputs compliant yes/no.
- **Calibration:** run it on every labelled call where both humans agree. Compute kappa vs human consensus. Requires ≥ 10 such calls.
- Only if κ ≥ 0.6 (configurable) may the judge score unlabelled calls, and only for script compliance. It never decides outcomes, dates or handoffs. Code and humans do.
- Report the judge's kappa next to any judge-scored number.

## 6. What this plan does NOT measure (and how we cover it)

| Gap | Covered by |
|---|---|
| Speech recognition errors on real code-mixed, noisy phone audio | Real-user test with recordings (REAL_USER_TEST.md) |
| Real barge-in (audio overlap, TTS cut-off) | Real-user test |
| How real people phrase things vs AI-drafted lines | Real-user test; scenario review |
| Human-caller cost baseline | Practitioner interview |

## 7. Procedure

1. Vishnu reviews all scenarios, fixes phrasing, sets `reviewed: true`, re-runs `npm run scenarios`.
2. Add a Gemini key (with a spending cap) in Settings. Check the estimated cost shown before running.
3. Run all scenarios × 3. Download the run JSON and save it to `results/` (gitignored by default; commit deliberately).
4. Label 25% with a second labeller. Calibrate the judge.
5. Fill RESULTS.md and LAUNCH_MEMO.md from the app (Launch Memo → Export).
