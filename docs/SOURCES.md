# Sources

Fetched or searched on 24 Oct 2026. "Verified" = page text fetched and the cited lines read. "Search only" = located via search, not read.

## Regulatory (conduct rules in POLICY_CARD.md)

1. **RBI/2022-23/108, DOR.ORG.REC.65/21.04.158/2022-23 (12 Aug 2022). "Outsourcing of Financial Services – Responsibilities of regulated entities employing Recovery Agents."** Verified. Prohibits intimidation or harassment "of any kind, either verbal or physical"; intruding on the privacy of family, referees and friends; inappropriate messages; "threatening and/ or anonymous calls"; persistent calls; "calling the borrower before 8:00 a.m. and after 7:00 p.m. for recovery of overdue loans"; false and misleading representations. https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12378
2. **Master Circular – Fair Practices Code, RBI/2015-16/16, DNBR (PD) CC.No.054/03.10.119/2015-16 (1 Jul 2015), for NBFCs.** Verified. §2.A(i)(a): communications "in the vernacular language or a language as understood by the borrower"; §2.A(iv)(c): no "undue harassment viz. persistently bothering the borrowers at odd hours, use muscle power for recovery of loans etc."; grievance redressal §2.A(v)–(vi). https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=9823
3. **RBI/2007-2008/296, DBOD.No.Leg.BC.75/09.07.005/2007-08 (24 Apr 2008). "Recovery Agents engaged by Banks."** Verified (via summary). Agents "properly trained to handle with care and sensitivity"; "tape recording of the content / text of the calls"; no "intimidatory and questionable methods". https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=4141
4. **Reserve Bank of India (Non-Banking Financial Companies – Responsible Business Conduct) Directions, 2025** (listing page updated 1 Jul 2026). **Not read**: the PDF returned a captcha. May consolidate/supersede #2. Must be checked. https://rbi.org.in/SCRIPTS/BS_ViewMasDirections.aspx?id=12942
5. News coverage of #1 (search only): Business Standard, "RBI directs loan recovery agents not to intimidate borrowers; no calling before 8am, after 7pm". https://www.business-standard.com/amp/article/finance/rbi-directs-loan-recovery-agents-not-to-intimidate-borrowers-no-calling-before-8am-after-7pm-122081201144_1.html

## Model and pricing

6. Gemini 2.5 Flash paid-tier price, $0.30 / 1M input and $2.50 / 1M output tokens, from a third-party page that says it checked Google's pricing on 21 Aug 2026 (verified the page, **not** Google's own page, which was not reachable from this environment). Used only as editable defaults, labelled as estimates. https://www.morphllm.com/gemini-api-pricing
7. Gemini thinking docs. Thinking tokens are priced with output. The fetched page now documents a newer Interactions API (`thinking_level`); the `generationConfig.thinkingConfig.thinkingBudget` field used here is the v1beta generateContent form and **should be re-checked**. Setting thinking budget to -1 in Settings omits it. https://ai.google.dev/gemini-api/docs/thinking

## Product / market context (from the research report in this project's brief)

8. Bolna (YC) on mid-call language switching and cost per call: https://www.ycombinator.com/launches/OVc-bolna-voice-ai-for-india
9. apna AI product-ops intern JD ("missed intents, compliance gaps, and hallucinations"; "accuracy, containment, latency, and adherence to flows"): https://jobs.insightpartners.com/companies/apna/jobs/71951193-intern-ai-product-operations-solutions-delivery-team
10. Navana.ai (voice AI for regulated lenders, incl. an evaluation platform): https://india.entrepreneur.com/business-news/voice-ai-startup-navana-ai-raises-inr-40-cr-series-a
11. CXOToday on Indian voice-AI infrastructure (code-mixing, telephony audio, cost multiples): https://cxotoday.com/special-reports/voice-ai-is-the-new-interface-but-is-indias-infrastructure-ready/
12. The Ken on customers interrupting scripted calls to ask about interest rates (partly paywalled): https://the-ken.com/story/voice-ai-has-gone-from-whisper-to-commotion-can-the-market-get-any-louder/
13. Existing Hinglish voice-eval repos whose admitted gaps this project targets (synthetic TTS, unreviewed Hinglish, no barge-in): https://github.com/Lingikaushikreddy/indicorderbench · https://github.com/Shashank-VK/indic-voice-agent-eval

## Web platform

14. Web Speech API (SpeechRecognition / SpeechSynthesis). Availability varies by browser; the app feature-detects and falls back to typing.
