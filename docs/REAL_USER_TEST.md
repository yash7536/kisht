# Real-user test protocol

**Status: not run yet.**

## Why

Scripted scenarios were drafted with AI assistance and the handoff detector was written alongside them, so scripted results are an optimistic upper bound. The evidence that matters is the **gap between scripted and real-caller performance**. No synthetic-eval repo can show that.

## Who

- **15–20 adults** in Pune (friends, family, neighbours), deliberately including:
  - at least 5 people aged 55+ who code-mix naturally and are not English-dominant;
  - at least 5 comfortable in Marathi-English;
  - a mix of phones and rooms (quiet, street, kitchen).
- Not employees of any lender. No minors.

## Setup

- Each participant gets a **persona card** (fictional; never their own loan): e.g. "You are Ramesh. You'll pay on the 9th because salary comes on the 8th", "You lost your job", "You're Ramesh's wife and he's out", "Ask what the interest rate is", "Interrupt the agent and correct your date".
- Each person makes **3–4 unscripted calls** in the Call Simulator, speaking (browser mic) in their own words. Target **~60 calls**.
- If time runs short, cut Marathi-English from this phase, but **do not cut real users**.
- Settings: same model, prompt, policy card and guards as the scripted run being compared. Record the app version (git SHA).

## Consent script (read aloud, record the "yes")

> "This is a practice project by Vishnu for his portfolio. You'll talk to a computer voice pretending to be a loan reminder call from a **made-up** company. Nothing is real: no real loan, no real money, no real company. Please don't share any real personal details like account numbers, Aadhaar or OTPs. I'd like to **record the audio and the text of the calls** to measure how well the computer understands people. Recordings stay on my laptop, are used only for this project, and will be deleted by [date]. I may quote short anonymised lines in my write-up, never your name or voice. You can stop at any time, and ask me to delete your recordings at any time. Is that okay with you?"

For participants over 60 or less familiar with tech, read it in Hindi/Marathi and confirm understanding.

## What to record per call

| Field | How |
|---|---|
| Participant ID (P01…), age band, primary language | Sheet (no names) |
| Persona card given | Sheet |
| Audio | Screen/audio recorder on the laptop, with consent; store outside the repo (`recordings/` is gitignored) |
| Transcript + guard log | "Download call JSON" in the simulator |
| STT accuracy | Afterwards, compare browser STT text with what the person actually said (manual transcript of the audio) → word error notes, esp. numbers and dates |
| Outcome vs persona expectation | Same rubric as scripted |
| Post-call Q1 | "Would you have hung up? When?" (free text + turn number) |
| Post-call Q2 | "How much would you trust this call?" 1–5 |

## Scoring

- Score each call with the **same rubric** (task completion, script compliance, invented numbers, handoff correctness, promise date, latency). Two labellers on all real calls (only ~60).
- Report separately: **STT errors** (wrong words) vs **agent errors** given correct text. A real call can fail because the browser misheard "das" as "do", which is not the model's fault but still the product's.

## Comparison with scripted results

Table per metric: scripted (k=3, matching personas) vs real users, with n for each. Highlight:
- metrics where real < scripted by > 10 points;
- failure categories that appear only in real calls (likely STT, barge-in, unexpected phrasing);
- hang-up points and trust scores by language.

The launch memo's language-level decision ("go Hinglish, hold Marathi-English") should rest on this table.

## Ethics and data handling

- Fictional lender, fictional loans; participants role-play.
- No real personal data collected; if someone volunteers real details, delete that segment.
- Audio and transcripts are stored locally, never committed, and deleted by the stated date.
- Quotes in the write-up are anonymised and short.
