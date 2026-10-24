# PRD: Kisht, a pre-due EMI reminder voice agent

**Author:** Vishnu Yash Pandey · **Status:** Draft for evaluation, not for launch · **Lender:** Sahayak Finance (**fictional**)

> This PRD is the frame for the real deliverable: an evaluation and a launch decision. Nothing here claims results. Results live in `RESULTS.md` and say "not run yet" until runs exist.

## 1. Users

| User | What they need | What they fear |
|---|---|---|
| **Collections / operations lead at a lender** (primary buyer) | Fewer missed EMIs, fewer human reminder calls for easy cases, and a record of who promised what date. | An AI that says a wrong amount, threatens someone, talks to the wrong person, or creates a regulatory complaint. |
| **Borrower** (person on the call) | A short, polite reminder in the language they speak, the exact amount and date, and how to pay. A human when it's not simple. | Harassment, being pressured, their loan discussed with family, a robot that doesn't understand "8 ko… nahi nahi 10 ko". |
| **Human agent** (receives handoffs) | Clean handoffs with a reason, so they call the right people back. | A flood of unnecessary handoffs. |

## 2. Problem

A pre-due reminder is the cheapest point in the collections funnel: the borrower has not missed anything yet and most just need a nudge and a date. Lenders do this by SMS (easy to ignore) or by human callers (expensive at scale). In Pune and Mumbai, many borrowers code-mix: Hinglish, Marathi-English, and Hindi. Many don't speak English comfortably.

**The job:** make one short call before the due date. Confirm it's the borrower, state the amount and due date, answer a few basic questions, and get a promise-to-pay date. Anything else goes to a human.

## 3. Why AI is necessary here

- **Free-form, code-mixed speech.** Borrowers answer in their own words and switch language mid-sentence ("Mazi salary 8 la yete, 8 ko… nahi, 9 tarkhela bharto"). An IVR keypad tree cannot capture a date said that way.
- **Interruptions and self-corrections.** People talk over the agent and correct themselves. A scripted IVR either loses the turn or makes the caller repeat.
- **Off-script questions mid-flow.** Borrowers ask about interest rates or fees halfway through. The agent has to *recognise* an off-limits question and route it, which needs language understanding, not keyword menus.

## 4. Where AI is the risk (and what we do about it)

| Risk | Why it's dangerous | Control (in code, not the prompt) |
|---|---|---|
| Invents a number (rate, waiver, grace days) | A wrong figure on a loan call is a compliance and trust failure. | **Number guard:** every number/date the agent drafts must be on the policy card or be the code-validated promise date. Otherwise block and retry, then hand off. |
| Misses a handoff (dispute, hardship, wrong person) | Hardship handled by a bot reads as harassment; a dispute ignored becomes a complaint. | **Handoff backstop:** a code detector on borrower turns forces a handoff the model missed. Counted against the model. |
| Records the wrong promise date | Ops follow up on the wrong day. | **Promise parser in code** handles self-corrections and checks the allowed window. The model never sets the date. |
| Discloses to a third party | Privacy breach. | Identity before facts; fixed greeting with no loan facts; guard flags disclosure before identity. |
| Threatens or pressures | Prohibited conduct (RBI guidance). | Lexicon check on every draft; LLM judge only after calibration. |
| Goes off-flow | Unpredictable calls. | **State machine in code**; the model can only propose legal transitions. |

## 5. Scope

**In scope (v0):** one call type (pre-due reminder); one policy card; identity by name only; 3 FAQs (how to pay; late charge per card; date change → handoff); promise-to-pay capture; handoff for everything else; four language varieties; browser voice (Web Speech API) + text; eval runner; human labelling; launch memo.

**Non-goals (deliberately not built):**
- Post-due collections or recovery (different ethics and regulation; stay pre-due).
- Telephony / PSTN integration, dialer, CRM, payment links, SMS sending.
- Real borrower data of any kind. The lender and borrower are fictional.
- Negotiation, settlements, restructuring, fee waivers.
- Native speech-to-speech model in v0 (see DECISIONS.md D3).
- Analytics dashboard beyond what the decision needs.

## 6. Success metrics and launch targets

| Metric | Definition | Target | Severity |
|---|---|---|---|
| Invented numbers heard | Calls where a number not on the card reached the borrower | **0** | Critical |
| Correct handoff (system) | Of calls that should hand off, % that did | **≥ 98%** | Critical |
| Script compliance (model) | Calls with no conduct violation in any draft, even if blocked | **≥ 98%** | Critical |
| Task completion | Outcome matches expected (right promise date / handoff / close) | **≥ 85%** | Major |
| Unnecessary handoff | Of calls that should be resolved, % handed off | **≤ 10%** | Major |
| Consistency pass^k | Scenarios that pass in all k (=3) runs | **≥ 80%** | Major |
| p95 model latency per turn | Model time incl. guard retries | **≤ 2,000 ms** | Minor |
| ₹ per resolved call | Token cost ÷ resolved calls (estimate) | **< human caller cost** (baseline to be collected from a practitioner) | Business |
| Human agreement | Cohen's kappa between two labellers on 25% of calls | **≥ 0.6** before publishing | Evidence quality |
| Real vs scripted gap | Same metrics on ~60 real-user calls | Reported, not targeted | Evidence quality |

Targets are judgment calls for a v0 pilot, set before any run. They live in code (`src/lib/decision.ts`) so the launch memo cannot quietly move them.

## 7. Launch decision rule

- **No-go** if any critical target fails.
- **Not yet: hold failing languages** if a language falls below 85% task completion while others pass ("go for Hinglish, hold Marathi-English" is an allowed outcome).
- **Not yet: evidence incomplete** until scenarios are reviewed, human labels agree (κ ≥ 0.6) and the real-user test is done.
- The app never says "Go" on its own. Vishnu makes that call in `LAUNCH_MEMO.md`.

## 8. Open questions

1. If an angry borrower promises a date *and* says "don't call again", is that a promise or a handoff? (Not encoded; see scenario S011 note.)
2. Should "already paid" be verified by a human (handoff), or closed? v0 closes and records the claim.
3. What does a human reminder call cost a Pune NBFC? Needed before ₹/resolved call means anything.
4. Does Marathi-English matter to Pune/Mumbai lenders, or is Hinglish enough? (Unconfirmed in research; treat as a bet.)
