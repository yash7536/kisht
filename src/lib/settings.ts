/**
 * Settings. The API key is NEVER written to localStorage, logs, exported JSON or the repo.
 * It lives in module memory; the user may opt in to sessionStorage (cleared when the tab closes).
 */

export interface Settings {
  model: string;
  temperature: number;
  /** -1 = model default; 0 = thinking off (where the model allows it). */
  thinkingBudget: number;
  runsPerScenario: number;
  concurrency: number;
  /** USD per 1M input tokens. ESTIMATE: verify on ai.google.dev/pricing before quoting. */
  priceInPerM: number;
  /** USD per 1M output tokens (thinking tokens are billed as output). ESTIMATE. */
  priceOutPerM: number;
  usdToInr: number;
  latencyThresholdMs: number;
  enforceCallingHours: boolean;
  sttLang: 'hi-IN' | 'en-IN' | 'mr-IN';
  speakReplies: boolean;
  judgeKappaThreshold: number;
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'gemini-2.5-flash',
  temperature: 0.3,
  thinkingBudget: 0,
  runsPerScenario: 3,
  concurrency: 2,
  priceInPerM: 0.3,
  priceOutPerM: 2.5,
  usdToInr: 88,
  latencyThresholdMs: 2000,
  enforceCallingHours: true,
  sttLang: 'hi-IN',
  speakReplies: true,
  judgeKappaThreshold: 0.6,
};

const SETTINGS_KEY = 'kisht.settings.v1';
const SESSION_KEY = 'kisht.byok.session';

let memoryKey = '';

export function getApiKey(): string {
  if (memoryKey) return memoryKey;
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (s) memoryKey = s;
  } catch { /* storage blocked */ }
  return memoryKey;
}

export function setApiKey(key: string, rememberInTab: boolean): void {
  memoryKey = key.trim();
  try {
    if (rememberInTab && memoryKey) sessionStorage.setItem(SESSION_KEY, memoryKey);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* storage blocked */ }
}

export function clearApiKey(): void {
  memoryKey = '';
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function isKeyInSession(): boolean {
  try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export interface Usage {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
}

export function costInr(u: Usage, s: Pick<Settings, 'priceInPerM' | 'priceOutPerM' | 'usdToInr'>): number {
  const usd = (u.promptTokens * s.priceInPerM + (u.outputTokens + u.thoughtTokens) * s.priceOutPerM) / 1e6;
  return usd * s.usdToInr;
}
