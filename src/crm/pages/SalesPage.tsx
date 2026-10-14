import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';
import { DateRangePicker } from '../components/common/DateRangePicker';
import { TaxInvoiceModal } from '../components/common/TaxInvoiceModal';
import {
  ShoppingCart,
  Plus,
  Search,
  Building,
  Eye,
  X,
  AlertCircle,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Printer
} from 'lucide-react';

export const SalesPage: React.FC = () => {
  const { currentRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'sales' | 'rma'>('sales');
  const [sales, setSales] = useState<any[]>([]);
  const [rmaReturns, setRmaReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [invoicePrintSale, setInvoicePrintSale] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Date Range filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form states for new sale
  const [customers, setCustomers] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(18999);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentRef, setPaymentRef] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [savingSale, setSavingSale] = useState(false);

  // Form states for RMA Return
  const [showRmaModal, setShowRmaModal] = useState(false);
  const [rmaSale, setRmaSale] = useState<any | null>(null);
  const [rmaUnitId, setRmaUnitId] = useState('');
  const [rmaReason, setRmaReason] = useState('Defective display / dead pixels');
  const [rmaCondition, setRmaCondition] = useState('good_condition');
  const [rmaOutcome, setRmaOutcome] = useState('in_stock');
  const [rmaRefundAmount, setRmaRefundAmount] = useState<number>(0);
  const [rmaRefundMethod, setRmaRefundMethod] = useState('original_payment');
  const [rmaNotes, setRmaNotes] = useState('');
  const [processingRma, setProcessingRma] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('sales')
        .select(`
          *,
          customers(customer_code, full_name, phone, state, city, postal_code, address_line1),
          dealers(dealer_code, dealer_name, gst_number, city, state),
          sale_items(
            id,
            quantity,
            unit_price,
            product_unit_id,
            product_units(
              id,
              serial_number,
              barcode,
              status,
              product_variants(product_name, product_code)
            )
          ),
          payments(id, amount, payment_method, payment_status, payment_reference)
        `)
        .order('sale_date', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`sale_number.ilike.${q}`);
      }

      if (startDate) {
        query = query.gte('sale_date', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        query = query.lte('sale_date', `${endDate}T23:59:59Z`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSales(data || []);

      // Fetch RMA Returns
      let rmaQuery = supabase
        .from('sales_returns')
        .select(`
          *,
          sales(sale_number),
          customers(full_name, phone),
          product_units(serial_number, barcode, product_variants(product_name))
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        rmaQuery = rmaQuery.gte('created_at', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        rmaQuery = rmaQuery.lte('created_at', `${endDate}T23:59:59Z`);
      }

      const { data: rmaData } = await rmaQuery;
      setRmaReturns(rmaData || []);
    } catch (err: any) {
      console.error('Error fetching sales:', err);
      setErrorMsg(err.message || 'Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  };

  const loadFormData = async () => {
    try {
      const [custRes, dealerRes, unitRes] = await Promise.all([
        supabase.from('customers').select('id, customer_code, full_name, phone').eq('is_active', true),
        supabase.from('dealers').select('id, dealer_code, dealer_name').eq('is_active', true),
        supabase
          .from('product_units')
          .select('id, serial_number, barcode, status, warehouse_id, warehouses(warehouse_name), product_variants(product_name)')
          .in('status', ['available', 'in_stock'])
      ]);

      setCustomers(custRes.data || []);
      setDealers(dealerRes.data || []);
      setAvailableUnits(unitRes.data || []);
    } catch (err) {
      console.error('Error loading form dependencies:', err);
    }
  };

  useEffect(() => {
    fetchSales();
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  useEffect(() => {
    if (showCreateModal) {
      loadFormData();
    }
  }, [showCreateModal]);

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedUnitId) {
      alert('Please select both a Customer and an available TV unit');
      return;
    }

    setSavingSale(true);
    try {
      const subtotal = Number(unitPrice);
      const discount = Number(discountAmount) || 0;

      const { data, error } = await (supabase.rpc as any)('create_sales_order', {
        p_customer_id: selectedCustomerId,
        p_product_unit_id: selectedUnitId,
        p_unit_price: subtotal,
        p_discount_amount: discount,
        p_dealer_id: selectedDealerId || null,
        p_payment_method: paymentMethod,
        p_payment_status: paymentStatus,
        p_payment_ref: paymentRef.trim() || null,
        p_notes: saleNotes.trim() || null
      });

      if (error) throw error;

      setShowCreateModal(false);
      setSelectedCustomerId('');
      setSelectedDealerId('');
      setSelectedUnitId('');
      setSaleNotes('');
      fetchSales();
      alert(`Sale Order ${data?.sale_number || ''} created successfully! TV unit status updated to SOLD.`);
    } catch (err: any) {
      alert(`Failed to create sale: ${err.message}`);
    } finally {
      setSavingSale(false);
    }
  };

  const openRmaModal = (sale: any) => {
    setRmaSale(sale);
    const firstItem = sale.sale_items?.[0];
    setRmaUnitId(firstItem?.product_unit_id || '');
    setRmaRefundAmount(sale.total_amount || 0);
    setShowRmaModal(true);
  };

  const handleProcessRma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rmaSale || !rmaUnitId) return;

    setProcessingRma(true);
    try {
      const { data, error } = await (supabase.rpc as any)('process_sales_return', {
        p_unit_id: rmaUnitId,
        p_sale_id: rmaSale.id,
        p_reason: rmaReason.trim(),
        p_inspection_condition: rmaCondition,
        p_outcome: rmaOutcome,
        p_refund_amount: Number(rmaRefundAmount) || 0,
        p_refund_method: rmaRefundMethod,
        p_notes: rmaNotes.trim() || null
      });

      if (error) throw error;

      setShowRmaModal(false);
      setSelectedSale(null);
      fetchSales();
      alert(`RMA Return processed successfully! Policy Number: ${data?.return_number}. Product unit status updated to ${rmaOutcome.toUpperCase()}.`);
    } catch (err: any) {
      alert(`RMA Return processing failed: ${err.message}`);
    } finally {
      setProcessingRma(false);
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (activeTab === 'sales') {
      const headers = ['Invoice Number', 'Sale Date', 'Customer Name', 'Customer Phone', 'Dealer Channel', 'Subtotal (INR)', 'Discount (INR)', 'GST Tax (INR)', 'Total Amount (INR)', 'Payment Status', 'Order Status'];
      const rows = sales.map((s) => [
        s.sale_number,
        new Date(s.sale_date).toLocaleDateString(),
        s.customers?.full_name || 'Direct Customer',
        s.customers?.phone || '',
        s.dealers?.dealer_name || 'Direct Retail Store',
        s.subtotal,
        s.discount_amount,
        s.tax_amount,
        s.total_amount,
        s.payment_status,
        s.sale_status
      ]);
      exportToCSV('ZUVO_Sales_Orders', headers, rows);
    } else {
      const headers = ['RMA Return Number', 'Original Invoice', 'Customer Name', 'Customer Phone', 'TV Unit Barcode', 'TV Serial Number', 'Return Reason', 'Inspection Condition', 'Outcome', 'Refund Amount (INR)', 'Created At'];
      const rows = rmaReturns.map((r) => [
        r.return_number,
        r.sales?.sale_number || '',
        r.customers?.full_name || '',
        r.customers?.phone || '',
        r.product_units?.barcode || '',
        r.product_units?.serial_number || '',
        r.return_reason,
        r.inspection_condition,
        r.outcome,
        r.refund_amount,
        new Date(r.created_at).toLocaleString()
      ]);
      exportToCSV('ZUVO_RMA_Sales_Returns', headers, rows);
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'sales') {
      const headers = ['Invoice Number', 'Sale Date', 'Customer Name', 'Customer Phone', 'Dealer Channel', 'Subtotal (INR)', 'Discount (INR)', 'GST Tax (INR)', 'Total Amount (INR)', 'Payment Status', 'Order Status'];
      const rows = sales.map((s) => [
        s.sale_number,
        new Date(s.sale_date).toLocaleDateString(),
        s.customers?.full_name || 'Direct Customer',
        s.customers?.phone || '',
        s.dealers?.dealer_name || 'Direct Retail Store',
        s.subtotal,
        s.discount_amount,
        s.tax_amount,
        s.total_amount,
        s.payment_status,
        s.sale_status
      ]);
      exportToExcel('ZUVO_Sales_Orders', 'Sales Orders', headers, rows);
    } else {
      const headers = ['RMA Return Number', 'Original Invoice', 'Customer Name', 'Customer Phone', 'TV Unit Barcode', 'TV Serial Number', 'Return Reason', 'Inspection Condition', 'Outcome', 'Refund Amount (INR)', 'Created At'];
      const rows = rmaReturns.map((r) => [
        r.return_number,
        r.sales?.sale_number || '',
        r.customers?.full_name || '',
        r.customers?.phone || '',
        r.product_units?.barcode || '',
        r.product_units?.serial_number || '',
        r.return_reason,
        r.inspection_condition,
        r.outcome,
        r.refund_amount,
        new Date(r.created_at).toLocaleString()
      ]);
      exportToExcel('ZUVO_RMA_Sales_Returns', 'RMA Returns', headers, rows);
    }
  };

  const canCreateSale = ['super_admin', 'admin', 'sales'].includes(currentRole);
  const canProcessReturn = ['super_admin', 'admin', 'sales', 'inventory'].includes(currentRole);

  // Paginated Data
  const paginatedSales = sales.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedRma = rmaReturns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart style={{ color: 'var(--brand-primary)' }} /> Sales, Invoicing & Returns (RMA)
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Orders, GST tax invoicing, customer purchase records, and RMA returns lifecycle.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          {canCreateSale && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Sale Order
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setActiveTab('sales'); setCurrentPage(1); }}
          >
            <ShoppingCart size={15} /> Sales Orders & Invoices ({sales.length})
          </button>
          <button
            className={`btn ${activeTab === 'rma' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setActiveTab('rma'); setCurrentPage(1); }}
          >
            <RotateCcw size={15} /> RMA Sales Returns Ledger ({rmaReturns.length})
          </button>
        </div>

        {/* Date Range Picker Component */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearDateRange={() => { setStartDate(''); setEndDate(''); }}
        />
      </div>

      {/* TAB 1: Sales Orders Table */}
      {activeTab === 'sales' && (
        <>
          {/* Search Bar */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Search by invoice / sale number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
              />
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="card" style={{ borderColor: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <AlertCircle style={{ color: 'var(--status-danger)' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--status-danger)' }}>Error loading sales</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Sales Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Dealer</th>
                    <th>Total Amount</th>
                    <th>Payment Status</th>
                    <th>Order Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                        <p className="text-muted">Loading sales records...</p>
                      </td>
                    </tr>
                  ) : paginatedSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                        <ShoppingCart size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Sales Orders Found</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                          {searchQuery || startDate ? 'Try adjusting your search query or date range filters' : 'Create your first sale order to record transactions'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedSales.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {s.sale_number}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>
                          {new Date(s.sale_date).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.customers?.full_name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.customers?.phone}</div>
                        </td>
                        <td>
                          {s.dealers ? (
                            <span style={{ fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Building size={13} style={{ color: 'var(--brand-accent)' }} /> {s.dealers.dealer_name}
                            </span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.8125rem' }}>Direct Retail</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{s.total_amount?.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className={`badge ${s.payment_status === 'paid' ? 'badge-success' : s.payment_status === 'refunded' ? 'badge-purple' : 'badge-warning'}`}>
                            {s.payment_status}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${s.sale_status === 'returned' ? 'badge-danger' : 'badge-neutral'}`}>
                            {s.sale_status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSale(s)}>
                              <Eye size={14} /> View
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setInvoicePrintSale(s)} style={{ background: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' }}>
                              <Printer size={14} /> Tax Invoice
                            </button>
                            {canProcessReturn && s.sale_status !== 'returned' && (
                              <button className="btn btn-danger btn-sm" onClick={() => openRmaModal(s)}>
                                <RotateCcw size={14} /> RMA
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            <Pagination
              currentPage={currentPage}
              totalCount={sales.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      )}

      {/* TAB 2: RMA Returns History Ledger */}
      {activeTab === 'rma' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>RMA #</th>
                  <th>Original Sale</th>
                  <th>Customer</th>
                  <th>Returned TV Unit</th>
                  <th>Return Reason</th>
                  <th>Inspection Condition</th>
                  <th>Inventory Outcome</th>
                  <th>Refund Amount</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRma.length > 0 ? (
                  paginatedRma.map((rma) => (
                    <tr key={rma.id}>
                      <td>
                        <span className="badge badge-purple" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {rma.return_number}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontFamily: 'monospace' }}>
                          {rma.sales?.sale_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{rma.customers?.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rma.customers?.phone}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{rma.product_units?.product_variants?.product_name}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          BC: {rma.product_units?.barcode} | SN: {rma.product_units?.serial_number}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{rma.return_reason}</td>
                      <td>
                        <span className="badge badge-slate">{rma.inspection_condition}</span>
                      </td>
                      <td>
                        <span className={`badge ${
                          rma.outcome === 'in_stock' ? 'badge-success' :
                          rma.outcome === 'damaged' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {rma.outcome?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>
                        ₹{rma.refund_amount?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(rma.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                      <RotateCcw size={48} style={{ opacity: 0.4, margin: '0 auto 1rem' }} />
                      <h3>Zero RMA Returns Processed</h3>
                      <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>All customer sales confirmed with zero product returns.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalCount={rmaReturns.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Order Details #{selectedSale.sale_number}</h3>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  Sale Date: {new Date(selectedSale.sale_date).toLocaleString()}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedSale(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Customer & Dealer Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</div>
                  <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{selectedSale.customers?.full_name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{selectedSale.customers?.phone}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {selectedSale.customers?.customer_code}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Channel / Dealer</div>
                  <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{selectedSale.dealers ? selectedSale.dealers.dealer_name : 'Direct Retail Store'}</div>
                  {selectedSale.dealers && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dealer Code: {selectedSale.dealers.dealer_code}</div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>Purchased Items</h4>
              <div className="table-responsive" style={{ marginBottom: '1.5rem' }}>
                <table className="data-table" style={{ fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th>TV Model / Variant</th>
                      <th>Barcode</th>
                      <th>Serial #</th>
                      <th>Unit Status</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.sale_items?.map((item: any) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>
                          {item.product_units?.product_variants?.product_name || 'ZUVO TV'}
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{item.product_units?.barcode}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.product_units?.serial_number}</td>
                        <td>
                          <span className={`badge ${
                            item.product_units?.status === 'sold' ? 'badge-success' :
                            item.product_units?.status === 'returned' || item.product_units?.status === 'in_stock' ? 'badge-warning' : 'badge-danger'
                          }`}>
                            {item.product_units?.status}
                          </span>
                        </td>
                        <td>₹{item.unit_price?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pricing breakdown */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                  <div className="flex-between">
                    <span className="text-muted">Subtotal:</span>
                    <span>₹{selectedSale.subtotal?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-between">
                    <span className="text-muted">Discount:</span>
                    <span style={{ color: 'var(--status-success)' }}>-₹{selectedSale.discount_amount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-between">
                    <span className="text-muted">GST (18%):</span>
                    <span>₹{selectedSale.tax_amount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontWeight: 700, fontSize: '1rem' }}>
                    <span>Total:</span>
                    <span style={{ color: 'var(--brand-primary)' }}>₹{selectedSale.total_amount?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const saleToPrint = selectedSale;
                  setSelectedSale(null);
                  setInvoicePrintSale(saleToPrint);
                }}
              >
                <Printer size={16} /> Generate GST Tax Invoice PDF
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedSale(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Invoice Generator Modal */}
      {invoicePrintSale && (
        <TaxInvoiceModal
          sale={invoicePrintSale}
          onClose={() => setInvoicePrintSale(null)}
        />
      )}

      {/* Process RMA Return Modal */}
      {showRmaModal && rmaSale && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-danger)' }}>
                <RotateCcw size={20} /> Process Sales Return (RMA) for {rmaSale.sale_number}
              </h3>
              <button className="btn-icon" onClick={() => setShowRmaModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleProcessRma}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Sold TV Unit to Return *</label>
                  <select
                    className="input-field"
                    value={rmaUnitId}
                    onChange={(e) => setRmaUnitId(e.target.value)}
                    required
                  >
                    {rmaSale.sale_items?.map((item: any) => (
                      <option key={item.product_unit_id} value={item.product_unit_id}>
                        {item.product_units?.product_variants?.product_name} | Barcode: {item.product_units?.barcode} | SN: {item.product_units?.serial_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Return Reason *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Defective display, customer change of mind, freight damage"
                    value={rmaReason}
                    onChange={(e) => setRmaReason(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Physical Inspection Condition *</label>
                    <select
                      className="input-field"
                      value={rmaCondition}
                      onChange={(e) => setRmaCondition(e.target.value)}
                    >
                      <option value="good_condition">Good Condition (Like New)</option>
                      <option value="minor_damage">Minor Cosmetic Damage</option>
                      <option value="defective_damaged">Defective / Damaged Hardware</option>
                      <option value="scrap">Scrap / Irreparable</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Restock / Inventory Outcome *</label>
                    <select
                      className="input-field"
                      value={rmaOutcome}
                      onChange={(e) => setRmaOutcome(e.target.value)}
                    >
                      <option value="in_stock">Return to Stock (IN_STOCK)</option>
                      <option value="damaged">Quarantine as Damaged (DAMAGED)</option>
                      <option value="in_service">Send to Service Hub (IN_SERVICE)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Refund Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      className="input-field"
                      value={rmaRefundAmount}
                      onChange={(e) => setRmaRefundAmount(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Refund Method</label>
                    <select
                      className="input-field"
                      value={rmaRefundMethod}
                      onChange={(e) => setRmaRefundMethod(e.target.value)}
                    >
                      <option value="original_payment">Original Payment Method</option>
                      <option value="bank_transfer">Bank Transfer / NEFT</option>
                      <option value="store_credit">Store / Dealer Credit</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Internal RMA Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Inspection findings, manager approval reference..."
                    value={rmaNotes}
                    onChange={(e) => setRmaNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRmaModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={processingRma}>
                  {processingRma ? 'Executing RMA...' : 'Confirm Sales Return & Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sale Order Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Sale Order</h3>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSale}>
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
                        {c.full_name} ({c.phone}) - {c.customer_code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">TV Unit to Sell (Status: Available / In Stock) *</label>
                  {availableUnits.length === 0 ? (
                    <div className="card" style={{ padding: '0.75rem', background: 'var(--bg-secondary)', fontSize: '0.875rem', color: 'var(--status-warning)' }}>
                      No TV units currently in stock. Add product units in Products / Inventory first.
                    </div>
                  ) : (
                    <select
                      required
                      className="input-field"
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                    >
                      <option value="">-- Select Available TV Unit --</option>
                      {availableUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.product_variants?.product_name || 'ZUVO TV'} | Barcode: {u.barcode} | Serial: {u.serial_number} | Warehouse: {u.warehouses?.warehouse_name || 'Central Facility'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Dealer / Channel (Optional)</label>
                  <select
                    className="input-field"
                    value={selectedDealerId}
                    onChange={(e) => setSelectedDealerId(e.target.value)}
                  >
                    <option value="">-- Direct Retail (No Dealer) --</option>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.dealer_name} ({d.dealer_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Unit Price (₹) *</label>
                    <input
                      type="number"
                      required
                      className="input-field"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Amount (₹)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="input-field"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="credit">Dealer Credit</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Status</label>
                    <select
                      className="input-field"
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transaction Ref</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. TXN-102938"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Order Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Optional notes or delivery instructions..."
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSale || availableUnits.length === 0}>
                  {savingSale ? 'Processing Sale...' : 'Complete Sale Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
