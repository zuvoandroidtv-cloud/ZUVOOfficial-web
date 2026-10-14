import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  Search,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Tv,
  Building,
  FileText,
  DollarSign,
  Package,
  X,
  AlertCircle,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';
import { DateRangePicker } from '../components/common/DateRangePicker';
import { AssignTechnicianModal } from '../components/service/AssignTechnicianModal';
import { ScheduleVisitModal } from '../components/service/ScheduleVisitModal';
import { BarcodeLookupModal } from '../components/common/BarcodeLookupModal';
import { Calendar, UserCheck, QrCode } from 'lucide-react';

export const ServicePage: React.FC = () => {
  const { currentRole, user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketDetails, setTicketDetails] = useState<{
    updates: any[];
    diagnosis: any[];
    parts: any[];
    costs: any[];
  }>({ updates: [], diagnosis: [], parts: [], costs: [] });
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Field Service modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [actionTicket, setActionTicket] = useState<any | null>(null);

  // Date range filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Form dependencies & state
  const [customers, setCustomers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [serviceType, setServiceType] = useState('on_site');
  const [priority, setPriority] = useState('medium');
  const [savingTicket, setSavingTicket] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('service_tickets')
        .select(`
          *,
          customers(customer_code, full_name, phone, address_line1, city),
          service_centers(center_name, center_code),
          product_units(
            serial_number,
            barcode,
            product_variants(product_name, product_code)
          ),
          assigned_profile:profiles!service_tickets_assigned_to_fkey(full_name, employee_code)
        `, { count: 'exact' })
        .order('opened_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`ticket_number.ilike.${q},issue_description.ilike.${q}`);
      }

      if (startDate) {
        query = query.gte('opened_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('opened_at', `${endDate}T23:59:59.999`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setTickets(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching service tickets:', err);
      setErrorMsg(err.message || 'Failed to fetch service tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [searchQuery, statusFilter, startDate, endDate, page, pageSize]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      let query = supabase
        .from('service_tickets')
        .select(`
          *,
          customers(full_name, phone),
          service_centers(center_name),
          product_units(
            serial_number,
            barcode,
            product_variants(product_name)
          )
        `)
        .order('opened_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`ticket_number.ilike.${q},issue_description.ilike.${q}`);
      }
      if (startDate) query = query.gte('opened_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('opened_at', `${endDate}T23:59:59.999`);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []).map((t: any) => ({
        ticket_number: t.ticket_number,
        customer_name: t.customers?.full_name || '',
        customer_phone: t.customers?.phone || '',
        product_name: t.product_units?.product_variants?.product_name || '',
        barcode: t.product_units?.barcode || '',
        serial_number: t.product_units?.serial_number || '',
        issue_description: t.issue_description || '',
        service_type: t.service_type || '',
        priority: t.priority || '',
        status: t.status || '',
        service_center: t.service_centers?.center_name || 'Unassigned',
        opened_at: new Date(t.opened_at).toLocaleDateString()
      }));

      const headers = [
        { key: 'ticket_number', label: 'Ticket #' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'customer_phone', label: 'Phone' },
        { key: 'product_name', label: 'TV Variant' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'serial_number', label: 'Serial #' },
        { key: 'issue_description', label: 'Issue Description' },
        { key: 'service_type', label: 'Service Type' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status' },
        { key: 'service_center', label: 'Center' },
        { key: 'opened_at', label: 'Opened Date' }
      ];

      const filename = `zuvo_service_tickets_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        exportToCSV(rows, headers, filename);
      } else {
        await exportToExcel(rows, headers, filename, 'Service Tickets');
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const loadDependencies = async () => {
    try {
      const [custRes, unitRes, centerRes] = await Promise.all([
        supabase.from('customers').select('id, full_name, phone, customer_code').eq('is_active', true),
        supabase.from('product_units').select('id, serial_number, barcode, product_variants(product_name)'),
        supabase.from('service_centers').select('id, center_name, center_code').eq('is_active', true)
      ]);
      setCustomers(custRes.data || []);
      setUnits(unitRes.data || []);
      setCenters(centerRes.data || []);
    } catch (err) {
      console.error('Error loading ticket dependencies:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (showCreateModal) {
      loadDependencies();
    }
  }, [showCreateModal]);

  const fetchTicketDetails = async (ticket: any) => {
    setSelectedTicket(ticket);
    setLoadingDetails(true);
    try {
      const [updatesRes, diagRes, partsRes, costsRes] = await Promise.all([
        supabase.from('service_updates').select('*').eq('service_ticket_id', ticket.id).order('created_at', { ascending: false }),
        supabase.from('service_diagnosis').select('*').eq('service_ticket_id', ticket.id).order('diagnosed_at', { ascending: false }),
        supabase.from('service_parts').select('*, spare_parts(part_name, part_code)').eq('service_ticket_id', ticket.id),
        supabase.from('service_costs').select('*').eq('service_ticket_id', ticket.id)
      ]);

      setTicketDetails({
        updates: updatesRes.data || [],
        diagnosis: diagRes.data || [],
        parts: partsRes.data || [],
        costs: costsRes.data || []
      });
    } catch (err) {
      console.error('Error fetching ticket details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedUnitId || !issueDescription.trim()) {
      alert('Please fill out customer, product unit, and issue description');
      return;
    }

    setSavingTicket(true);
    try {
      const ticketNum = `TCK-${Date.now().toString().slice(-7)}`;
      const { error } = await supabase
        .from('service_tickets')
        .insert({
          ticket_number: ticketNum,
          customer_id: selectedCustomerId,
          product_unit_id: selectedUnitId,
          service_center_id: selectedCenterId || null,
          issue_description: issueDescription.trim(),
          service_type: serviceType,
          priority: priority,
          status: 'open',
          opened_at: new Date().toISOString()
        });

      if (error) throw error;

      setShowCreateModal(false);
      setSelectedCustomerId('');
      setSelectedUnitId('');
      setSelectedCenterId('');
      setIssueDescription('');
      fetchTickets();
      alert(`Service ticket ${ticketNum} created successfully!`);
    } catch (err: any) {
      alert(`Failed to create ticket: ${err.message}`);
    } finally {
      setSavingTicket(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'in_progress') updateData.started_at = new Date().toISOString();
      if (newStatus === 'resolved') updateData.resolved_at = new Date().toISOString();
      if (newStatus === 'closed') updateData.closed_at = new Date().toISOString();

      const { error } = await supabase
        .from('service_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      // Add log update
      await supabase.from('service_updates').insert({
        service_ticket_id: ticketId,
        update_type: 'status_update',
        description: `Ticket status updated to ${newStatus}`,
        new_status: newStatus,
        previous_status: selectedTicket?.status || null,
        created_by: user?.id || null
      });

      fetchTickets();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const canManage = ['super_admin', 'admin', 'service', 'support'].includes(currentRole);

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench style={{ color: 'var(--brand-primary)' }} /> Service & RMA Operations
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Service tickets, diagnostics, technician assignments, spare part consumption & billing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Open Service Ticket
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search tickets by number, issue..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['all', 'open', 'assigned', 'in_progress', 'resolved', 'closed'].map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                style={{ textTransform: 'capitalize' }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(d) => { setStartDate(d); setPage(1); }}
          onEndDateChange={(d) => { setEndDate(d); setPage(1); }}
          onClearDateRange={() => { setStartDate(''); setEndDate(''); setPage(1); }}
        />
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="card" style={{ borderColor: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--status-danger)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--status-danger)' }}>Error loading service tickets</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Tickets Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Opened</th>
                <th>Customer</th>
                <th>TV Product</th>
                <th>Issue</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Center</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted">Loading service tickets...</p>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <Wrench size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Service Tickets</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filter' : 'All television sets are operating without open defects'}
                    </p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {t.ticket_number}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {new Date(t.opened_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.customers?.full_name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.customers?.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem' }}>{t.product_units?.product_variants?.product_name || 'ZUVO TV'}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        SN: {t.product_units?.serial_number}
                      </div>
                    </td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                      {t.issue_description}
                    </td>
                    <td>
                      <span className={`badge ${t.priority === 'urgent' ? 'badge-danger' : t.priority === 'high' ? 'badge-warning' : 'badge-neutral'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'resolved' || t.status === 'closed' ? 'badge-success' : t.status === 'in_progress' ? 'badge-warning' : 'badge-info'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {t.service_centers?.center_name || 'Unassigned'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchTicketDetails(t)} title="Manage Details">
                          Manage
                        </button>
                        {canManage && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setActionTicket(t);
                                setShowAssignModal(true);
                              }}
                              title="Assign Technician"
                            >
                              <UserCheck size={14} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setActionTicket(t);
                                setShowScheduleModal(true);
                              }}
                              title="Schedule Visit"
                            >
                              <Calendar size={14} />
                            </button>
                          </>
                        )}
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
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* Ticket Detail Drawer / Modal */}
      {selectedTicket && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wrench size={20} style={{ color: 'var(--brand-primary)' }} />
                  Ticket #{selectedTicket.ticket_number}
                  <span className={`badge ${selectedTicket.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedTicket.status?.toUpperCase()}
                  </span>
                </h3>
                <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  Type: {selectedTicket.service_type} | Priority: {selectedTicket.priority} | Opened: {new Date(selectedTicket.opened_at).toLocaleString()}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedTicket(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Status Update Quick Action */}
              <div className="card" style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Workflow Action:</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['open', 'assigned', 'in_progress', 'resolved', 'closed'].map((st) => (
                    <button
                      key={st}
                      className={`btn btn-sm ${selectedTicket.status === st ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateStatus(selectedTicket.id, st)}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer & Unit Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-primary)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CUSTOMER DETAILS</div>
                  <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{selectedTicket.customers?.full_name}</div>
                  <div>Phone: {selectedTicket.customers?.phone}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{selectedTicket.customers?.address_line1}, {selectedTicket.customers?.city}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TV UNIT SPECIFICATION</div>
                  <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{selectedTicket.product_units?.product_variants?.product_name}</div>
                  <div style={{ fontFamily: 'monospace' }}>Barcode: {selectedTicket.product_units?.barcode}</div>
                  <div style={{ fontFamily: 'monospace' }}>Serial: {selectedTicket.product_units?.serial_number}</div>
                </div>
              </div>

              {/* Issue Description */}
              <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reported Problem</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.9375rem', lineHeight: 1.5 }}>{selectedTicket.issue_description}</div>
              </div>

              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p className="text-muted">Loading technical notes, diagnosis and parts...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Spare Parts Installed */}
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Package size={16} style={{ color: 'var(--brand-accent)' }} /> Replaced Spare Parts ({ticketDetails.parts.length})
                    </h4>
                    {ticketDetails.parts.length === 0 ? (
                      <p className="text-muted" style={{ fontSize: '0.8125rem' }}>No spare parts registered on this ticket yet.</p>
                    ) : (
                      <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                        <thead>
                          <tr>
                            <th>Part Code</th>
                            <th>Part Name</th>
                            <th>Qty</th>
                            <th>Warranty Covered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ticketDetails.parts.map((p) => (
                            <tr key={p.id}>
                              <td style={{ fontFamily: 'monospace' }}>{p.spare_parts?.part_code}</td>
                              <td>{p.spare_parts?.part_name}</td>
                              <td>{p.quantity}</td>
                              <td>
                                <span className={`badge ${p.warranty_covered ? 'badge-success' : 'badge-warning'}`}>
                                  {p.warranty_covered ? 'Yes (Free)' : 'No (Chargeable)'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Diagnosis */}
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <FileText size={16} style={{ color: 'var(--brand-primary)' }} /> Technical Diagnosis ({ticketDetails.diagnosis.length})
                    </h4>
                    {ticketDetails.diagnosis.length === 0 ? (
                      <p className="text-muted" style={{ fontSize: '0.8125rem' }}>No engineering diagnosis recorded yet.</p>
                    ) : (
                      ticketDetails.diagnosis.map((d) => (
                        <div key={d.id} className="card" style={{ padding: '0.75rem', marginBottom: '0.5rem', background: 'var(--bg-secondary)', fontSize: '0.8125rem' }}>
                          <div style={{ fontWeight: 600 }}>Fault Category: {d.fault_category}</div>
                          <div style={{ marginTop: '0.25rem' }}>{d.diagnosis_notes}</div>
                          {d.solution_summary && <div style={{ marginTop: '0.25rem', color: 'var(--status-success)' }}>Solution: {d.solution_summary}</div>}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Activity Logs */}
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Clock size={16} style={{ color: 'var(--text-muted)' }} /> Activity & Progress Timeline ({ticketDetails.updates.length})
                    </h4>
                    {ticketDetails.updates.length === 0 ? (
                      <p className="text-muted" style={{ fontSize: '0.8125rem' }}>No progress updates yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {ticketDetails.updates.map((u) => (
                          <div key={u.id} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8125rem', borderLeft: '2px solid var(--brand-primary)', paddingLeft: '0.75rem' }}>
                            <div style={{ color: 'var(--text-muted)', minWidth: '120px' }}>{new Date(u.created_at).toLocaleString()}</div>
                            <div>{u.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedTicket(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Service Ticket Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Open New Service Ticket</h3>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTicket}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Customer *</label>
                  <select
                    required
                    className="input-field"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Television Unit *</label>
                  <select
                    required
                    className="input-field"
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                  >
                    <option value="">-- Select TV Unit --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.product_variants?.product_name} | Barcode: {u.barcode} | SN: {u.serial_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Service Type</label>
                    <select
                      className="input-field"
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                    >
                      <option value="on_site">On-Site Home Visit</option>
                      <option value="carry_in">Carry-In Service Center</option>
                      <option value="pickup">Pickup & Drop</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="input-field"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Service Center (Optional)</label>
                  <select
                    className="input-field"
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                  >
                    <option value="">-- Select Service Center --</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.center_name} ({c.center_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reported Issue Description *</label>
                  <textarea
                    required
                    rows={3}
                    className="input-field"
                    placeholder="Describe the television fault (e.g. No display, sound only, remote not pairing...)"
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingTicket}>
                  {savingTicket ? 'Creating...' : 'Open Service Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field Service Modals */}
      {showAssignModal && actionTicket && (
        <AssignTechnicianModal
          ticket={actionTicket}
          onClose={() => {
            setShowAssignModal(false);
            setActionTicket(null);
          }}
          onSuccess={() => {
            fetchTickets();
          }}
        />
      )}

      {showScheduleModal && actionTicket && (
        <ScheduleVisitModal
          ticket={actionTicket}
          onClose={() => {
            setShowScheduleModal(false);
            setActionTicket(null);
          }}
          onSuccess={() => {
            fetchTickets();
          }}
        />
      )}

      {showBarcodeModal && (
        <BarcodeLookupModal
          isOpen={showBarcodeModal}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
    </div>
  );
};
