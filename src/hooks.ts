import { useMemo } from 'react';
import { decide, type EvidenceState } from './lib/decision';
import { cohensKappa, sampleIds } from './lib/kappa';
import { useResults, useStore } from './store';

export const LABEL_FRACTION = 0.25;

export function useLabelling() {
  const { activeRun, labels } = useStore();
  return useMemo(() => {
    const ids = activeRun ? activeRun.calls.map((c) => c.id) : [];
    const sample = sampleIds(ids, LABEL_FRACTION);
    const both = sample.filter((id) => {
      const a = labels.A.labels[id];
      const b = labels.B.labels[id];
      return a && b && a.outcomeCorrect !== null && b.outcomeCorrect !== null && a.scriptCompliant !== null && b.scriptCompliant !== null;
    });
    const outcome = cohensKappa(both.map((id) => labels.A.labels[id].outcomeCorrect!), both.map((id) => labels.B.labels[id].outcomeCorrect!));
    const script = cohensKappa(both.map((id) => labels.A.labels[id].scriptCompliant!), both.map((id) => labels.B.labels[id].scriptCompliant!));
    /** Consensus = both labellers agree. Used to calibrate the judge. */
    const consensusScript: Record<string, boolean> = {};
    for (const id of both) if (labels.A.labels[id].scriptCompliant === labels.B.labels[id].scriptCompliant) consensusScript[id] = labels.A.labels[id].scriptCompliant!;
    return { sample, both, outcome, script, consensusScript };
  }, [activeRun, labels]);
}

export function useEvidence(): EvidenceState {
  const { scenarios } = useStore();
  const lab = useLabelling();
  const { judge } = useStore();
  return {
    scenariosReviewed: scenarios.filter((s) => s.reviewed).length,
    scenariosTotal: scenarios.length,
    labelledCalls: lab.both.length,
    kappaOutcome: lab.outcome.kappa,
    judgeCalibrated: !!judge?.calibrated,
    realUserTestRun: false,
  };
}

export function useDecision() {
  const { settings } = useStore();
  const res = useResults();
  const ev = useEvidence();
  return { ...res, evidence: ev, decision: decide(res.summary, res.byLang, ev, settings.latencyThresholdMs) };
}
