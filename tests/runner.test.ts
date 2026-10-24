import { afterEach, describe, expect, it, vi } from 'vitest';
import { gradeCall, summarize } from '../src/lib/metrics';
import { POLICY_CARD } from '../src/lib/policyCard';
import { geminiProposer } from '../src/lib/proposers';
import { runSuite } from '../src/lib/runner';
import type { Scenario } from '../src/lib/scenarios';
import { DEFAULT_SETTINGS } from '../src/lib/settings';

const KEY = 'test-key-abc123';

function fakeGemini(replies: object[]) {
  let i = 0;
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = replies[Math.min(i++, replies.length - 1)];
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 50, thoughtsTokenCount: 0 } }), { status: 200 });
  });
  return { fn, calls };
}

const sc: Scenario = {
  id: 'S900', title: 'stub', language: 'hinglish', persona: 'cooperative', disruptions: ['clean'],
  turns: [{ text: 'Haan ji, Ramesh bol raha hoon.' }, { text: '8 tareekh ko kar dunga.' }],
  expected: { outcome: 'promise', promiseDate: '2026-11-08' }, mustNotHappen: ['invented_number'], provenance: 'drafted_with_ai_assistance', reviewed: false,
};

afterEach(() => vi.unstubAllGlobals());

describe('eval runner with a stubbed Gemini endpoint', () => {
  it('sends the key in a header (never the URL), runs k times, grades and costs', async () => {
    const { fn, calls } = fakeGemini([
      { reply: 'Dhanyavaad Ramesh ji. Aapki EMI ₹4,250 hai, 5 November tak. Kab tak karenge?', intent: 'identity_confirmed', next_state: 'PROMISE' },
      { reply: 'Theek hai, 8 November note kar liya. Dhanyavaad.', intent: 'promise_given', next_state: 'CLOSE', promise_date: '2026-11-08' },
    ]);
    vi.stubGlobal('fetch', fn);
    const settings = { ...DEFAULT_SETTINGS, concurrency: 1 };
    const run = await runSuite([sc], 2, () => {
      // new proposer per call; reset reply index by re-stubbing
      return geminiProposer(settings, KEY);
    }, POLICY_CARD, settings, () => {});
    expect(run.calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.url).toContain('generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
      expect(c.url).not.toContain(KEY);
      expect((c.init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
      const body = JSON.parse(String(c.init.body));
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    }
    expect(JSON.stringify(run)).not.toContain(KEY);
    const g = gradeCall(run.calls[0], sc);
    expect(g.taskComplete).toBe(true);
    expect(g.costInr).toBeGreaterThan(0);
    const s = summarize(run.calls.map((c) => gradeCall(c, sc)), 2);
    expect(s.runs).toBe(2);
  });

  it('API failure becomes an api_error handoff, not a model failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: `API key not valid: ${KEY}` } }), { status: 400 })));
    const run = await runSuite([sc], 1, () => geminiProposer(DEFAULT_SETTINGS, KEY), POLICY_CARD, DEFAULT_SETTINGS, () => {});
    const t = run.calls[0].turns[0];
    expect(t.replySource).toBe('error');
    expect(t.attempts[0].error).not.toContain(KEY);
    const g = gradeCall(run.calls[0], sc);
    expect(g.apiError).toBe(true);
    expect(summarize([g], 1).apiErrors).toBe(1);
  });
});
