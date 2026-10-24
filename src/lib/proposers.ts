/** Proposers: where the agent's draft reply comes from. Live = Gemini. Demo = hand-written transcript. */

import type { Proposal, Proposer, ProposerContext } from './agent';
import { RESPONSE_SCHEMA, systemPrompt } from './agent';
import { generate, parseJsonLoose, type GeminiContent } from './gemini';
import type { Settings } from './settings';

export function buildContents(ctx: ProposerContext): GeminiContent[] {
  const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: '[CALL CONNECTED — the borrower picked up]' }] }];
  for (const h of ctx.history) {
    const role = h.speaker === 'agent' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last.role === role) last.parts.push({ text: h.text });
    else contents.push({ role, parts: [{ text: h.text }] });
  }
  const userTurn = `${ctx.borrowerText}\n\n${ctx.systemNote}`;
  const last = contents[contents.length - 1];
  if (last.role === 'user') last.parts.push({ text: userTurn });
  else contents.push({ role: 'user', parts: [{ text: userTurn }] });
  if (ctx.rejection) {
    contents.push({ role: 'model', parts: [{ text: ctx.rejection.draft }] });
    contents.push({
      role: 'user',
      parts: [{ text: `[SYSTEM: your previous draft was BLOCKED and not spoken. Reasons: ${ctx.rejection.reasons.join('; ')}. Write a new reply that follows the HARD RULES. Do not include any number that is not on the policy card.]` }],
    });
  }
  return contents;
}

export function geminiProposer(settings: Settings, apiKey: string, signal?: AbortSignal): Proposer {
  return async (ctx) => {
    try {
      const res = await generate({
        apiKey,
        model: settings.model,
        system: systemPrompt(ctx.card),
        contents: buildContents(ctx),
        temperature: settings.temperature,
        thinkingBudget: settings.thinkingBudget,
        responseSchema: RESPONSE_SCHEMA,
        signal,
      });
      return { proposal: parseJsonLoose<Proposal>(res.text), rawText: res.text, latencyMs: res.latencyMs, usage: res.usage };
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      return { proposal: null, rawText: '', latencyMs: 0, usage: { promptTokens: 0, outputTokens: 0, thoughtTokens: 0 }, error: (e as Error).message };
    }
  };
}

/** Replays hand-written agent drafts in order. Guards still run on them for real. */
export function scriptedProposer(drafts: Proposal[]): Proposer {
  let i = 0;
  return async () => {
    const p = drafts[Math.min(i, drafts.length - 1)];
    i++;
    return { proposal: p, rawText: JSON.stringify(p), latencyMs: 0, usage: { promptTokens: 0, outputTokens: 0, thoughtTokens: 0 } };
  };
}
