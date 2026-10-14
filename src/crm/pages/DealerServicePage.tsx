import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { Wrench, Search, Plus, X, AlertCircle } from 'lucide-react';
import { Pagination } from '../components/common/Pagination';

export const DealerServicePage: React.FC = () => {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Create Ticket Modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);

  // Form
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueCategory, setIssueCategory] = useState('display_panel');
  const [priority, setPriority] = useState('medium');

  const fetchTickets = async () => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('service_tickets')
        .select('*, customers(full_name, phone), product_units(barcode, serial_number, product_variants(product_name))', { count: 'exact' })
        .eq('dealer_id', dealerId)
        .order('opened_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`ticket_number.ilike.${q}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setTickets(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching dealer service tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModalData = async () => {
    if (!dealerId) return;
    try {
      // Product units sold/assigned to dealer
      const { data: uData } = await supabase
        .from('product_units')
        .select('*, product_variants(product_name)')
        .eq('dealer_id', dealerId);
      setUnitsList(uData || []);

      // Customers
      const { data: cData } = await supabase
        .from('customers')
        .select('*')
        .order('full_name', { ascending: true });
      setCustomersList(cData || []);
    } catch (err) {
      console.error('Error loading service modal data:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [dealerId, searchQuery, page, pageSize]);

  const handleOpenModal = () => {
    loadModalData();
    setShowModal(true);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId || !selectedCustomerId || !issueDescription.trim()) {
      alert('Please fill out all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('fn_dealer_create_service_ticket', {
        p_product_unit_id: selectedUnitId,
        p_customer_id: selectedCustomerId,
        p_issue_description: issueDescription.trim(),
        p_issue_category: issueCategory,
        p_priority: priority
      });

      if (error) throw error;

      setShowModal(false);
      setSelectedUnitId('');
      setSelectedCustomerId('');
      setIssueDescription('');
      fetchTickets();
    } catch (err: any) {
      alert(`Service Request Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="module-container">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench style={{ color: 'var(--brand-primary)' }} /> Dealer Service Requests
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Submit repair/service requests for dealer customers and track field service ticket resolution
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={16} /> New Service Request
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by Service Ticket Number..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>TV Unit</th>
                <th>Customer</th>
                <th>Issue Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Opened Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted">Loading dealer service tickets...</p>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <Wrench size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Service Tickets</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      Click "New Service Request" if a customer reports a hardware issue or defect.
                    </p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.ticket_number}</td>
                    <td>
                      <div>{t.product_units?.product_variants?.product_name || 'ZUVO TV'}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.product_units?.barcode}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.customers?.full_name || 'Customer'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.customers?.phone}</div>
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ fontSize: '0.8125rem' }}>{t.issue_description}</div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                        {t.issue_category}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.priority === 'high' || t.priority === 'urgent' ? 'badge-danger' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'open' ? 'badge-warning' : t.status === 'resolved' || t.status === 'closed' ? 'badge-success' : 'badge-primary'}`} style={{ textTransform: 'capitalize' }}>
                        {t.status}
                      </span>
                    </td>
                    <td>{new Date(t.opened_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          totalRecords={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* New Service Request Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Dealer Service Request</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitTicket}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Customer *</label>
                  <select
                    className="input-field"
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">-- Select Customer --</option>
                    {customersList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select TV Product Unit *</label>
                  <select
                    className="input-field"
                    required
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                  >
                    <option value="">-- Select Product Unit (Barcode - Model) --</option>
                    {unitsList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.barcode} - {u.product_variants?.product_name} (S/N: {u.serial_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Issue Category</label>
                    <select
                      className="input-field"
                      value={issueCategory}
                      onChange={(e) => setIssueCategory(e.target.value)}
                    >
                      <option value="display_panel">Display Panel / Screen</option>
                      <option value="audio_speaker">Audio / Sound</option>
                      <option value="motherboard_power">Motherboard / Power</option>
                      <option value="remote_connectivity">Remote / Connectivity</option>
                      <option value="general">General Repair</option>
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

                <div className="form-group">
                  <label className="form-label">Issue Description *</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    required
                    placeholder="Describe the issue reported by the customer..."
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Service Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
