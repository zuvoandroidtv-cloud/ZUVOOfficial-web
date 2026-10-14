import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Truck,
  Plus,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Building2,
  Calendar,
  X,
  Package,
  Layers,
  ArrowRight,
  Send,
  Ban,
  Download,
  RefreshCw,
  QrCode,
  ShieldAlert,
  ChevronRight,
  Filter
} from 'lucide-react';
import { exportToCSV } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';

type ProcurementTab = 'purchase_orders' | 'goods_receipts' | 'vendors' | 'vendor_returns' | 'reports';

interface LineItemInput {
  product_variant_id: string;
  ordered_quantity: number;
  unit_cost: number;
  tax_rate: number;
  notes: string;
}

export const ProcurementPage: React.FC = () => {
  const { role, isAllowed } = useAuth();
  const [activeTab, setActiveTab] = useState<ProcurementTab>('purchase_orders');

  // Shared Reference Data
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [inStockUnits, setInStockUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Purchase Orders State
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poFilterStatus, setPoFilterStatus] = useState<string>('all');
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [poDetailsLoading, setPoDetailsLoading] = useState(false);
  const [poItems, setPoItems] = useState<any[]>([]);

  // Create PO Modal State
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [poVendorId, setPoVendorId] = useState('');
  const [poWarehouseId, setPoWarehouseId] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poLines, setPoLines] = useState<LineItemInput[]>([
    { product_variant_id: '', ordered_quantity: 1, unit_cost: 15000, tax_rate: 18, notes: '' }
  ]);
  const [savingPo, setSavingPo] = useState(false);

  // Goods Receipt Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivePo, setReceivePo] = useState<any | null>(null);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [vendorInvoiceRef, setVendorInvoiceRef] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receivingItems, setReceivingItems] = useState<{
    po_item_id: string;
    variant_name: string;
    ordered: number;
    already_received: number;
    accepted_quantity: number;
    rejected_quantity: number;
    rejection_reason: string;
    serial_number: string;
    barcode: string;
  }[]>([]);
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Goods Receipts List State
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');

  // Vendor Management State
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  const [vendorCode, setVendorCode] = useState('');
  const [vendorLegalName, setVendorLegalName] = useState('');
  const [vendorDisplayName, setVendorDisplayName] = useState('');
  const [vendorType, setVendorType] = useState('manufacturer');
  const [vendorContactPerson, setVendorContactPerson] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorCity, setVendorCity] = useState('');
  const [vendorState, setVendorState] = useState('');
  const [vendorPincode, setVendorPincode] = useState('');
  const [vendorPaymentTerms, setVendorPaymentTerms] = useState('NET_30');
  const [vendorNotes, setVendorNotes] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);

  // Vendor Returns State
  const [vendorReturns, setVendorReturns] = useState<any[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnVendorId, setReturnVendorId] = useState('');
  const [returnUnitId, setReturnUnitId] = useState('');
  const [returnReason, setReturnReason] = useState('Screen damage during quality check');
  const [returnNotes, setReturnNotes] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);

  // Reports & Analytics State
  const [purchaseSummary, setPurchaseSummary] = useState<any[]>([]);
  const [receivingPerf, setReceivingPerf] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);

  // Feedback Notification
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Primary Reference Data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setLoading(true);
        const [vendRes, whRes, varRes, unitsRes] = await Promise.all([
          supabase.from('vendors').select('*').order('legal_name', { ascending: true }),
          supabase.from('warehouses').select('*').eq('is_active', true).order('warehouse_name', { ascending: true }),
          supabase.from('product_variants').select('id, product_name, product_code, base_price').order('product_name', { ascending: true }),
          supabase.from('product_units').select('id, serial_number, barcode, status, purchase_cost').eq('status', 'in_stock').limit(100)
        ]);

        if (vendRes.data) setVendors(vendRes.data);
        if (whRes.data) {
          setWarehouses(whRes.data);
          if (whRes.data.length > 0 && !poWarehouseId) {
            setPoWarehouseId(whRes.data[0].id);
          }
        }
        if (varRes.data) setVariants(varRes.data);
        if (unitsRes.data) setInStockUnits(unitsRes.data);
      } catch (err: any) {
        console.error('Error fetching master procurement references:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMasterData();
  }, [refreshKey]);

  // Load Tab Specific Data
  useEffect(() => {
    const fetchTabData = async () => {
      try {
        if (activeTab === 'purchase_orders') {
          let query = supabase
            .from('purchase_orders')
            .select(`
              *,
              vendors (legal_name, display_name, vendor_code),
              warehouses (warehouse_name)
            `)
            .order('created_at', { ascending: false });

          if (poFilterStatus !== 'all') {
            query = query.eq('status', poFilterStatus);
          }
          const { data, error } = await query;
          if (error) throw error;
          setPurchaseOrders(data || []);
        } else if (activeTab === 'goods_receipts') {
          const { data, error } = await supabase
            .from('purchase_receipts')
            .select(`
              *,
              vendors (legal_name, vendor_code),
              warehouses (warehouse_name),
              purchase_orders (po_number)
            `)
            .order('received_at', { ascending: false });
          if (error) throw error;
          setReceipts(data || []);
        } else if (activeTab === 'vendor_returns') {
          const { data, error } = await supabase
            .from('vendor_returns')
            .select(`
              *,
              vendors (legal_name, vendor_code),
              product_units (serial_number, barcode, status)
            `)
            .order('created_at', { ascending: false });
          if (error) throw error;
          setVendorReturns(data || []);
        } else if (activeTab === 'reports') {
          const [sumRes, perfRes, discRes] = await Promise.all([
            supabase.from('vw_vendor_purchase_summary' as any).select('*'),
            supabase.from('vw_vendor_receiving_performance' as any).select('*'),
            supabase.from('vw_vendor_discrepancy_summary' as any).select('*')
          ]);
          if (sumRes.data) setPurchaseSummary(sumRes.data);
          if (perfRes.data) setReceivingPerf(perfRes.data);
          if (discRes.data) setDiscrepancies(discRes.data);
        }
      } catch (err: any) {
        console.error('Error loading tab procurement data:', err);
      }
    };
    fetchTabData();
  }, [activeTab, poFilterStatus, refreshKey]);

  // View PO Details Drawer/Modal
  const handleViewPoDetails = async (po: any) => {
    setSelectedPo(po);
    setPoDetailsLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          product_variants (product_name, product_code)
        `)
        .eq('purchase_order_id', po.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPoItems(data || []);
    } catch (err: any) {
      console.error('Error loading PO items:', err);
    } finally {
      setPoDetailsLoading(false);
    }
  };

  // 1. CREATE PURCHASE ORDER
  const handleAddLineItem = () => {
    setPoLines([
      ...poLines,
      { product_variant_id: variants[0]?.id || '', ordered_quantity: 1, unit_cost: 15000, tax_rate: 18, notes: '' }
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (poLines.length === 1) return;
    setPoLines(poLines.filter((_, idx) => idx !== index));
  };

  const calculatePoTotals = () => {
    let subtotal = 0;
    let tax = 0;
    poLines.forEach((l) => {
      const lineSub = (Number(l.ordered_quantity) || 0) * (Number(l.unit_cost) || 0);
      const lineTax = (lineSub * (Number(l.tax_rate) || 0)) / 100;
      subtotal += lineSub;
      tax += lineTax;
    });
    return { subtotal, tax, grandTotal: subtotal + tax };
  };

  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poVendorId) {
      alert('Please select a vendor.');
      return;
    }
    if (!poWarehouseId) {
      alert('Please select a destination warehouse.');
      return;
    }
    for (const line of poLines) {
      if (!line.product_variant_id) {
        alert('Please select a product variant for each line item.');
        return;
      }
      if (line.ordered_quantity <= 0) {
        alert('Quantity must be greater than zero.');
        return;
      }
    }

    setSavingPo(true);
    try {
      const itemsPayload = poLines.map((l) => ({
        product_variant_id: l.product_variant_id,
        ordered_quantity: Number(l.ordered_quantity),
        unit_cost: Number(l.unit_cost),
        tax_rate: Number(l.tax_rate),
        notes: l.notes || null
      }));

      const { data, error } = await supabase.rpc('fn_create_purchase_order', {
        p_vendor_id: poVendorId,
        p_warehouse_id: poWarehouseId,
        p_expected_delivery_date: poExpectedDate || null,
        p_notes: poNotes || null,
        p_items: itemsPayload as any
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) {
        throw new Error(res.message);
      }

      setBannerMsg({ type: 'success', text: `Purchase Order ${res.po_number} created successfully!` });
      setShowCreatePoModal(false);
      setPoLines([{ product_variant_id: '', ordered_quantity: 1, unit_cost: 15000, tax_rate: 18, notes: '' }]);
      setPoNotes('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(`Error creating Purchase Order: ${err.message}`);
    } finally {
      setSavingPo(false);
    }
  };

  // 2. SUBMIT PURCHASE ORDER FOR APPROVAL
  const handleSubmitPo = async (poId: string) => {
    if (!window.confirm('Submit this Purchase Order for managerial approval?')) return;
    try {
      const { data, error } = await supabase.rpc('fn_submit_purchase_order', {
        p_po_id: poId,
        p_notes: 'Submitted via CRM Web Portal'
      });
      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.message);

      setBannerMsg({ type: 'success', text: res.message });
      setRefreshKey((k) => k + 1);
      if (selectedPo?.id === poId) {
        setSelectedPo((prev: any) => ({ ...prev, status: 'submitted' }));
      }
    } catch (err: any) {
      alert(`Failed to submit PO: ${err.message}`);
    }
  };

  // 3. APPROVE PURCHASE ORDER (Admin / Super Admin only)
  const handleApprovePo = async (poId: string) => {
    if (!window.confirm('Approve this Purchase Order? Once approved, goods can be received.')) return;
    try {
      const { data, error } = await supabase.rpc('fn_approve_purchase_order', {
        p_po_id: poId,
        p_notes: 'Approved via CRM Web Portal'
      });
      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.message);

      setBannerMsg({ type: 'success', text: res.message });
      setRefreshKey((k) => k + 1);
      if (selectedPo?.id === poId) {
        setSelectedPo((prev: any) => ({ ...prev, status: 'approved' }));
      }
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  // 4. CANCEL PURCHASE ORDER
  const handleCancelPo = async (poId: string) => {
    const reason = window.prompt('Please provide a cancellation reason:');
    if (!reason) return;

    try {
      const { data, error } = await supabase.rpc('fn_cancel_purchase_order', {
        p_po_id: poId,
        p_reason: reason
      });
      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.message);

      setBannerMsg({ type: 'success', text: res.message });
      setRefreshKey((k) => k + 1);
      if (selectedPo?.id === poId) {
        setSelectedPo((prev: any) => ({ ...prev, status: 'cancelled' }));
      }
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    }
  };

  // 5. GOODS RECEIPT MODAL PREPARATION
  const handleOpenReceiveModal = async (po: any) => {
    setReceivePo(po);
    setDeliveryNoteNumber(`DN-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`);
    setVendorInvoiceRef(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setReceiveNotes('');

    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          id,
          ordered_quantity,
          received_quantity,
          product_variants (product_name, product_code)
        `)
        .eq('purchase_order_id', po.id);

      if (error) throw error;

      const items = (data || []).map((item: any) => {
        const remaining = Math.max(0, item.ordered_quantity - item.received_quantity);
        return {
          po_item_id: item.id,
          variant_name: item.product_variants?.product_name || 'TV Unit',
          ordered: item.ordered_quantity,
          already_received: item.received_quantity,
          accepted_quantity: remaining,
          rejected_quantity: 0,
          rejection_reason: '',
          serial_number: '',
          barcode: ''
        };
      });
      setReceivingItems(items);
      setShowReceiveModal(true);
    } catch (err: any) {
      alert(`Could not load PO lines: ${err.message}`);
    }
  };

  // 6. SUBMIT GOODS RECEIPT (fn_receive_purchase_goods)
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryNoteNumber) {
      alert('Please enter Delivery Note Number');
      return;
    }

    const totalAccepted = receivingItems.reduce((acc, i) => acc + (Number(i.accepted_quantity) || 0), 0);
    const totalRejected = receivingItems.reduce((acc, i) => acc + (Number(i.rejected_quantity) || 0), 0);

    if (totalAccepted + totalRejected === 0) {
      alert('Please enter at least 1 unit to accept or reject.');
      return;
    }

    setSavingReceipt(true);
    try {
      const receivedItemsPayload = receivingItems.map((item) => ({
        po_item_id: item.po_item_id,
        accepted_quantity: Number(item.accepted_quantity) || 0,
        rejected_quantity: Number(item.rejected_quantity) || 0,
        rejection_reason: item.rejected_quantity > 0 ? item.rejection_reason || 'Damage or specification defect' : null,
        notes: 'Inward receiving inspection'
      }));

      // Serial/barcode custom map if entered
      const serialsPayload = receivingItems
        .filter((i) => i.accepted_quantity > 0 && i.serial_number)
        .map((i) => ({
          po_item_id: i.po_item_id,
          serial_number: i.serial_number,
          barcode: i.barcode || null
        }));

      const { data, error } = await supabase.rpc('fn_receive_purchase_goods', {
        p_po_id: receivePo.id,
        p_delivery_note_number: deliveryNoteNumber,
        p_vendor_invoice_reference: vendorInvoiceRef,
        p_received_items: receivedItemsPayload as any,
        p_serials_barcodes: serialsPayload.length > 0 ? (serialsPayload as any) : null,
        p_notes: receiveNotes || null
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.message);

      setBannerMsg({
        type: 'success',
        text: `Goods Received! GRN: ${res.receipt_number}. PO updated to status: ${res.po_status}. Inventory units generated.`
      });
      setShowReceiveModal(false);
      setRefreshKey((k) => k + 1);
      if (selectedPo?.id === receivePo.id) {
        handleViewPoDetails(receivePo);
      }
    } catch (err: any) {
      alert(`Goods Receipt Failed: ${err.message}`);
    } finally {
      setSavingReceipt(false);
    }
  };

  // 7. VENDOR MANAGEMENT (Add & Edit)
  const handleOpenVendorModal = (vendor?: any) => {
    if (vendor) {
      setEditingVendor(vendor);
      setVendorCode(vendor.vendor_code);
      setVendorLegalName(vendor.legal_name);
      setVendorDisplayName(vendor.display_name);
      setVendorType(vendor.vendor_type);
      setVendorContactPerson(vendor.contact_person || '');
      setVendorPhone(vendor.phone || '');
      setVendorEmail(vendor.email || '');
      setVendorGstin(vendor.gstin || '');
      setVendorAddress(vendor.address || '');
      setVendorCity(vendor.city || '');
      setVendorState(vendor.state || '');
      setVendorPincode(vendor.pincode || '');
      setVendorPaymentTerms(vendor.payment_terms);
      setVendorNotes(vendor.notes || '');
    } else {
      setEditingVendor(null);
      setVendorCode(`VEND-${Math.floor(100 + Math.random() * 900)}`);
      setVendorLegalName('');
      setVendorDisplayName('');
      setVendorType('manufacturer');
      setVendorContactPerson('');
      setVendorPhone('');
      setVendorEmail('');
      setVendorGstin('');
      setVendorAddress('');
      setVendorCity('');
      setVendorState('');
      setVendorPincode('');
      setVendorPaymentTerms('NET_30');
      setVendorNotes('');
    }
    setShowVendorModal(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorLegalName || !vendorDisplayName) {
      alert('Please fill legal name and display name');
      return;
    }

    setSavingVendor(true);
    try {
      const payload = {
        vendor_code: vendorCode,
        legal_name: vendorLegalName,
        display_name: vendorDisplayName,
        vendor_type: vendorType,
        contact_person: vendorContactPerson || null,
        phone: vendorPhone || null,
        email: vendorEmail || null,
        gstin: vendorGstin || null,
        address: vendorAddress || null,
        city: vendorCity || null,
        state: vendorState || null,
        pincode: vendorPincode || null,
        payment_terms: vendorPaymentTerms,
        notes: vendorNotes || null,
        status: 'active'
      };

      if (editingVendor) {
        const { error } = await supabase.from('vendors').update(payload).eq('id', editingVendor.id);
        if (error) throw error;
        setBannerMsg({ type: 'success', text: `Vendor ${vendorDisplayName} updated.` });
      } else {
        const { error } = await supabase.from('vendors').insert([payload]);
        if (error) throw error;
        setBannerMsg({ type: 'success', text: `Vendor ${vendorDisplayName} registered successfully.` });
      }
      setShowVendorModal(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(`Failed to save vendor: ${err.message}`);
    } finally {
      setSavingVendor(false);
    }
  };

  // 8. INITIATE VENDOR RETURN
  const handleInitiateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnVendorId || !returnUnitId) {
      alert('Please select both a vendor and product unit.');
      return;
    }

    setSavingReturn(true);
    try {
      const { data, error } = await supabase.rpc('fn_create_vendor_return', {
        p_vendor_id: returnVendorId,
        p_product_unit_id: returnUnitId,
        p_return_reason: returnReason,
        p_notes: returnNotes || null
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.message);

      setBannerMsg({ type: 'success', text: `Vendor Return ${res.return_number} initiated successfully.` });
      setShowReturnModal(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(`Vendor Return Failed: ${err.message}`);
    } finally {
      setSavingReturn(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="badge badge-secondary">Draft</span>;
      case 'submitted':
        return <span className="badge badge-warning">Submitted</span>;
      case 'approved':
        return <span className="badge badge-primary">Approved</span>;
      case 'partially_received':
        return <span className="badge badge-info">Partially Received</span>;
      case 'fully_received':
      case 'completed':
        return <span className="badge badge-success">Fully Received</span>;
      case 'cancelled':
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '1.5rem', fontWeight: 800 }}>
            <Truck style={{ color: 'var(--brand-primary)' }} /> Procurement & Vendor Operations
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Manage TV manufacturers, Purchase Orders, Goods Receiving (GRN), Quality Inspections, and Vendor Returns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw size={14} /> Refresh
          </button>
          {isAllowed(['super_admin', 'admin', 'inventory']) && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => handleOpenVendorModal()}>
                <Building2 size={14} /> Add Vendor
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreatePoModal(true)}>
                <Plus size={14} /> Create Purchase Order
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Notification Banner */}
      {bannerMsg && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: bannerMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${bannerMsg.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`,
            color: bannerMsg.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{bannerMsg.text}</span>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setBannerMsg(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <button
          className={`tab-btn ${activeTab === 'purchase_orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchase_orders')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'purchase_orders' ? '2px solid var(--brand-primary)' : 'none',
            color: activeTab === 'purchase_orders' ? 'var(--brand-primary)' : 'var(--text-muted)'
          }}
        >
          <FileText size={16} style={{ display: 'inline', marginRight: '6px' }} /> Purchase Orders ({purchaseOrders.length})
        </button>

        <button
          className={`tab-btn ${activeTab === 'goods_receipts' ? 'active' : ''}`}
          onClick={() => setActiveTab('goods_receipts')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'goods_receipts' ? '2px solid var(--brand-primary)' : 'none',
            color: activeTab === 'goods_receipts' ? 'var(--brand-primary)' : 'var(--text-muted)'
          }}
        >
          <Package size={16} style={{ display: 'inline', marginRight: '6px' }} /> Goods Receipts (GRN)
        </button>

        <button
          className={`tab-btn ${activeTab === 'vendors' ? 'active' : ''}`}
          onClick={() => setActiveTab('vendors')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'vendors' ? '2px solid var(--brand-primary)' : 'none',
            color: activeTab === 'vendors' ? 'var(--brand-primary)' : 'var(--text-muted)'
          }}
        >
          <Building2 size={16} style={{ display: 'inline', marginRight: '6px' }} /> Vendors Directory ({vendors.length})
        </button>

        <button
          className={`tab-btn ${activeTab === 'vendor_returns' ? 'active' : ''}`}
          onClick={() => setActiveTab('vendor_returns')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'vendor_returns' ? '2px solid var(--brand-primary)' : 'none',
            color: activeTab === 'vendor_returns' ? 'var(--brand-primary)' : 'var(--text-muted)'
          }}
        >
          <RotateCcw size={16} style={{ display: 'inline', marginRight: '6px' }} /> Vendor Returns (RMA)
        </button>

        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'reports' ? '2px solid var(--brand-primary)' : 'none',
            color: activeTab === 'reports' ? 'var(--brand-primary)' : 'var(--text-muted)'
          }}
        >
          <BarChart3 size={16} style={{ display: 'inline', marginRight: '6px' }} /> Discrepancies & Analytics
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'purchase_orders' && (
        <div>
          {/* Controls & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '240px' }}>
              <div className="search-input-wrap" style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search PO Number or Vendor..."
                  value={poSearchQuery}
                  onChange={(e) => setPoSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
              </div>

              <select
                className="form-control"
                style={{ width: '160px' }}
                value={poFilterStatus}
                onChange={(e) => setPoFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="partially_received">Partially Received</option>
                <option value="fully_received">Fully Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const rows = purchaseOrders.map((p) => ({
                  po_number: p.po_number,
                  vendor: p.vendors?.display_name || p.vendors?.legal_name,
                  warehouse: p.warehouses?.warehouse_name,
                  po_date: p.po_date,
                  status: p.status,
                  total_amount: p.total_amount
                }));
                exportToCSV(
                  rows,
                  [
                    { key: 'po_number', label: 'PO Number' },
                    { key: 'vendor', label: 'Vendor' },
                    { key: 'warehouse', label: 'Warehouse' },
                    { key: 'po_date', label: 'PO Date' },
                    { key: 'status', label: 'Status' },
                    { key: 'total_amount', label: 'Total Amount (INR)' }
                  ],
                  `zuvo_purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`
                );
              }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* PO List Table */}
          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>PO Number</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Vendor</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Destination Hub</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Total (INR)</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders
                  .filter((p) => {
                    const matchSearch =
                      !poSearchQuery ||
                      p.po_number.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
                      p.vendors?.legal_name?.toLowerCase().includes(poSearchQuery.toLowerCase());
                    return matchSearch;
                  })
                  .map((po) => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {po.po_number}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div>{po.vendors?.display_name || po.vendors?.legal_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{po.vendors?.vendor_code}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>{po.warehouses?.warehouse_name || 'Main Hub'}</td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>{po.po_date}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>{getStatusBadge(po.status)}</td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                        ₹{Number(po.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleViewPoDetails(po)}
                          >
                            Details
                          </button>

                          {po.status === 'draft' && isAllowed(['super_admin', 'admin', 'inventory']) && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleSubmitPo(po.id)}
                            >
                              <Send size={12} /> Submit
                            </button>
                          )}

                          {po.status === 'submitted' && isAllowed(['super_admin', 'admin']) && (
                            <button
                              className="btn btn-success btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleApprovePo(po.id)}
                            >
                              <CheckCircle2 size={12} /> Approve
                            </button>
                          )}

                          {(po.status === 'approved' || po.status === 'partially_received') &&
                            isAllowed(['super_admin', 'admin', 'inventory']) && (
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => handleOpenReceiveModal(po)}
                              >
                                <Package size={12} /> Inward (GRN)
                              </button>
                            )}

                          {['draft', 'submitted', 'approved'].includes(po.status) &&
                            isAllowed(['super_admin', 'admin', 'inventory']) && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--status-danger)' }}
                                onClick={() => handleCancelPo(po.id)}
                              >
                                <Ban size={12} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}

                {purchaseOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No purchase orders recorded yet. Click "Create Purchase Order" above to begin procurement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GOODS RECEIPTS (GRN) */}
      {activeTab === 'goods_receipts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
            <div className="search-input-wrap" style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search GRN, Delivery Note or PO..."
                value={receiptSearchQuery}
                onChange={(e) => setReceiptSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const rows = receipts.map((r) => ({
                  receipt_number: r.receipt_number,
                  po_number: r.purchase_orders?.po_number,
                  vendor: r.vendors?.legal_name,
                  warehouse: r.warehouses?.warehouse_name,
                  delivery_note: r.delivery_note_number,
                  vendor_invoice: r.vendor_invoice_reference,
                  date: r.received_at
                }));
                exportToCSV(
                  rows,
                  [
                    { key: 'receipt_number', label: 'GRN Number' },
                    { key: 'po_number', label: 'PO Number' },
                    { key: 'vendor', label: 'Vendor' },
                    { key: 'warehouse', label: 'Warehouse' },
                    { key: 'delivery_note', label: 'Delivery Note' },
                    { key: 'vendor_invoice', label: 'Invoice Ref' },
                    { key: 'date', label: 'Date Received' }
                  ],
                  `zuvo_grn_receipts_${new Date().toISOString().slice(0, 10)}.csv`
                );
              }}
            >
              <Download size={14} /> Export GRNs
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>GRN Number</th>
                  <th style={{ padding: '0.875rem 1rem' }}>PO Reference</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Vendor</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Warehouse</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Delivery Note / Chalan</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Vendor Invoice Ref</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Received At</th>
                </tr>
              </thead>
              <tbody>
                {receipts
                  .filter((r) => {
                    if (!receiptSearchQuery) return true;
                    const q = receiptSearchQuery.toLowerCase();
                    return (
                      r.receipt_number.toLowerCase().includes(q) ||
                      r.delivery_note_number?.toLowerCase().includes(q) ||
                      r.purchase_orders?.po_number?.toLowerCase().includes(q)
                    );
                  })
                  .map((rec) => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {rec.receipt_number}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace' }}>
                        {rec.purchase_orders?.po_number || '-'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>{rec.vendors?.legal_name}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>{rec.warehouses?.warehouse_name}</td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>{rec.delivery_note_number || '-'}</td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>{rec.vendor_invoice_reference || '-'}</td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                        {new Date(rec.received_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}

                {receipts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No Goods Receipts (GRN) logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VENDORS DIRECTORY */}
      {activeTab === 'vendors' && (
        <div>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Code</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Company / Legal Name</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Contact</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Payment Terms</th>
                  <th style={{ padding: '0.875rem 1rem' }}>GSTIN</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{v.vendor_code}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{v.display_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.legal_name}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textTransform: 'capitalize' }}>{v.vendor_type}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                      <div>{v.contact_person || v.phone || '-'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{v.email}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span className="badge badge-secondary">{v.payment_terms}</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {v.gstin || '-'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span className={`badge ${v.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenVendorModal(v)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}

                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No vendors added yet. Click "Add Vendor" above to register suppliers.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: VENDOR RETURNS */}
      {activeTab === 'vendor_returns' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              Defective or damaged TV units returned back to vendor factories.
            </p>
            {isAllowed(['super_admin', 'admin', 'inventory']) && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowReturnModal(true)}>
                <RotateCcw size={14} /> Initiate Vendor Return
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Return No</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Vendor</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Unit Serial / Barcode</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Requested At</th>
                </tr>
              </thead>
              <tbody>
                {vendorReturns.map((ret) => (
                  <tr key={ret.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{ret.return_number}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>{ret.vendors?.legal_name}</td>
                    <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace' }}>
                      <div>{ret.product_units?.serial_number}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ret.product_units?.barcode}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>{ret.return_reason}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span className="badge badge-warning">{ret.status}</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                      {new Date(ret.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {vendorReturns.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No vendor returns requested.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DISCREPANCIES & REPORTING */}
      {activeTab === 'reports' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Purchase Spend Summary */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={18} style={{ color: 'var(--brand-primary)' }} /> Supplier Purchase Totals
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th>Vendor</th>
                    <th>POs</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseSummary.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td>{s.vendor_name}</td>
                      <td>{s.total_purchase_orders}</td>
                      <td>{s.total_units_ordered}</td>
                      <td>{s.total_units_received}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(s.total_purchase_value).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {purchaseSummary.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                        No purchase summary metrics available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receiving Quality & Rejection Rate */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--status-success)' }} /> Receiving QA & Defect Rate
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th>Vendor</th>
                    <th>Receipts</th>
                    <th>Accepted</th>
                    <th>Rejected</th>
                    <th>Rejection Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {receivingPerf.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td>{p.vendor_name}</td>
                      <td>{p.total_receipts}</td>
                      <td style={{ color: 'var(--status-success)', fontWeight: 600 }}>{p.total_accepted_units}</td>
                      <td style={{ color: p.total_rejected_units > 0 ? 'var(--status-danger)' : 'inherit', fontWeight: 600 }}>
                        {p.total_rejected_units}
                      </td>
                      <td>
                        <span className={`badge ${Number(p.rejection_rate_percentage) > 0 ? 'badge-danger' : 'badge-success'}`}>
                          {p.rejection_rate_percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {receivingPerf.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                        No receiving QA records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shipment Discrepancies Summary */}
          <div className="card" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--status-warning)' }} /> Inward Shipment Discrepancies & Defect Logs
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th>Vendor</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Expected</th>
                    <th>Accepted</th>
                    <th>Rejected</th>
                    <th>Rejection Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancies.map((d, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ fontWeight: 600 }}>{d.vendor_name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{d.product_code}</td>
                      <td>{d.product_name}</td>
                      <td>{d.total_expected}</td>
                      <td style={{ color: 'var(--status-success)', fontWeight: 600 }}>{d.total_accepted}</td>
                      <td style={{ color: 'var(--status-danger)', fontWeight: 600 }}>{d.total_rejected}</td>
                      <td style={{ color: 'var(--status-danger)' }}>{d.rejection_reasons || 'Defect'}</td>
                    </tr>
                  ))}
                  {discrepancies.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No delivery discrepancies or rejected items recorded. All goods receipts match 100%.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE PURCHASE ORDER */}
      {showCreatePoModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Create New Purchase Order</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowCreatePoModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePoSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Vendor / Manufacturer *</label>
                  <select
                    className="form-control"
                    required
                    value={poVendorId}
                    onChange={(e) => setPoVendorId(e.target.value)}
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.display_name} ({v.vendor_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Destination Warehouse Hub *</label>
                  <select
                    className="form-control"
                    required
                    value={poWarehouseId}
                    onChange={(e) => setPoWarehouseId(e.target.value)}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_name} ({w.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Expected Delivery Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>Purchase Order Line Items</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddLineItem}>
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Product Variant</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '100px' }}>Quantity</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '120px' }}>Unit Cost (₹)</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>GST %</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '120px', textAlign: 'right' }}>Line Total (₹)</th>
                        <th style={{ padding: '0.5rem', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {poLines.map((line, idx) => {
                        const lineSub = (Number(line.ordered_quantity) || 0) * (Number(line.unit_cost) || 0);
                        const lineTot = lineSub + (lineSub * (Number(line.tax_rate) || 0)) / 100;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <select
                                className="form-control"
                                required
                                value={line.product_variant_id}
                                onChange={(e) => {
                                  const updated = [...poLines];
                                  updated[idx].product_variant_id = e.target.value;
                                  const selectedV = variants.find((v) => v.id === e.target.value);
                                  if (selectedV?.base_price) {
                                    updated[idx].unit_cost = Number(selectedV.base_price);
                                  }
                                  setPoLines(updated);
                                }}
                              >
                                <option value="">Select TV Variant...</option>
                                {variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.product_name} ({v.product_code})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="number"
                                min="1"
                                className="form-control"
                                value={line.ordered_quantity}
                                onChange={(e) => {
                                  const updated = [...poLines];
                                  updated[idx].ordered_quantity = parseInt(e.target.value) || 1;
                                  setPoLines(updated);
                                }}
                              />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                value={line.unit_cost}
                                onChange={(e) => {
                                  const updated = [...poLines];
                                  updated[idx].unit_cost = parseFloat(e.target.value) || 0;
                                  setPoLines(updated);
                                }}
                              />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="number"
                                min="0"
                                className="form-control"
                                value={line.tax_rate}
                                onChange={(e) => {
                                  const updated = [...poLines];
                                  updated[idx].tax_rate = parseFloat(e.target.value) || 0;
                                  setPoLines(updated);
                                }}
                              />
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                              ₹{lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {poLines.length > 1 && (
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer' }}
                                  onClick={() => handleRemoveLineItem(idx)}
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              {(() => {
                const { subtotal, tax, grandTotal } = calculatePoTotals();
                return (
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Subtotal: ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Estimated Tax (GST): ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
                      Grand Total: ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Purchase Order Notes / Instructions</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Terms, payment milestone, special packaging..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePoModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPo}>
                  {savingPo ? 'Creating PO...' : 'Create Purchase Order (Draft)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GOODS RECEIPT (INWARD) MODAL */}
      {showReceiveModal && receivePo && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Goods Inward Receipt (GRN)</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Receiving shipment against PO: <strong style={{ color: 'var(--text-primary)' }}>{receivePo.po_number}</strong> ({receivePo.vendors?.display_name})
                </p>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowReceiveModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReceipt}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Delivery Chalan / Note # *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={deliveryNoteNumber}
                    onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Vendor Invoice Reference</label>
                  <input
                    type="text"
                    className="form-control"
                    value={vendorInvoiceRef}
                    onChange={(e) => setVendorInvoiceRef(e.target.value)}
                  />
                </div>
              </div>

              {/* Items Inspection & Quantities */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Line Items Inward Inspection</label>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Product Variant</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '80px' }}>Ordered</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>Accepted</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>Rejected</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Rejection Reason (If Damaged)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivingItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 600 }}>{item.variant_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Previously Received: {item.already_received} / {item.ordered}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{item.ordered}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="number"
                              min="0"
                              max={item.ordered - item.already_received}
                              className="form-control"
                              style={{ width: '75px' }}
                              value={item.accepted_quantity}
                              onChange={(e) => {
                                const updated = [...receivingItems];
                                updated[idx].accepted_quantity = parseInt(e.target.value) || 0;
                                setReceivingItems(updated);
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="number"
                              min="0"
                              className="form-control"
                              style={{ width: '75px' }}
                              value={item.rejected_quantity}
                              onChange={(e) => {
                                const updated = [...receivingItems];
                                updated[idx].rejected_quantity = parseInt(e.target.value) || 0;
                                setReceivingItems(updated);
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. Cracked panel glass, dead pixels"
                              disabled={item.rejected_quantity === 0}
                              value={item.rejection_reason}
                              onChange={(e) => {
                                const updated = [...receivingItems];
                                updated[idx].rejection_reason = e.target.value;
                                setReceivingItems(updated);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  <QrCode size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Unique serial numbers & inventory barcodes will be automatically generated and linked to each accepted TV unit in warehouse storage.
                </p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Receipt Inspection Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Gate pass number, transporter details, inspection signatures..."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingReceipt}>
                  {savingReceipt ? 'Receiving Goods...' : 'Confirm Inward Goods Receipt (GRN)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PO DETAILS DRAWER / MODAL */}
      {selectedPo && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, fontFamily: 'monospace' }}>
                  {selectedPo.po_number}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                  {getStatusBadge(selectedPo.status)}
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Created {selectedPo.po_date}</span>
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSelectedPo(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supplier / Vendor</div>
                <div style={{ fontWeight: 600 }}>{selectedPo.vendors?.display_name || selectedPo.vendors?.legal_name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delivery Destination</div>
                <div style={{ fontWeight: 600 }}>{selectedPo.warehouses?.warehouse_name || 'Main Hub'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Cost (INR)</div>
                <div style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>
                  ₹{Number(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Item Breakdown */}
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ordered Line Items</h4>
            {poDetailsLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading items...</div>
            ) : (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto', marginBottom: '1.25rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Item</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Ordered</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Received</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Unit Cost</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div style={{ fontWeight: 600 }}>{item.product_variants?.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.product_variants?.product_code}</div>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{item.ordered_quantity}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: item.received_quantity > 0 ? 'var(--status-success)' : 'inherit' }}>
                          {item.received_quantity}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>₹{Number(item.unit_cost).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          ₹{Number(item.line_total).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedPo(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD / EDIT VENDOR */}
      {showVendorModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {editingVendor ? 'Edit Vendor Supplier' : 'Register New Vendor Supplier'}
              </h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowVendorModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVendor}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Vendor Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={vendorCode}
                    onChange={(e) => setVendorCode(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Vendor Type *</label>
                  <select
                    className="form-control"
                    value={vendorType}
                    onChange={(e) => setVendorType(e.target.value)}
                  >
                    <option value="manufacturer">Manufacturer / OEM</option>
                    <option value="distributor">Regional Distributor</option>
                    <option value="importer">Importer</option>
                    <option value="component_supplier">Component / Panel Supplier</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Legal Company Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Zuvo Electronics Pvt Ltd"
                    value={vendorLegalName}
                    onChange={(e) => setVendorLegalName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Brand / Display Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Zuvo Tech"
                    value={vendorDisplayName}
                    onChange={(e) => setVendorDisplayName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Payment Terms</label>
                  <select
                    className="form-control"
                    value={vendorPaymentTerms}
                    onChange={(e) => setVendorPaymentTerms(e.target.value)}
                  >
                    <option value="IMMEDIATE">Immediate / Cash</option>
                    <option value="ADVANCE">Advance Payment</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                    <option value="CONSIGNMENT">Consignment Basis</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>GSTIN / Tax ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="29AAAAA0000A1Z5"
                    value={vendorGstin}
                    onChange={(e) => setVendorGstin(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Contact Person</label>
                  <input
                    type="text"
                    className="form-control"
                    value={vendorContactPerson}
                    onChange={(e) => setVendorContactPerson(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Phone Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVendorModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingVendor}>
                  {savingVendor ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: INITIATE VENDOR RETURN */}
      {showReturnModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Initiate Vendor Return (RMA)</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowReturnModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInitiateReturn}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Vendor Supplier *</label>
                  <select
                    className="form-control"
                    required
                    value={returnVendorId}
                    onChange={(e) => setReturnVendorId(e.target.value)}
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.display_name} ({v.vendor_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>In-Stock TV Unit to Return *</label>
                  <select
                    className="form-control"
                    required
                    value={returnUnitId}
                    onChange={(e) => setReturnUnitId(e.target.value)}
                  >
                    <option value="">Select In-Stock Unit...</option>
                    {inStockUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.serial_number} | Barcode: {u.barcode} (Cost: ₹{u.purchase_cost})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Return Reason *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Motherboard dead-on-arrival, backlight defect"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Notes / RMA Reference</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingReturn}>
                  {savingReturn ? 'Initiating Return...' : 'Submit Vendor Return Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
