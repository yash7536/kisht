# Decisions log

Format: **decision / what it cost / why.** Ordered roughly by how much they shape the product.

### D1. Fixed policy card instead of free answers
- **Decision:** the agent may state only facts on a short policy card (amount, due date, late charge, payment methods, window). Everything else hands off.
- **Cost:** the agent can't answer many reasonable questions (interest rate, foreclosure, statement). More handoffs, lower containment.
- **Why:** on a loan call, a confident wrong figure is worse than "a team member will call you". It also makes "invented number" checkable in code: if a number isn't on the card, it's invented.

### D2. Handoff-first
- **Decision:** when in doubt, hand off. 18 handoff reasons; 49 of 88 scenarios expect a handoff.
- **Cost:** containment (calls resolved without a human) is lower than a bolder agent's. Unnecessary handoffs are tracked so this cost is visible.
- **Why:** the harms are asymmetric. A missed hardship or third-party handoff can be a complaint or a privacy breach; an unnecessary handoff is one extra human call.

### D3. Text pipeline + browser STT/TTS, not a native audio model (v0)
- **Decision:** borrower speech → browser SpeechRecognition (hi-IN / en-IN / mr-IN) → text → Gemini → guards → browser SpeechSynthesis.
- **Cost:** higher end-to-end latency than speech-to-speech; browser STT quality on code-mixed and noisy audio is uncertain; no real barge-in detection (we stop TTS when the user starts speaking, approximately).
- **Why:** every guard (number, handoff, promise date) needs text. With a native audio model the agent's words would reach the borrower before code could check them. The text pipeline makes the eval reproducible (scripted text turns) and free to demo. Research flagged Gemini's real-time audio on Marathi-English as unverified; spike it later and compare against this baseline.

### D4. The model proposes, code decides
- **Decision:** the model returns JSON (reply, intent, proposed next state). Code owns the state machine, the promise date, the number guard and the handoff backstop. A blocked draft gets one retry, then a fixed handoff line.
- **Cost:** more engineering; an extra round-trip on retries (latency and ₹); more rigid flows.
- **Why:** makes failure modes measurable and bounded. Model-level failures (what it tried) are reported separately from system-level outcomes (what the borrower heard).

### D5. Promise date parsed in code, given to the model as a note
- **Decision:** code parses the borrower's date (incl. "8 ko… nahi nahi 10 ko") and tells the model whether it's VALID / OUTSIDE_WINDOW. The only non-card number the agent may say is that validated date.
- **Cost:** the eval measures the model's *following* of the parsed date more than its own understanding. Parser coverage is limited to patterns written so far.
- **Why:** a wrong date silently corrupts ops follow-ups. Deterministic, testable parsing beats trusting the model.

### D6. The handoff detector is hidden from the model
- **Decision:** the model is not told what the code detector found; the detector only acts as a backstop.
- **Cost:** some handoffs are forced with a fixed line instead of a natural one.
- **Why:** otherwise "correct handoff (model alone)" would just measure the detector. Hiding it keeps the model metric honest.

### D7. No credit-bureau statement in the late-payment FAQ
- **Decision:** the late FAQ states only the ₹350 charge.
- **Cost:** borrowers aren't told a real consequence.
- **Why:** a factual consequence ("may affect your credit score") is easily delivered as pressure, which is exactly the conduct we're testing against. A lender's compliance team should decide the wording.

### D8. BYOK, browser-only, no backend
- **Decision:** the user pastes their own Gemini key; it lives in memory (optionally sessionStorage), goes only to Google in a header, and is never logged, exported or committed.
- **Cost:** reviewers need their own key to run live; keys in browsers can leak via extensions; no server-side rate limiting.
- **Why:** zero hosting cost, nothing to secure server-side, no shared key to abuse on a public demo. Demo mode without a key replays hand-written transcripts, labelled as such.

### D9. Word numerals need a unit marker; digits always count
- **Decision:** "do", "ek", "saath" count as numbers only next to hazaar / rupaye / tareekh / a month / %; digits always count.
- **Cost:** misses some spoken numbers without units; value-based checking lets "5 minute" through.
- **Why:** "de do", "ek baar", "aapke saath" are ordinary words. Without context rules the guard would block normal Hindi.

### D10. Scripted borrowers, live agent, k = 3
- **Decision:** borrower lines are fixed; only the agent varies; each scenario runs 3×.
- **Cost:** scripted borrowers don't adapt, so some failures are artefacts. 3× cost.
- **Why:** reproducibility and a consistency number (pass^3). Real adaptiveness is tested with real users instead.

### D11. Fixed greeting and handoff lines
- **Decision:** the opening (automated disclosure + name check) and code-forced handoff lines are templates per language.
- **Cost:** less natural; four languages to maintain.
- **Why:** the two riskiest moments, before identity and when handing off, should never depend on generation.

### D12. Pre-due only
- **Decision:** reminders before the due date; no overdue collections.
- **Cost:** smaller market slice; less dramatic demo.
- **Why:** keeps the project clear of debt-recovery ethics while still exercising the same conduct rules.
