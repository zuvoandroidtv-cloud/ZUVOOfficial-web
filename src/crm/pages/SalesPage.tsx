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
  Printer,
  DollarSign,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  Layers,
  RefreshCw
} from 'lucide-react';

interface AgingSummary {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
}

export const SalesPage: React.FC = () => {
  const { currentRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'sales' | 'rma' | 'ar_ledger' | 'unallocated_receipts' | 'dunning'>('sales');
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

  // =========================================================================
  // PHASE 8.2: ACCOUNTS RECEIVABLE (AR) & RECONCILIATION STATES
  // =========================================================================
  const [arLedgers, setArLedgers] = useState<any[]>([]);
  const [unallocatedReceipts, setUnallocatedReceipts] = useState<any[]>([]);
  const [dunningCases, setDunningCases] = useState<any[]>([]);
  const [commercialInvoices, setCommercialInvoices] = useState<any[]>([]);
  const [agingSummary, setAgingSummary] = useState<AgingSummary>({
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    days90Plus: 0,
    totalOutstanding: 0
  });

  // Payment allocation drawer / modal
  const [showAllocationDrawer, setShowAllocationDrawer] = useState(false);
  const [selectedArInvoice, setSelectedArInvoice] = useState<any | null>(null);
  const [selectedReceiptForAlloc, setSelectedReceiptForAlloc] = useState<string>('');
  const [allocationAmount, setAllocationAmount] = useState<number>(0);
  const [processingAlloc, setProcessingAlloc] = useState(false);

  // Multi-invoice reconciliation modal
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedReceiptForReconcile, setSelectedReceiptForReconcile] = useState<any | null>(null);
  const [selectedArInvoiceIds, setSelectedArInvoiceIds] = useState<string[]>([]);
  const [processingReconcile, setProcessingReconcile] = useState(false);

  // New Unallocated Receipt Modal
  const [showCreateReceiptModal, setShowCreateReceiptModal] = useState(false);
  const [newReceiptAmount, setNewReceiptAmount] = useState<number>(0);
  const [newReceiptMethod, setNewReceiptMethod] = useState<'NEFT' | 'RTGS' | 'UPI' | 'BANK_TRANSFER' | 'IMPS'>('UPI');
  const [newReceiptTxRef, setNewReceiptTxRef] = useState('');
  const [newReceiptPayer, setNewReceiptPayer] = useState('');
  const [newReceiptNotes, setNewReceiptNotes] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Dunning evaluation state
  const [evaluatingDunning, setEvaluatingDunning] = useState(false);

  // Generate Commercial Tax Invoice state
  const [generatingTaxInvId, setGeneratingTaxInvId] = useState<string | null>(null);

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

  // Phase 8.2: Fetch Accounts Receivable data
  const fetchArData = async () => {
    try {
      const [arRes, receiptsRes, dunningRes, taxInvRes] = await Promise.all([
        (supabase.from as any)('customer_ar_ledger').select(`
          *,
          customers(id, customer_code, full_name, phone, state),
          dealers(id, dealer_code, dealer_name, state),
          sales(sale_number)
        `).order('due_date', { ascending: true }),
        (supabase.from as any)('payment_receipts_unallocated').select('*').order('received_date', { ascending: false }),
        (supabase.from as any)('ar_dunning_cases').select(`
          *,
          customers(full_name, phone),
          dealers(dealer_name)
        `).order('days_overdue', { ascending: false }),
        (supabase.from as any)('commercial_tax_invoices').select('*').order('invoice_date', { ascending: false })
      ]);

      const ledgers: any[] = arRes.data || [];
      setArLedgers(ledgers);
      setUnallocatedReceipts(receiptsRes.data || []);
      setDunningCases(dunningRes.data || []);
      setCommercialInvoices(taxInvRes.data || []);

      // Authoritative calculation of aging buckets based on due_date
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let current = 0;
      let d1_30 = 0;
      let d31_60 = 0;
      let d61_90 = 0;
      let d90Plus = 0;
      let total = 0;

      for (const item of ledgers) {
        if (item.status === 'OPEN' || item.status === 'PARTIALLY_SETTLED') {
          const balance = Number(item.remaining_balance) || 0;
          if (balance > 0) {
            total += balance;
            const dueDate = new Date(item.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
              current += balance;
            } else if (diffDays <= 30) {
              d1_30 += balance;
            } else if (diffDays <= 60) {
              d31_60 += balance;
            } else if (diffDays <= 90) {
              d61_90 += balance;
            } else {
              d90Plus += balance;
            }
          }
        }
      }

      setAgingSummary({
        current: Math.round(current * 100) / 100,
        days1_30: Math.round(d1_30 * 100) / 100,
        days31_60: Math.round(d31_60 * 100) / 100,
        days61_90: Math.round(d61_90 * 100) / 100,
        days90Plus: Math.round(d90Plus * 100) / 100,
        totalOutstanding: Math.round(total * 100) / 100
      });
    } catch (err: any) {
      console.error('Error fetching AR data:', err);
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
    fetchArData();
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
      fetchArData();
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

  // Phase 8.2: Generate Authoritative Commercial Tax Invoice
  const handleGenerateCommercialInvoice = async (saleId: string) => {
    setGeneratingTaxInvId(saleId);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_generate_commercial_tax_invoice', {
        p_sale_id: saleId
      });

      if (error) throw error;

      if (data?.success) {
        alert(`Commercial Tax Invoice ${data.invoice_number} generated successfully! HSN 8528 tax calculated server-side and posted to AR ledger.`);
        fetchArData();
        fetchSales();
      } else {
        alert(`Invoice generation notice: ${data?.error || 'Unknown result'}`);
      }
    } catch (err: any) {
      alert(`Failed to generate commercial tax invoice: ${err.message}`);
    } finally {
      setGeneratingTaxInvId(null);
    }
  };

  // Phase 8.2: Open Allocation Drawer
  const openAllocationDrawer = (arInvoice: any) => {
    setSelectedArInvoice(arInvoice);
    setAllocationAmount(Number(arInvoice.remaining_balance) || 0);
    const firstAvailableReceipt = unallocatedReceipts.find(r => (r.status === 'UNALLOCATED' || r.status === 'PARTIALLY_ALLOCATED') && r.remaining_amount > 0);
    setSelectedReceiptForAlloc(firstAvailableReceipt?.id || '');
    setShowAllocationDrawer(true);
  };

  // Phase 8.2: Apply Payment to AR Invoice
  const handleApplyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArInvoice || !selectedReceiptForAlloc || allocationAmount <= 0) {
      alert('Please select a payment receipt and enter a valid allocation amount');
      return;
    }

    const receipt = unallocatedReceipts.find(r => r.id === selectedReceiptForAlloc);
    if (!receipt || receipt.remaining_amount < allocationAmount) {
      alert(`Selected receipt only has ₹${receipt?.remaining_amount?.toLocaleString('en-IN') || 0} remaining`);
      return;
    }

    if (allocationAmount > selectedArInvoice.remaining_balance) {
      alert(`Allocation amount cannot exceed invoice remaining balance of ₹${selectedArInvoice.remaining_balance?.toLocaleString('en-IN')}`);
      return;
    }

    setProcessingAlloc(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_apply_payment_to_ar_invoice', {
        p_ar_ledger_id: selectedArInvoice.id,
        p_payment_id: selectedReceiptForAlloc,
        p_amount: allocationAmount
      });

      if (error) throw error;

      if (data?.success) {
        alert(`Payment of ₹${allocationAmount.toLocaleString('en-IN')} allocated successfully! Remaining AR balance: ₹${data.new_ar_balance?.toLocaleString('en-IN')}`);
        setShowAllocationDrawer(false);
        fetchArData();
      } else {
        alert(`Allocation error: ${data?.error}`);
      }
    } catch (err: any) {
      alert(`Failed to apply payment: ${err.message}`);
    } finally {
      setProcessingAlloc(false);
    }
  };

  // Phase 8.2: Open Multi-Invoice Reconcile Modal
  const openReconcileModal = (receipt: any) => {
    setSelectedReceiptForReconcile(receipt);
    const eligibleAr = arLedgers.filter(ar => (ar.status === 'OPEN' || ar.status === 'PARTIALLY_SETTLED') && ar.remaining_balance > 0);
    setSelectedArInvoiceIds(eligibleAr.slice(0, 3).map(a => a.id));
    setShowReconcileModal(true);
  };

  // Phase 8.2: Execute Multi-Invoice Reconciliation
  const handleExecuteReconcile = async () => {
    if (!selectedReceiptForReconcile || selectedArInvoiceIds.length === 0) {
      alert('Please select at least one open AR invoice to reconcile against');
      return;
    }

    setProcessingReconcile(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_reconcile_unallocated_bank_receipt', {
        p_unallocated_id: selectedReceiptForReconcile.id,
        p_ar_ledger_ids: selectedArInvoiceIds
      });

      if (error) throw error;

      if (data?.success) {
        alert(`Reconciliation complete! Allocated ₹${data.allocated_total?.toLocaleString('en-IN')} across ${data.invoices_reconciled} invoices.`);
        setShowReconcileModal(false);
        fetchArData();
      } else {
        alert(`Reconciliation error: ${data?.error}`);
      }
    } catch (err: any) {
      alert(`Failed to reconcile: ${err.message}`);
    } finally {
      setProcessingReconcile(false);
    }
  };

  // Phase 8.2: Create New Unallocated Bank/UPI Receipt
  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReceiptAmount || newReceiptAmount <= 0 || !newReceiptTxRef || !newReceiptPayer) {
      alert('Please fill all required receipt fields with valid amounts');
      return;
    }

    setSavingReceipt(true);
    try {
      const ref = `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await (supabase.from as any)('payment_receipts_unallocated').insert({
        receipt_reference: ref,
        external_transaction_ref: newReceiptTxRef.trim(),
        amount: Number(newReceiptAmount),
        received_date: new Date().toISOString().split('T')[0],
        payment_method: newReceiptMethod,
        payer_name: newReceiptPayer.trim(),
        matched_amount: 0.00,
        remaining_amount: Number(newReceiptAmount),
        status: 'UNALLOCATED',
        notes: newReceiptNotes.trim() || null
      });

      if (error) throw error;

      alert(`Unallocated Receipt ${ref} created successfully! Ready for AR matching.`);
      setShowCreateReceiptModal(false);
      setNewReceiptAmount(0);
      setNewReceiptTxRef('');
      setNewReceiptPayer('');
      setNewReceiptNotes('');
      fetchArData();
    } catch (err: any) {
      alert(`Failed to create receipt: ${err.message}`);
    } finally {
      setSavingReceipt(false);
    }
  };

  // Phase 8.2: Evaluate Dunning Pipeline
  const handleEvaluateDunning = async () => {
    setEvaluatingDunning(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_evaluate_ar_dunning_pipeline');
      if (error) throw error;

      if (data?.success) {
        alert(`Dunning Engine evaluated successfully! ${data.cases_created} new dunning cases created, ${data.cases_escalated} escalated.`);
        fetchArData();
      } else {
        alert(`Dunning notice: ${data?.error}`);
      }
    } catch (err: any) {
      alert(`Dunning evaluation failed: ${err.message}`);
    } finally {
      setEvaluatingDunning(false);
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
    } else if (activeTab === 'ar_ledger') {
      const headers = ['Invoice Number', 'Party Name', 'Party Type', 'Due Date', 'Billed (INR)', 'Settled (INR)', 'Remaining Balance (INR)', 'Status'];
      const rows = arLedgers.map((a) => [
        a.invoice_number,
        a.customers?.full_name || a.dealers?.dealer_name || 'Unknown',
        a.dealers ? 'DEALER' : 'CUSTOMER',
        a.due_date,
        a.billed_amount,
        a.settled_amount,
        a.remaining_balance,
        a.status
      ]);
      exportToCSV('ZUVO_Customer_AR_Ledger', headers, rows);
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

  const canCreateSale = ['super_admin', 'admin', 'sales', 'inventory', 'support'].includes(currentRole || 'admin');
  const canProcessReturn = ['super_admin', 'admin', 'sales', 'inventory'].includes(currentRole || 'admin');
  const isFinanceOrAdmin = ['super_admin', 'admin', 'finance', 'sales'].includes(currentRole || 'admin');

  // Paginated Data
  const paginatedSales = sales.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedRma = rmaReturns.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedAr = arLedgers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart style={{ color: 'var(--brand-primary)' }} /> Sales, AR Invoicing & Cash Reconciliation
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Enterprise Accounts Receivable ledger, GST e-invoicing (HSN 8528), bank reconciliation, and dunning engine.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          {isFinanceOrAdmin && (
            <button className="btn btn-secondary" onClick={() => setShowCreateReceiptModal(true)}>
              <DollarSign size={15} /> Log Bank Receipt
            </button>
          )}
          {canCreateSale && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Sale Order
            </button>
          )}
        </div>
      </div>

      {/* AR Aging Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
          <div>
            <div className="stat-label">Current (Due)</div>
            <div className="stat-val" style={{ color: 'var(--accent-emerald)' }}>
              ₹{agingSummary.current.toLocaleString('en-IN')}
            </div>
          </div>
          <Clock size={24} style={{ color: 'var(--accent-emerald)', opacity: 0.8 }} />
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
          <div>
            <div className="stat-label">1–30 Days Overdue</div>
            <div className="stat-val" style={{ color: 'var(--accent-blue)' }}>
              ₹{agingSummary.days1_30.toLocaleString('en-IN')}
            </div>
          </div>
          <AlertCircle size={24} style={{ color: 'var(--accent-blue)', opacity: 0.8 }} />
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
          <div>
            <div className="stat-label">31–60 Days Overdue</div>
            <div className="stat-val" style={{ color: 'var(--accent-amber)' }}>
              ₹{agingSummary.days31_60.toLocaleString('en-IN')}
            </div>
          </div>
          <AlertTriangle size={24} style={{ color: 'var(--accent-amber)', opacity: 0.8 }} />
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <div>
            <div className="stat-label">61–90 Days Overdue</div>
            <div className="stat-val" style={{ color: 'var(--accent-purple)' }}>
              ₹{agingSummary.days61_90.toLocaleString('en-IN')}
            </div>
          </div>
          <ShieldAlert size={24} style={{ color: 'var(--accent-purple)', opacity: 0.8 }} />
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-rose)' }}>
          <div>
            <div className="stat-label">90+ Days Critical</div>
            <div className="stat-val" style={{ color: 'var(--accent-rose)' }}>
              ₹{agingSummary.days90Plus.toLocaleString('en-IN')}
            </div>
          </div>
          <ShieldAlert size={24} style={{ color: 'var(--accent-rose)', opacity: 0.8 }} />
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <div>
            <div className="stat-label">Total AR Outstanding</div>
            <div className="stat-val" style={{ color: 'var(--accent-cyan)' }}>
              ₹{agingSummary.totalOutstanding.toLocaleString('en-IN')}
            </div>
          </div>
          <DollarSign size={24} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setActiveTab('sales'); setCurrentPage(1); }}
          >
            <ShoppingCart size={15} /> Sales Orders ({sales.length})
          </button>
          <button
            className={`btn ${activeTab === 'ar_ledger' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setActiveTab('ar_ledger'); setCurrentPage(1); }}
          >
            <DollarSign size={15} /> Accounts Receivable Ledger ({arLedgers.length})
          </button>
          <button
            className={`btn ${activeTab === 'unallocated_receipts' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setActiveTab('unallocated_receipts'); setCurrentPage(1); }}
          >
            <Layers size={15} /> Unallocated Bank Receipts ({unallocatedReceipts.length})
          </button>
          <button
            className={`btn ${activeTab === 'dunning' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setActiveTab('dunning'); setCurrentPage(1); }}
          >
            <AlertTriangle size={15} /> Dunning Pipeline ({dunningCases.length})
          </button>
          <button
            className={`btn ${activeTab === 'rma' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setActiveTab('rma'); setCurrentPage(1); }}
          >
            <RotateCcw size={15} /> RMA Returns ({rmaReturns.length})
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

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sale #</th>
                    <th>Date</th>
                    <th>Customer / Dealer</th>
                    <th>Total Amount</th>
                    <th>Payment Status</th>
                    <th>Order Status</th>
                    <th>Commercial GST</th>
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
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '420px', margin: '0.5rem auto 1.25rem' }}>
                          Start selling TV inventory by creating your first sales order. Select an active customer and an available serialized TV unit from stock.
                        </p>
                        {canCreateSale && (
                          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
                            <Plus size={15} /> Create First Sale Order
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedSales.map((s) => {
                      const linkedInv = commercialInvoices.find(ci => ci.sale_id === s.id);
                      return (
                        <tr key={s.id}>
                          <td>
                            <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {s.sale_number}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.875rem' }}>{new Date(s.sale_date).toLocaleDateString()}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{s.customers?.full_name || s.dealers?.dealer_name || 'Direct Customer'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {s.dealers ? `Dealer: ${s.dealers.dealer_code}` : s.customers?.phone}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>
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
                            {linkedInv ? (
                              <span className="badge badge-success" style={{ fontFamily: 'monospace' }}>
                                {linkedInv.invoice_number}
                              </span>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={generatingTaxInvId === s.id}
                                onClick={() => handleGenerateCommercialInvoice(s.id)}
                                style={{ fontSize: '0.75rem' }}
                              >
                                {generatingTaxInvId === s.id ? 'Generating...' : '+ GST Invoice'}
                              </button>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSale(s)}>
                                <Eye size={14} /> View
                              </button>
                              <button className="btn btn-primary btn-sm" onClick={() => setInvoicePrintSale(s)} style={{ background: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' }}>
                                <Printer size={14} /> Tax Inv
                              </button>
                              {canProcessReturn && s.sale_status !== 'returned' && (
                                <button className="btn btn-danger btn-sm" onClick={() => openRmaModal(s)}>
                                  <RotateCcw size={14} /> RMA
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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

      {/* TAB 2: ACCOUNTS RECEIVABLE (AR) LEDGER */}
      {activeTab === 'ar_ledger' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>AR Invoice #</th>
                  <th>Customer / Dealer</th>
                  <th>Due Date</th>
                  <th>Billed Amount</th>
                  <th>Settled</th>
                  <th>Balance Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAr.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <DollarSign size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Zero Accounts Receivable Records</h3>
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Generate a commercial tax invoice to post initial customer receivables.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedAr.map((ar) => (
                    <tr key={ar.id}>
                      <td>
                        <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {ar.invoice_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ar.customers?.full_name || ar.dealers?.dealer_name || 'Direct Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {ar.dealers ? `B2B Dealer (${ar.dealers.dealer_code})` : `B2C Customer (${ar.customers?.phone || ''})`}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{ar.due_date}</td>
                      <td style={{ fontWeight: 600 }}>₹{ar.billed_amount?.toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--accent-emerald)' }}>₹{ar.settled_amount?.toLocaleString('en-IN')}</td>
                      <td style={{ fontWeight: 700, color: ar.remaining_balance > 0 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>
                        ₹{ar.remaining_balance?.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge ${
                          ar.status === 'SETTLED' ? 'badge-success' :
                          ar.status === 'PARTIALLY_SETTLED' ? 'badge-warning' :
                          ar.status === 'WRITTEN_OFF' ? 'badge-neutral' : 'badge-danger'
                        }`}>
                          {ar.status}
                        </span>
                      </td>
                      <td>
                        {isFinanceOrAdmin && ar.status !== 'SETTLED' && ar.status !== 'WRITTEN_OFF' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openAllocationDrawer(ar)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            <DollarSign size={13} /> Allocate Cash
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalCount={arLedgers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* TAB 3: UNALLOCATED RECEIPTS STAGING */}
      {activeTab === 'unallocated_receipts' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt Ref</th>
                  <th>External Txn Ref (UTR/UPI)</th>
                  <th>Payment Method</th>
                  <th>Payer Name</th>
                  <th>Received Date</th>
                  <th>Total Amount</th>
                  <th>Unallocated Remainder</th>
                  <th>Status</th>
                  <th>Reconciliation</th>
                </tr>
              </thead>
              <tbody>
                {unallocatedReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <Layers size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Zero Unallocated Receipts</h3>
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        All incoming NEFT/RTGS/UPI receipts have been fully reconciled.
                      </p>
                    </td>
                  </tr>
                ) : (
                  unallocatedReceipts.map((rcpt) => (
                    <tr key={rcpt.id}>
                      <td>
                        <span className="badge badge-secondary" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {rcpt.receipt_reference}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{rcpt.external_transaction_ref}</td>
                      <td>
                        <span className="badge badge-neutral">{rcpt.payment_method}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{rcpt.payer_name}</td>
                      <td style={{ fontSize: '0.875rem' }}>{rcpt.received_date}</td>
                      <td style={{ fontWeight: 600 }}>₹{rcpt.amount?.toLocaleString('en-IN')}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        ₹{rcpt.remaining_amount?.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge ${
                          rcpt.status === 'FULLY_ALLOCATED' ? 'badge-success' :
                          rcpt.status === 'PARTIALLY_ALLOCATED' ? 'badge-warning' : 'badge-primary'
                        }`}>
                          {rcpt.status}
                        </span>
                      </td>
                      <td>
                        {isFinanceOrAdmin && rcpt.remaining_amount > 0 && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openReconcileModal(rcpt)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            <RefreshCw size={13} /> Multi-Invoice Reconcile
                          </button>
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

      {/* TAB 4: DUNNING PIPELINE */}
      {activeTab === 'dunning' && (
        <div>
          <div className="flex-between" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Automated Dunning & Overdue Escalation Matrix</h3>
              <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                Tier 1 (Reminder), Tier 2 (Urgent Notice), Tier 3 (Legal / Service Suspension Review).
              </p>
            </div>
            {isFinanceOrAdmin && (
              <button
                className="btn btn-primary btn-sm"
                disabled={evaluatingDunning}
                onClick={handleEvaluateDunning}
              >
                <RefreshCw size={14} className={evaluatingDunning ? 'animate-spin' : ''} />
                {evaluatingDunning ? 'Evaluating...' : 'Evaluate Dunning Pipeline'}
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer / Dealer</th>
                    <th>Days Overdue</th>
                    <th>Overdue Amount</th>
                    <th>Dunning Tier</th>
                    <th>Notice Count</th>
                    <th>Service Suspension Flag</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dunningCases.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                        <CheckCircle size={48} style={{ color: 'var(--accent-emerald)', margin: '0 auto 1rem', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Zero Overdue Dunning Cases</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                          All customer and dealer accounts receivable are current.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    dunningCases.map((dc) => (
                      <tr key={dc.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{dc.invoice_number}</td>
                        <td style={{ fontWeight: 600 }}>{dc.customers?.full_name || dc.dealers?.dealer_name || 'Customer on File'}</td>
                        <td style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>{dc.days_overdue} days</td>
                        <td style={{ fontWeight: 700 }}>₹{dc.overdue_amount?.toLocaleString('en-IN')}</td>
                        <td>
                          <span className={`badge ${
                            dc.tier === 'TIER_1' ? 'badge-primary' :
                            dc.tier === 'TIER_2' ? 'badge-warning' : 'badge-danger'
                          }`}>
                            {dc.tier === 'TIER_1' ? 'Tier 1 (Reminder)' : dc.tier === 'TIER_2' ? 'Tier 2 (Urgent Notice)' : 'Tier 3 (Suspension)'}
                          </span>
                        </td>
                        <td>{dc.notice_count} notices</td>
                        <td>
                          {dc.service_suspension_flag ? (
                            <span className="badge badge-danger">SUSPENSION REVIEW</span>
                          ) : (
                            <span className="badge badge-success">ACTIVE</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${dc.status === 'RESOLVED' ? 'badge-success' : 'badge-warning'}`}>
                            {dc.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RMA Returns History Ledger */}
      {activeTab === 'rma' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return Number</th>
                  <th>Original Sale #</th>
                  <th>Customer</th>
                  <th>Product Unit Details</th>
                  <th>Reason</th>
                  <th>Inspection Condition</th>
                  <th>Outcome</th>
                  <th>Refund Amount</th>
                  <th>Return Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRma.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                      <RotateCcw size={48} style={{ opacity: 0.4, margin: '0 auto 1rem' }} />
                      <h3>Zero RMA Returns Processed</h3>
                      <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>All customer sales confirmed with zero product returns.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedRma.map((rma) => (
                    <tr key={rma.id}>
                      <td>
                        <span className="badge badge-primary" style={{ fontFamily: 'monospace' }}>
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

      {/* MODAL: Single Payment Allocation Drawer */}
      {showAllocationDrawer && selectedArInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Allocate Payment to AR #{selectedArInvoice.invoice_number}</h3>
              <button className="btn-icon" onClick={() => setShowAllocationDrawer(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleApplyPayment}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                    <span className="text-muted">Total Billed:</span>
                    <span style={{ fontWeight: 600 }}>₹{selectedArInvoice.billed_amount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                    <span className="text-muted">Already Settled:</span>
                    <span style={{ color: 'var(--accent-emerald)' }}>₹{selectedArInvoice.settled_amount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontWeight: 700 }}>
                    <span>Remaining Balance:</span>
                    <span style={{ color: 'var(--accent-rose)' }}>₹{selectedArInvoice.remaining_balance?.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Unallocated Bank/UPI Receipt *</label>
                  <select
                    className="input-field"
                    value={selectedReceiptForAlloc}
                    onChange={(e) => setSelectedReceiptForAlloc(e.target.value)}
                    required
                  >
                    <option value="">-- Choose incoming receipt --</option>
                    {unallocatedReceipts
                      .filter(r => (r.status === 'UNALLOCATED' || r.status === 'PARTIALLY_ALLOCATED') && r.remaining_amount > 0)
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.receipt_reference} ({r.payment_method} - ₹{r.remaining_amount?.toLocaleString('en-IN')} rem) - {r.payer_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Allocation Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedArInvoice.remaining_balance}
                    className="input-field"
                    value={allocationAmount}
                    onChange={(e) => setAllocationAmount(Number(e.target.value))}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Server-enforced: cannot exceed receipt remaining amount or open invoice balance.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAllocationDrawer(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={processingAlloc || !selectedReceiptForAlloc}>
                  {processingAlloc ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Multi-Invoice Reconciliation */}
      {showReconcileModal && selectedReceiptForReconcile && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Reconcile Receipt #{selectedReceiptForReconcile.receipt_reference}</h3>
              <button className="btn-icon" onClick={() => setShowReconcileModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <div className="flex-between">
                  <span className="text-muted">Available Unallocated Cash:</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>
                    ₹{selectedReceiptForReconcile.remaining_amount?.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Select one or more open AR invoices below to match sequentially.
                </div>
              </div>

              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Open Eligible Invoices:</label>
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                {arLedgers
                  .filter(ar => (ar.status === 'OPEN' || ar.status === 'PARTIALLY_SETTLED') && ar.remaining_balance > 0)
                  .map(ar => (
                    <div
                      key={ar.id}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-color)',
                        background: selectedArInvoiceIds.includes(ar.id) ? 'rgba(6, 182, 212, 0.08)' : 'transparent'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={selectedArInvoiceIds.includes(ar.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedArInvoiceIds([...selectedArInvoiceIds, ar.id]);
                            } else {
                              setSelectedArInvoiceIds(selectedArInvoiceIds.filter(id => id !== ar.id));
                            }
                          }}
                        />
                        <div>
                          <span style={{ fontWeight: 600 }}>{ar.invoice_number}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            ({ar.customers?.full_name || ar.dealers?.dealer_name})
                          </span>
                        </div>
                      </label>
                      <span style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>
                        ₹{ar.remaining_balance?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReconcileModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={processingReconcile || selectedArInvoiceIds.length === 0}
                onClick={handleExecuteReconcile}
              >
                {processingReconcile ? 'Matching...' : `Reconcile Selected (${selectedArInvoiceIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Log Bank/UPI Receipt */}
      {showCreateReceiptModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Incoming Bank / UPI Receipt</h3>
              <button className="btn-icon" onClick={() => setShowCreateReceiptModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateReceipt}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Payment Method *</label>
                  <select
                    className="input-field"
                    value={newReceiptMethod}
                    onChange={(e: any) => setNewReceiptMethod(e.target.value)}
                    required
                  >
                    <option value="UPI">UPI</option>
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (INR) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="input-field"
                    value={newReceiptAmount || ''}
                    onChange={(e) => setNewReceiptAmount(Number(e.target.value))}
                    required
                    placeholder="e.g. 50000"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">External Reference (UTR / UPI Ref) *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={newReceiptTxRef}
                    onChange={(e) => setNewReceiptTxRef(e.target.value)}
                    required
                    placeholder="e.g. UTR-HDFC-99182374"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payer Name / Business Account *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={newReceiptPayer}
                    onChange={(e) => setNewReceiptPayer(e.target.value)}
                    required
                    placeholder="e.g. Apex Electronics Mumbai"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={newReceiptNotes}
                    onChange={(e) => setNewReceiptNotes(e.target.value)}
                    placeholder="Optional notes or remittance remarks..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateReceiptModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingReceipt}>
                  {savingReceipt ? 'Logging...' : 'Save Staged Receipt'}
                </button>
              </div>
            </form>
          </div>
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
              <div>
                <h3 className="modal-title">Process Sales Return (RMA)</h3>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  For Sale Order: #{rmaSale.sale_number}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setShowRmaModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleProcessRma}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">TV Unit to Return *</label>
                  <select
                    className="input-field"
                    value={rmaUnitId}
                    onChange={(e) => setRmaUnitId(e.target.value)}
                    required
                  >
                    <option value="">Select TV Unit</option>
                    {rmaSale.sale_items?.map((item: any) => (
                      <option key={item.id} value={item.product_unit_id}>
                        {item.product_units?.product_variants?.product_name || 'ZUVO TV'} - Barcode: {item.product_units?.barcode} (SN: {item.product_units?.serial_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Return Reason *</label>
                  <select
                    className="input-field"
                    value={rmaReason}
                    onChange={(e) => setRmaReason(e.target.value)}
                    required
                  >
                    <option value="Defective display / dead pixels">Defective display / dead pixels</option>
                    <option value="Motherboard / Power supply failure">Motherboard / Power supply failure</option>
                    <option value="Physical cosmetic damage">Physical cosmetic damage</option>
                    <option value="Customer order cancellation / change of mind">Customer order cancellation / change of mind</option>
                    <option value="Incorrect model delivered">Incorrect model delivered</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Physical Inspection Condition *</label>
                    <select
                      className="input-field"
                      value={rmaCondition}
                      onChange={(e) => setRmaCondition(e.target.value)}
                      required
                    >
                      <option value="good_condition">Good Condition</option>
                      <option value="minor_damage">Minor Cosmetic Damage</option>
                      <option value="defective_damaged">Defective / Damaged</option>
                      <option value="scrap">Irreparable Scrap</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inventory Custody Outcome *</label>
                    <select
                      className="input-field"
                      value={rmaOutcome}
                      onChange={(e) => setRmaOutcome(e.target.value)}
                      required
                    >
                      <option value="in_stock">Restock to Warehouse (In Stock)</option>
                      <option value="damaged">Quarantine in Damaged Depot</option>
                      <option value="in_service">Send to Service Workshop</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Refund Amount (INR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field"
                      value={rmaRefundAmount}
                      onChange={(e) => setRmaRefundAmount(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Refund Settlement Tender *</label>
                    <select
                      className="input-field"
                      value={rmaRefundMethod}
                      onChange={(e) => setRmaRefundMethod(e.target.value)}
                      required
                    >
                      <option value="original_payment">Original Payment Tender</option>
                      <option value="store_credit">Customer Store Credit</option>
                      <option value="bank_transfer">Direct Bank Transfer (NEFT/RTGS)</option>
                      <option value="upi">Instant UPI Refund</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">RMA Inspection & Settlement Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Enter technician inspection notes or reason for customer refund..."
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
                  {processingRma ? 'Authorizing Return...' : 'Authorize RMA Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Sale Order Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Commercial Sale Order</h3>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSale}>
              <div className="modal-body">
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Customer *</label>
                    {customers.length === 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)' }}>
                        No customers found (Register under Customers first)
                      </span>
                    )}
                  </div>
                  <select
                    className="input-field"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                  >
                    <option value="">Select a Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone || c.customer_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Dealer / Channel Partner (Optional)</label>
                  <select
                    className="input-field"
                    value={selectedDealerId}
                    onChange={(e) => setSelectedDealerId(e.target.value)}
                  >
                    <option value="">Direct Retail Customer (No Dealer)</option>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.dealer_name} ({d.dealer_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Serialized TV Unit *</label>
                    <span style={{ fontSize: '0.75rem', color: availableUnits.length > 0 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {availableUnits.length} Available in Stock
                    </span>
                  </div>
                  <select
                    className="input-field"
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    required
                  >
                    <option value="">Select an Available TV Unit</option>
                    {availableUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.product_variants?.product_name || 'TV Unit'} - Barcode: {u.barcode} (SN: {u.serial_number}) - Loc: {u.warehouses?.warehouse_name || 'Main Warehouse'}
                      </option>
                    ))}
                  </select>
                  {availableUnits.length === 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginTop: '8px', lineHeight: 1.4 }}>
                      <strong>⚠️ No available units in stock:</strong><br />
                      To sell a television, intake units under <strong>Products & Variants → + Add Unit</strong> first.
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Unit Price (INR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Amount (INR)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="input-field"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="card">Credit/Debit Card</option>
                      <option value="upi">UPI / QR Code</option>
                      <option value="cash">Cash on Delivery</option>
                      <option value="net_banking">Net Banking</option>
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
