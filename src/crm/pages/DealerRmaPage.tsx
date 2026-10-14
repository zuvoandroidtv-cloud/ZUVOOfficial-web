import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { RotateCcw, Search, Plus, X, AlertCircle } from 'lucide-react';
import { Pagination } from '../components/common/Pagination';

export const DealerRmaPage: React.FC = () => {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;

  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dealerSalesList, setDealerSalesList] = useState<any[]>([]);

  // Form
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [inspectionCondition, setInspectionCondition] = useState('unopened');

  const fetchReturns = async () => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('sales_returns')
        .select('*, customers(full_name, phone), sales(sale_number), product_units(barcode, serial_number)', { count: 'exact' })
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`return_number.ilike.${q}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setReturns(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching dealer RMA returns:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModalData = async () => {
    if (!dealerId) return;
    try {
      const { data: sData } = await supabase
        .from('sales')
        .select('*, customers(full_name, phone), sale_items(*, product_units(barcode, serial_number, product_variants(product_name)))')
        .eq('dealer_id', dealerId)
        .eq('sale_status', 'completed');
      setDealerSalesList(sData || []);
    } catch (err) {
      console.error('Error loading sales for RMA:', err);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [dealerId, searchQuery, page, pageSize]);

  const handleOpenModal = () => {
    loadModalData();
    setShowModal(true);
  };

  const handleSaleSelect = (saleId: string) => {
    setSelectedSaleId(saleId);
    const sale = dealerSalesList.find((s) => s.id === saleId);
    if (sale) {
      setSelectedCustomerId(sale.customer_id);
      const item = sale.sale_items?.[0];
      if (item) {
        setSelectedUnitId(item.product_unit_id);
      }
    }
  };

  const handleSubmitRma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleId || !selectedUnitId || !selectedCustomerId || !returnReason.trim()) {
      alert('Please fill out all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('fn_dealer_create_rma_request', {
        p_sale_id: selectedSaleId,
        p_product_unit_id: selectedUnitId,
        p_customer_id: selectedCustomerId,
        p_return_reason: returnReason.trim(),
        p_inspection_condition: inspectionCondition
      });

      if (error) throw error;

      setShowModal(false);
      setSelectedSaleId('');
      setSelectedUnitId('');
      setSelectedCustomerId('');
      setReturnReason('');
      fetchReturns();
    } catch (err: any) {
      alert(`RMA Request Failed: ${err.message}`);
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
            <RotateCcw style={{ color: 'var(--brand-primary)' }} /> Dealer RMA & Return Requests
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Submit sales returns and replacement requests for dealer TV orders
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={16} /> Request Return (RMA)
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by RMA Return Number..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Returns Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>RMA Number</th>
                <th>Sale Order</th>
                <th>Customer</th>
                <th>Barcode / S/N</th>
                <th>Return Reason</th>
                <th>Condition</th>
                <th>Approval Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted">Loading RMA requests...</p>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <RotateCcw size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No RMA Requests</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      Click "Request Return (RMA)" if a TV unit needs to be returned or replaced.
                    </p>
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.return_number}</td>
                    <td>{r.sales?.sale_number || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.customers?.full_name || 'Customer'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.customers?.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem' }}>{r.product_units?.barcode}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>S/N: {r.product_units?.serial_number}</div>
                    </td>
                    <td>{r.return_reason}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.inspection_condition}</td>
                    <td>
                      <span className={`badge ${r.refund_status === 'approved' ? 'badge-success' : r.refund_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                        {r.refund_status.replace('_', ' ')}
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
          totalRecords={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* New RMA Request Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Request TV Return / Replacement (RMA)</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitRma}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Dealer Sale Order *</label>
                  <select
                    className="input-field"
                    required
                    value={selectedSaleId}
                    onChange={(e) => handleSaleSelect(e.target.value)}
                  >
                    <option value="">-- Select Completed Sale Order --</option>
                    {dealerSalesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sale_number} - {s.customers?.full_name} ({s.sale_items?.[0]?.product_units?.barcode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Inspection Condition</label>
                  <select
                    className="input-field"
                    value={inspectionCondition}
                    onChange={(e) => setInspectionCondition(e.target.value)}
                  >
                    <option value="unopened">Unopened (Sealed Box)</option>
                    <option value="opened_good">Opened (Good Condition)</option>
                    <option value="damaged">Damaged Box / Cosmetic Defect</option>
                    <option value="defective">Dead on Arrival (DOA / Defective)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Return Reason *</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    required
                    placeholder="State the reason for return/replacement request..."
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !selectedSaleId}>
                  {submitting ? 'Submitting...' : 'Submit RMA Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
