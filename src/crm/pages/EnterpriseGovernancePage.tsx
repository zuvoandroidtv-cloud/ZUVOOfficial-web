import React, { useState } from 'react';
import {
  ShieldCheck,
  GitMerge,
  Bell,
  AlertTriangle,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Zap,
  RotateCcw,
  CheckSquare,
  FileText,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Cpu,
  Lock,
  Server,
  UserCheck
} from 'lucide-react';

interface ApprovalItem {
  id: string;
  code: string;
  type: string;
  module: string;
  sourceReference: string;
  amount: number;
  requesterName: string;
  assignedRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
}

interface WorkflowInstanceItem {
  id: string;
  instanceNumber: string;
  workflowName: string;
  targetRef: string;
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'ESCALATED';
  initiatedBy: string;
  startedAt: string;
}

interface ExceptionItem {
  id: string;
  exceptionNumber: string;
  module: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  summary: string;
  status: 'OPEN' | 'INVESTIGATING' | 'ACTION_REQUIRED' | 'RESOLVED';
  dueHours: number;
}

export const EnterpriseGovernancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'workflows' | 'notifications' | 'exceptions' | 'observability'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const mockApprovals: ApprovalItem[] = [];
  const mockWorkflows: WorkflowInstanceItem[] = [];
  const mockExceptions: ExceptionItem[] = [];

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'badge-critical';
      case 'HIGH': return 'badge-danger';
      case 'MEDIUM': return 'badge-warning';
      default: return 'badge-info';
    }
  };

  return (
    <div className="crm-page-container" style={{ padding: '1.5rem', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-primary, #6366f1)'
            }}>
              <ShieldCheck size={24} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Enterprise Governance & Control Center
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted, #94a3b8)' }}>
                Phase 20 Reusable Workflow Engine, Centralized Approvals, Multichannel Notification Queue & Observability
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} /> Refresh Health
          </button>
          <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Zap size={14} /> Run Governance Sweep
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="crm-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Approvals</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem', color: '#f59e0b' }}>{mockApprovals.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.25rem' }}>
            ₹0.00 under review
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>Active Workflows</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem', color: '#6366f1' }}>{mockWorkflows.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <TrendingUp size={12} /> 100% On-Time SLA
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>Open Exceptions</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem', color: '#ef4444' }}>{mockExceptions.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
            0 Critical (Systems Clean)
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>Automation Health</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem', color: '#10b981' }}>HEALTHY</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
            Active Background Sweeps
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>Notification Pipeline</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem', color: '#8b5cf6' }}>100%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.25rem' }}>
            0 Dead Letters
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color, #334155)', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Governance Overview' },
          { id: 'approvals', label: `Approval Center (${mockApprovals.length})` },
          { id: 'workflows', label: `Workflow Engine & Instances (${mockWorkflows.length})` },
          { id: 'notifications', label: 'Notification Queue & Outbox' },
          { id: 'exceptions', label: `Enterprise Exceptions (${mockExceptions.length})` },
          { id: 'observability', label: 'System Observability & Audits' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '0.625rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--brand-primary, #6366f1)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--brand-primary, #6366f1)' : 'var(--text-muted, #94a3b8)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Left: Active Policies & Approval Highlights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="crm-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Active Enterprise Governance Policies
              </h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Authoritative governance policies enforced across all ZUVO modules.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '0.875rem', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>FIN-POL-001: Commercial Discount & Pricing Floor Governance</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem' }}>
                      Discounts exceeding 10% mandate Director-level approval. Hard floor prevents sales below 15% gross margin.
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>ACTIVE (v2)</span>
                </div>

                <div style={{ padding: '0.875rem', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>PROC-POL-004: Dual Control Purchase Requisition Authorization</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem' }}>
                      Mandatory maker-checker guard on all purchase orders &gt; ₹1,00,000. Requester cannot approve their own PR/PO.
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>ACTIVE (v1)</span>
                </div>

                <div style={{ padding: '0.875rem', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>SEC-POL-012: Zero-Trust Multi-Tenant Isolation & PII Redaction</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem' }}>
                      Tenant scoping enforced at database RLS level. Customer phone, email and financial margins masked for unauthorized roles.
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>ACTIVE (v3)</span>
                </div>
              </div>
            </div>

            {/* Quick Approvals Queue Preview */}
            <div className="crm-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>High-Priority Approvals Awaiting Action</h3>
                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>3 Pending</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color, #334155)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Code</th>
                      <th style={{ padding: '0.5rem' }}>Type</th>
                      <th style={{ padding: '0.5rem' }}>Amount</th>
                      <th style={{ padding: '0.5rem' }}>Requester</th>
                      <th style={{ padding: '0.5rem' }}>Risk</th>
                      <th style={{ padding: '0.5rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockApprovals.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted, #94a3b8)' }}>
                          No pending approvals requiring maker-checker decision.
                        </td>
                      </tr>
                    ) : (
                      mockApprovals.map(a => (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color, #1e293b)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 600 }}>{a.code}</td>
                          <td style={{ padding: '0.5rem' }}>{a.type}</td>
                          <td style={{ padding: '0.5rem', fontWeight: 600 }}>₹{a.amount.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '0.5rem' }}>{a.requesterName}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <span className={`badge ${getSeverityBadge(a.riskTier)}`}>{a.riskTier}</span>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                              Decide
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: System Telemetry & Automation Health */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="crm-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                Observability & Heartbeat
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Database Isolation:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>100% RLS Enforced</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>RPC Search Path:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Hardened (public, pg_temp)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Maker-Checker Check:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Server-Authoritative</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Last Automation Sweep:</span>
                  <span>Active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Active Dead Letters:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>0 (Clean)</span>
                </div>
              </div>
            </div>

            <div className="crm-card" style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.05)', borderLeft: '4px solid #6366f1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={18} style={{ color: '#6366f1' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Governance Rule Engine</div>
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Phase 20 centralizes cross-module decisions into deterministic, audited state machines, preventing unauthorized client status manipulation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Approvals */}
      {activeTab === 'approvals' && (
        <div className="crm-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Unified Enterprise Approval Queue</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Extends Phase 16 dual-control register with cross-module maker-checker enforcement.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #334155)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Approval Code</th>
                  <th style={{ padding: '0.75rem' }}>Module</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem' }}>Source Reference</th>
                  <th style={{ padding: '0.75rem' }}>Amount</th>
                  <th style={{ padding: '0.75rem' }}>Requester</th>
                  <th style={{ padding: '0.75rem' }}>Risk Tier</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted, #94a3b8)' }}>
                      No active approvals in queue.
                    </td>
                  </tr>
                ) : (
                  mockApprovals.map(app => (
                    <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color, #1e293b)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{app.code}</td>
                      <td style={{ padding: '0.75rem' }}><span className="badge badge-info">{app.module}</span></td>
                      <td style={{ padding: '0.75rem' }}>{app.type}</td>
                      <td style={{ padding: '0.75rem' }}>{app.sourceReference}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{app.amount.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem' }}>{app.requesterName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${getSeverityBadge(app.riskTier)}`}>{app.riskTier}</span>
                      </td>
                      <td style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem' }}>Approve</button>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>Reject</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Workflows */}
      {activeTab === 'workflows' && (
        <div className="crm-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Enterprise Workflow Engine & Instances</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Multi-step deterministic state progression with SLA gates and immutable history.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #334155)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Instance #</th>
                  <th style={{ padding: '0.75rem' }}>Workflow Name</th>
                  <th style={{ padding: '0.75rem' }}>Target Ref</th>
                  <th style={{ padding: '0.75rem' }}>Current Step</th>
                  <th style={{ padding: '0.75rem' }}>Progress</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Initiated By</th>
                  <th style={{ padding: '0.75rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {mockWorkflows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted, #94a3b8)' }}>
                      No active workflow instances running.
                    </td>
                  </tr>
                ) : (
                  mockWorkflows.map(wf => (
                    <tr key={wf.id} style={{ borderBottom: '1px solid var(--border-color, #1e293b)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{wf.instanceNumber}</td>
                      <td style={{ padding: '0.75rem' }}>{wf.workflowName}</td>
                      <td style={{ padding: '0.75rem' }}>{wf.targetRef}</td>
                      <td style={{ padding: '0.75rem' }}>{wf.currentStep}</td>
                      <td style={{ padding: '0.75rem' }}>Step {wf.stepIndex} of {wf.totalSteps}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${wf.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>{wf.status}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{wf.initiatedBy}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>Inspect</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Exceptions */}
      {activeTab === 'exceptions' && (
        <div className="crm-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Centralized Enterprise Exception Center</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Aggregates deviations across Sales, Procurement, SCM, Finance, Service and Security.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #334155)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Exception #</th>
                  <th style={{ padding: '0.75rem' }}>Module</th>
                  <th style={{ padding: '0.75rem' }}>Severity</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem' }}>Summary</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>SLA Target</th>
                  <th style={{ padding: '0.75rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {mockExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted, #94a3b8)' }}>
                      No open enterprise exceptions found. Systems operating normally.
                    </td>
                  </tr>
                ) : (
                  mockExceptions.map(exc => (
                    <tr key={exc.id} style={{ borderBottom: '1px solid var(--border-color, #1e293b)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{exc.exceptionNumber}</td>
                      <td style={{ padding: '0.75rem' }}><span className="badge badge-info">{exc.module}</span></td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${getSeverityBadge(exc.severity)}`}>{exc.severity}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{exc.type}</td>
                      <td style={{ padding: '0.75rem' }}>{exc.summary}</td>
                      <td style={{ padding: '0.75rem' }}><span className="badge badge-warning">{exc.status}</span></td>
                      <td style={{ padding: '0.75rem', color: exc.dueHours <= 4 ? '#ef4444' : 'inherit' }}>
                        {exc.dueHours}h remaining
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>Investigate</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {activeTab === 'notifications' && (
        <div className="crm-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Enterprise Notification Center & Outbox Pipeline</h3>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
            Orchestration queue covering In-App, Email, SMS and WhatsApp. Failed deliveries are automatically retried before dead-letter disposition.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #334155)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Notification #</th>
                  <th style={{ padding: '0.75rem' }}>Channel</th>
                  <th style={{ padding: '0.75rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem' }}>Recipient (Masked)</th>
                  <th style={{ padding: '0.75rem' }}>Subject / Event</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Delivery Attempts</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted, #94a3b8)' }}>
                    Outbox pipeline empty. Real-time message events will dispatch automatically.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Observability */}
      {activeTab === 'observability' && (
        <div className="crm-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>System Observability & Audits</h3>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
            Telemetry, execution latencies, and security audit logs with PII masking.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.875rem', borderRadius: '6px', borderLeft: '4px solid #10b981', background: 'var(--bg-secondary, #1e293b)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>GOVERNANCE_SWEEP Heartbeat</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>Latency: 25ms • 2 mins ago</span>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Automated sweep executed successfully: 0 retries required, 0 dead letters, all SLA targets evaluated.
              </p>
            </div>
            <div style={{ padding: '0.875rem', borderRadius: '6px', borderLeft: '4px solid #6366f1', background: 'var(--bg-secondary, #1e293b)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>WORKFLOW_STEP_TRANSITION</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>Latency: 14ms • 15 mins ago</span>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Step 1 (Technical Verification) approved for instance WFI-20261025-10021 by authorized engineer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
