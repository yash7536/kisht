/** Eval runner: scripted borrower turns (deterministic) against the live model, k runs per scenario. */

import { isEnded, runTurn, startCall, type CallRecord, type Proposer } from './agent';
import type { PolicyCard } from './policyCard';
import type { Scenario } from './scenarios';
import type { Settings } from './settings';

export async function runScenario(sc: Scenario, runIndex: number, proposer: Proposer, card: PolicyCard, settings: Settings): Promise<CallRecord> {
  const session = startCall(card, settings, sc.language, 'live', { scenarioId: sc.id, runIndex });
  for (const t of sc.turns) {
    if (isEnded(session)) break;
    await runTurn(session, t.text, proposer, { interrupted: !!t.interrupt });
  }
  return session.record;
}

export interface RunProgress {
  done: number;
  total: number;
  current?: string;
}

export interface SuiteRun {
  id: string;
  startedAt: string;
  finishedAt?: string;
  model: string;
  k: number;
  settingsSnapshot: Omit<Settings, never>;
  scenarioIds: string[];
  calls: CallRecord[];
  aborted: boolean;
}

export async function runSuite(
  scenarios: Scenario[],
  k: number,
  makeProposer: () => Proposer,
  card: PolicyCard,
  settings: Settings,
  onProgress: (p: RunProgress, call?: CallRecord) => void,
  signal?: AbortSignal,
): Promise<SuiteRun> {
  const run: SuiteRun = {
    id: `run-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    startedAt: new Date().toISOString(),
    model: settings.model,
    k,
    settingsSnapshot: { ...settings },
    scenarioIds: scenarios.map((s) => s.id),
    calls: [],
    aborted: false,
  };
  const jobs: { sc: Scenario; r: number }[] = [];
  for (const sc of scenarios) for (let r = 0; r < k; r++) jobs.push({ sc, r });
  let next = 0;
  let done = 0;
  const total = jobs.length;
  onProgress({ done, total });

  const worker = async () => {
    while (next < jobs.length) {
      if (signal?.aborted) return;
      const job = jobs[next++];
      try {
        const call = await runScenario(job.sc, job.r, makeProposer(), card, settings);
        run.calls.push(call);
        done++;
        onProgress({ done, total, current: job.sc.id }, call);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, settings.concurrency) }, worker));
  run.aborted = !!signal?.aborted;
  run.finishedAt = new Date().toISOString();
  return run;
}

/** Rough pre-run cost estimate so nobody is surprised by the bill. Clearly an estimate. */
export function estimateRunCostInr(scenarios: Scenario[], k: number, settings: Settings): { calls: number; turns: number; inr: number } {
  const turns = scenarios.reduce((s, sc) => s + sc.turns.length, 0) * k;
  // Assumption: ~1,800 prompt tokens and ~120 output tokens per turn (system prompt + card + history).
  const usd = (turns * 1800 * settings.priceInPerM + turns * 120 * settings.priceOutPerM) / 1e6;
  return { calls: scenarios.length * k, turns, inr: usd * settings.usdToInr };
}
