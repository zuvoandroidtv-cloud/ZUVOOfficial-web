import React, { useState } from 'react';
import {
  Users,
  Target,
  FileText,
  Calendar,
  Gift,
  Award,
  PhoneCall,
  Store,
  Compass,
  ArrowRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

export const GrowthEnginePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'funnel' | 'leads' | 'opportunities' | 'quotations' | 'activities' | 'onboarding' | 'campaigns' | 'loyalty'>('funnel');

  const [leads] = useState<Array<{ id: string; lead_number: string; name: string; phone: string; source: string; model: string; value: string; score: number; status: string }>>([]);
  const [opportunities] = useState<Array<{ id: string; opp_number: string; title: string; account: string; stage: string; prob: string; value: string; weighted: string; close: string }>>([]);
  const [quotations] = useState<Array<{ id: string; quote_number: string; account: string; total: string; valid_until: string; status: string }>>([]);
  const [applications] = useState<Array<{ id: string; app_number: string; trade_name: string; contact: string; territory: string; requested_credit: string; status: string }>>([]);
  const [campaigns] = useState<Array<{ id: string; code: string; name: string; type: string; budget: string; target: string; actual: string; status: string }>>([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
        borderColor: 'rgba(59, 130, 246, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-cyan">Phase 11 Growth Engine</span>
            <span className="badge badge-purple">Customer & Dealer Commercial Network</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>
            Enterprise Customer, Dealer & Partner Growth Engine
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Omni-channel lead generation, weighted opportunity pipeline, quotation approvals, dealer KYC, and retention intelligence.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', overflowX: 'auto' }}>
        <button
          className={`btn btn-sm ${activeTab === 'funnel' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('funnel')}
        >
          Pipeline Funnel Overview
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'leads' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('leads')}
        >
          Leads Management ({leads.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'opportunities' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('opportunities')}
        >
          Opportunities ({opportunities.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'quotations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('quotations')}
        >
          Quotations ({quotations.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'onboarding' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('onboarding')}
        >
          Dealer Onboarding & KYC ({applications.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'campaigns' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('campaigns')}
        >
          Campaigns & Referrals
        </button>
      </div>

      {/* Tab 1: Pipeline Funnel Overview */}
      {activeTab === 'funnel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-blue)' }}>₹0.00</div>
                <div className="stat-label">Total Pipeline Value</div>
              </div>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-blue)' }}>
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-emerald)' }}>₹0.00</div>
                <div className="stat-label">Weighted Pipeline</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
                <Target size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-purple)' }}>0.0%</div>
                <div className="stat-label">Average Win Probability</div>
              </div>
              <div style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-purple)' }}>
                <Percent size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-val" style={{ color: 'var(--accent-cyan)' }}>{applications.length} Apps</div>
                <div className="stat-label">Active Dealer KYC Queue</div>
              </div>
              <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
                <Store size={24} />
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Sales Pipeline Stage Distribution</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>QUALIFICATION</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0' }}>₹0.00</div>
                <span className="badge badge-slate">0 Deals</span>
              </div>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>QUOTATION</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0' }}>₹0.00</div>
                <span className="badge badge-cyan">0 Deals</span>
              </div>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>NEGOTIATION</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0' }}>₹0.00</div>
                <span className="badge badge-purple">0 Deals</span>
              </div>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>COMMIT</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0' }}>₹0.00</div>
                <span className="badge badge-emerald">0 Deals</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Leads Management */}
      {activeTab === 'leads' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Inbound & Outreach Commercial Leads</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead #</th>
                  <th>Prospect Name</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Interested Model</th>
                  <th>Est. Value</th>
                  <th>Qualification</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      No active commercial leads found. Systems ready for inbound inquiries.
                    </td>
                  </tr>
                ) : (
                  leads.map(l => (
                    <tr key={l.id}>
                      <td><strong>{l.lead_number}</strong></td>
                      <td style={{ fontWeight: 600 }}>{l.name}</td>
                      <td>{l.phone}</td>
                      <td><span className="badge badge-slate">{l.source.replace('_', ' ')}</span></td>
                      <td>{l.model}</td>
                      <td style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{l.value}</td>
                      <td><span className="badge badge-cyan">{l.score} / 100</span></td>
                      <td><span className="badge badge-emerald">{l.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Opportunities */}
      {activeTab === 'opportunities' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Active Deals & Weighted Pipeline</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Opp #</th>
                  <th>Deal Title</th>
                  <th>Account / Customer</th>
                  <th>Stage</th>
                  <th>Probability</th>
                  <th>Expected Value</th>
                  <th>Weighted Value</th>
                  <th>Est. Close</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      No active deals in pipeline. New opportunities will appear here.
                    </td>
                  </tr>
                ) : (
                  opportunities.map(o => (
                    <tr key={o.id}>
                      <td><strong>{o.opp_number}</strong></td>
                      <td style={{ fontWeight: 600 }}>{o.title}</td>
                      <td>{o.account}</td>
                      <td><span className="badge badge-purple">{o.stage}</span></td>
                      <td><span className="badge badge-slate">{o.prob}</span></td>
                      <td style={{ fontWeight: 600 }}>{o.value}</td>
                      <td style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{o.weighted}</td>
                      <td>{o.close}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Quotations */}
      {activeTab === 'quotations' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Commercial Quotations</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Account / Customer</th>
                  <th>Grand Total</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      No commercial quotations created.
                    </td>
                  </tr>
                ) : (
                  quotations.map(q => (
                    <tr key={q.id}>
                      <td><strong>{q.quote_number}</strong></td>
                      <td style={{ fontWeight: 600 }}>{q.account}</td>
                      <td style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{q.total}</td>
                      <td>{q.valid_until}</td>
                      <td><span className={`badge ${q.status === 'APPROVED' ? 'badge-emerald' : 'badge-cyan'}`}>{q.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Dealer Onboarding */}
      {activeTab === 'onboarding' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Dealer Onboarding Applications & KYC</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>App #</th>
                  <th>Trade Name</th>
                  <th>Contact Person</th>
                  <th>Territory</th>
                  <th>Requested Credit</th>
                  <th>KYC Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      No dealer onboarding applications in queue.
                    </td>
                  </tr>
                ) : (
                  applications.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.app_number}</strong></td>
                      <td style={{ fontWeight: 600 }}>{a.trade_name}</td>
                      <td>{a.contact}</td>
                      <td>{a.territory}</td>
                      <td style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{a.requested_credit}</td>
                      <td><span className={`badge ${a.status === 'KYC_REVIEW' ? 'badge-amber' : 'badge-slate'}`}>{a.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Commercial Campaigns & Promotions</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Budget</th>
                  <th>Target Revenue</th>
                  <th>Achieved Revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      No active commercial campaigns configured.
                    </td>
                  </tr>
                ) : (
                  campaigns.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong></td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td><span className="badge badge-purple">{c.type}</span></td>
                      <td>{c.budget}</td>
                      <td>{c.target}</td>
                      <td style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{c.actual}</td>
                      <td><span className="badge badge-emerald">{c.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
