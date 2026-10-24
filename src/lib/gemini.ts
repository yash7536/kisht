/**
 * Minimal Gemini REST client (BYOK). The browser calls Google directly; there is no Kisht server.
 * The key goes in the x-goog-api-key header (not the URL) so it does not land in URL logs/history.
 */

import type { Usage } from './settings';

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiRequest {
  apiKey: string;
  model: string;
  system: string;
  contents: GeminiContent[];
  temperature: number;
  thinkingBudget: number;
  responseSchema?: unknown;
  signal?: AbortSignal;
}

export interface GeminiResponse {
  text: string;
  usage: Usage;
  latencyMs: number;
  attempts: number;
}

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function scrub(msg: string, key: string): string {
  return key ? msg.split(key).join('[key]') : msg;
}

export async function generate(req: GeminiRequest, fetchImpl: typeof fetch = fetch): Promise<GeminiResponse> {
  if (!req.apiKey) throw new GeminiError('No API key set. Add your own Gemini key in Settings.', 0);
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature,
    responseMimeType: 'application/json',
  };
  if (req.responseSchema) generationConfig.responseSchema = req.responseSchema;
  if (req.thinkingBudget >= 0 && /2\.5|3/.test(req.model)) generationConfig.thinkingConfig = { thinkingBudget: req.thinkingBudget };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.contents,
    generationConfig,
  });

  let attempts = 0;
  let lastErr: GeminiError | null = null;
  while (attempts < 4) {
    attempts++;
    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(req.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.apiKey },
        body,
        signal: req.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new GeminiError(scrub(`Network error: ${(e as Error).message}`, req.apiKey), 0);
    }
    const latencyMs = performance.now() - t0;
    if (res.status === 429 || res.status >= 500) {
      lastErr = new GeminiError(`Gemini returned ${res.status} (rate limit or server error)`, res.status);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempts));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } }).error?.message ?? res.statusText;
      throw new GeminiError(scrub(`Gemini error ${res.status}: ${msg}`, req.apiKey), res.status);
    }
    const cand = (json as any).candidates?.[0];
    const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    const um = (json as any).usageMetadata ?? {};
    return {
      text,
      latencyMs,
      attempts,
      usage: {
        promptTokens: um.promptTokenCount ?? 0,
        outputTokens: um.candidatesTokenCount ?? 0,
        thoughtTokens: um.thoughtsTokenCount ?? 0,
      },
    };
  }
  throw lastErr ?? new GeminiError('Gemini request failed', 0);
}

/** Parse a JSON object from model text, tolerating code fences. */
export function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { return null; }
    }
    return null;
  }
}
