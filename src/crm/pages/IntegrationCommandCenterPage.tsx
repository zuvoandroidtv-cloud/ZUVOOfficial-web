import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Network,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  MailCheck,
  FileText,
  Inbox,
  Send,
  Skull,
  Shield,
  TrendingUp,
  Search,
  Eye,
  RotateCcw,
  Zap,
  Database,
  Globe,
  CreditCard,
  MessageSquare,
  Package,
  Truck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------
type IntegrationCategory =
  | 'PAYMENT' | 'ACCOUNTING' | 'GST' | 'TAX' | 'SMS' | 'EMAIL'
  | 'WHATSAPP' | 'SHIPPING' | 'LOGISTICS' | 'BANKING' | 'ERP'
  | 'MARKETPLACE' | 'WEBSITE' | 'ANALYTICS' | 'DOCUMENT' | 'OTHER';

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'AT_RISK' | 'DOWN' | 'CONFIGURATION_ERROR' | 'UNKNOWN';

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DEPRECATED' | 'CONFIGURATION_REQUIRED';

type EventStatus =
  | 'RECEIVED' | 'VALIDATED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DEAD_LETTER'
  | 'PENDING' | 'RETRYING' | 'SENT';

type CommStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

type DocStatus = 'DRAFT' | 'GENERATED' | 'ISSUED' | 'SUPERSEDED' | 'CANCELLED' | 'ARCHIVED';

interface MockIntegration {
  id: string;
  integration_code: string;
  integration_name: string;
  category: IntegrationCategory;
  provider: string;
  environment: string;
  status: IntegrationStatus;
  health_status: HealthStatus;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  inbox_pending: number;
  outbox_pending: number;
  dlq_open: number;
  credential_alerts: number;
}

interface MockEvent {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  integration: string;
  event_type: string;
  status: EventStatus;
  received_at: string;
  attempt_count: number;
  correlation_id: string;
}

interface MockComm {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  message_type: string;
  recipient: string;
  status: CommStatus;
  queued_at: string;
  sent_at: string | null;
}

interface MockDocument {
  id: string;
  document_type: string;
  entity_type: string;
  document_number: string;
  version: number;
  status: DocStatus;
  generated_at: string;
  deliveries: number;
}

interface MockDLQ {
  id: string;
  integration: string;
  event_type: string;
  failure_category: string;
  failure_reason: string;
  attempt_count: number;
  final_failure_at: string;
  resolution_status: 'OPEN' | 'REPLAY_REQUESTED' | 'REPLAYED' | 'DISMISSED';
}

// ---------------------------------------------------------------------------
// MOCK DATA (UI scaffold — real data via Supabase RPCs in production)
// ---------------------------------------------------------------------------
const MOCK_INTEGRATIONS: MockIntegration[] = [
  {
    id: 'int-001', integration_code: 'RAZORPAY_PG', integration_name: 'Razorpay Payment Gateway',
    category: 'PAYMENT', provider: 'Razorpay', environment: 'PRODUCTION', status: 'ACTIVE',
    health_status: 'HEALTHY', last_success_at: '2026-10-24T09:45:00Z', last_failure_at: null,
    failure_count: 0, inbox_pending: 2, outbox_pending: 0, dlq_open: 0, credential_alerts: 0,
  },
  {
    id: 'int-002', integration_code: 'TALLY_ERP', integration_name: 'Tally ERP Accounting',
    category: 'ACCOUNTING', provider: 'Tally Solutions', environment: 'PRODUCTION', status: 'ACTIVE',
    health_status: 'DEGRADED', last_success_at: '2026-10-24T06:00:00Z', last_failure_at: '2026-10-24T08:30:00Z',
    failure_count: 7, inbox_pending: 0, outbox_pending: 14, dlq_open: 3, credential_alerts: 1,
  },
  {
    id: 'int-003', integration_code: 'MSG91_SMS', integration_name: 'MSG91 SMS Gateway',
    category: 'SMS', provider: 'MSG91', environment: 'PRODUCTION', status: 'ACTIVE',
    health_status: 'HEALTHY', last_success_at: '2026-10-24T10:15:00Z', last_failure_at: null,
    failure_count: 1, inbox_pending: 0, outbox_pending: 3, dlq_open: 0, credential_alerts: 0,
  },
  {
    id: 'int-004', integration_code: 'SENDGRID_EMAIL', integration_name: 'SendGrid Email Delivery',
    category: 'EMAIL', provider: 'Twilio SendGrid', environment: 'PRODUCTION', status: 'ACTIVE',
    health_status: 'HEALTHY', last_success_at: '2026-10-24T10:30:00Z', last_failure_at: null,
    failure_count: 0, inbox_pending: 0, outbox_pending: 5, dlq_open: 0, credential_alerts: 0,
  },
  {
    id: 'int-005', integration_code: 'DELHIVERY_SHIP', integration_name: 'Delhivery Logistics',
    category: 'SHIPPING', provider: 'Delhivery', environment: 'PRODUCTION', status: 'ACTIVE',
    health_status: 'AT_RISK', last_success_at: '2026-10-23T22:00:00Z', last_failure_at: '2026-10-24T07:00:00Z',
    failure_count: 23, inbox_pending: 5, outbox_pending: 8, dlq_open: 6, credential_alerts: 1,
  },
  {
    id: 'int-006', integration_code: 'GSTN_API', integration_name: 'GSTN GST Compliance API',
    category: 'GST', provider: 'GSTN / NIC', environment: 'PRODUCTION', status: 'ACTIVE',
    health_status: 'HEALTHY', last_success_at: '2026-10-24T10:00:00Z', last_failure_at: null,
    failure_count: 0, inbox_pending: 0, outbox_pending: 2, dlq_open: 0, credential_alerts: 0,
  },
];

const MOCK_EVENTS: MockEvent[] = [
  { id: 'ev-001', direction: 'INBOUND', integration: 'Razorpay', event_type: 'payment.captured', status: 'PROCESSED', received_at: '2026-10-24T09:45:00Z', attempt_count: 1, correlation_id: 'corr-a1b2' },
  { id: 'ev-002', direction: 'OUTBOUND', integration: 'Tally ERP', event_type: 'invoice.sync', status: 'RETRYING', received_at: '2026-10-24T08:30:00Z', attempt_count: 3, correlation_id: 'corr-c3d4' },
  { id: 'ev-003', direction: 'INBOUND', integration: 'Delhivery', event_type: 'shipment.delivered', status: 'FAILED', received_at: '2026-10-24T07:00:00Z', attempt_count: 5, correlation_id: 'corr-e5f6' },
  { id: 'ev-004', direction: 'OUTBOUND', integration: 'MSG91', event_type: 'sms.send', status: 'SENT', received_at: '2026-10-24T10:15:00Z', attempt_count: 1, correlation_id: 'corr-g7h8' },
  { id: 'ev-005', direction: 'INBOUND', integration: 'Razorpay', event_type: 'refund.processed', status: 'VALIDATED', received_at: '2026-10-24T10:20:00Z', attempt_count: 0, correlation_id: 'corr-i9j0' },
  { id: 'ev-006', direction: 'OUTBOUND', integration: 'SendGrid', event_type: 'email.invoice', status: 'PENDING', received_at: '2026-10-24T10:28:00Z', attempt_count: 0, correlation_id: 'corr-k1l2' },
];

const MOCK_COMMS: MockComm[] = [
  { id: 'cm-001', channel: 'EMAIL', message_type: 'INVOICE_GENERATED', recipient: 'dealer@acmestores.in', status: 'DELIVERED', queued_at: '2026-10-24T09:00:00Z', sent_at: '2026-10-24T09:01:00Z' },
  { id: 'cm-002', channel: 'SMS', message_type: 'TECHNICIAN_ASSIGNED', recipient: '+919876543210', status: 'SENT', queued_at: '2026-10-24T10:00:00Z', sent_at: '2026-10-24T10:01:00Z' },
  { id: 'cm-003', channel: 'WHATSAPP', message_type: 'WARRANTY_APPROVED', recipient: '+918765432109', status: 'DELIVERED', queued_at: '2026-10-24T08:30:00Z', sent_at: '2026-10-24T08:31:00Z' },
  { id: 'cm-004', channel: 'EMAIL', message_type: 'PAYMENT_RECEIVED', recipient: 'customer@example.com', status: 'FAILED', queued_at: '2026-10-24T07:00:00Z', sent_at: null },
  { id: 'cm-005', channel: 'SMS', message_type: 'SHIPMENT_DISPATCHED', recipient: '+917654321098', status: 'QUEUED', queued_at: '2026-10-24T10:30:00Z', sent_at: null },
];

const MOCK_DOCUMENTS: MockDocument[] = [
  { id: 'doc-001', document_type: 'INVOICE', entity_type: 'sale', document_number: 'INV-2026-10-09821', version: 1, status: 'ISSUED', generated_at: '2026-10-24T09:00:00Z', deliveries: 2 },
  { id: 'doc-002', document_type: 'WARRANTY_CERTIFICATE', entity_type: 'warranty', document_number: 'WC-2026-04412', version: 1, status: 'ISSUED', generated_at: '2026-10-24T08:00:00Z', deliveries: 1 },
  { id: 'doc-003', document_type: 'DELIVERY_DOCUMENT', entity_type: 'fulfillment', document_number: 'DC-2026-01187', version: 2, status: 'ISSUED', generated_at: '2026-10-24T10:00:00Z', deliveries: 3 },
  { id: 'doc-004', document_type: 'CREDIT_NOTE', entity_type: 'return', document_number: 'CN-2026-00341', version: 1, status: 'GENERATED', generated_at: '2026-10-24T10:25:00Z', deliveries: 0 },
  { id: 'doc-005', document_type: 'SERVICE_REPORT', entity_type: 'service_ticket', document_number: 'SR-2026-07723', version: 1, status: 'ISSUED', generated_at: '2026-10-23T18:00:00Z', deliveries: 2 },
];

const MOCK_DLQ: MockDLQ[] = [
  { id: 'dlq-001', integration: 'Tally ERP', event_type: 'invoice.sync', failure_category: 'PROVIDER_ERROR', failure_reason: 'Connection timeout after 30s', attempt_count: 5, final_failure_at: '2026-10-24T08:30:00Z', resolution_status: 'OPEN' },
  { id: 'dlq-002', integration: 'Delhivery', event_type: 'shipment.update', failure_category: 'VALIDATION_ERROR', failure_reason: 'Invalid tracking ID format', attempt_count: 3, final_failure_at: '2026-10-24T07:00:00Z', resolution_status: 'OPEN' },
  { id: 'dlq-003', integration: 'Delhivery', event_type: 'pod.upload', failure_category: 'AUTH_FAILURE', failure_reason: 'API key expired', attempt_count: 5, final_failure_at: '2026-10-23T22:00:00Z', resolution_status: 'REPLAY_REQUESTED' },
  { id: 'dlq-004', integration: 'Tally ERP', event_type: 'payment.sync', failure_category: 'NETWORK_ERROR', failure_reason: 'SSL handshake failed', attempt_count: 5, final_failure_at: '2026-10-24T06:00:00Z', resolution_status: 'OPEN' },
];

// ---------------------------------------------------------------------------
// HELPER COMPONENTS
// ---------------------------------------------------------------------------
const HealthBadge: React.FC<{ status: HealthStatus }> = ({ status }) => {
  const map: Record<HealthStatus, { color: string; icon: React.ReactNode; label: string }> = {
    HEALTHY:             { color: 'var(--status-success)', icon: <CheckCircle2 size={12} />, label: 'Healthy' },
    DEGRADED:            { color: 'var(--status-warning)', icon: <AlertTriangle size={12} />, label: 'Degraded' },
    AT_RISK:             { color: '#f97316', icon: <AlertTriangle size={12} />, label: 'At Risk' },
    DOWN:                { color: 'var(--status-error)', icon: <XCircle size={12} />, label: 'Down' },
    CONFIGURATION_ERROR: { color: '#a855f7', icon: <Shield size={12} />, label: 'Config Error' },
    UNKNOWN:             { color: 'var(--text-muted)', icon: <Clock size={12} />, label: 'Unknown' },
  };
  const cfg = map[status] ?? map.UNKNOWN;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: `${cfg.color}22`, color: cfg.color, fontSize: '0.72rem', fontWeight: 700 }}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

const StatusBadge: React.FC<{ status: string; type?: 'event' | 'comm' | 'doc' | 'dlq' }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    PROCESSED: 'var(--status-success)', SENT: 'var(--status-success)', DELIVERED: 'var(--status-success)',
    ISSUED: 'var(--status-success)', HEALTHY: 'var(--status-success)', REPLAYED: 'var(--status-success)',
    RETRYING: 'var(--status-warning)', DEGRADED: 'var(--status-warning)', QUEUED: 'var(--status-warning)',
    SENDING: 'var(--status-warning)', PENDING: 'var(--status-warning)', PROCESSING: 'var(--status-warning)',
    VALIDATED: '#60a5fa', RECEIVED: '#60a5fa', GENERATED: '#60a5fa', REPLAY_REQUESTED: '#60a5fa',
    FAILED: 'var(--status-error)', DEAD_LETTER: 'var(--status-error)', OPEN: 'var(--status-error)',
    CANCELLED: 'var(--text-muted)', SUPERSEDED: 'var(--text-muted)', DISMISSED: 'var(--text-muted)',
  };
  const color = colorMap[status] ?? 'var(--text-muted)';
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: `${color}22`, color, fontSize: '0.72rem', fontWeight: 700 }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const CategoryIcon: React.FC<{ category: IntegrationCategory }> = ({ category }) => {
  const iconMap: Record<IntegrationCategory, React.ReactNode> = {
    PAYMENT: <CreditCard size={16} />, ACCOUNTING: <Database size={16} />, GST: <Shield size={16} />,
    TAX: <Shield size={16} />, SMS: <MessageSquare size={16} />, EMAIL: <MailCheck size={16} />,
    WHATSAPP: <MessageSquare size={16} />, SHIPPING: <Truck size={16} />, LOGISTICS: <Package size={16} />,
    BANKING: <Database size={16} />, ERP: <Zap size={16} />, MARKETPLACE: <Globe size={16} />,
    WEBSITE: <Globe size={16} />, ANALYTICS: <TrendingUp size={16} />, DOCUMENT: <FileText size={16} />,
    OTHER: <Network size={16} />,
  };
  return <>{iconMap[category] ?? <Network size={16} />}</>;
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color?: string; sub?: string }> = ({ label, value, icon, color = 'var(--accent-cyan)', sub }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.7rem', color, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// TAB DEFINITIONS
// ---------------------------------------------------------------------------
type PageTab = 'overview' | 'registry' | 'events' | 'dlq' | 'communications' | 'documents' | 'trace' | 'alerts';

const TABS: { id: PageTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Executive Overview', icon: <Activity size={15} /> },
  { id: 'registry', label: 'Integration Registry', icon: <Network size={15} /> },
  { id: 'events', label: 'Event Monitor', icon: <Zap size={15} /> },
  { id: 'dlq', label: 'Dead Letter Queue', icon: <Skull size={15} /> },
  { id: 'communications', label: 'Communications', icon: <MailCheck size={15} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={15} /> },
  { id: 'trace', label: 'Trace Explorer', icon: <Search size={15} /> },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={15} /> },
];

// ---------------------------------------------------------------------------
// MAIN PAGE COMPONENT
// ---------------------------------------------------------------------------
export const IntegrationCommandCenterPage: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<PageTab>('overview');
  const [traceQuery, setTraceQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [commFilter, setCommFilter] = useState<'ALL' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP'>('ALL');
  const [replayingDlq, setReplayingDlq] = useState<string | null>(null);
  const [dlqItems, setDlqItems] = useState<MockDLQ[]>(MOCK_DLQ);
  const [lastSweep, setLastSweep] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  // Role guard
  const canConfigure = role && ['super_admin', 'admin'].includes(role);
  const canViewFinance = role && ['super_admin', 'admin', 'sales'].includes(role);

  // KPIs
  const totalIntegrations = MOCK_INTEGRATIONS.length;
  const activeIntegrations = MOCK_INTEGRATIONS.filter(i => i.status === 'ACTIVE').length;
  const healthyIntegrations = MOCK_INTEGRATIONS.filter(i => i.health_status === 'HEALTHY').length;
  const totalDlqOpen = MOCK_DLQ.filter(d => d.resolution_status === 'OPEN').length;
  const totalCredAlerts = MOCK_INTEGRATIONS.reduce((s, i) => s + i.credential_alerts, 0);
  const totalQueueDepth = MOCK_INTEGRATIONS.reduce((s, i) => s + i.inbox_pending + i.outbox_pending, 0);
  const failedComms = MOCK_COMMS.filter(c => c.status === 'FAILED').length;

  const handleRunSweep = async () => {
    setSweeping(true);
    await new Promise(r => setTimeout(r, 1500));
    setLastSweep(new Date().toLocaleTimeString());
    setSweeping(false);
  };

  const handleReplayDlq = (id: string) => {
    setReplayingDlq(id);
    setTimeout(() => {
      setDlqItems(prev => prev.map(d => d.id === id ? { ...d, resolution_status: 'REPLAY_REQUESTED' } : d));
      setReplayingDlq(null);
    }, 1200);
  };

  const filteredEvents = MOCK_EVENTS.filter(e => eventFilter === 'ALL' || e.direction === eventFilter);
  const filteredComms = MOCK_COMMS.filter(c => commFilter === 'ALL' || c.channel === commFilter);
  const traceResults = traceQuery.length >= 3
    ? MOCK_EVENTS.filter(e =>
        e.correlation_id.toLowerCase().includes(traceQuery.toLowerCase()) ||
        e.event_type.toLowerCase().includes(traceQuery.toLowerCase()) ||
        e.integration.toLowerCase().includes(traceQuery.toLowerCase())
      )
    : [];

  const sectionStyle: React.CSSProperties = { padding: '0 24px 24px' };
  const tableHeaderStyle: React.CSSProperties = {
    display: 'grid', padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)',
    fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
  };
  const tableRowStyle: React.CSSProperties = {
    display: 'grid', padding: '10px 12px',
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)', alignItems: 'center',
    fontSize: '0.825rem', marginBottom: 4,
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Page Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
              <Network size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Integration Command Center</h1>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Phase 17 · API Governance, Events, Communications & Documents
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {lastSweep && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Last sweep: {lastSweep}
              </span>
            )}
            {canConfigure && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRunSweep}
                disabled={sweeping}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} className={sweeping ? 'animate-spin' : ''} />
                {sweeping ? 'Sweeping…' : 'Run Health Sweep'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 1 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '0.8rem', fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: 0 }}>

        {/* ── EXECUTIVE OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              <StatCard label="Total Integrations" value={totalIntegrations} icon={<Network size={20} />} />
              <StatCard label="Active & Healthy" value={`${healthyIntegrations}/${activeIntegrations}`} icon={<CheckCircle2 size={20} />} color="var(--status-success)" />
              <StatCard label="Queue Depth" value={totalQueueDepth} icon={<Inbox size={20} />} color="#60a5fa" />
              <StatCard label="Dead Letters (Open)" value={totalDlqOpen} icon={<Skull size={20} />} color="var(--status-error)" />
              <StatCard label="Credential Alerts" value={totalCredAlerts} icon={<Shield size={20} />} color="#f97316" />
              <StatCard label="Failed Comms" value={failedComms} icon={<XCircle size={20} />} color="var(--status-warning)" />
            </div>

            {/* Integration health grid */}
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Integration Health Overview
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {MOCK_INTEGRATIONS.map(int => (
                <div key={int.id} style={{ background: 'var(--bg-card)', border: `1px solid ${int.health_status !== 'HEALTHY' ? 'var(--status-warning)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-lg)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ color: 'var(--accent-cyan)' }}><CategoryIcon category={int.category} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{int.integration_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{int.provider} · {int.category}</div>
                    </div>
                    <HealthBadge status={int.health_status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
                    {[
                      { label: 'Inbox', val: int.inbox_pending, warn: int.inbox_pending > 5 },
                      { label: 'Outbox', val: int.outbox_pending, warn: int.outbox_pending > 10 },
                      { label: 'DLQ', val: int.dlq_open, warn: int.dlq_open > 0 },
                      { label: 'Cred ⚠', val: int.credential_alerts, warn: int.credential_alerts > 0 },
                    ].map(m => (
                      <div key={m.label} style={{ background: m.warn ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-sm)', padding: '6px 4px' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: m.warn ? 'var(--status-error)' : 'inherit' }}>{m.val}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INTEGRATION REGISTRY ──────────────────────────────────────── */}
        {activeTab === 'registry' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20 }}>
              <div style={{ ...tableHeaderStyle, gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                <span>Integration</span><span>Category</span><span>Provider</span>
                <span>Environment</span><span>Status</span><span>Health</span>
              </div>
              {MOCK_INTEGRATIONS.map(int => (
                <div key={int.id} style={{ ...tableRowStyle, gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{int.integration_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{int.integration_code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--accent-cyan)' }}><CategoryIcon category={int.category} /></span>
                    <span style={{ fontSize: '0.8rem' }}>{int.category}</span>
                  </div>
                  <span>{int.provider}</span>
                  <span style={{ fontSize: '0.78rem' }}>{int.environment}</span>
                  <StatusBadge status={int.status} />
                  <HealthBadge status={int.health_status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EVENT MONITOR ─────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20, display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['ALL', 'INBOUND', 'OUTBOUND'] as const).map(f => (
                <button key={f} className={`btn btn-sm ${eventFilter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEventFilter(f)}>{f}</button>
              ))}
            </div>
            <div style={{ ...tableHeaderStyle, gridTemplateColumns: '80px 1fr 1.5fr 100px 80px 80px' }}>
              <span>Direction</span><span>Integration</span><span>Event Type</span>
              <span>Status</span><span>Attempts</span><span>Time</span>
            </div>
            {filteredEvents.map(ev => (
              <div key={ev.id} style={{ ...tableRowStyle, gridTemplateColumns: '80px 1fr 1.5fr 100px 80px 80px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: ev.direction === 'INBOUND' ? '#60a5fa' : 'var(--accent-cyan)' }}>
                  {ev.direction === 'INBOUND' ? <Inbox size={13} /> : <Send size={13} />}{ev.direction === 'INBOUND' ? 'IN' : 'OUT'}
                </span>
                <span style={{ fontSize: '0.825rem' }}>{ev.integration}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ev.event_type}</span>
                <StatusBadge status={ev.status} />
                <span style={{ textAlign: 'center', color: ev.attempt_count > 3 ? 'var(--status-error)' : 'inherit' }}>{ev.attempt_count}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(ev.received_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── DEAD LETTER QUEUE ─────────────────────────────────────────── */}
        {activeTab === 'dlq' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20 }}>
              <div style={{ ...tableHeaderStyle, gridTemplateColumns: '1fr 1.5fr 1fr 1fr 80px 100px 80px' }}>
                <span>Integration</span><span>Event Type</span><span>Failure</span>
                <span>Reason</span><span>Attempts</span><span>Status</span><span>Actions</span>
              </div>
              {dlqItems.map(dl => (
                <div key={dl.id} style={{ ...tableRowStyle, gridTemplateColumns: '1fr 1.5fr 1fr 1fr 80px 100px 80px' }}>
                  <span style={{ fontWeight: 600 }}>{dl.integration}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{dl.event_type}</span>
                  <StatusBadge status={dl.failure_category} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dl.failure_reason}>{dl.failure_reason}</span>
                  <span style={{ textAlign: 'center', color: 'var(--status-error)', fontWeight: 700 }}>{dl.attempt_count}</span>
                  <StatusBadge status={dl.resolution_status} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {canConfigure && dl.resolution_status === 'OPEN' && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleReplayDlq(dl.id)}
                        disabled={replayingDlq === dl.id}
                        title="Request Replay"
                        style={{ padding: '4px 8px' }}
                      >
                        {replayingDlq === dl.id ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      </button>
                    )}
                    <button className="btn btn-sm btn-secondary" style={{ padding: '4px 8px' }} title="View Detail">
                      <Eye size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {dlqItems.filter(d => d.resolution_status === 'OPEN').length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--status-success)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontWeight: 700 }}>Dead letter queue is clear</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMMUNICATIONS ────────────────────────────────────────────── */}
        {activeTab === 'communications' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20, display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(['ALL', 'EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'] as const).map(f => (
                <button key={f} className={`btn btn-sm ${commFilter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCommFilter(f as typeof commFilter)}>{f}</button>
              ))}
            </div>
            <div style={{ ...tableHeaderStyle, gridTemplateColumns: '80px 1.5fr 2fr 100px 80px 80px' }}>
              <span>Channel</span><span>Type</span><span>Recipient</span>
              <span>Status</span><span>Queued</span><span>Sent</span>
            </div>
            {filteredComms.map(cm => (
              <div key={cm.id} style={{ ...tableRowStyle, gridTemplateColumns: '80px 1.5fr 2fr 100px 80px 80px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>{cm.channel}</span>
                <span style={{ fontSize: '0.8rem' }}>{cm.message_type.replace(/_/g, ' ')}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{cm.recipient}</span>
                <StatusBadge status={cm.status} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(cm.queued_at).toLocaleTimeString()}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cm.sent_at ? new Date(cm.sent_at).toLocaleTimeString() : '—'}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── DOCUMENTS ─────────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20 }}>
              <div style={{ ...tableHeaderStyle, gridTemplateColumns: '1.5fr 1fr 1.5fr 50px 100px 80px 80px' }}>
                <span>Document</span><span>Type</span><span>Reference</span>
                <span>Ver</span><span>Status</span><span>Generated</span><span>Deliveries</span>
              </div>
              {MOCK_DOCUMENTS.map(doc => (
                <div key={doc.id} style={{ ...tableRowStyle, gridTemplateColumns: '1.5fr 1fr 1.5fr 50px 100px 80px 80px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.825rem' }}>{doc.document_type.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{doc.entity_type}</div>
                  </div>
                  <span style={{ fontSize: '0.78rem' }}>{doc.document_type.split('_')[0]}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>{doc.document_number}</span>
                  <span style={{ textAlign: 'center', fontWeight: 700 }}>v{doc.version}</span>
                  <StatusBadge status={doc.status} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(doc.generated_at).toLocaleTimeString()}</span>
                  <span style={{ textAlign: 'center', color: doc.deliveries === 0 ? 'var(--status-warning)' : 'var(--status-success)', fontWeight: 700 }}>{doc.deliveries}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TRACE EXPLORER ────────────────────────────────────────────── */}
        {activeTab === 'trace' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20, maxWidth: 640, marginBottom: 24 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Search by Correlation ID, Event Type, Integration, Customer, Invoice, Ticket…
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="e.g. corr-a1b2, invoice.sync, Razorpay…"
                  value={traceQuery}
                  onChange={e => setTraceQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 38px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                />
              </div>
            </div>
            {traceQuery.length >= 3 ? (
              traceResults.length > 0 ? (
                <div>
                  <div style={{ ...tableHeaderStyle, gridTemplateColumns: '80px 1fr 1.5fr 100px 120px' }}>
                    <span>Direction</span><span>Integration</span><span>Event</span><span>Status</span><span>Correlation</span>
                  </div>
                  {traceResults.map(ev => (
                    <div key={ev.id} style={{ ...tableRowStyle, gridTemplateColumns: '80px 1fr 1.5fr 100px 120px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: ev.direction === 'INBOUND' ? '#60a5fa' : 'var(--accent-cyan)' }}>{ev.direction}</span>
                      <span>{ev.integration}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ev.event_type}</span>
                      <StatusBadge status={ev.status} />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ev.correlation_id}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Search size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                  <div>No events found matching <strong>"{traceQuery}"</strong></div>
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', opacity: 0.6 }}>
                <Search size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div>Enter at least 3 characters to search</div>
              </div>
            )}
          </div>
        )}

        {/* ── ALERTS ────────────────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <div style={sectionStyle}>
            <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MOCK_INTEGRATIONS.filter(i => i.credential_alerts > 0).map(int => (
                <div key={`cred-${int.id}`} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 'var(--radius-md)', alignItems: 'flex-start' }}>
                  <Shield size={18} style={{ color: '#f97316', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#f97316' }}>Credential Expiry Alert</div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {int.integration_name} — credential is expiring or requires rotation. Update in credential governance.
                    </div>
                  </div>
                </div>
              ))}
              {MOCK_INTEGRATIONS.filter(i => i.health_status === 'AT_RISK' || i.health_status === 'DOWN').map(int => (
                <div key={`health-${int.id}`} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: `rgba(${int.health_status === 'DOWN' ? '239,68,68' : '234,179,8'},0.08)`, border: `1px solid rgba(${int.health_status === 'DOWN' ? '239,68,68' : '234,179,8'},0.3)`, borderRadius: 'var(--radius-md)', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ color: int.health_status === 'DOWN' ? 'var(--status-error)' : 'var(--status-warning)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: int.health_status === 'DOWN' ? 'var(--status-error)' : 'var(--status-warning)' }}>Integration {int.health_status === 'DOWN' ? 'Outage' : 'Degraded'}</div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {int.integration_name} — {int.failure_count} failures recorded. Investigate connectivity and credentials.
                    </div>
                  </div>
                </div>
              ))}
              {totalDlqOpen > 0 && (
                <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', alignItems: 'flex-start' }}>
                  <Skull size={18} style={{ color: 'var(--status-error)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--status-error)' }}>Dead Letter Queue — {totalDlqOpen} Open</div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {totalDlqOpen} events exceeded maximum retries and require manual review or replay.
                    </div>
                  </div>
                </div>
              )}
              {failedComms > 0 && (
                <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 'var(--radius-md)', alignItems: 'flex-start' }}>
                  <MailCheck size={18} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--status-warning)' }}>Communication Failures — {failedComms}</div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {failedComms} customer communications failed delivery. Check channel provider settings.
                    </div>
                  </div>
                </div>
              )}
              {totalDlqOpen === 0 && totalCredAlerts === 0 && failedComms === 0 && MOCK_INTEGRATIONS.every(i => i.health_status === 'HEALTHY') && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--status-success)' }}>
                  <CheckCircle2 size={36} style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>All integrations healthy</div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: 4 }}>No alerts at this time</div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
