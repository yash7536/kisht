import { useEffect, useState } from 'react';
import { POLICY_CARD } from './lib/policyCard';
import { getApiKey } from './lib/settings';
import { useStore } from './store';
import Overview from './pages/Overview';
import Simulator from './pages/Simulator';
import EvalRuns from './pages/EvalRuns';
import Taxonomy from './pages/Taxonomy';
import LaunchMemo from './pages/LaunchMemo';
import Labelling from './pages/Labelling';
import SettingsPage from './pages/Settings';

const ROUTES = [
  { id: 'overview', label: 'Overview', icon: '◫', el: Overview },
  { id: 'simulator', label: 'Call Simulator', icon: '≋', el: Simulator },
  { id: 'evals', label: 'Eval Runs', icon: '☰', el: EvalRuns },
  { id: 'taxonomy', label: 'Failure Taxonomy', icon: '△', el: Taxonomy },
  { id: 'memo', label: 'Launch Memo', icon: '▤', el: LaunchMemo },
  { id: 'labelling', label: 'Labelling', icon: '✎', el: Labelling },
  { id: 'settings', label: 'Settings', icon: '⚙', el: SettingsPage },
] as const;

type RouteId = (typeof ROUTES)[number]['id'];

function currentRoute(): RouteId {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES.find((r) => r.id === h)?.id ?? 'overview') as RouteId;
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(currentRoute);
  const { activeRun, settings } = useStore();
  useEffect(() => {
    const on = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const Page = ROUTES.find((r) => r.id === route)!.el;
  const hasKey = !!getApiKey();

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <div className="brand-mark" aria-hidden>K</div>
          <div>
            <div className="brand-name">Kisht</div>
            <div className="brand-sub">Voice agent · eval</div>
          </div>
        </div>
        <div className="lender-ctx">
          <div className="spread">
            <span className="label">Lender context</span>
            <span className="chip ok">Fictional</span>
          </div>
          <div>{POLICY_CARD.lender}</div>
          <div className="small muted">Pre-due EMI reminder · Hinglish, Marathi-English, English, Hindi</div>
        </div>
        <nav className="nav">
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} className={route === r.id ? 'active' : ''}>
              <span className="nav-icon" aria-hidden>{r.icon}</span>
              {r.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="spread"><span className="label">Model</span><span className="num">{settings.model}</span></div>
          <div className="spread"><span className="label">Key</span><span className={`chip ${hasKey ? 'ok' : 'notrun'}`}>{hasKey ? 'set (memory)' : 'not set'}</span></div>
          <div className="spread"><span className="label">Active run</span><span className="num small">{activeRun ? `${activeRun.calls.length} calls` : 'none'}</span></div>
          <div className="small">Built by Vishnu Yash Pandey. Fictional lender, sample data.</div>
        </div>
      </aside>

      <div className="main">
        <nav className="mobile-nav" aria-label="Primary (mobile)">
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} className={route === r.id ? 'active' : ''}>{r.label}</a>
          ))}
        </nav>
        <header className="topbar">
          <div className="row">
            <span className="serif" style={{ fontSize: 20 }}>Kisht Eval Console</span>
          </div>
          <div className="topbar-labels">
            <span className="chip">Fictional lender</span>
            <span className="chip">Sample data</span>
            <span className="chip">Scenarios AI-drafted · review pending</span>
          </div>
        </header>
        <main className="content">
          <Page />
        </main>
      </div>
    </div>
  );
}
