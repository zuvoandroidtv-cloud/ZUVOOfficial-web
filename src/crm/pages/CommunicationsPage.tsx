import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Mail,
  Smartphone,
  Send,
  Search,
  Filter,
  RefreshCw,
  Sliders,
  CheckCircle,
  AlertTriangle,
  FileText,
  Eye,
  Edit,
  Plus,
  Lock,
  ExternalLink,
  Cpu,
  ShieldCheck
} from 'lucide-react';
import { notificationGateway } from '../lib/notificationGateway';

export const CommunicationsPage: React.FC = () => {
  const { user, isAllowed } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'logs' | 'templates' | 'gateway'>('logs');
  const [logs, setLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Sandbox State
  const [sandboxTemplateKey, setSandboxTemplateKey] = useState<string>('WARRANTY_REGISTERED');
  const [sandboxChannel, setSandboxChannel] = useState<string>('whatsapp');
  const [sandboxCustomerName, setSandboxCustomerName] = useState<string>('Rajesh Sharma');
  const [sandboxSerial, setSandboxSerial] = useState<string>('ZUV-43UHD-2026001');
  const [sandboxWarrantyEnd, setSandboxWarrantyEnd] = useState<string>('2027-10-07');
  const [sandboxServiceTicket, setSandboxServiceTicket] = useState<string>('TKT-9042');
  const [sandboxRendered, setSandboxRendered] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadLogs(), loadTemplates()]);
    } catch (err) {
      console.error('Error fetching communications data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('communication_logs')
      .select(`
        *,
        customers:customer_id (full_name, phone, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load comm logs:', error);
    } else {
      setLogs(data || []);
    }
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('communication_templates')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load templates:', error);
    } else {
      setTemplates(data || []);
    }
  };

  // Run Sandbox Live Render
  useEffect(() => {
    const match = templates.find(t => t.template_key === sandboxTemplateKey && t.channel === sandboxChannel);
    if (match) {
      let text = match.message_body || '';
      text = text.replace(/{{customer_name}}/g, sandboxCustomerName);
      text = text.replace(/{{serial_number}}/g, sandboxSerial);
      text = text.replace(/{{warranty_end_date}}/g, sandboxWarrantyEnd);
      text = text.replace(/{{service_ticket_number}}/g, sandboxServiceTicket);
      text = text.replace(/{{company_name}}/g, 'ZUVO TV');
      setSandboxRendered(text);
    } else {
      setSandboxRendered('No template found for selected key and channel.');
    }
  }, [sandboxTemplateKey, sandboxChannel, sandboxCustomerName, sandboxSerial, sandboxWarrantyEnd, sandboxServiceTicket, templates]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    try {
      const { error } = await supabase
        .from('communication_templates')
        .update({
          subject: selectedTemplate.subject,
          message_body: selectedTemplate.message_body,
          is_active: selectedTemplate.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTemplate.id);

      if (error) {
        alert('Failed to update template: ' + error.message);
      } else {
        await loadTemplates();
        setSelectedTemplate(null);
      }
    } catch (err) {
      console.error('Error saving template:', err);
    }
  };

  // Filters
  const filteredLogs = logs.filter(l => {
    if (channelFilter !== 'all' && l.channel !== channelFilter) return false;
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCust = l.customers?.full_name?.toLowerCase().includes(q);
      const matchRecipient = l.recipient?.toLowerCase().includes(q);
      const matchBody = l.message_body?.toLowerCase().includes(q);
      const matchType = l.message_type?.toLowerCase().includes(q);
      if (!matchCust && !matchRecipient && !matchBody && !matchType) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageSquare size={16} style={{ color: 'var(--accent-emerald)' }} />;
      case 'sms': return <Smartphone size={16} style={{ color: 'var(--accent-cyan)' }} />;
      case 'email': return <Mail size={16} style={{ color: 'var(--accent-purple)' }} />;
      default: return <Send size={16} style={{ color: 'var(--accent-blue)' }} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <span className="badge badge-emerald">SENT (SIMULATED)</span>;
      case 'not_configured':
        return <span className="badge badge-amber">NOT CONFIGURED</span>;
      case 'failed':
        return <span className="badge badge-rose">FAILED</span>;
      case 'queued':
        return <span className="badge badge-cyan">QUEUED</span>;
      default:
        return <span className="badge badge-slate">{status.toUpperCase()}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.08) 100%)',
        borderColor: 'rgba(16, 185, 129, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-emerald), var(--accent-cyan))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
            }}>
              <MessageSquare size={20} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Customer Communications Center</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Provider-independent communication hub, message templates engine, variable substitutions & delivery audit log.
          </p>
        </div>

        <button
          onClick={() => { setIsRefreshing(true); fetchData().finally(() => setIsRefreshing(false)); }}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh Logs
        </button>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card">
          <div>
            <div className="stat-val">{logs.length}</div>
            <div className="stat-label">Total Communication Logs</div>
          </div>
          <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
            <FileText size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: 'var(--accent-emerald)' }}>
              {logs.filter(l => l.status === 'sent' || l.status === 'delivered').length}
            </div>
            <div className="stat-label">Sent Dispatches (Simulated)</div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
            <CheckCircle size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: 'var(--accent-amber)' }}>
              {logs.filter(l => l.status === 'not_configured').length}
            </div>
            <div className="stat-label">Provider Not Configured</div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-amber)' }}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Sub Tabs Switcher */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`btn ${activeSubTab === 'logs' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileText size={15} /> Communication Logs
        </button>
        <button
          onClick={() => setActiveSubTab('templates')}
          className={`btn ${activeSubTab === 'templates' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Sliders size={15} /> Message Templates & Sandbox
        </button>
        <button
          onClick={() => setActiveSubTab('gateway')}
          className={`btn ${activeSubTab === 'gateway' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Cpu size={15} /> Gateway Provider Settings
        </button>
      </div>

      {activeSubTab === 'logs' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Toolbar */}
          <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search logs by customer, recipient, or body..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="input"
                  style={{ paddingLeft: '36px', width: '100%', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {/* Channel Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={channelFilter}
                  onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
                  className="input"
                  style={{ fontSize: '0.8rem', padding: '6px 10px', background: '#111827' }}
                >
                  <option value="all">All Channels</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="input"
                style={{ fontSize: '0.8rem', padding: '6px 10px', background: '#111827' }}
              >
                <option value="all">All Statuses</option>
                <option value="sent">Sent (Simulated)</option>
                <option value="not_configured">Not Configured</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Logs Data Table */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Customer / Recipient</th>
                    <th>Event Type</th>
                    <th>Message Snippet</th>
                    <th>Provider / Msg ID</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        Loading communication logs...
                      </td>
                    </tr>
                  ) : paginatedLogs.length > 0 ? (
                    paginatedLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize', fontWeight: 600 }}>
                            {getChannelIcon(log.channel)} {log.channel}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{log.customers?.full_name || 'Direct Recipient'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.recipient}</div>
                        </td>
                        <td>
                          <span className="badge badge-slate" style={{ fontSize: '0.65rem' }}>
                            {log.message_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.825rem' }}>
                          {log.subject ? `[${log.subject}] ` : ''}{log.message_body}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{log.provider_name || 'N/A'}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{log.provider_message_id || 'N/A'}</div>
                        </td>
                        <td>{getStatusBadge(log.status)}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No communication logs match the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="btn btn-secondary btn-sm">
                  Previous
                </button>
                <span style={{ fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)' }}>
                  Page {page} of {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="btn btn-secondary btn-sm">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeSubTab === 'templates' ? (
        /* Templates & Sandbox Subtab */
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* Left: Templates List */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Communication Templates Engine</h3>
              <span className="badge badge-cyan">{templates.length} Active Templates</span>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Channel</th>
                    <th>Event</th>
                    <th>Active</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700, fontSize: '0.825rem' }}>{t.template_key}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize', fontSize: '0.8rem' }}>
                          {getChannelIcon(t.channel)} {t.channel}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.event_type}</td>
                      <td>
                        <span className={`badge ${t.is_active ? 'badge-emerald' : 'badge-slate'}`}>
                          {t.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedTemplate(t)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          <Edit size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Live Variable Substitution Sandbox */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-cyan)' }}>
              Live Template Variable Sandbox
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Test variable substitution and render preview before dispatching to customers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Select Template</label>
                <select
                  value={sandboxTemplateKey}
                  onChange={(e) => setSandboxTemplateKey(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: '0.85rem', background: '#111827' }}
                >
                  <option value="WARRANTY_REGISTERED">WARRANTY_REGISTERED</option>
                  <option value="SERVICE_CREATED">SERVICE_CREATED</option>
                  <option value="SERVICE_COMPLETED">SERVICE_COMPLETED</option>
                  <option value="SALE_COMPLETED">SALE_COMPLETED</option>
                  <option value="RMA_CREATED">RMA_CREATED</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Channel</label>
                <select
                  value={sandboxChannel}
                  onChange={(e) => setSandboxChannel(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: '0.85rem', background: '#111827' }}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Customer Name</label>
                  <input
                    type="text"
                    value={sandboxCustomerName}
                    onChange={(e) => setSandboxCustomerName(e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Serial Number</label>
                  <input
                    type="text"
                    value={sandboxSerial}
                    onChange={(e) => setSandboxSerial(e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>Rendered Result Output</label>
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'monospace',
                  fontSize: '0.825rem',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  minHeight: '100px'
                }}>
                  {sandboxRendered}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Gateway Provider Settings Sub-Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                <Cpu size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Notification Gateway Configuration</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Provider-agnostic dispatch architecture with automatic failover to local simulation and in-app messaging.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Active Primary Adapter:</span>
                  <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    SIMULATION (SAFE)
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Environment default: VITE_SMS_GATEWAY_ENABLED is false. Zero paid telecom consumption.
                </p>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Fail-Safe Fallback:</span>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    ACTIVE & VERIFIED
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  If external providers time out or fail, system logs dispatch locally without disrupting technician visits.
                </p>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Idempotency Protection:</span>
                  <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    ENFORCED
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Duplicate webhook calls and repeated send attempts are deduplicated via unique idempotency keys.
                </p>
              </div>
            </div>

            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
                <ShieldCheck size={18} /> Production Ready Gateway Interface
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                To enable real telecom SMS or WhatsApp Business in production:
                <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  <li>Deploy secure backend webhook dispatcher (Cloudflare Worker / Edge Function).</li>
                  <li>Set <code>VITE_SMS_GATEWAY_ENABLED=true</code> in hosting environment variables.</li>
                  <li>Set <code>VITE_SMS_GATEWAY_URL</code> to the authorized relay endpoint.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '580px', padding: '24px', background: '#0F172A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Communication Log Detail</h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
              <div><strong>Recipient:</strong> {selectedLog.recipient} ({selectedLog.customers?.full_name || 'N/A'})</div>
              <div><strong>Channel:</strong> {selectedLog.channel.toUpperCase()}</div>
              <div><strong>Message Type:</strong> {selectedLog.message_type}</div>
              <div><strong>Status:</strong> {getStatusBadge(selectedLog.status)}</div>
              <div><strong>Provider Name:</strong> {selectedLog.provider_name || 'N/A'}</div>
              <div><strong>Provider Message ID:</strong> {selectedLog.provider_message_id || 'N/A'}</div>
              {selectedLog.subject && <div><strong>Subject:</strong> {selectedLog.subject}</div>}

              <div>
                <strong>Message Body:</strong>
                <div style={{
                  padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)', marginTop: '4px', fontFamily: 'monospace', whiteSpace: 'pre-wrap'
                }}>
                  {selectedLog.message_body}
                </div>
              </div>

              {selectedLog.failure_reason && (
                <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>
                  <strong>Note / Reason:</strong> {selectedLog.failure_reason}
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {selectedTemplate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '24px', background: '#0F172A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Edit Template: {selectedTemplate.template_name}</h3>
              <button onClick={() => setSelectedTemplate(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {selectedTemplate.channel === 'email' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Subject</label>
                  <input
                    type="text"
                    value={selectedTemplate.subject || ''}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Message Body</label>
                <textarea
                  rows={6}
                  value={selectedTemplate.message_body}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, message_body: e.target.value })}
                  className="input"
                  style={{ width: '100%', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setSelectedTemplate(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
