import { describe, expect, it } from 'vitest';
import { decide, type EvidenceState } from '../src/lib/decision';
import { summarize, type Summary } from '../src/lib/metrics';

const ev: EvidenceState = { scenariosReviewed: 0, scenariosTotal: 88, labelledCalls: 0, kappaOutcome: null, judgeCalibrated: false, realUserTestRun: false };
const base = (patch: Partial<Summary>): Summary => ({ ...summarize([], 3), runs: 30, scenarios: 10, k: 3, inventedNumberHeard: 0, correctHandoffRate: 1, scriptCompliance: 1, taskCompletion: 0.9, unnecessaryHandoffRate: 0.05, passHatK: 0.9, p95LatencyMs: 900, ...patch });

describe('launch decision rule', () => {
  it('defaults to "Not yet — run evals" with no runs', () => {
    expect(decide(null, [], ev, 2000).headline).toBe('Not yet — run evals');
    expect(decide(summarize([], 3), [], ev, 2000).headline).toBe('Not yet — run evals');
  });
  it('No-go on any critical failure', () => {
    expect(decide(base({ inventedNumberHeard: 1 }), [], ev, 2000).headline).toBe('No-go');
    expect(decide(base({ correctHandoffRate: 0.9 }), [], ev, 2000).headline).toBe('No-go');
  });
  it('non-critical misses are not reported as "gates met"', () => {
    expect(decide(base({ unnecessaryHandoffRate: 0.3 }), [], ev, 2000).headline).toBe('Not yet — non-critical gates missed');
  });
  it('holds a failing language', () => {
    const d = decide(base({}), [{ key: 'marathi_english', runs: 60, taskCompletion: 0.7, passRate: 0.6, inventedNumberCallRate: 0, missedHandoffs: 0, unnecessaryHandoffs: 3 }], ev, 2000);
    expect(d.headline).toBe('Not yet — hold failing languages');
  });
  it('never says Go: all gates met still waits for evidence', () => {
    const d = decide(base({}), [], ev, 2000);
    expect(d.headline).toMatch(/^Not yet/);
    expect(d.reasons.join(' ')).toMatch(/Real-user test/);
  });
});
