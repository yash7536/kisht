import { useState } from 'react';
import { Panel } from '../components/ui';
import { clearApiKey, DEFAULT_SETTINGS, getApiKey, isKeyInSession, setApiKey, type Settings } from '../lib/settings';
import { sttSupported, ttsSupported } from '../lib/speech';
import { useStore } from '../store';

function Num({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input className="input num" type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="small muted">{hint}</span>}
    </label>
  );
}

export default function SettingsPage() {
  const { settings, setSettings } = useStore();
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(isKeyInSession());
  const [, force] = useState(0);
  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });
  const has = !!getApiKey();

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">Bring your own key · model · prices</span>
        <h2>Settings</h2>
      </div>

      <Panel title="Gemini API key (BYOK)" right={<span className={`chip ${has ? 'ok' : 'notrun'}`}>{has ? 'Key set' : 'No key'}</span>}>
        <div className="stack-sm">
          <p className="small">Your key stays in this tab's memory and is sent only to <span className="num">generativelanguage.googleapis.com</span> in a request header. It is never written to localStorage, exported JSON, logs or the repo. Optionally keep it in sessionStorage (cleared when the tab closes). Use a key with a spending cap.</p>
          <div className="sim-input">
            <input className="input num" type="password" autoComplete="off" placeholder={has ? '•••••••• (set)' : 'Paste your Gemini API key'} value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="btn primary" onClick={() => { setApiKey(key, remember); setKey(''); force((x) => x + 1); }} disabled={!key.trim()}>Save</button>
            <button className="btn" onClick={() => { clearApiKey(); force((x) => x + 1); }} disabled={!has}>Forget</button>
          </div>
          <label className="check small"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember in this tab (sessionStorage)</label>
        </div>
      </Panel>

      <Panel title="Model">
        <div className="field-row">
          <label className="field"><span className="label">Model id</span><input className="input num" value={settings.model} onChange={(e) => set({ model: e.target.value.trim() })} /><span className="small muted">Default gemini-2.5-flash</span></label>
          <Num label="Temperature" value={settings.temperature} step={0.1} onChange={(v) => set({ temperature: v })} />
          <Num label="Thinking budget" value={settings.thinkingBudget} onChange={(v) => set({ thinkingBudget: v })} hint="0 = off (lower latency); -1 = model default" />
        </div>
      </Panel>

      <Panel title="Eval">
        <div className="field-row">
          <Num label="Runs per scenario (k)" value={settings.runsPerScenario} onChange={(v) => set({ runsPerScenario: Math.max(1, v) })} />
          <Num label="Concurrency" value={settings.concurrency} onChange={(v) => set({ concurrency: Math.max(1, Math.min(6, v)) })} hint="Lower if you hit rate limits" />
          <Num label="Latency threshold (ms)" value={settings.latencyThresholdMs} onChange={(v) => set({ latencyThresholdMs: v })} />
          <Num label="Judge kappa threshold" value={settings.judgeKappaThreshold} step={0.05} onChange={(v) => set({ judgeKappaThreshold: v })} />
        </div>
      </Panel>

      <Panel title="Cost estimate inputs (labelled as estimates everywhere)">
        <div className="field-row">
          <Num label="USD per 1M input tokens" value={settings.priceInPerM} step={0.01} onChange={(v) => set({ priceInPerM: v })} />
          <Num label="USD per 1M output tokens" value={settings.priceOutPerM} step={0.01} onChange={(v) => set({ priceOutPerM: v })} hint="Thinking tokens are billed as output" />
          <Num label="USD → INR" value={settings.usdToInr} step={0.1} onChange={(v) => set({ usdToInr: v })} />
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Defaults are placeholders to be checked against Google's current pricing page and today's exchange rate before any ₹ figure is quoted. Browser TTS/STT is free and not costed; a production telephony stack would add per-minute costs.</p>
      </Panel>

      <Panel title="Voice & conduct">
        <div className="stack-sm">
          <div className="field-row">
            <label className="field"><span className="label">Speech recognition language</span>
              <select className="input" value={settings.sttLang} onChange={(e) => set({ sttLang: e.target.value as Settings['sttLang'] })}>
                <option value="hi-IN">hi-IN (Hindi / Hinglish)</option><option value="en-IN">en-IN (Indian English)</option><option value="mr-IN">mr-IN (Marathi)</option>
              </select>
            </label>
            <div className="small muted" style={{ alignSelf: 'end' }}>STT {sttSupported() ? 'available' : 'not available'} · TTS {ttsSupported() ? 'available' : 'not available'} in this browser</div>
          </div>
          <label className="check"><input type="checkbox" checked={settings.speakReplies} onChange={(e) => set({ speakReplies: e.target.checked })} /> Speak agent replies (browser TTS)</label>
          <label className="check"><input type="checkbox" checked={settings.enforceCallingHours} onChange={(e) => set({ enforceCallingHours: e.target.checked })} /> Enforce calling hours 08:00–19:00 in the simulator</label>
          <button className="btn small" style={{ justifySelf: 'start' }} onClick={() => setSettings({ ...DEFAULT_SETTINGS })}>Reset to defaults</button>
        </div>
      </Panel>
    </div>
  );
}
