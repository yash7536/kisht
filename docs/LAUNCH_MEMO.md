# Launch memo: Kisht pre-due EMI reminder agent

> **Template. Results sections say "not run yet" until real runs exist.** The app's Launch Memo page fills the same structure from the active run and exports it as Markdown; paste that export here. Lender is fictional (Sahayak Finance). Scenarios drafted with AI assistance; reviewed by Vishnu before results are published.

**Author:** Vishnu Yash Pandey · **Date:** _fill_ · **Model:** _fill (default gemini-2.5-flash)_ · **App version:** _git SHA_

---

## 1. Decision

**Current: Not yet. Evals not run.**

Allowed decisions (choose one when evidence exists):
- **Go** for all four language varieties, as a supervised pilot.
- **Go for Hinglish (+ English) only; hold Marathi-English / Devanagari** until the failing categories below are fixed.
- **No-go**, with the blocking failure categories named.

Decision rule (fixed before any run, PRD §7): any critical gate failing → No-go. A language below 85% task completion → hold that language. "Go" also requires: all scenarios reviewed, human κ ≥ 0.6, real-user test run.

## 2. Evidence

### 2.1 Scripted eval: not run yet

| Gate | Target | Actual | Result |
|---|---|---|---|
| Invented numbers heard by borrower | = 0 | not run yet | — |
| Correct handoff (system) | ≥ 98% | not run yet | — |
| Script compliance (model drafts) | ≥ 98% | not run yet | — |
| Task completion | ≥ 85% | not run yet | — |
| Unnecessary handoff | ≤ 10% | not run yet | — |
| Consistency (pass^3) | ≥ 80% | not run yet | — |
| p95 model latency per turn | ≤ 2,000 ms | not run yet | — |
| ₹ per resolved call (estimate) | < human baseline | not run yet | baseline not collected |

### 2.2 By language: not run yet
### 2.3 Top failure categories (from FAILURE_TAXONOMY.md): not run yet
### 2.4 Human labelling (25%, two labellers, Cohen's κ): not run yet
### 2.5 LLM judge calibration (script compliance only): not run yet
### 2.6 Real-user test (15–20 people, ~60 calls) vs scripted: not run yet
### 2.7 Unit economics: not run yet

₹ per resolved call = token cost (estimated from configured prices) ÷ calls resolved without a human. It means nothing until compared with what a human reminder call costs a lender, which should come from a practitioner interview, not a guess.

## 3. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Scripted borrowers ≠ real borrowers | AI-drafted lines; detector co-written with them → optimistic recall | Real-user test; report the gap |
| Text pipeline hides STT errors | Browser STT on code-mixed, noisy 8 kHz audio is unmeasured | Score STT separately on recordings |
| Guard false negatives | Value-based number guard; unusual spellings | 25% human labelling |
| Conduct rules interpreted, not certified | Drawn from public RBI circulars; newer 2025 Directions not read | Lender compliance review; practitioner critique |
| Model / price drift | Behaviour and per-token prices change | Pin model; re-run on change |

## 4. What must be true to launch

- [ ] Zero invented numbers reach the borrower across all runs
- [ ] No missed handoffs in any language (system level)
- [ ] All scenarios reviewed by Vishnu (`reviewed: true`)
- [ ] Two human labellers on 25% of calls, κ ≥ 0.6
- [ ] Real-user test run; scripted vs real gap understood per language
- [ ] ₹ per resolved call below the human-caller cost (practitioner baseline)
- [ ] Lender compliance sign-off on script and policy card
- [ ] A practitioner (NBFC ops or voice-AI PM) has critiqued the rubric (quote their feedback)
