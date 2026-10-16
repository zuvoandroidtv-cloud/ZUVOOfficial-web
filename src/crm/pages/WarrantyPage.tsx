import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Search,
  AlertTriangle,
  Clock,
  Calendar,
  Tv,
  User,
  CheckCircle,
  XCircle,
  BarChart2,
  Eye,
  X,
  AlertCircle,
  Download,
  FileSpreadsheet,
  History,
  UserCheck,
  Plus,
  Sparkles,
  FileText,
  DollarSign
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';
import { DateRangePicker } from '../components/common/DateRangePicker';
import { RequestExtensionModal } from '../components/warranty/RequestExtensionModal';
import { RequestTransferModal } from '../components/warranty/RequestTransferModal';
import { WarrantyTimelineModal } from '../components/warranty/WarrantyTimelineModal';

export const WarrantyPage: React.FC = () => {
  const { currentRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'claims' | 'extended' | 'extensions' | 'transfers' | 'expirations' | 'analytics'>('list');
  const [warranties, setWarranties] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [extendedPolicies, setExtendedPolicies] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [expirations, setExpirations] = useState<any[]>([]);
  const [warrantyStatusCounts, setWarrantyStatusCounts] = useState<any[]>([]);
  const [channelCounts, setChannelCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarranty, setSelectedWarranty] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Phase 7.7 Modal States
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [activeClaim, setActiveClaim] = useState<any | null>(null);
  const [settleForm, setSettleForm] = useState({
    decision: 'APPROVE',
    settlementType: 'PARTS_LABOR_PAYOUT',
    approvedAmount: 0,
    rejectionReason: '',
    notes: ''
  });
  const [settlingClaim, setSettlingClaim] = useState(false);

  // Modals state
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [actionWarranty, setActionWarranty] = useState<any | null>(null);

  // Date range filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  const isAdminOrSuper = ['super_admin', 'admin', 'service'].includes(currentRole);

  const fetchWarrantyData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'list') {
        let query = supabase
          .from('warranties')
          .select(`
            *,
            customers(customer_code, full_name, phone, city),
            dealers(dealer_name, dealer_code),
            product_units(
              id,
              serial_number,
              barcode,
              product_variants(product_name, product_code, screen_size)
            )
          `, { count: 'exact' })
          .order('registered_at', { ascending: false });

        if (searchQuery.trim()) {
          const q = `%${searchQuery.trim()}%`;
          query = query.or(`warranty_number.ilike.${q}`);
        }

        if (startDate) {
          query = query.gte('registered_at', `${startDate}T00:00:00`);
        }
        if (endDate) {
          query = query.lte('registered_at', `${endDate}T23:59:59.999`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;
        setWarranties(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'claims') {
        let query = (supabase as any)
          .from('warranty_claims')
          .select(`
            *,
            customers(full_name, phone),
            warranties(warranty_number, warranty_start_date, warranty_end_date),
            product_units(barcode, serial_number, product_variants(product_name))
          `, { count: 'exact' })
          .order('created_at', { ascending: false });

        if (searchQuery.trim()) {
          const q = `%${searchQuery.trim()}%`;
          query = query.or(`claim_number.ilike.${q},defect_description.ilike.${q}`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;
        setClaims(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'extended') {
        let query = (supabase as any)
          .from('extended_warranty_policies')
          .select(`
            *,
            customers(full_name, phone),
            dealers(dealer_name, dealer_code),
            extended_warranty_plans(plan_name, plan_code, coverage_months),
            product_units(barcode, serial_number, product_variants(product_name))
          `, { count: 'exact' })
          .order('created_at', { ascending: false });

        if (searchQuery.trim()) {
          const q = `%${searchQuery.trim()}%`;
          query = query.or(`policy_number.ilike.${q}`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;
        setExtendedPolicies(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'extensions') {
        let query = supabase
          .from('vw_warranty_extensions_summary')
          .select('*', { count: 'exact' })
          .order('requested_at', { ascending: false });

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;
        setExtensions(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'transfers') {
        let query = supabase
          .from('vw_warranty_transfers_summary')
          .select('*', { count: 'exact' })
          .order('requested_at', { ascending: false });

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;
        setTransfers(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'expirations') {
        let query = supabase
          .from('warranty_expiration_report')
          .select('*', { count: 'exact' })
          .order('warranty_end_date', { ascending: true });

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;
        setExpirations(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'analytics') {
        const [statusRes, channelRes] = await Promise.all([
          supabase.from('warranty_summary').select('*'),
          supabase.from('warranty_registration_summary').select('*')
        ]);
        setWarrantyStatusCounts(statusRes.data || []);
        setChannelCounts(channelRes.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching warranty data:', err);
      setErrorMsg(err.message || 'Failed to fetch warranty data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarrantyData();
  }, [activeTab, searchQuery, startDate, endDate, page, pageSize]);

  // Approval Handlers
  const handleApproveExtension = async (extId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.rpc('fn_approve_warranty_extension', {
        p_extension_id: extId,
        p_approved_by: user?.id || null
      });
      if (error) throw error;
      setSuccessMsg('Warranty extension APPROVED successfully!');
      fetchWarrantyData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve extension.');
    }
  };

  const handleRejectExtension = async (extId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.rpc('fn_reject_warranty_extension', {
        p_extension_id: extId,
        p_rejected_by: user?.id || null,
        p_reason: reason
      });
      if (error) throw error;
      setSuccessMsg('Warranty extension REJECTED.');
      fetchWarrantyData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject extension.');
    }
  };

  const handleApproveTransfer = async (trfId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.rpc('fn_approve_warranty_transfer', {
        p_transfer_id: trfId,
        p_approved_by: user?.id || null
      });
      if (error) throw error;
      setSuccessMsg('Warranty transfer APPROVED successfully!');
      fetchWarrantyData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve transfer.');
    }
  };

  const handleRejectTransfer = async (trfId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.rpc('fn_reject_warranty_transfer', {
        p_transfer_id: trfId,
        p_rejected_by: user?.id || null,
        p_reason: reason
      });
      if (error) throw error;
      setSuccessMsg('Warranty transfer REJECTED.');
      fetchWarrantyData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject transfer.');
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      if (activeTab === 'list') {
        let query = supabase
          .from('warranties')
          .select(`
            *,
            customers(customer_code, full_name, phone),
            dealers(dealer_name, dealer_code),
            product_units(
              serial_number,
              barcode,
              product_variants(product_name, product_code)
            )
          `)
          .order('registered_at', { ascending: false });

        if (searchQuery.trim()) {
          const q = `%${searchQuery.trim()}%`;
          query = query.or(`warranty_number.ilike.${q}`);
        }
        if (startDate) query = query.gte('registered_at', `${startDate}T00:00:00`);
        if (endDate) query = query.lte('registered_at', `${endDate}T23:59:59.999`);

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []).map((w: any) => ({
          warranty_number: w.warranty_number,
          customer_name: w.customers?.full_name || '',
          customer_phone: w.customers?.phone || '',
          product_name: w.product_units?.product_variants?.product_name || '',
          barcode: w.product_units?.barcode || '',
          serial_number: w.product_units?.serial_number || '',
          start_date: w.warranty_start_date,
          end_date: w.warranty_end_date,
          channel: w.registration_method,
          status: w.status,
          registered_at: new Date(w.registered_at).toLocaleDateString()
        }));

        const headers = [
          { key: 'warranty_number', label: 'Policy #' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'customer_phone', label: 'Phone' },
          { key: 'product_name', label: 'TV Model' },
          { key: 'barcode', label: 'Barcode' },
          { key: 'serial_number', label: 'Serial #' },
          { key: 'start_date', label: 'Start Date' },
          { key: 'end_date', label: 'End Date' },
          { key: 'channel', label: 'Channel' },
          { key: 'status', label: 'Status' },
          { key: 'registered_at', label: 'Registration Date' }
        ];

        const filename = `zuvo_warranties_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') {
          exportToCSV(rows, headers, filename);
        } else {
          await exportToExcel(rows, headers, filename, 'Warranties');
        }
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck style={{ color: 'var(--brand-primary)' }} /> Warranty Hub & Lifecycle Management
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Active policies, warranty extensions, ownership transfers, expiration forecasting, and barcode auditing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activeTab !== 'analytics' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('csv')}
                disabled={exporting || loading}
              >
                <Download size={15} /> Export CSV
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('xlsx')}
                disabled={exporting || loading}
              >
                <FileSpreadsheet size={15} /> Export Excel
              </button>
            </>
          )}
          <button
            className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('list'); setPage(1); }}
          >
            Registered Warranties
          </button>
          <button
            className={`btn ${activeTab === 'claims' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('claims'); setPage(1); }}
          >
            <FileText size={15} /> Claims & Settlements
          </button>
          <button
            className={`btn ${activeTab === 'extended' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('extended'); setPage(1); }}
          >
            <Sparkles size={15} /> Extended Warranties
          </button>
          <button
            className={`btn ${activeTab === 'extensions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('extensions'); setPage(1); }}
          >
            <Clock size={15} /> Extension Requests
          </button>
          <button
            className={`btn ${activeTab === 'transfers' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('transfers'); setPage(1); }}
          >
            <UserCheck size={15} /> Ownership Transfers
          </button>
          <button
            className={`btn ${activeTab === 'expirations' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('expirations'); setPage(1); }}
          >
            <Calendar size={15} /> Expirations
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div className="card" style={{ borderColor: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--status-danger)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--status-danger)' }}>Error</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{errorMsg}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="card" style={{ borderColor: 'var(--status-success)', background: 'rgba(16, 185, 129, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <CheckCircle style={{ color: 'var(--status-success)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--status-success)' }}>Success</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{successMsg}</div>
          </div>
        </div>
      )}

      {/* TAB 1: Registered Warranties */}
      {activeTab === 'list' && (
        <>
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Search by warranty policy number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                style={{ paddingLeft: '2.75rem' }}
              />
            </div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(d) => { setStartDate(d); setPage(1); }}
              onEndDateChange={(d) => { setEndDate(d); setPage(1); }}
              onClearDateRange={() => { setStartDate(''); setEndDate(''); setPage(1); }}
            />
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Warranty #</th>
                    <th>Customer</th>
                    <th>Product Model / Variant</th>
                    <th>Barcode & Serial</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                        <p className="text-muted">Loading warranty records...</p>
                      </td>
                    </tr>
                  ) : warranties.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                        <ShieldCheck size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Warranties Found</h3>
                      </td>
                    </tr>
                  ) : (
                    warranties.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {w.warranty_number}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{w.customers?.full_name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.customers?.phone}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{w.product_units?.product_variants?.product_name || 'ZUVO TV'}</div>
                        </td>
                        <td>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                            BC: {w.product_units?.barcode}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            SN: {w.product_units?.serial_number}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>{w.warranty_start_date}</td>
                        <td style={{ fontSize: '0.875rem', fontWeight: 600 }}>{w.warranty_end_date}</td>
                        <td>
                          <span className={`badge ${w.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                            {w.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setActionWarranty(w);
                                setShowExtensionModal(true);
                              }}
                              title="Extend Warranty"
                            >
                              <Clock size={13} /> Extend
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setActionWarranty(w);
                                setShowTransferModal(true);
                              }}
                              title="Transfer Ownership"
                            >
                              <UserCheck size={13} /> Transfer
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setActionWarranty(w);
                                setShowTimelineModal(true);
                              }}
                              title="View History Timeline"
                            >
                              <History size={13} /> Timeline
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
            />
          </div>
        </>
      )}

      {/* PHASE 7.7: ENTERPRISE CLAIMS & SETTLEMENTS VIEW */}
      {activeTab === 'claims' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Warranty #</th>
                  <th>Customer</th>
                  <th>Product Unit</th>
                  <th>Claim Type</th>
                  <th>Defect Description</th>
                  <th>Claimed</th>
                  <th>Approved</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                      <p className="text-muted">Loading warranty claims...</p>
                    </td>
                  </tr>
                ) : claims.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <FileText size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Warranty Claims Recorded</h3>
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Customer and dealer warranty service claims will appear here for engineering evaluation and settlement.
                      </p>
                    </td>
                  </tr>
                ) : (
                  claims.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.claim_number}</td>
                      <td>
                        <span className="badge badge-primary" style={{ fontFamily: 'monospace' }}>
                          {c.warranties?.warranty_number || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.customers?.full_name || 'Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.customers?.phone}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{c.product_units?.product_variants?.product_name || 'ZUVO TV'}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          BC: {c.product_units?.barcode}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                          {c.claim_type}
                        </span>
                      </td>
                      <td style={{ maxWidth: '220px', fontSize: '0.8125rem' }} title={c.defect_description}>
                        {c.defect_description}
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{c.claimed_amount?.toLocaleString() || 0}</td>
                      <td style={{ fontWeight: 700, color: c.approved_amount ? 'var(--status-success)' : 'inherit' }}>
                        {c.approved_amount !== null ? `₹${c.approved_amount?.toLocaleString()}` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${
                          c.status === 'SETTLED' || c.status === 'APPROVED' ? 'badge-success' :
                          c.status === 'REJECTED' ? 'badge-danger' :
                          'badge-warning'
                        }`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        {isAdminOrSuper && (c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW') && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setActiveClaim(c);
                              setSettleForm({
                                decision: 'APPROVE',
                                settlementType: 'PARTS_LABOR_PAYOUT',
                                approvedAmount: c.claimed_amount || 0,
                                rejectionReason: '',
                                notes: ''
                              });
                              setShowSettleModal(true);
                            }}
                          >
                            <DollarSign size={13} /> Settle
                          </button>
                        )}
                        {c.settlement_reference && (
                          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
                            {c.settlement_reference}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
          />
        </div>
      )}

      {/* PHASE 7.7: EXTENDED WARRANTY POLICIES VIEW */}
      {activeTab === 'extended' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Policy #</th>
                  <th>Customer</th>
                  <th>Plan & Coverage</th>
                  <th>TV Model & Barcode</th>
                  <th>Coverage Window</th>
                  <th>Premium Paid</th>
                  <th>Channel / Dealer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                      <p className="text-muted">Loading extended policies...</p>
                    </td>
                  </tr>
                ) : extendedPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <Sparkles size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Extended Warranty Policies</h3>
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Extended policies activated through dealer channels or CRM direct sales will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  extendedPolicies.map((ep) => (
                    <tr key={ep.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ep.policy_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ep.customers?.full_name || 'Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ep.customers?.phone}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ep.extended_warranty_plans?.plan_name || 'Extended Care'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>
                          +{ep.extended_warranty_plans?.coverage_months || 12} Months
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{ep.product_units?.product_variants?.product_name || 'ZUVO TV'}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          BC: {ep.product_units?.barcode}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>
                          {ep.extended_start_date} to {ep.extended_end_date}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                        ₹{ep.premium_paid?.toLocaleString()}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>{ep.sales_channel}</div>
                        {ep.dealers && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {ep.dealers.dealer_name}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${ep.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'uppercase' }}>
                          {ep.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
          />
        </div>
      )}

      {/* TAB 2: Extension Requests */}
      {activeTab === 'extensions' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Extension #</th>
                  <th>Warranty #</th>
                  <th>Customer</th>
                  <th>Barcode / Serial</th>
                  <th>Prev End Date</th>
                  <th>Days</th>
                  <th>New End Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>Loading extensions...</td></tr>
                ) : extensions.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>No extension requests found.</td></tr>
                ) : (
                  extensions.map((ext) => (
                    <tr key={ext.extension_id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ext.extension_number}</td>
                      <td style={{ fontFamily: 'monospace' }}>{ext.warranty_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ext.customer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ext.customer_phone}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{ext.barcode}</td>
                      <td>{ext.previous_end_date}</td>
                      <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>+{ext.extension_days}</td>
                      <td style={{ fontWeight: 600, color: 'var(--status-success)' }}>{ext.new_end_date}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{ext.extension_reason}</td>
                      <td>
                        <span className={`badge ${ext.approval_status === 'approved' ? 'badge-success' : ext.approval_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {ext.approval_status}
                        </span>
                      </td>
                      <td>
                        {ext.approval_status === 'pending' && isAdminOrSuper && (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleApproveExtension(ext.extension_id)}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRejectExtension(ext.extension_id)}>
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Ownership Transfer Requests */}
      {activeTab === 'transfers' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Warranty #</th>
                  <th>Barcode / Serial</th>
                  <th>From Customer</th>
                  <th>To Customer</th>
                  <th>Reason</th>
                  <th>Requested Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>Loading transfers...</td></tr>
                ) : transfers.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>No transfer requests found.</td></tr>
                ) : (
                  transfers.map((trf) => (
                    <tr key={trf.transfer_id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{trf.transfer_number}</td>
                      <td style={{ fontFamily: 'monospace' }}>{trf.warranty_number}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{trf.barcode}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{trf.from_customer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trf.from_customer_phone}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--status-success)' }}>{trf.to_customer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trf.to_customer_phone}</div>
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>{trf.transfer_reason}</td>
                      <td style={{ fontSize: '0.75rem' }}>{new Date(trf.requested_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${trf.transfer_status === 'approved' ? 'badge-success' : trf.transfer_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {trf.transfer_status}
                        </span>
                      </td>
                      <td>
                        {trf.transfer_status === 'pending' && isAdminOrSuper && (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleApproveTransfer(trf.transfer_id)}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRejectTransfer(trf.transfer_id)}>
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Expiration Watchlist */}
      {activeTab === 'expirations' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Policy #</th>
                  <th>Customer</th>
                  <th>Barcode / Serial</th>
                  <th>Start Date</th>
                  <th>Expiry Date</th>
                  <th>Forecasting Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>Loading expirations...</td></tr>
                ) : expirations.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>No expirations forecasted.</td></tr>
                ) : (
                  expirations.map((exp, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{exp.warranty_number}</td>
                      <td>{exp.customer_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{exp.barcode}</td>
                      <td>{exp.warranty_start_date}</td>
                      <td style={{ fontWeight: 600, color: 'var(--status-danger)' }}>{exp.warranty_end_date}</td>
                      <td>
                        <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>
                          {exp.expiration_category?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${exp.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                          {exp.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showExtensionModal && actionWarranty && (
        <RequestExtensionModal
          warranty={actionWarranty}
          onClose={() => {
            setShowExtensionModal(false);
            setActionWarranty(null);
          }}
          onSuccess={() => fetchWarrantyData()}
        />
      )}

      {showTransferModal && actionWarranty && (
        <RequestTransferModal
          warranty={actionWarranty}
          onClose={() => {
            setShowTransferModal(false);
            setActionWarranty(null);
          }}
          onSuccess={() => fetchWarrantyData()}
        />
      )}

      {showTimelineModal && actionWarranty && (
        <WarrantyTimelineModal
          warranty={actionWarranty}
          onClose={() => {
            setShowTimelineModal(false);
            setActionWarranty(null);
          }}
        />
      )}
      {/* PHASE 7.7: SETTLE WARRANTY CLAIM MODAL */}
      {showSettleModal && activeClaim && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} style={{ color: 'var(--brand-primary)' }} />
                <span>Adjudicate & Settle Warranty Claim</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowSettleModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setSettlingClaim(true);
              setErrorMsg(null);
              setSuccessMsg(null);
              try {
                const { data, error } = await (supabase.rpc as any)('fn_settle_warranty_claim', {
                  p_claim_id: activeClaim.id,
                  p_decision: settleForm.decision,
                  p_settlement_type: settleForm.decision === 'APPROVE' ? settleForm.settlementType : 'REJECTED_OUT_OF_SCOPE',
                  p_approved_amount: settleForm.decision === 'APPROVE' ? parseFloat(settleForm.approvedAmount as any) || 0 : 0,
                  p_rejection_reason: settleForm.decision === 'REJECT' ? settleForm.rejectionReason : null,
                  p_notes: settleForm.notes || null
                });

                if (error) throw error;
                const res = data as any;
                if (res && res.success === false) {
                  throw new Error(res.error || 'Claim settlement failed');
                }

                setSuccessMsg(`Claim ${activeClaim.claim_number} successfully adjudicated as ${settleForm.decision}!`);
                setShowSettleModal(false);
                setActiveClaim(null);
                fetchWarrantyData();
              } catch (err: any) {
                setErrorMsg(err.message || 'Settlement failed');
              } finally {
                setSettlingClaim(false);
              }
            }}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 600 }}>Claim #{activeClaim.claim_number}</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Customer: {activeClaim.customers?.full_name} | Policy: {activeClaim.warranties?.warranty_number}
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>Defect: {activeClaim.defect_description}</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Adjudication Decision *</label>
                  <select
                    className="input-field"
                    value={settleForm.decision}
                    onChange={(e) => setSettleForm({ ...settleForm, decision: e.target.value })}
                  >
                    <option value="APPROVE">Approve & Settle Claim</option>
                    <option value="REJECT">Reject Claim (Out of Scope / Void)</option>
                  </select>
                </div>

                {settleForm.decision === 'APPROVE' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Settlement Type</label>
                      <select
                        className="input-field"
                        value={settleForm.settlementType}
                        onChange={(e) => setSettleForm({ ...settleForm, settlementType: e.target.value })}
                      >
                        <option value="PARTS_LABOR_PAYOUT">Parts & Labor Payout</option>
                        <option value="NO_CHARGE_REPAIR">No-Charge Customer Repair</option>
                        <option value="DIRECT_REPLACEMENT">Direct Replacement Unit Swap</option>
                        <option value="CREDIT_MEMO">Authorized Credit Memo</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Approved Settlement Amount (₹) *</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input-field"
                        value={settleForm.approvedAmount}
                        onChange={(e) => setSettleForm({ ...settleForm, approvedAmount: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Rejection Reason *</label>
                    <textarea
                      required
                      className="input-field"
                      rows={2}
                      placeholder="e.g. Physical panel impact damage, liquid ingress, or tampered seal"
                      value={settleForm.rejectionReason}
                      onChange={(e) => setSettleForm({ ...settleForm, rejectionReason: e.target.value })}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Engineering / Auditor Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Optional internal justification or notes"
                    value={settleForm.notes}
                    onChange={(e) => setSettleForm({ ...settleForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSettleModal(false)}
                  disabled={settlingClaim}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={settlingClaim}
                  style={{
                    background: settleForm.decision === 'REJECT' ? 'var(--status-danger)' : undefined
                  }}
                >
                  {settlingClaim ? 'Adjudicating...' : `Confirm ${settleForm.decision}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
