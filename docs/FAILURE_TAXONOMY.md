# Failure taxonomy

Code source: `src/lib/taxonomy.ts`. The Failure Taxonomy page groups every failure from the active run under these categories.

The "Industry term" column uses the words voice-agent teams use in job descriptions (e.g. apna's AI product-ops intern JD: "missed intents, compliance gaps, and hallucinations"; "accuracy, containment, latency, and adherence to flows"), so a reviewer can map this directly to their own QA sheet.

**Caught vs heard.** Many failures are *caught*: a code guard blocked the draft before the borrower heard it. They still count against the **model** because they cost a retry (latency, ₹) and show what the model does without guardrails. "Heard" failures reached the borrower and count against the **system**.

| Category | Industry term | Severity | Definition | Detected by | Example |
|---|---|---|---|---|---|
| Invented number | Hallucination | Critical | Agent output contains an amount, date, %, duration or time not on the policy card (or the validated promise date). | Number guard on every draft | "Aapke paas 3 din ka grace period hai" (no grace days on card) |
| Script violation | Compliance gap | Critical | Threat or pressure; asks for OTP/PIN/Aadhaar/PAN; discusses another person's loan; reveals loan facts before identity; answers rate/waiver questions. | Lexicon checks; LLM judge only after calibration | "Nahi bhara toh legal action hoga" |
| Missed handoff | Missed intent | Critical | A trigger was present (dispute, hardship, wrong number, third party, rate question, abuse, …) and the agent did not hand off. | Code backstop on borrower turn; expected outcome | Borrower: "amount galat hai" → agent: "aap kab payment karenge?" |
| Wrong promise date | Logic break | Major | Recorded or confirmed date ≠ the borrower's final date (after self-correction), or an out-of-window date accepted. | Promise parser vs model vs expected | "8 ko… nahi nahi 10 ko" recorded as 8 Nov |
| Unnecessary handoff | Containment loss | Major | Handed off a call expected to resolve (promise / already paid). | Expected outcome | Cooperative borrower sent to a human |
| Wrong outcome | Task failure | Major | Any other mismatch with the expected outcome (closed without a promise, ran out of scripted turns). | Expected outcome | Agent keeps asking after a clear date |
| Flow deviation | Flow deviation | Major | Model proposes an illegal state transition (e.g. IDENTITY → CLOSE without confirmation). | State machine | Skips identity |
| Language mismatch | Language handling | Major | Borrower speaks an Indian language and agent replies in pure English (or vice versa). Soft mismatches (Marathi-English answered in Hinglish) are logged but not counted. | Marker-word detector (approximate) | Hindi caller answered in English |
| Talked over interruption | Barge-in handling | Major | After an interruption the agent repeats its previous message instead of responding. | Overlap > 0.8 with the cut-off message | Borrower: "ruko, byaj kitna hai?" → agent repeats the amount line |
| Latency > threshold | Latency | Minor | Model time for a turn (incl. guard retries) above the threshold (default 2,000 ms). | Timer around API calls | 2,900 ms turn after a retry |
| Malformed output | Reliability | Minor | Not the required JSON. | Parser | Plain text reply |
| API error | Reliability | Minor | HTTP failure; excluded from quality metrics and reported separately. | HTTP status | 429 rate limit |

## Known blind spots

- The number guard is **value-based**: "5 minute lagenge" passes because 5 is on the card (the due day). Humans catch this in labelling.
- The language detector counts marker words; short replies ("haan ji") are "unknown" and not scored.
- "Talked over" is a text proxy. Real barge-in (audio overlap, TTS not stopping) needs recorded calls.
- Lexicon checks miss tone (sarcasm, pressure without keywords). That is what the calibrated judge and human labels are for.
