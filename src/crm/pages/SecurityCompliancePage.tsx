import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Database,
  Activity,
  FileText,
  Server,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  Plus,
  Clock,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Types for Phase 14 Enterprise Security & Resilience
interface SecurityIncident {
  id: string;
  incident_number: string;
  title: string;
  severity: 'p1_critical' | 'p2_high' | 'p3_medium' | 'p4_low';
  category: string;
  detection_source: string;
  affected_module: string;
  status: 'reported' | 'investigating' | 'contained' | 'resolved' | 'closed';
  incident_owner: string;
  containment_action?: string;
  root_cause?: string;
  corrective_action?: string;
  created_at: string;
}

interface RiskItem {
  id: string;
  risk_code: string;
  risk_title: string;
  category: 'cybersecurity' | 'financial' | 'operational' | 'compliance' | 'supply_chain' | 'manufacturing' | 'business_continuity';
  probability: number;
  impact: number;
  inherent_score: number;
  residual_probability: number;
  residual_impact: number;
  residual_score: number;
  risk_owner: string;
  mitigation_plan: string;
  status: 'identified' | 'assessing' | 'mitigating' | 'accepted' | 'closed';
  due_date: string;
}

interface CriticalProcess {
  id: string;
  process_code: string;
  process_name: string;
  owning_module: string;
  recovery_priority: 'tier_0_mission_critical' | 'tier_1_business_critical' | 'tier_2_important' | 'tier_3_deferrable';
  rpo_target_hours: number;
  rto_target_hours: number;
  dr_readiness_status: 'ready' | 'degraded' | 'gap_identified' | 'testing_required';
  last_test_date: string;
  process_owner: string;
}

interface AutomationJournalEntry {
  id: string;
  job_name: string;
  idempotency_key: string;
  execution_identifier: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'dead_letter';
  retry_count: number;
  max_retries: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

interface DataGovernanceEntity {
  id: string;
  table_name: string;
  data_classification: 'public' | 'internal' | 'confidential' | 'restricted_pii' | 'statutory_financial';
  contains_pii: boolean;
  retention_period_months: number;
  governance_owner: string;
  active_records: number;
  access_governance_rule: string;
}

interface EnterpriseAuditRecord {
  id: string;
  event_category: 'auth' | 'rbac' | 'rls' | 'data_access' | 'financial' | 'admin_config' | 'incident' | 'automation';
  event_action: string;
  severity: 'info' | 'warning' | 'critical';
  user_email: string;
  role: string;
  ip_address: string;
  created_at: string;
  details: string;
}

export const SecurityCompliancePage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'posture' | 'risks' | 'incidents' | 'governance' | 'bcm' | 'automation' | 'audit'
  >('posture');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');

  // Mock initial enterprise telemetry
  const [incidents] = useState<SecurityIncident[]>([
    {
      id: 'inc-001',
      incident_number: 'INC-2026-0001',
      title: 'Repeated unauthorized access attempts to treasury journal RPC',
      severity: 'p1_critical',
      category: 'cybersecurity',
      detection_source: 'fn_log_security_audit_event (Deterministic Alert)',
      affected_module: 'finance_treasury',
      status: 'contained',
      incident_owner: 'security_lead@zuvo.tv',
      containment_action: 'IP subnet rate-limited & token revoked',
      root_cause: 'Stale credential automated probe detected',
      corrective_action: 'Rotated secret keys & reinforced fixed search_path validation',
      created_at: '2026-10-21 07:14:00'
    },
    {
      id: 'inc-002',
      incident_number: 'INC-2026-0002',
      title: 'Cross-tenant query attempt on dealer consignment inventory',
      severity: 'p2_high',
      category: 'compliance',
      detection_source: 'RLS Tenant Isolation Policy Monitor',
      affected_module: 'dealer_consignment',
      status: 'resolved',
      incident_owner: 'compliance_officer@zuvo.tv',
      containment_action: 'Client session terminated',
      root_cause: 'Malformed multi-tenant query filter from external portal',
      corrective_action: 'Enforced tenant_id claim validator in auth interceptor',
      created_at: '2026-10-20 14:32:00'
    },
    {
      id: 'inc-003',
      incident_number: 'INC-2026-0003',
      title: 'Batch warranty claims idempotency duplicate collision detected',
      severity: 'p3_medium',
      category: 'operational',
      detection_source: 'sec_automation_execution_journal',
      affected_module: 'service_warranty',
      status: 'closed',
      incident_owner: 'ops_lead@zuvo.tv',
      containment_action: 'Idempotency key rejection triggered automatically',
      root_cause: 'Network replay from partner portal sync worker',
      corrective_action: 'Partner webhook retry jitter implemented',
      created_at: '2026-10-19 11:20:00'
    }
  ]);

  const [risks] = useState<RiskItem[]>([
    {
      id: 'rsk-001',
      risk_code: 'RSK-CYBER-01',
      risk_title: 'Direct execution of SECURITY DEFINER functions without search_path guard',
      category: 'cybersecurity',
      probability: 2,
      impact: 5,
      inherent_score: 10,
      residual_probability: 1,
      residual_impact: 4,
      residual_score: 4,
      risk_owner: 'DevOps / DB Architect',
      mitigation_plan: 'Enforced SET search_path = public, pg_temp on 100% of privileged RPCs',
      status: 'mitigating',
      due_date: '2026-11-15'
    },
    {
      id: 'rsk-002',
      risk_code: 'RSK-FIN-01',
      risk_title: 'Silent double posting of payroll or dealer commission payouts',
      category: 'financial',
      probability: 3,
      impact: 5,
      inherent_score: 15,
      residual_probability: 1,
      residual_impact: 5,
      residual_score: 5,
      risk_owner: 'Chief Financial Officer',
      mitigation_plan: 'Mandated unique idempotency keys in sec_automation_execution_journal before ledger execution',
      status: 'mitigating',
      due_date: '2026-10-31'
    },
    {
      id: 'rsk-003',
      risk_code: 'RSK-OPS-01',
      risk_title: 'Critical assembly line stoppage due to unverified component BOM firmware mismatch',
      category: 'manufacturing',
      probability: 4,
      impact: 4,
      inherent_score: 16,
      residual_probability: 2,
      residual_impact: 3,
      residual_score: 6,
      risk_owner: 'VP Manufacturing',
      mitigation_plan: 'Strict Phase 13 station QA gating and automated hold routing',
      status: 'mitigating',
      due_date: '2026-12-01'
    },
    {
      id: 'rsk-004',
      risk_code: 'RSK-COMP-01',
      risk_title: 'Customer PII leakage via unprotected warranty lookup endpoints',
      category: 'compliance',
      probability: 2,
      impact: 5,
      inherent_score: 10,
      residual_probability: 1,
      residual_impact: 4,
      residual_score: 4,
      risk_owner: 'Data Protection Officer',
      mitigation_plan: 'Restricted PII masking and mandatory sec_data_access_audit logging',
      status: 'mitigating',
      due_date: '2026-11-30'
    }
  ]);

  const [processes] = useState<CriticalProcess[]>([
    {
      id: 'bcm-001',
      process_code: 'PRC-01-TXN',
      process_name: 'Core General Ledger & Invoicing Engine',
      owning_module: 'finance_gl',
      recovery_priority: 'tier_0_mission_critical',
      rpo_target_hours: 0.25,
      rto_target_hours: 1.0,
      dr_readiness_status: 'ready',
      last_test_date: '2026-10-15',
      process_owner: 'CFO / Lead DBA'
    },
    {
      id: 'bcm-002',
      process_code: 'PRC-02-SRV',
      process_name: 'Customer Field Service & Warranty Verification',
      owning_module: 'service_warranty',
      recovery_priority: 'tier_1_business_critical',
      rpo_target_hours: 1.0,
      rto_target_hours: 4.0,
      dr_readiness_status: 'ready',
      last_test_date: '2026-10-10',
      process_owner: 'Head of Customer Experience'
    },
    {
      id: 'bcm-003',
      process_code: 'PRC-03-MFG',
      process_name: 'Smart Factory MES & Station Quality Lockouts',
      owning_module: 'manufacturing',
      recovery_priority: 'tier_1_business_critical',
      rpo_target_hours: 0.5,
      rto_target_hours: 2.0,
      dr_readiness_status: 'ready',
      last_test_date: '2026-10-18',
      process_owner: 'Plant General Manager'
    },
    {
      id: 'bcm-004',
      process_code: 'PRC-04-PAY',
      process_name: 'Dealer Incentive Payout & Payroll Disbursals',
      owning_module: 'treasury',
      recovery_priority: 'tier_2_important',
      rpo_target_hours: 4.0,
      rto_target_hours: 12.0,
      dr_readiness_status: 'ready',
      last_test_date: '2026-09-30',
      process_owner: 'Treasury Lead'
    }
  ]);

  const [governance] = useState<DataGovernanceEntity[]>([
    {
      id: 'gov-001',
      table_name: 'customers',
      data_classification: 'restricted_pii',
      contains_pii: true,
      retention_period_months: 84,
      governance_owner: 'Legal & Compliance',
      active_records: 48920,
      access_governance_rule: 'Access logged to sec_data_access_audit; masked phone/email for non-superadmin'
    },
    {
      id: 'gov-002',
      table_name: 'dealer_kyc_documents',
      data_classification: 'confidential',
      contains_pii: true,
      retention_period_months: 96,
      governance_owner: 'Finance Risk Lead',
      active_records: 2450,
      access_governance_rule: 'Encrypted storage paths; privileged download verification required'
    },
    {
      id: 'gov-003',
      table_name: 'gl_journal_entries',
      data_classification: 'statutory_financial',
      contains_pii: false,
      retention_period_months: 120,
      governance_owner: 'Chief Financial Officer',
      active_records: 184500,
      access_governance_rule: 'Immutable append-only; update/delete strictly revoked by triggers'
    },
    {
      id: 'gov-004',
      table_name: 'sec_enterprise_audit_log',
      data_classification: 'statutory_financial',
      contains_pii: false,
      retention_period_months: 84,
      governance_owner: 'Chief Information Security Officer',
      active_records: 92400,
      access_governance_rule: 'WORM (Write Once Read Many); zero update/delete permissions granted'
    }
  ]);

  const [automationJobs] = useState<AutomationJournalEntry[]>([
    {
      id: 'job-001',
      job_name: 'sync_dealer_consignment_ledger',
      idempotency_key: 'IDEMP-20261021-0900-CONS',
      execution_identifier: 'EXEC-772910-AUTO',
      status: 'completed',
      retry_count: 0,
      max_retries: 3,
      started_at: '2026-10-21 09:00:00',
      completed_at: '2026-10-21 09:00:12'
    },
    {
      id: 'job-002',
      job_name: 'batch_calculate_mfg_oee_metrics',
      idempotency_key: 'IDEMP-20261021-0800-OEE',
      execution_identifier: 'EXEC-772899-AUTO',
      status: 'completed',
      retry_count: 0,
      max_retries: 3,
      started_at: '2026-10-21 08:00:00',
      completed_at: '2026-10-21 08:02:45'
    },
    {
      id: 'job-003',
      job_name: 'automated_bank_recon_feed_import',
      idempotency_key: 'IDEMP-20261021-0730-RECON',
      execution_identifier: 'EXEC-772810-AUTO',
      status: 'dead_letter',
      retry_count: 3,
      max_retries: 3,
      error_message: 'Host bank SFTP gateway timeout after 3 retries (504 Gateway)',
      started_at: '2026-10-21 07:30:00'
    }
  ]);

  const [auditLogs] = useState<EnterpriseAuditRecord[]>([
    {
      id: 'aud-001',
      event_category: 'auth',
      event_action: 'MFA_CHALLENGE_VERIFIED',
      severity: 'info',
      user_email: user?.email || 'admin@zuvo.tv',
      role: user?.role || 'super_admin',
      ip_address: '103.21.244.18',
      created_at: '2026-10-21 09:22:10',
      details: 'Elevated administrative session validated with FIDO2 hardware token.'
    },
    {
      id: 'aud-002',
      event_category: 'rls',
      event_action: 'CROSS_TENANT_READ_BLOCKED',
      severity: 'warning',
      user_email: 'dealer_ops@partner.zuvo.tv',
      role: 'dealer',
      ip_address: '122.161.44.82',
      created_at: '2026-10-21 08:44:19',
      details: 'RLS check prevented tenant mismatch reading table: dealer_inventory_batches.'
    },
    {
      id: 'aud-003',
      event_category: 'data_access',
      event_action: 'RESTRICTED_PII_EXPORT_REQUESTED',
      severity: 'critical',
      user_email: 'service_lead@zuvo.tv',
      role: 'service',
      ip_address: '103.21.244.20',
      created_at: '2026-10-21 07:55:04',
      details: 'Export of 500 customer contact records recorded in sec_data_access_audit.'
    },
    {
      id: 'aud-004',
      event_category: 'admin_config',
      event_action: 'SECURITY_SETTING_MODIFIED',
      severity: 'warning',
      user_email: 'sec_admin@zuvo.tv',
      role: 'super_admin',
      ip_address: '10.0.4.12',
      created_at: '2026-10-20 18:30:00',
      details: 'Updated BCM recovery target RTO for service operations from 6.0h to 4.0h.'
    }
  ]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Enterprise Security, Compliance & Resilience Command Center
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Phase 14 Active
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Centralized Governance, Zero-Trust RLS Verification, WORM Audit Logs & BCM Disaster Readiness
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-400 block">Operator Session</span>
            <span className="text-xs font-mono font-medium text-indigo-300">
              {user?.email || 'super_admin@zuvo.tv'} ({user?.role || 'super_admin'})
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Telemetry
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2 scrollbar-none">
        {[
          { id: 'posture', label: 'Security Posture', icon: ShieldCheck },
          { id: 'risks', label: 'Risk Register & Mitigations', icon: AlertTriangle, count: risks.length },
          { id: 'incidents', label: 'Security Incidents', icon: ShieldAlert, count: incidents.length },
          { id: 'governance', label: 'Data Governance & PII', icon: Database },
          { id: 'bcm', label: 'BCM & Disaster Recovery', icon: Server },
          { id: 'automation', label: 'Automation Idempotency', icon: Activity, count: automationJobs.filter(j => j.status === 'dead_letter').length },
          { id: 'audit', label: 'Immutable Audit Trail', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SECURITY POSTURE */}
      {activeTab === 'posture' && (
        <div className="space-y-6">
          {/* Posture Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-400">RLS Enforcement</span>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">100%</div>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> All 54 enterprise tables guarded
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-400">Unresolved Incidents</span>
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">1 Active</div>
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 1 P1 under containment protocol
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-400">High Residual Risks</span>
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-white">0 Critical</div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                All rated &le; 6 post-mitigation
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-400">BCM DR Readiness</span>
                <Server className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">4 / 4 Ready</div>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Tier-0 & Tier-1 drills compliant
              </p>
            </div>
          </div>

          {/* Defense-in-Depth Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                Zero-Trust & Database Isolation Guarantees
              </h3>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Fixed search_path Enforced</span>
                    All privileged <code className="text-indigo-300">SECURITY DEFINER</code> functions explicitly specify <code className="text-indigo-300">SET search_path = public, pg_temp</code> preventing schema substitution hijacking.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Immutable Append-Only Audit Log</span>
                    The <code className="text-indigo-300">sec_enterprise_audit_log</code> table rejects all <code className="text-rose-300">UPDATE</code> and <code className="text-rose-300">DELETE</code> operations via a blocking PostgreSQL trigger.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Tenant Isolation Boundaries</span>
                    Every multi-tenant query strictly checks <code className="text-indigo-300">tenant_id = (SELECT auth.jwt() -&gt;&gt; 'tenant_id')</code> to eliminate cross-tenant data leaks.
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                Deterministic Threat & Anomaly Detectors
              </h3>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Privilege Escalation Monitor</span>
                    Monitors unauthorized requests attempting to mutate user roles or bypass role checks.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Financial Segregation (Maker-Checker) Guard</span>
                    Blocks any user from approving their own journal entries or payment requisitions.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Automation Dead-Letter Traps</span>
                    Automatically pauses jobs exceeding max retry attempts and records them in the dead-letter queue.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RISK REGISTER */}
      {activeTab === 'risks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Enterprise Risk Management (ERM)</h3>
              <p className="text-xs text-slate-400">Comprehensive risk assessment across cybersecurity, financial, operational, and supply chain domains.</p>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition">
              <Plus className="w-3.5 h-3.5" />
              Add Risk Assessment
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Risk Code</th>
                    <th className="p-3">Risk Title</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Inherent (P &times; I)</th>
                    <th className="p-3 text-center">Residual (P &times; I)</th>
                    <th className="p-3">Risk Owner</th>
                    <th className="p-3">Mitigation Plan</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {risks.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-medium text-indigo-300">{r.risk_code}</td>
                      <td className="p-3 font-semibold text-white">{r.risk_title}</td>
                      <td className="p-3 capitalize">{r.category.replace('_', ' ')}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-semibold">
                          {r.inherent_score} ({r.probability}&times;{r.impact})
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
                          {r.residual_score} ({r.residual_probability}&times;{r.residual_impact})
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{r.risk_owner}</td>
                      <td className="p-3 text-slate-300 max-w-xs truncate" title={r.mitigation_plan}>{r.mitigation_plan}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Security Incident Management</h3>
              <p className="text-xs text-slate-400">P1–P4 incident tracking, root cause analysis, containment verification, and immutable records.</p>
            </div>
          </div>

          <div className="space-y-3">
            {incidents.map(inc => (
              <div key={inc.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded border ${
                      inc.severity === 'p1_critical'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : inc.severity === 'p2_high'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                    }`}>
                      {inc.severity.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-xs text-indigo-300 font-semibold">{inc.incident_number}</span>
                    <h4 className="text-sm font-bold text-white">{inc.title}</h4>
                  </div>
                  <span className="text-xs capitalize font-medium text-slate-400 px-2 py-0.5 bg-slate-800 rounded">
                    Status: <span className="text-indigo-300 font-semibold">{inc.status}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg">
                  <div><strong className="text-slate-300">Detection Source:</strong> {inc.detection_source}</div>
                  <div><strong className="text-slate-300">Affected Module:</strong> <code className="text-indigo-300">{inc.affected_module}</code></div>
                  <div><strong className="text-slate-300">Incident Owner:</strong> {inc.incident_owner}</div>
                </div>

                {inc.containment_action && (
                  <div className="text-xs text-slate-300 space-y-1">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Containment Executed:
                    </span>
                    <p className="pl-4 text-slate-400">{inc.containment_action}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DATA GOVERNANCE & PRIVACY */}
      {activeTab === 'governance' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">Data Governance, Classification & Privacy</h3>
            <p className="text-xs text-slate-400">Configurable retention rules, sensitive PII access monitoring, and Indian Digital Personal Data Protection (DPDP) alignment.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {governance.map(g => (
              <div key={g.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <code className="text-sm font-bold text-indigo-300">{g.table_name}</code>
                    <span className="text-xs text-slate-400 block mt-0.5">Owner: {g.governance_owner}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                    g.data_classification === 'restricted_pii'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : g.data_classification === 'confidential'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                  }`}>
                    {g.data_classification.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Retention Period:</span>
                    <span className="font-semibold text-white">{g.retention_period_months} months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Records:</span>
                    <span className="font-mono text-indigo-300">{g.active_records.toLocaleString()}</span>
                  </div>
                  <div className="pt-1 text-[11px] text-slate-400">
                    <strong className="text-slate-300">Rule:</strong> {g.access_governance_rule}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: BCM & DISASTER RECOVERY */}
      {activeTab === 'bcm' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">Business Continuity Management (BCM) & Disaster Recovery</h3>
            <p className="text-xs text-slate-400">Tier-0 through Tier-3 mission critical dependency mapping, RTO/RPO targets, and exercise verification evidence.</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Process Code</th>
                  <th className="p-3">Critical Process</th>
                  <th className="p-3">Priority Tier</th>
                  <th className="p-3 text-center">RPO Target</th>
                  <th className="p-3 text-center">RTO Target</th>
                  <th className="p-3">DR Readiness</th>
                  <th className="p-3">Last Drill Date</th>
                  <th className="p-3">Process Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {processes.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-medium text-indigo-300">{p.process_code}</td>
                    <td className="p-3 font-semibold text-white">{p.process_name}</td>
                    <td className="p-3 capitalize font-semibold text-amber-400">{p.recovery_priority.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-center font-mono text-white">{p.rpo_target_hours}h</td>
                    <td className="p-3 text-center font-mono text-white">{p.rto_target_hours}h</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {p.dr_readiness_status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{p.last_test_date}</td>
                    <td className="p-3 text-slate-300">{p.process_owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: AUTOMATION RESILIENCE */}
      {activeTab === 'automation' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">Automation Execution Journal & Dead-Letter Queue</h3>
            <p className="text-xs text-slate-400">Strict idempotency controls preventing silent transaction duplication, retry tracking, and circuit breakers.</p>
          </div>

          <div className="space-y-3">
            {automationJobs.map(job => (
              <div key={job.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded ${
                      job.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : job.status === 'dead_letter'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}>
                      {job.status.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-sm font-bold text-white">{job.job_name}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    Idempotency Key: <code className="text-indigo-300">{job.idempotency_key}</code>
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex flex-wrap gap-4 pt-1">
                  <span>Execution: <strong className="text-slate-300 font-mono">{job.execution_identifier}</strong></span>
                  <span>Retries: <strong className="text-slate-300">{job.retry_count} / {job.max_retries}</strong></span>
                  <span>Started: <strong className="text-slate-300">{job.started_at}</strong></span>
                </div>

                {job.error_message && (
                  <div className="mt-2 text-xs bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg text-rose-300">
                    <strong>Dead-Letter Error:</strong> {job.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: IMMUTABLE AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Immutable Enterprise Audit Trail</h3>
              <p className="text-xs text-slate-400">WORM (Write-Once-Read-Many) compliant event stream recording privileged and sensitive operations.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter audit events..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Actor (Role)</th>
                  <th className="p-3">Client IP</th>
                  <th className="p-3">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-400 whitespace-nowrap">{log.created_at}</td>
                    <td className="p-3 uppercase text-indigo-300 font-semibold">{log.event_category}</td>
                    <td className="p-3 text-white font-semibold">{log.event_action}</td>
                    <td className="p-3 text-slate-300">{log.user_email} ({log.role})</td>
                    <td className="p-3 text-slate-400">{log.ip_address}</td>
                    <td className="p-3 font-sans text-slate-300">{log.details}</td>
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
