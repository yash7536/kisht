# Review checklist (Vishnu)

Scenarios and copy were **drafted with AI assistance**. Nothing below is published as a result until each box is ticked by Vishnu.

## A. Scenarios (`scripts/build-scenarios.mjs` → `npm run scenarios`)

For each of the 88 scenarios:
- [ ] **Natural phrasing:** would a real Pune/Mumbai borrower say this? Fix stilted Hinglish/Marathi. Get a native Marathi speaker to check all 20 Marathi-English rows and a Hindi reader for the 14 Devanagari rows.
- [ ] **Expected outcome is right** (promise date / handoff reason / closed). Pay special attention to:
  - S003, S005, S035, S036: self-corrections and numerals
  - S011: angry + promise (open policy question in the note)
  - S030: "paid… no wait, that was last month": expected promise 7 Nov
  - S037–S054 (English): realistic for Indian-English speakers?
  - `date_outside_window` rows S034, S073
  - S069 Marathi abuse row ("Gappa bas, baklya"): natural? enough?
  - S074 Marathi→Hindi code-switch mid-utterance
- [ ] **Must-not-happen list** makes sense for the persona.
- [ ] Set `reviewed: true` in the generator (per row), regenerate, commit.
- [ ] Add 10+ scenarios **you** write from real conversations you've heard (not AI-drafted); mark provenance accordingly (extend the schema with `written_by_vishnu`).

## B. Policy and sources

- [ ] Read RBI *NBFC – Responsible Business Conduct Directions, 2025* (`docs/SOURCES.md` #4) and update POLICY_CARD.md rules C5/C6 if the 2015 circular is superseded.
- [ ] Re-read the three verified circulars yourself; make sure every quoted phrase is exact.
- [ ] Check no real lender trades as "Sahayak Finance" in a way that could confuse readers; rename if needed (one constant in `src/lib/policyCard.ts` + templates).
- [ ] Decide the S011 policy (promise + "don't call me").

## C. Model and cost

- [ ] Verify Gemini prices on Google's own pricing page and today's USD→INR; update Settings defaults.
- [ ] Confirm `thinkingConfig.thinkingBudget: 0` is accepted by the current API for your model; else set -1.
- [ ] Do a 5-scenario smoke run before the full 88 × 3.

## D. Before publishing any number

- [ ] Full run saved to `results/` with model id, date, git SHA.
- [ ] 25% double-labelled; kappa reported; judge calibrated or explicitly not used.
- [ ] Real-user test done (or the memo states it isn't).
- [ ] README screenshots from the **real app with real results**, not Stitch mockups.
- [ ] Portfolio copy says "fictional lender", "AI-drafted scenarios reviewed by me", and gives n for every percentage.
