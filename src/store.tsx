/**
 * App state: settings, eval runs, human labels, judge calibration.
 * Runs and labels are kept in this browser's localStorage (never the API key). If storage is full
 * the app keeps them in memory and asks you to download the JSON.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import scenariosRaw from '../data/scenarios.jsonl?raw';
import type { CallRecord } from './lib/agent';
import { breakdown, gradeCall, summarize, type Grade } from './lib/metrics';
import { parseScenariosJsonl, type Scenario } from './lib/scenarios';
import type { SuiteRun } from './lib/runner';
import { loadSettings, saveSettings, type Settings } from './lib/settings';

export interface CallLabel {
  outcomeCorrect: boolean | null;
  scriptCompliant: boolean | null;
  categories: string[];
  note: string;
}

export interface LabelSet {
  labeller: string;
  labels: Record<string, CallLabel>;
}

export interface JudgeCalibration {
  at: string;
  n: number;
  agreement: number | null;
  kappa: number | null;
  calibrated: boolean;
  verdicts: Record<string, boolean | null>;
}

interface Store {
  settings: Settings;
  setSettings: (s: Settings) => void;
  scenarios: Scenario[];
  scenarioErrors: string[];
  scenarioById: Map<string, Scenario>;
  runs: SuiteRun[];
  addRun: (r: SuiteRun) => void;
  deleteRun: (id: string) => void;
  activeRunId: string | null;
  setActiveRunId: (id: string | null) => void;
  activeRun: SuiteRun | null;
  grades: Grade[];
  labels: { A: LabelSet; B: LabelSet };
  setLabel: (who: 'A' | 'B', callId: string, l: CallLabel) => void;
  setLabellerName: (who: 'A' | 'B', name: string) => void;
  importLabels: (who: 'A' | 'B', set: LabelSet) => void;
  judge: JudgeCalibration | null;
  setJudge: (j: JudgeCalibration | null) => void;
  storageWarning: string | null;
  simCalls: CallRecord[];
  addSimCall: (c: CallRecord) => void;
}

const Ctx = createContext<Store | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const emptyLabels = { A: { labeller: 'Labeller A', labels: {} }, B: { labeller: 'Labeller B', labels: {} } };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const { scenarios, errors: scenarioErrors } = useMemo(() => parseScenariosJsonl(scenariosRaw), []);
  const scenarioById = useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);
  const [runs, setRuns] = useState<SuiteRun[]>(() => readJson('kisht.runs.v1', []));
  const [activeRunId, setActiveRunId] = useState<string | null>(() => readJson<SuiteRun[]>('kisht.runs.v1', []).at(-1)?.id ?? null);
  const [labels, setLabels] = useState<{ A: LabelSet; B: LabelSet }>(() => readJson('kisht.labels.v1', emptyLabels));
  const [judge, setJudgeState] = useState<JudgeCalibration | null>(() => readJson('kisht.judge.v1', null));
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [simCalls, setSimCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    if (!writeJson('kisht.runs.v1', runs)) setStorageWarning('Runs are too large for browser storage and are kept in memory only. Download the JSON before closing this tab.');
    else setStorageWarning(null);
  }, [runs]);
  useEffect(() => { writeJson('kisht.labels.v1', labels); }, [labels]);
  useEffect(() => { writeJson('kisht.judge.v1', judge); }, [judge]);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);

  const activeRun = runs.find((r) => r.id === activeRunId) ?? null;
  const grades = useMemo(() => {
    if (!activeRun) return [];
    return activeRun.calls.filter((c) => c.scenarioId && scenarioById.has(c.scenarioId)).map((c) => gradeCall(c, scenarioById.get(c.scenarioId!)!));
  }, [activeRun, scenarioById]);

  const value: Store = {
    settings,
    setSettings,
    scenarios,
    scenarioErrors,
    scenarioById,
    runs,
    addRun: (r) => {
      setRuns((rs) => [...rs.filter((x) => x.id !== r.id), r]);
      setActiveRunId(r.id);
    },
    deleteRun: (id) => {
      setRuns((rs) => rs.filter((x) => x.id !== id));
      setActiveRunId((cur) => (cur === id ? null : cur));
    },
    activeRunId,
    setActiveRunId,
    activeRun,
    grades,
    labels,
    setLabel: (who, callId, l) => setLabels((ls) => ({ ...ls, [who]: { ...ls[who], labels: { ...ls[who].labels, [callId]: l } } })),
    setLabellerName: (who, name) => setLabels((ls) => ({ ...ls, [who]: { ...ls[who], labeller: name } })),
    importLabels: (who, set) => setLabels((ls) => ({ ...ls, [who]: set })),
    judge,
    setJudge: setJudgeState,
    storageWarning,
    simCalls,
    addSimCall: (c) => setSimCalls((cs) => [...cs, c]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

/** Summary + breakdowns for the active run, or nulls when nothing has been run. */
export function useResults() {
  const { grades, activeRun, scenarioById } = useStore();
  return useMemo(() => {
    if (!activeRun || grades.length === 0) return { summary: null, byLang: [], byPersona: [], byDisruption: [] };
    const sc = (g: Grade) => scenarioById.get(g.scenarioId)!;
    return {
      summary: summarize(grades, activeRun.k),
      byLang: breakdown(grades, (g) => [sc(g).language]),
      byPersona: breakdown(grades, (g) => [sc(g).persona]),
      byDisruption: breakdown(grades, (g) => sc(g).disruptions),
    };
  }, [grades, activeRun, scenarioById]);
}
