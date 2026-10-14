import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, Search, Plus, X, Barcode, User, FileText, CheckCircle2 } from 'lucide-react';
import { Pagination } from '../components/common/Pagination';
import { UnlinkedDealerAlert } from '../components/common/UnlinkedDealerAlert';

export const DealerSalesPage: React.FC = () => {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // New Sale Order Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);

  // Form Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [saleNotes, setSaleNotes] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const fetchSales = async () => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('*, customers(full_name, phone, email), sale_items(product_units(barcode, serial_number))', { count: 'exact' })
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`sale_number.ilike.${q}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setSales(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching dealer sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModalData = async () => {
    if (!dealerId) return;
    try {
      // Available stock
      const { data: uData } = await supabase
        .from('product_units')
        .select('*, product_variants(product_name, selling_price, screen_size)')
        .eq('dealer_id', dealerId)
        .eq('status', 'in_stock')
        .order('received_at', { ascending: false });
      setAvailableUnits(uData || []);

      // Customers
      const { data: cData } = await supabase
        .from('customers')
        .select('*')
        .order('full_name', { ascending: true })
        .limit(100);
      setCustomersList(cData || []);
    } catch (err) {
      console.error('Error loading modal data:', err);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [dealerId, searchQuery, page, pageSize]);

  const handleOpenCreateModal = () => {
    loadModalData();
    setShowCreateModal(true);
  };

  const handleUnitSelect = (unitId: string) => {
    setSelectedUnitId(unitId);
    const unit = availableUnits.find((u) => u.id === unitId);
    if (unit && unit.product_variants?.selling_price) {
      setUnitPrice(unit.product_variants.selling_price);
    }
  };

  const handleCreateCustomerAndSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) {
      alert('Please select a product unit from your stock');
      return;
    }

    setCreating(true);
    try {
      let finalCustomerId = selectedCustomerId;

      // If user wants to create a new customer
      if (isCreatingCustomer) {
        if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
          alert('Customer name and phone are required');
          setCreating(false);
          return;
        }
        const custCode = `CUST-${Date.now().toString().slice(-6)}`;
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            customer_code: custCode,
            full_name: newCustomerName.trim(),
            phone: newCustomerPhone.trim(),
            is_active: true
          })
          .select()
          .single();

        if (custErr) throw custErr;
        finalCustomerId = (newCust as any)?.id;
      }

      if (!finalCustomerId) {
        alert('Please select or create a customer');
        setCreating(false);
        return;
      }

      // Execute RPC
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_dealer_create_sale_order', {
        p_customer_id: finalCustomerId,
        p_product_unit_id: selectedUnitId,
        p_unit_price: Number(unitPrice) || 0,
        p_notes: saleNotes.trim() || null
      });

      if (rpcErr) throw rpcErr;

      setShowCreateModal(false);
      setSelectedCustomerId('');
      setSelectedUnitId('');
      setUnitPrice('');
      setSaleNotes('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setIsCreatingCustomer(false);
      fetchSales();
    } catch (err: any) {
      alert(`Sale Creation Failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (!dealerId && !loading) {
    return (
      <div className="module-container">
        <UnlinkedDealerAlert />
      </div>
    );
  }

  return (
    <div className="module-container">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag style={{ color: 'var(--brand-primary)' }} /> Dealer Sales & Orders
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Record customer sales orders, link product barcodes, and auto-update inventory status
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={16} /> Record New Sale
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by sale order number..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Sales Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Barcode / Serial</th>
                <th>Sale Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted">Loading dealer sales records...</p>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <ShoppingBag size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Sales Orders Found</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      Click "Record New Sale" to register your first TV sale order.
                    </p>
                  </td>
                </tr>
              ) : (
                sales.map((s) => {
                  const item = s.sale_items?.[0];
                  const pu = item?.product_units;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.sale_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.customers?.full_name || 'Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.customers?.phone}</div>
                      </td>
                      <td>
                        {pu ? (
                          <div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem' }}>{pu.barcode}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>S/N: {pu.serial_number}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td>{new Date(s.sale_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>₹{(s.total_amount || 0).toLocaleString()}</td>
                      <td>
                        <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                          {s.sale_status}
                        </span>
                      </td>
                    </tr>
                  );
                })
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

      {/* Record New Sale Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Record Dealer TV Sale Order</h3>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomerAndSale}>
              <div className="modal-body">
                {/* Select Stock Unit */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Select Available Stock TV Unit *</label>
                  <select
                    className="input-field"
                    required
                    value={selectedUnitId}
                    onChange={(e) => handleUnitSelect(e.target.value)}
                  >
                    <option value="">-- Select Product Unit (Barcode - Model) --</option>
                    {availableUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.barcode} ({u.product_variants?.product_name} - {u.product_variants?.screen_size}") - S/N: {u.serial_number}
                      </option>
                    ))}
                  </select>
                  {availableUnits.length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.375rem' }}>
                      No available stock units found in your dealer inventory.
                    </div>
                  )}
                </div>

                {/* Customer Toggle */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name="custType"
                        checked={!isCreatingCustomer}
                        onChange={() => setIsCreatingCustomer(false)}
                      />
                      Select Existing Customer
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name="custType"
                        checked={isCreatingCustomer}
                        onChange={() => setIsCreatingCustomer(true)}
                      />
                      Create New Customer
                    </label>
                  </div>

                  {!isCreatingCustomer ? (
                    <div className="form-group">
                      <select
                        className="input-field"
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        required={!isCreatingCustomer}
                      >
                        <option value="">-- Select Customer --</option>
                        {customersList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Customer Name *</label>
                        <input
                          type="text"
                          required={isCreatingCustomer}
                          className="input-field"
                          placeholder="Full Name"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phone Number *</label>
                        <input
                          type="tel"
                          required={isCreatingCustomer}
                          className="input-field"
                          placeholder="Phone Number"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Selling Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      className="input-field"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Status</label>
                    <input type="text" className="input-field" disabled value="Paid (Completed)" />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Sale Notes (Optional)</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Enter any specific sale details..."
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating || availableUnits.length === 0}>
                  {creating ? 'Saving Sale...' : 'Submit Sale Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
