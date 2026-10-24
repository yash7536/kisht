# Policy card: Sahayak Finance (FICTIONAL)

> **Sahayak Finance is a fictional lender created for this project. Ramesh Patil is a fictional borrower. No real company, loan or person is represented.** Check before publishing that no real lender uses this exact name in a way that could confuse readers (see REVIEW.md).

The policy card is the **only** source of facts the agent may state. Code source: `src/lib/policyCard.ts`.

## Facts

| Field | Value |
|---|---|
| Lender | Sahayak Finance (fictional) |
| Borrower (identity check only) | Ramesh Patil |
| Product | Personal loan |
| EMI amount due | ₹4,250 |
| Due date | 5 November 2026 |
| Simulated call date | Monday 2 November 2026 |
| Promise window (no human needed) | 2–10 November 2026 inclusive |
| Late payment charge | ₹350 (as per the loan agreement) |
| How to pay | Sahayak Finance app → "Pay EMI"; UPI link sent by SMS from Sahayak Finance; any Sahayak Finance branch |
| Calling hours | 08:00–19:00 local time |

## The three allowed FAQs

1. **How do I pay?** → the three payment methods above.
2. **What happens if I pay late?** → "A late payment charge of ₹350 applies after the due date (as per the loan agreement). For anything else about charges, a team member will call back." (Deliberately no credit-bureau statement, so a factual consequence can't be delivered as a threat. See DECISIONS.md D7.)
3. **Can I change the EMI date?** → "Not on this call; a team member will call back." → **handoff**.

## Conduct rules and where they come from

Rules marked **[RBI]** are drawn from public RBI circulars (quotes verified via fetch on 24 Oct 2026; see SOURCES.md). Rules marked **[Design]** are this product's choices, not regulatory claims.

| # | Rule | Basis |
|---|---|---|
| C1 | Never use intimidation or harassment, verbal or physical; no threatening calls. | **[RBI]** RBI/2022-23/108, 12 Aug 2022: REs and agents must not "resort to intimidation or harassment of any kind, either verbal or physical", including "making threatening and/ or anonymous calls". |
| C2 | Call only between **08:00 and 19:00**. | **[RBI]** Same circular prohibits "calling the borrower before 8:00 a.m. and after 7:00 p.m. for recovery of overdue loans". That text covers *overdue* recovery; Kisht is *pre-due*, so we apply the same window as a stricter design choice. |
| C3 | Do not intrude on the privacy of family members, referees or friends; never disclose loan details to anyone but the borrower. | **[RBI]** Same circular: no acts that "intrude upon the privacy of the debtors' family members, referees and friends". Name-only identity check + handoff on third party is **[Design]**. |
| C4 | No false or misleading representations: never state a number not on the card. | **[RBI]** Same circular lists "making false and misleading representations". The number guard is **[Design]**. |
| C5 | No persistent calling / bothering at odd hours. | **[RBI]** Master Circular – Fair Practices Code (NBFCs), 1 Jul 2015, recovery: no "undue harassment viz. persistently bothering the borrowers at odd hours". One call per cycle is **[Design]**. |
| C6 | Communicate in the borrower's language. | **[RBI]** Same Master Circular: communications "in the vernacular language or a language as understood by the borrower". Mirroring the caller's code-mix is **[Design]**. |
| C7 | Staff handling recovery must be trained to treat customers with care and sensitivity; calls recorded. | **[RBI]** RBI/2007-2008/296, 24 Apr 2008 (banks): agents "properly trained to handle with care and sensitivity"; "tape recording of the content / text of the calls". Our analogue: every call is logged turn by turn; hardship → human. |
| C8 | Say the call is automated. | **[Design]** Not claimed as an RBI rule. |
| C9 | Never ask for OTP, PIN, Aadhaar, PAN, account numbers, date of birth. | **[Design]** (fraud-safety norm). |
| C10 | Never discuss anyone else's loan. | **[Design]**, consistent with C3. |

**Caveat to verify:** RBI has since issued *Reserve Bank of India (Non-Banking Financial Companies – Responsible Business Conduct) Directions, 2025* (page updated 1 Jul 2026), which may consolidate or supersede the 2015 Master Circular. Its PDF was behind a captcha and **was not read**. Vishnu must check it before citing C5/C6 as current.

## Handoff triggers (handoff-first)

Wrong number · someone else answered · dispute about amount/loan · interest-rate question · fee waiver request · hardship (job loss, illness, no money) · abuse · complaint / legal / regulator mention · bereavement · asks for a human · asks not to be called · asks for a callback · wants to change the date · promise date outside the window · identity unclear after 2 tries · guard blocked the model twice · API failure.
