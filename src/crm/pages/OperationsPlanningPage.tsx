import React, { useState } from 'react';
import {
  TrendingUp,
  Target,
  BarChart2,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Calendar,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';

export const OperationsPlanningPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'briefing' | 'targets' | 'forecasting' | 'recommendations' | 'exceptions' | 'scorecards'>('briefing');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock initial deterministic state for offline / initial UI render
  const [targets] = useState([
    { id: '1', fiscal_year: 'FY2026-27', period: '2026-10', dept: 'SALES', target_units: 500, target_rev: '₹1,22,50,000', target_margin: '₹24,50,000', status: 'ACTIVE' },
    { id: '2', fiscal_year: 'FY2026-27', period: '2026-10', dept: 'MANUFACTURING', target_units: 600, target_rev: '₹1,11,00,000', target_margin: '₹18,00,000', status: 'APPROVED' },
    { id: '3', fiscal_year: 'FY2026-27', period: '2026-10', dept: 'SERVICE', target_units: 50, target_rev: '₹2,50,000', target_margin: '₹75,000', status: 'ACTIVE' },
  ]);

  const [forecasts] = useState([
    { id: '1', version: 'FC-2026-Q3-V1', period: '2026-11', method: 'WEIGHTED_MOVING_AVERAGE', confidence: '88%', units: 540, revenue: '₹1,32,30,000', margin: '₹26,46,000', status: 'ACTIVE' },
    { id: '2', version: 'FC-2026-Q4-V1', period: '2026-12', method: 'SEASONAL_RUN_RATE', confidence: '82%', units: 620, revenue: '₹1,51,90,000', margin: '₹30,38,000', status: 'DRAFT' },
  ]);

  const [recommendations] = useState([
    { id: '1', code: 'REC-PROD-ZUVO55-01', type: 'PRODUCE', cat: 'FINISHED_TV', item: 'ZUVO 55" 4K Smart Voice TV', qty: 50, est_cost: '₹9,25,000', coverage: '6 Days', urgency: 'HIGH', reason: 'Stockout Risk: Buffer stock below 7-day safety ceiling', status: 'PENDING_REVIEW' },
    { id: '2', code: 'REC-PURCH-PANEL43-02', type: 'PURCHASE', cat: 'RAW_MATERIAL', item: '43" D-LED Ultra Panel Assembly', qty: 100, est_cost: '₹7,50,000', coverage: '12 Days', urgency: 'MEDIUM', reason: 'Production Staging buffer for November build schedule', status: 'PENDING_REVIEW' },
  ]);

  const [exceptions] = useState([
    { id: '1', code: 'EXC-INV-0089', cat: 'INVENTORY', sev: 'HIGH', ref: 'ZUVO-32-BT', summary: 'Critical Low Stock: 32" BT Voice (4 units on hand)', action: 'Release manufacturing assembly work order', status: 'OPEN' },
    { id: '2', code: 'EXC-SVC-0142', cat: 'SERVICE', sev: 'CRITICAL', ref: 'TKT-202610-008', summary: 'SLA Breach: Ticket overdue for 48h resolution', action: 'Reassign to regional senior field technician', status: 'ACKNOWLEDGED' },
    { id: '3', code: 'EXC-FIN-0031', cat: 'FINANCE', sev: 'MEDIUM', ref: 'DLR-SOUTH-001', summary: 'Credit Utilization at 85% of sanctioned limit', action: 'Request pending invoice collection before new dispatch', status: 'OPEN' },
  ]);

  const [scorecards] = useState([
    { group: 'SALES', kpi: 'Monthly Units Sold', target: '500 Units', actual: '480 Units', variance: '-4.0%', status: 'ON_TRACK' },
    { group: 'FINANCE', kpi: 'Collections Efficiency', target: '95.0%', actual: '92.4%', variance: '-2.6%', status: 'NEEDS_ATTENTION' },
    { group: 'OPERATIONS', kpi: 'Finished Goods Inventory Days', target: '18 Days', actual: '14 Days', variance: '-4 Days', status: 'EXCELLENT' },
    { group: 'SERVICE', kpi: 'First-Visit Resolution (FVR)', target: '85.0%', actual: '87.5%', variance: '+2.5%', status: 'EXCELLENT' },
  ]);

  const handleRefreshSweep = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
        borderColor: 'rgba(16, 185, 129, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-emerald">Phase 10 Intelligence Layer</span>
            <span className="badge badge-slate">Deterministic Analytics</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>
            Operations Planning, Forecasting & Intelligence Cockpit
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Enterprise target governance, sales run-rate forecasts, demand planning, and centralized exception triage.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleRefreshSweep}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Running Sweep...' : 'Trigger Intelligence Sweep'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', overflowX: 'auto' }}>
        <button
          className={`btn btn-sm ${activeTab === 'briefing' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('briefing')}
        >
          Daily Executive Briefing
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'targets' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('targets')}
        >
          Planning Targets
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'forecasting' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('forecasting')}
        >
          Sales Forecasting
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'recommendations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('recommendations')}
        >
          Planning Recommendations ({recommendations.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'exceptions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('exceptions')}
        >
          Enterprise Exceptions ({exceptions.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'scorecards' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('scorecards')}
        >
          KPI Scorecards
        </button>
      </div>

      {/* Tab 1: Daily Executive Briefing */}
      {activeTab === 'briefing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-emerald)' }}>₹1.22 Cr</div>
                <div className="stat-label">MTD Sales Revenue</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-cyan)' }}>96.0%</div>
                <div className="stat-label">Target Achievement</div>
              </div>
              <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
                <Target size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-amber)' }}>2 Items</div>
                <div className="stat-label">Stockout Risk Alerts</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-amber)' }}>
                <AlertTriangle size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-rose)' }}>3 Active</div>
                <div className="stat-label">Open Exceptions</div>
              </div>
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-rose)' }}>
                <ShieldAlert size={24} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="glass-card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lightbulb size={18} style={{ color: 'var(--accent-amber)' }} /> Urgent Operational Actions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recommendations.map(r => (
                  <div key={r.id} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.type}: {r.item}</div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{r.reason}</div>
                    </div>
                    <span className="badge badge-amber">{r.urgency}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ color: 'var(--accent-rose)' }} /> Critical Exception Queue
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {exceptions.map(e => (
                  <div key={e.id} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.code} — {e.summary}</div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Action: {e.action}</div>
                    </div>
                    <span className={`badge ${e.sev === 'CRITICAL' ? 'badge-rose' : 'badge-amber'}`}>{e.sev}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Planning Targets */}
      {activeTab === 'targets' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Enterprise Operating Targets</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Department</th>
                  <th>Target Units</th>
                  <th>Target Revenue</th>
                  <th>Target Margin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {targets.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.fiscal_year} ({t.period})</strong></td>
                    <td><span className="badge badge-slate">{t.dept}</span></td>
                    <td>{t.target_units} TVs</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>{t.target_rev}</td>
                    <td>{t.target_margin}</td>
                    <td><span className="badge badge-emerald">{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Sales Forecasting */}
      {activeTab === 'forecasting' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Deterministic Sales Demand Forecasts</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Period</th>
                  <th>Methodology</th>
                  <th>Confidence</th>
                  <th>Forecast Units</th>
                  <th>Forecast Revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.version}</strong></td>
                    <td>{f.period}</td>
                    <td><span className="badge badge-slate">{f.method.replace('_', ' ')}</span></td>
                    <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{f.confidence}</td>
                    <td>{f.units} TVs</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>{f.revenue}</td>
                    <td><span className={`badge ${f.status === 'ACTIVE' ? 'badge-emerald' : 'badge-slate'}`}>{f.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Planning Recommendations */}
      {activeTab === 'recommendations' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Operations & Supply Chain Recommendations</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Recommended Qty</th>
                  <th>Est. Cost</th>
                  <th>Coverage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.code}</strong></td>
                    <td><span className="badge badge-cyan">{r.type}</span></td>
                    <td>{r.cat}</td>
                    <td style={{ fontWeight: 600 }}>{r.item}</td>
                    <td>{r.qty} units</td>
                    <td style={{ color: 'var(--accent-emerald)' }}>{r.est_cost}</td>
                    <td><span className="badge badge-amber">{r.coverage}</span></td>
                    <td><span className="badge badge-slate">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Enterprise Exceptions */}
      {activeTab === 'exceptions' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Enterprise Exception Management Center</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exception Code</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Reference</th>
                  <th>Summary</th>
                  <th>Recommended Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map(e => (
                  <tr key={e.id}>
                    <td><strong>{e.code}</strong></td>
                    <td><span className="badge badge-slate">{e.cat}</span></td>
                    <td><span className={`badge ${e.sev === 'CRITICAL' ? 'badge-rose' : 'badge-amber'}`}>{e.sev}</span></td>
                    <td>{e.ref}</td>
                    <td style={{ fontWeight: 500 }}>{e.summary}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{e.action}</td>
                    <td><span className="badge badge-cyan">{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: KPI Scorecards */}
      {activeTab === 'scorecards' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Corporate KPI Performance Scorecards</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>KPI Indicator</th>
                  <th>Target Value</th>
                  <th>Actual Performance</th>
                  <th>Variance</th>
                  <th>Status Evaluation</th>
                </tr>
              </thead>
              <tbody>
                {scorecards.map((s, idx) => (
                  <tr key={idx}>
                    <td><span className="badge badge-slate">{s.group}</span></td>
                    <td style={{ fontWeight: 600 }}>{s.kpi}</td>
                    <td>{s.target}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>{s.actual}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: s.variance.startsWith('+') ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontWeight: 600 }}>
                        {s.variance.startsWith('+') ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {s.variance}
                      </span>
                    </td>
                    <td><span className={`badge ${s.status === 'EXCELLENT' ? 'badge-emerald' : s.status === 'ON_TRACK' ? 'badge-cyan' : 'badge-amber'}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
