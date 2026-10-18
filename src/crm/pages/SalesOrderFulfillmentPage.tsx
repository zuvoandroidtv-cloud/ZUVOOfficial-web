import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart,
  Truck,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Play,
  ShieldCheck,
  TrendingUp,
  Clock,
  Wrench,
  Search,
  Filter,
  DollarSign,
  BarChart2,
  FileText,
  Boxes,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Building,
  User,
  QrCode,
  MapPin,
  Check,
  Printer,
  ChevronRight,
  Eye,
  FileCheck
} from 'lucide-react';
import type {
  SalesOrder,
  SalesOrderItem,
  SalesOrderReservation,
  DeliveryChallan,
  DeliveryChallanItem,
  SalesOrderAuditEvent,
  FulfillmentKPIs,
  SalesOrderStatus,
  DeliveryChallanStatus,
  PaymentTerms
} from '../types/salesOrderFulfillment';

export const SalesOrderFulfillmentPage: React.FC = () => {
  const { currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'cockpit' | 'orders' | 'pick_pack' | 'challans' | 'pod_invoicing'>('cockpit');

  // Loading & Alerts
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Core Data
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);

  // Selected Order for Pick/Pack or Challan
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [selectedChallan, setSelectedChallan] = useState<DeliveryChallan | null>(null);

  // Modals
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isCreateChallanModalOpen, setIsCreateChallanModalOpen] = useState(false);
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [isPrintChallanModalOpen, setIsPrintChallanModalOpen] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Form State: Create Sales Order
  const [newOrderPartyType, setNewOrderPartyType] = useState<'dealer' | 'customer'>('dealer');
  const [newOrderDealerId, setNewOrderDealerId] = useState('');
  const [newOrderCustomerId, setNewOrderCustomerId] = useState('');
  const [newOrderExpectedDate, setNewOrderExpectedDate] = useState('');
  const [newOrderPaymentTerms, setNewOrderPaymentTerms] = useState<PaymentTerms>('NET_30');
  const [newOrderShippingAddress, setNewOrderShippingAddress] = useState('');
  const [newOrderBillingAddress, setNewOrderBillingAddress] = useState('');
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [newOrderItems, setNewOrderItems] = useState<Array<{
    product_variant_id: string;
    quantity_ordered: number;
    unit_price: number;
    discount_amount: number;
    tax_rate_pct: number;
  }>>([{ product_variant_id: '', quantity_ordered: 5, unit_price: 18500, discount_amount: 0, tax_rate_pct: 18 }]);

  // Form State: Allocation & Scanning
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [selectedAllocations, setSelectedAllocations] = useState<{ [itemId: string]: string[] }>({});

  // Form State: Create Delivery Challan
  const [challanTransporterName, setChallanTransporterName] = useState('VRL Logistics Enterprise');
  const [challanVehicleNumber, setChallanVehicleNumber] = useState('MH-04-AZ-8921');
  const [challanLrNumber, setChallanLrNumber] = useState('LR-202610-889');
  const [challanEwayBill, setChallanEwayBill] = useState('EWB-2710-9948-1102');
  const [challanEwayValidHours, setChallanEwayValidHours] = useState('72');
  const [challanDistanceKm, setChallanDistanceKm] = useState('240');

  // Form State: POD Confirmation
  const [podReceiverName, setPodReceiverName] = useState('');
  const [podContactPhone, setPodContactPhone] = useState('');
  const [podSignatureRef, setPodSignatureRef] = useState('');
  const [podNotes, setPodNotes] = useState('');

  // Fetch Master Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Sales Orders
      const { data: soData, error: soErr } = await (supabase.from as any)('sales_orders')
        .select(`
          *,
          dealer:dealer_id ( id, dealer_name, dealer_code, phone, city, state ),
          customer:customer_id ( id, full_name, phone, city, state ),
          items:sales_order_items (
            *,
            product_variant:product_variant_id ( id, variant_name, sku, screen_size_inch, resolution )
          ),
          reservations:sales_order_reservations (
            *,
            product_unit:product_unit_id ( id, barcode, status, purchase_cost )
          )
        `)
        .order('created_at', { ascending: false });

      if (soData) setOrders(soData as unknown as SalesOrder[]);

      // 2. Fetch Delivery Challans
      const { data: dcData, error: dcErr } = await (supabase.from as any)('delivery_challans')
        .select(`
          *,
          sales_order:sales_order_id ( so_number, order_date ),
          dealer:dealer_id ( dealer_name, dealer_code, gst_number ),
          warehouse:from_warehouse_id ( warehouse_name, warehouse_code ),
          items:delivery_challan_items (
            *,
            product_unit:product_unit_id ( barcode, serial_number )
          )
        `)
        .order('created_at', { ascending: false });

      if (dcData) setChallans(dcData as unknown as DeliveryChallan[]);

      // 3. Fetch Dealers & Customers
      const { data: dlrData } = await supabase.from('dealers').select('id, dealer_name, dealer_code, address, state').eq('is_active', true);
      if (dlrData) setDealers(dlrData);

      const { data: custData } = await supabase.from('customers').select('id, full_name, phone, address, state').limit(50);
      if (custData) setCustomers(custData);

      // 4. Fetch Product Variants
      const { data: pvData } = await supabase.from('product_variants').select('id, variant_name, sku, retail_price').order('variant_name');
      if (pvData) setVariants(pvData);

      // 5. Fetch Warehouses
      const { data: whData } = await supabase.from('warehouses').select('id, warehouse_name, warehouse_code').eq('is_active', true);
      if (whData) {
        setWarehouses(whData);
        if (whData.length > 0 && !selectedWarehouseId) {
          setSelectedWarehouseId(whData[0].id);
        }
      }

      // 6. Fetch Available Units
      const { data: puData } = await supabase
        .from('product_units')
        .select('id, barcode, variant_id, warehouse_id, status, purchase_cost')
        .in('status', ['in_stock', 'IN_STOCK', 'available'])
        .limit(100);
      if (puData) setAvailableUnits(puData);

    } catch (err: any) {
      console.error('Failed to fetch sales order data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync selected order object
  useEffect(() => {
    if (selectedOrderId) {
      const match = orders.find(o => o.id === selectedOrderId);
      setSelectedOrder(match || null);
    } else {
      setSelectedOrder(null);
    }
  }, [selectedOrderId, orders]);

  // KPIs
  const kpis: FulfillmentKPIs = {
    openOrdersCount: orders.filter(o => ['DRAFT', 'CONFIRMED'].includes(o.status)).length,
    creditHoldCount: orders.filter(o => o.status === 'CREDIT_HOLD').length,
    pendingPickingCount: orders.filter(o => o.status === 'ALLOCATED').length,
    packedOrdersCount: orders.filter(o => o.status === 'PACKED').length,
    inTransitChallansCount: challans.filter(c => ['DISPATCHED', 'IN_TRANSIT'].includes(c.status)).length,
    deliveredTodayCount: challans.filter(c => c.status === 'DELIVERED').length,
    totalOrderPipelineValue: orders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? Number(o.total_amount) : 0), 0)
  };

  // Handlers
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const payload = {
        dealer_id: newOrderPartyType === 'dealer' ? newOrderDealerId || null : null,
        customer_id: newOrderPartyType === 'customer' ? newOrderCustomerId || null : null,
        expected_delivery_date: newOrderExpectedDate || null,
        payment_terms: newOrderPaymentTerms,
        shipping_address: newOrderShippingAddress,
        billing_address: newOrderBillingAddress || newOrderShippingAddress,
        notes: newOrderNotes || null,
        items: newOrderItems.filter(i => i.product_variant_id && i.quantity_ordered > 0)
      };

      const { data, error } = await (supabase.rpc as any)('fn_create_b2b_sales_order', {
        p_order_data: payload
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to create sales order');
      }

      setSuccessMsg(`Sales Order ${data.so_number} created successfully in DRAFT status!`);
      setIsCreateOrderModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating sales order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await (supabase.rpc as any)('fn_confirm_sales_order', {
        p_sales_order_id: orderId
      });

      if (error) throw error;

      if (!data?.success) {
        if (data?.credit_hold) {
          setErrorMsg(`CREDIT HOLD ENFORCED: ${data.reason}. Current Exposure: ₹${data.current_exposure.toLocaleString()}, Limit: ₹${data.credit_limit.toLocaleString()}`);
        } else {
          setErrorMsg(data?.error || 'Confirmation blocked');
        }
      } else {
        setSuccessMsg(`Sales Order confirmed successfully! Ready for inventory allocation.`);
      }

      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to confirm order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllocateOrder = async () => {
    if (!selectedOrder) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const allocationsPayload = Object.entries(selectedAllocations).map(([itemId, unitIds]) => ({
        sales_order_item_id: itemId,
        warehouse_id: selectedWarehouseId,
        product_unit_ids: unitIds
      })).filter(a => a.product_unit_ids.length > 0);

      if (allocationsPayload.length === 0) {
        throw new Error('Please select or scan serialized units to allocate for this order.');
      }

      const { data, error } = await (supabase.rpc as any)('fn_allocate_and_pick_sales_order', {
        p_sales_order_id: selectedOrder.id,
        p_allocations: allocationsPayload,
        p_action: 'ALLOCATE'
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Allocation failed');
      }

      setSuccessMsg(`Successfully allocated ${data.units_allocated} serialized units! Order status: ALLOCATED.`);
      setSelectedAllocations({});
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Allocation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickOrPack = async (action: 'PICK' | 'PACK') => {
    if (!selectedOrder) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await (supabase.rpc as any)('fn_allocate_and_pick_sales_order', {
        p_sales_order_id: selectedOrder.id,
        p_allocations: [],
        p_action: action
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || `Failed to ${action} order`);
      }

      setSuccessMsg(`Warehouse ${action} operation completed successfully!`);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to ${action} order`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDeliveryChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const validUntil = new Date(Date.now() + parseInt(challanEwayValidHours) * 3600 * 1000).toISOString();

      const payload = {
        sales_order_id: selectedOrder.id,
        warehouse_id: selectedWarehouseId,
        transporter_name: challanTransporterName,
        vehicle_number: challanVehicleNumber,
        lr_number: challanLrNumber,
        eway_bill_number: challanEwayBill,
        eway_bill_valid_until: validUntil,
        distance_km: parseFloat(challanDistanceKm) || 100
      };

      const { data, error } = await (supabase.rpc as any)('fn_generate_delivery_challan', {
        p_challan_data: payload
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to generate delivery challan');
      }

      setSuccessMsg(`Delivery Challan ${data.challan_number} generated for ${data.total_quantity} units (₹${data.total_challan_value.toLocaleString()})!`);
      setIsCreateChallanModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Challan creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchChallan = async (challanId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await (supabase.rpc as any)('fn_dispatch_delivery_challan', {
        p_delivery_challan_id: challanId
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Dispatch failed');
      }

      setSuccessMsg(`Consignment dispatched! Challan status is now IN_TRANSIT with active E-Way Bill.`);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Dispatch failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDeliveryAndInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallan) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const podPayload = {
        receiver_name: podReceiverName,
        contact_phone: podContactPhone,
        signature_ref: podSignatureRef || 'ELECTRONIC_STAMP_OK',
        notes: podNotes,
        delivery_timestamp: new Date().toISOString()
      };

      const { data, error } = await (supabase.rpc as any)('fn_confirm_challan_delivery_and_invoice', {
        p_delivery_challan_id: selectedChallan.id,
        p_pod_data: podPayload
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Delivery confirmation failed');
      }

      setSuccessMsg(`Consignment marked DELIVERED! Commercial Tax Invoice ${data.invoice_number || 'generated'} and COGS recognized (₹${data.cogs_recognized || 'posted'}).`);
      setIsPodModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Delivery confirmation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for manual / scanner barcode add
  const handleAddBarcodeScan = (itemId: string, unitId: string) => {
    setSelectedAllocations(prev => {
      const current = prev[itemId] || [];
      if (current.includes(unitId)) return prev;
      return { ...prev, [itemId]: [...current, unitId] };
    });
  };

  const handleRemoveBarcodeScan = (itemId: string, unitId: string) => {
    setSelectedAllocations(prev => {
      const current = prev[itemId] || [];
      return { ...prev, [itemId]: current.filter(id => id !== unitId) };
    });
  };

  return (
    <div className="crm-module-container" style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShoppingCart style={{ color: 'var(--brand-primary)' }} size={28} />
            B2B Sales Order & Fulfillment Governance
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Enterprise multi-line order processing, serialized pick-pack-ship lifecycle, statutory delivery challans & E-Way Bill integration.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => setIsCreateOrderModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> Create B2B Sales Order
          </button>
          <button
            className="btn btn-secondary"
            onClick={fetchData}
            title="Refresh Data"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#dc2626', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '0.85rem 1rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', borderRadius: '8px', color: '#16a34a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Module Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {[
          { id: 'cockpit', label: 'Fulfillment Cockpit', icon: BarChart2 },
          { id: 'orders', label: 'Sales Orders', icon: ShoppingCart },
          { id: 'pick_pack', label: 'Pick & Pack', icon: Package },
          { id: 'challans', label: 'Delivery Challans & E-Way Bills', icon: Truck },
          { id: 'pod_invoicing', label: 'POD & Commercial Invoicing', icon: FileCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid var(--brand-primary)' : '2px solid transparent',
                color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: COCKPIT */}
      {activeTab === 'cockpit' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="crm-card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>OPEN B2B ORDERS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-primary)' }}>{kpis.openOrdersCount}</div>
            </div>
            <div className="crm-card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>CREDIT HOLD ORDERS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#ef4444' }}>{kpis.creditHoldCount}</div>
            </div>
            <div className="crm-card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <div style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>PENDING PICKING</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#f59e0b' }}>{kpis.pendingPickingCount}</div>
            </div>
            <div className="crm-card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <div style={{ color: 'var(--brand-primary)', fontSize: '0.85rem', fontWeight: 600 }}>PACKED & READY</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--brand-primary)' }}>{kpis.packedOrdersCount}</div>
            </div>
            <div className="crm-card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <div style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600 }}>IN-TRANSIT CHALLANS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#3b82f6' }}>{kpis.inTransitChallansCount}</div>
            </div>
            <div className="crm-card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <div style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>DELIVERED CONSIGNMENTS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#10b981' }}>{kpis.deliveredTodayCount}</div>
            </div>
          </div>

          {/* Quick Action Queue */}
          <div className="crm-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Orders Requiring Action</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem' }}>SO Number</th>
                    <th style={{ padding: '0.75rem' }}>Party (Dealer / Customer)</th>
                    <th style={{ padding: '0.75rem' }}>Total Amount</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 8).map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{order.so_number}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {order.dealer ? `${order.dealer.dealer_name} (${order.dealer.dealer_code})` : order.customer?.full_name}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{Number(order.total_amount).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: order.status === 'CREDIT_HOLD' ? 'rgba(239, 68, 68, 0.15)' :
                                      order.status === 'CONFIRMED' ? 'rgba(59, 130, 246, 0.15)' :
                                      order.status === 'DELIVERED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                          color: order.status === 'CREDIT_HOLD' ? '#ef4444' :
                                 order.status === 'CONFIRMED' ? '#3b82f6' :
                                 order.status === 'DELIVERED' ? '#10b981' : 'var(--text-secondary)'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {order.status === 'DRAFT' && (
                          <button className="btn btn-sm btn-primary" onClick={() => handleConfirmOrder(order.id)}>
                            Confirm Order
                          </button>
                        )}
                        {order.status === 'CREDIT_HOLD' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleConfirmOrder(order.id)} title="Re-evaluate dealer exposure">
                            Retry Credit Check
                          </button>
                        )}
                        {['CONFIRMED', 'ALLOCATED', 'PICKED'].includes(order.status) && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setActiveTab('pick_pack');
                            }}
                          >
                            Process Pick/Pack
                          </button>
                        )}
                        {order.status === 'PACKED' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setIsCreateChallanModalOpen(true);
                            }}
                          >
                            Create DC / E-Way Bill
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No B2B sales orders in the system. Click "Create B2B Sales Order" to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES ORDERS */}
      {activeTab === 'orders' && (
        <div className="crm-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>All B2B Sales Orders</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Search size={16} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search by SO #, Dealer, Customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>SO Number</th>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem' }}>Dealer / Customer</th>
                  <th style={{ padding: '0.75rem' }}>Payment Terms</th>
                  <th style={{ padding: '0.75rem' }}>Subtotal</th>
                  <th style={{ padding: '0.75rem' }}>GST Tax</th>
                  <th style={{ padding: '0.75rem' }}>Total Amount</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter(o => !searchTerm || o.so_number.toLowerCase().includes(searchTerm.toLowerCase()) || o.dealer?.dealer_name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{order.so_number}</td>
                      <td style={{ padding: '0.75rem' }}>{order.order_date}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {order.dealer ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{order.dealer.dealer_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Code: {order.dealer.dealer_code}</div>
                          </div>
                        ) : (
                          <div>{order.customer?.full_name}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{order.payment_terms}</td>
                      <td style={{ padding: '0.75rem' }}>₹{Number(order.subtotal).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem' }}>₹{Number(order.tax_amount).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{Number(order.total_amount).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: order.status === 'CREDIT_HOLD' ? 'rgba(239, 68, 68, 0.15)' :
                                      order.status === 'CONFIRMED' ? 'rgba(59, 130, 246, 0.15)' :
                                      order.status === 'DELIVERED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                          color: order.status === 'CREDIT_HOLD' ? '#ef4444' :
                                 order.status === 'CONFIRMED' ? '#3b82f6' :
                                 order.status === 'DELIVERED' ? '#10b981' : 'var(--text-secondary)'
                        }}>
                          {order.status}
                        </span>
                        {order.credit_hold_reason && (
                          <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.2rem', maxWidth: '180px' }}>
                            {order.credit_hold_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {order.status === 'DRAFT' && (
                            <button className="btn btn-sm btn-primary" onClick={() => handleConfirmOrder(order.id)}>
                              Confirm
                            </button>
                          )}
                          {order.status === 'CREDIT_HOLD' && (
                            <button className="btn btn-sm btn-secondary" onClick={() => handleConfirmOrder(order.id)}>
                              Retry Check
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setActiveTab('pick_pack');
                            }}
                          >
                            Details / Pick
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PICK & PACK WORKBENCH */}
      {activeTab === 'pick_pack' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Left: Order Selection & Warehouse */}
          <div className="crm-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Select Order & Warehouse</h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Sales Order</label>
              <select
                value={selectedOrderId}
                onChange={e => setSelectedOrderId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">-- Choose Sales Order --</option>
                {orders.filter(o => o.status !== 'CANCELLED').map(o => (
                  <option key={o.id} value={o.id}>
                    {o.so_number} - {o.dealer?.dealer_name || o.customer?.full_name} ({o.status})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Source Warehouse</label>
              <select
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_code})</option>
                ))}
              </select>
            </div>

            {selectedOrder && (
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', marginTop: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selectedOrder.so_number}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Status: <strong>{selectedOrder.status}</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Delivery Address: {selectedOrder.shipping_address}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                  {selectedOrder.status === 'ALLOCATED' && (
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handlePickOrPack('PICK')}>
                      Confirm Pick
                    </button>
                  )}
                  {selectedOrder.status === 'PICKED' && (
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handlePickOrPack('PACK')}>
                      Confirm Pack
                    </button>
                  )}
                  {selectedOrder.status === 'PACKED' && (
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setIsCreateChallanModalOpen(true)}>
                      Generate Delivery Challan
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Line Items & Unit Allocation */}
          <div className="crm-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Order Line Items & Unit Allocation</h3>

            {selectedOrder ? (
              <div>
                {selectedOrder.items?.map(item => {
                  const currentlyAllocated = selectedAllocations[item.id] || [];
                  const existingReservations = selectedOrder.reservations?.filter(r => r.sales_order_item_id === item.id) || [];
                  const remainingNeeded = item.quantity_ordered - existingReservations.length - currentlyAllocated.length;

                  return (
                    <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.product_variant?.variant_name || 'TV Unit'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SKU: {item.product_variant?.sku} | Unit Price: ₹{Number(item.unit_price).toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                            Ordered: {item.quantity_ordered} | Allocated: {existingReservations.length}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: remainingNeeded > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                            {remainingNeeded > 0 ? `Needs ${remainingNeeded} more units` : 'Fully Allocated'}
                          </div>
                        </div>
                      </div>

                      {/* Hard-reserved units already in DB */}
                      {existingReservations.length > 0 && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                            Reserved Serialized Units:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {existingReservations.map(res => (
                              <span key={res.id} style={{ padding: '0.25rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#2563eb' }}>
                                {res.product_unit?.barcode} ({res.reservation_status})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Staged Unit Scans before committing allocation */}
                      {currentlyAllocated.length > 0 && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.4rem' }}>
                            Staged for Allocation (Pending Save):
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {currentlyAllocated.map(unitId => {
                              const u = availableUnits.find(unit => unit.id === unitId);
                              return (
                                <span key={unitId} style={{ padding: '0.25rem 0.5rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  {u?.barcode || unitId}
                                  <button onClick={() => handleRemoveBarcodeScan(item.id, unitId)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}>×</button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Manual Picker / Barcode Matcher */}
                      {['CONFIRMED', 'ALLOCATED'].includes(selectedOrder.status) && remainingNeeded > 0 && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                handleAddBarcodeScan(item.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                          >
                            <option value="">-- Quick Pick Available Unit from Stock --</option>
                            {availableUnits
                              .filter(u => u.variant_id === item.product_variant_id && !currentlyAllocated.includes(u.id))
                              .map(u => (
                                <option key={u.id} value={u.id}>{u.barcode} (Cost: ₹{u.purchase_cost})</option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Allocation Action Button */}
                {['CONFIRMED', 'ALLOCATED'].includes(selectedOrder.status) && (
                  <button
                    className="btn btn-primary"
                    onClick={handleAllocateOrder}
                    style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Check size={16} /> Save Serialized Inventory Allocations
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Please select a sales order on the left to inspect lines and allocate serialized units.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DELIVERY CHALLANS & E-WAY BILLS */}
      {activeTab === 'challans' && (
        <div className="crm-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Statutory Delivery Challans (Form GST DRC-01 / Rule 55)</h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>DC Number</th>
                  <th style={{ padding: '0.75rem' }}>Sales Order</th>
                  <th style={{ padding: '0.75rem' }}>Consignee (Dealer)</th>
                  <th style={{ padding: '0.75rem' }}>Transporter / Vehicle</th>
                  <th style={{ padding: '0.75rem' }}>E-Way Bill #</th>
                  <th style={{ padding: '0.75rem' }}>Validity</th>
                  <th style={{ padding: '0.75rem' }}>Total Value</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challans.map(dc => (
                  <tr key={dc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{dc.challan_number}</td>
                    <td style={{ padding: '0.75rem' }}>{dc.sales_order?.so_number}</td>
                    <td style={{ padding: '0.75rem' }}>{dc.dealer?.dealer_name || 'Direct Customer'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 600 }}>{dc.transporter_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{dc.vehicle_number}</div>
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{dc.eway_bill_number}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.8rem' }}>{new Date(dc.eway_bill_valid_until).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{Number(dc.total_challan_value).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: dc.status === 'DELIVERED' ? 'rgba(16, 185, 129, 0.15)' :
                                    dc.status === 'IN_TRANSIT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: dc.status === 'DELIVERED' ? '#10b981' :
                               dc.status === 'IN_TRANSIT' ? '#3b82f6' : '#f59e0b'
                      }}>
                        {dc.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {dc.status === 'GENERATED' && (
                          <button className="btn btn-sm btn-primary" onClick={() => handleDispatchChallan(dc.id)}>
                            Dispatch
                          </button>
                        )}
                        {['IN_TRANSIT', 'DISPATCHED'].includes(dc.status) && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setSelectedChallan(dc);
                              setIsPodModalOpen(true);
                            }}
                          >
                            Confirm POD
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setSelectedChallan(dc);
                            setIsPrintChallanModalOpen(true);
                          }}
                        >
                          <Printer size={14} /> View / Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {challans.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No delivery challans generated yet. Pack a confirmed sales order to generate a challan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: POD & COMMERCIAL INVOICING */}
      {activeTab === 'pod_invoicing' && (
        <div className="crm-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Proof of Delivery (POD) & Commercial Invoice Recognition</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Authoritative confirmation of consignment delivery. Generates the canonical GST commercial tax invoice (Phase 8.2), records the AR ledger debit, and recognizes COGS inventory relief (Phase 8.6).
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Challan #</th>
                  <th style={{ padding: '0.75rem' }}>Receiver Name</th>
                  <th style={{ padding: '0.75rem' }}>Delivery Timestamp</th>
                  <th style={{ padding: '0.75rem' }}>Commercial Tax Invoice</th>
                  <th style={{ padding: '0.75rem' }}>COGS Journal Entry</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {challans.filter(c => c.status === 'DELIVERED').map(dc => (
                  <tr key={dc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{dc.challan_number}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 600 }}>{dc.pod_receiver_name || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{dc.pod_contact_phone}</div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{dc.delivered_at ? new Date(dc.delivered_at).toLocaleString() : 'N/A'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{dc.commercial_tax_invoice_id ? 'INV-POSTED' : 'PENDING'}</span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>{dc.journal_entry_id ? 'JV-COGS-RECOGNIZED' : 'PENDING'}</span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                        DELIVERED
                      </span>
                    </td>
                  </tr>
                ))}
                {challans.filter(c => c.status === 'DELIVERED').length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No delivered consignments recorded yet. Dispatch a challan and complete POD confirmation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE B2B SALES ORDER */}
      {isCreateOrderModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 800 }}>Create New B2B Sales Order</h3>

            <form onSubmit={handleCreateOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Customer / Dealer Type</label>
                  <select
                    value={newOrderPartyType}
                    onChange={e => setNewOrderPartyType(e.target.value as any)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="dealer">Authorized Dealer (B2B)</option>
                    <option value="customer">Direct Commercial Customer</option>
                  </select>
                </div>

                {newOrderPartyType === 'dealer' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Select Dealer</label>
                    <select
                      value={newOrderDealerId}
                      onChange={e => {
                        setNewOrderDealerId(e.target.value);
                        const match = dealers.find(d => d.id === e.target.value);
                        if (match) setNewOrderShippingAddress(match.address || `${match.dealer_name}, ${match.state || 'Maharashtra'}`);
                      }}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Choose Dealer --</option>
                      {dealers.map(d => (
                        <option key={d.id} value={d.id}>{d.dealer_name} ({d.dealer_code})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Select Customer</label>
                    <select
                      value={newOrderCustomerId}
                      onChange={e => {
                        setNewOrderCustomerId(e.target.value);
                        const match = customers.find(c => c.id === e.target.value);
                        if (match) setNewOrderShippingAddress(match.address || `${match.full_name}, ${match.state || 'Maharashtra'}`);
                      }}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Payment Terms</label>
                  <select
                    value={newOrderPaymentTerms}
                    onChange={e => setNewOrderPaymentTerms(e.target.value as any)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_45">Net 45 Days</option>
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="ADVANCE">100% Advance</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Expected Delivery Date</label>
                  <input
                    type="date"
                    value={newOrderExpectedDate}
                    onChange={e => setNewOrderExpectedDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Shipping Address</label>
                <textarea
                  rows={2}
                  required
                  value={newOrderShippingAddress}
                  onChange={e => setNewOrderShippingAddress(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Order Line Items */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Order Items</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setNewOrderItems([...newOrderItems, { product_variant_id: '', quantity_ordered: 1, unit_price: 18500, discount_amount: 0, tax_rate_pct: 18 }])}
                  >
                    + Add Product Line
                  </button>
                </div>

                {newOrderItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 0.5fr', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <select
                      value={item.product_variant_id}
                      onChange={e => {
                        const val = e.target.value;
                        const match = variants.find(v => v.id === val);
                        const updated = [...newOrderItems];
                        updated[idx].product_variant_id = val;
                        if (match) updated[idx].unit_price = match.retail_price || 18500;
                        setNewOrderItems(updated);
                      }}
                      required
                      style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Product Variant --</option>
                      {variants.map(v => (
                        <option key={v.id} value={v.id}>{v.variant_name} ({v.sku})</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity_ordered}
                      onChange={e => {
                        const updated = [...newOrderItems];
                        updated[idx].quantity_ordered = parseInt(e.target.value) || 1;
                        setNewOrderItems(updated);
                      }}
                      style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />

                    <input
                      type="number"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={e => {
                        const updated = [...newOrderItems];
                        updated[idx].unit_price = parseFloat(e.target.value) || 0;
                        setNewOrderItems(updated);
                      }}
                      style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />

                    {newOrderItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewOrderItems(newOrderItems.filter((_, i) => i !== idx))}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOrderModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Sales Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE DELIVERY CHALLAN */}
      {isCreateChallanModalOpen && selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 800 }}>
              Generate Statutory Delivery Challan & E-Way Bill
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Order: <strong>{selectedOrder.so_number}</strong> | Consignee: {selectedOrder.dealer?.dealer_name || selectedOrder.customer?.full_name}
            </p>

            <form onSubmit={handleCreateDeliveryChallan}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Transporter Name</label>
                  <input
                    type="text"
                    required
                    value={challanTransporterName}
                    onChange={e => setChallanTransporterName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Vehicle Registration #</label>
                  <input
                    type="text"
                    required
                    value={challanVehicleNumber}
                    onChange={e => setChallanVehicleNumber(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>LR / Bilty Number</label>
                  <input
                    type="text"
                    value={challanLrNumber}
                    onChange={e => setChallanLrNumber(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Distance (KM)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={challanDistanceKm}
                    onChange={e => setChallanDistanceKm(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>E-Way Bill Number</label>
                  <input
                    type="text"
                    required
                    value={challanEwayBill}
                    onChange={e => setChallanEwayBill(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Validity (Hours)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={challanEwayValidHours}
                    onChange={e => setChallanEwayValidHours(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateChallanModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Generating...' : 'Issue Delivery Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM POD */}
      {isPodModalOpen && selectedChallan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '550px', width: '100%', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 800 }}>Confirm Proof of Delivery (POD)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Confirm delivery for Challan: <strong>{selectedChallan.challan_number}</strong>. This triggers commercial invoicing and inventory relief.
            </p>

            <form onSubmit={handleConfirmDeliveryAndInvoice}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Receiver Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh K. (Store Manager)"
                  value={podReceiverName}
                  onChange={e => setPodReceiverName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Receiver Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91 98200 12345"
                  value={podContactPhone}
                  onChange={e => setPodContactPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Remarks / Receiving Stamp</label>
                <textarea
                  rows={2}
                  placeholder="Goods received in sealed condition. Box seal verified."
                  value={podNotes}
                  onChange={e => setPodNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPodModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Confirm Delivery & Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE CHALLAN */}
      {isPrintChallanModalOpen && selectedChallan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#ffffff', color: '#111827', borderRadius: '12px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', fontFamily: 'monospace' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>ZUVO TELEVISION INDIA PRIVATE LIMITED</h2>
              <div style={{ fontSize: '0.85rem' }}>GSTIN: 27AAACZ8901D1Z5 | Central Hub, Pune, Maharashtra</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: '0.5rem', textDecoration: 'underline' }}>
                DELIVERY CHALLAN (RULE 55 - CGST RULES, 2017)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <div><strong>DC Number:</strong> {selectedChallan.challan_number}</div>
                <div><strong>Date:</strong> {new Date(selectedChallan.created_at).toLocaleDateString()}</div>
                <div><strong>Sales Order:</strong> {selectedChallan.sales_order?.so_number}</div>
                <div><strong>Transporter:</strong> {selectedChallan.transporter_name}</div>
                <div><strong>Vehicle Number:</strong> {selectedChallan.vehicle_number}</div>
              </div>
              <div>
                <div><strong>Consignee:</strong> {selectedChallan.dealer?.dealer_name || 'Commercial Customer'}</div>
                <div><strong>Dealer Code:</strong> {selectedChallan.dealer?.dealer_code || 'N/A'}</div>
                <div><strong>Consignee GSTIN:</strong> {selectedChallan.dealer?.gst_number || 'URP'}</div>
                <div><strong>E-Way Bill:</strong> {selectedChallan.eway_bill_number}</div>
                <div><strong>Validity:</strong> {new Date(selectedChallan.eway_bill_valid_until).toLocaleString()}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #111827', fontSize: '0.8rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #111827' }}>
                  <th style={{ padding: '0.4rem', borderRight: '1px solid #111827' }}>S.No</th>
                  <th style={{ padding: '0.4rem', borderRight: '1px solid #111827' }}>Barcode / Serial #</th>
                  <th style={{ padding: '0.4rem', borderRight: '1px solid #111827' }}>HSN</th>
                  <th style={{ padding: '0.4rem', borderRight: '1px solid #111827' }}>Taxable Value</th>
                  <th style={{ padding: '0.4rem' }}>GST (18%)</th>
                </tr>
              </thead>
              <tbody>
                {selectedChallan.items?.map((it, idx) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.4rem', textAlign: 'center', borderRight: '1px solid #111827' }}>{idx + 1}</td>
                    <td style={{ padding: '0.4rem', borderRight: '1px solid #111827' }}>{it.product_unit?.barcode || 'ZUVO-TV-UNIT'}</td>
                    <td style={{ padding: '0.4rem', textAlign: 'center', borderRight: '1px solid #111827' }}>8528</td>
                    <td style={{ padding: '0.4rem', textAlign: 'right', borderRight: '1px solid #111827' }}>₹{Number(it.taxable_value).toLocaleString()}</td>
                    <td style={{ padding: '0.4rem', textAlign: 'right' }}>₹{Number(it.tax_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px dashed #9ca3af', fontSize: '0.8rem' }}>
              <div>
                <div>________________________</div>
                <div>Driver / Transporter Signature</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>________________________</div>
                <div>For ZUVO Television (Auth Signatory)</div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsPrintChallanModalOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                Print Challan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
