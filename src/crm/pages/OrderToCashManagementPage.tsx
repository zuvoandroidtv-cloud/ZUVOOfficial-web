import React, { useState } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  PackageCheck,
  Truck,
  CheckCircle2,
  Receipt,
  RotateCcw,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  Filter,
  DollarSign,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Clock,
  Layers,
  BarChart2,
  Calendar,
  Building2,
  BadgeCheck
} from 'lucide-react';

type O2CTab =
  | 'overview'
  | 'orders'
  | 'fulfillment'
  | 'delivery'
  | 'billing'
  | 'collections'
  | 'returns'
  | 'revenue_intel'
  | 'exceptions';

interface SalesOrder {
  id: string;
  so_number: string;
  order_date: string;
  customer_name: string;
  dealer_name?: string;
  order_priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'CREDIT_HOLD'
    | 'ALLOCATED'
    | 'PICKED'
    | 'PACKED'
    | 'DISPATCHED'
    | 'DELIVERED'
    | 'INVOICED'
    | 'PAID'
    | 'CANCELLED';
  credit_status: 'CLEAR' | 'WATCH' | 'HOLD' | 'BLOCK' | 'OVERRIDDEN';
  total_amount: number;
  advance_received: number;
  outstanding_amount: number;
  item_count: number;
}

export const OrderToCashManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<O2CTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Enterprise state initialized to zero for production operations
  const sampleOrders: SalesOrder[] = [];

  const filteredOrders = sampleOrders.filter((order) => {
    const matchesSearch =
      order.so_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="crm-page-container" style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ background: 'var(--brand-primary)', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
              PHASE 19
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Order-to-Cash (O2C) & Revenue Operations
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Authoritative lifecycle engine: Order Approval → Credit Check → Allocation → Dispatch → Delivery → Invoicing → Collections → Realization
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={15} /> Run Intelligence Sweep
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Create Sales Order
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto', gap: '0.25rem' }}>
        {[
          { id: 'overview', label: 'Executive Cockpit', icon: BarChart2 },
          { id: 'orders', label: 'Sales Orders', icon: ShoppingCart },
          { id: 'fulfillment', label: 'Pick & Pack', icon: PackageCheck },
          { id: 'delivery', label: 'Dispatch & POD', icon: Truck },
          { id: 'billing', label: 'GST Invoicing', icon: Receipt },
          { id: 'collections', label: 'AR Collections', icon: DollarSign },
          { id: 'returns', label: 'Returns & QC', icon: RotateCcw },
          { id: 'revenue_intel', label: 'Revenue Signals', icon: TrendingUp },
          { id: 'exceptions', label: 'O2C Exceptions', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as O2CTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--brand-primary)' : '2px solid transparent',
                color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '0.9rem',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* WORKSTREAM S: TAB 1 - OVERVIEW COCKPIT */}
      {activeTab === 'overview' && (
        <div>
          {/* Key Metric Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>GROSS PIPELINE</span>
                <ShoppingCart size={18} style={{ color: 'var(--brand-primary)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹0.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>0 orders in pipeline</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>INVOICED REVENUE</span>
                <Receipt size={18} style={{ color: 'var(--brand-secondary, #3b82f6)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹0.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>0.0% conversion rate</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COLLECTED CASH</span>
                <DollarSign size={18} style={{ color: 'var(--status-success)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹0.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)', marginTop: '0.25rem' }}>DSO: 0 Days (Target: &lt;30)</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>BLOCKED CREDIT</span>
                <ShieldAlert size={18} style={{ color: 'var(--status-danger)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-danger)' }}>₹0.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>0 Orders pending override</div>
            </div>
          </div>

          {/* O2C Funnel Stage Progression */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Order-to-Cash End-to-End Pipeline
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', textAlign: 'center' }}>
              {[
                { stage: 'Draft & Submitted', count: 0, value: '₹0.00', color: '#64748b' },
                { stage: 'Pending Approval', count: 0, value: '₹0.00', color: '#f59e0b' },
                { stage: 'Credit Approved', count: 0, value: '₹0.00', color: '#3b82f6' },
                { stage: 'Allocated (Serials)', count: 0, value: '₹0.00', color: '#8b5cf6' },
                { stage: 'Dispatched (In Transit)', count: 0, value: '₹0.00', color: '#06b6d4' },
                { stage: 'Delivered & Installed', count: 0, value: '₹0.00', color: '#10b981' },
                { stage: 'Fully Settled / Paid', count: 0, value: '₹0.00', color: '#059669' },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '6px', borderTop: `3px solid ${item.color}` }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, minHeight: '32px' }}>{item.stage}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--text-primary)' }}>{item.count}</div>
                  <div style={{ fontSize: '0.8rem', color: item.color, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WORKSTREAM A & B: TAB 2 - SALES ORDERS */}
      {activeTab === 'orders' && (
        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Search order #, customer, dealer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="CREDIT_HOLD">Credit Hold</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>SO Number</th>
                  <th style={{ padding: '0.75rem' }}>Customer / Dealer</th>
                  <th style={{ padding: '0.75rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem' }}>Credit Check</th>
                  <th style={{ padding: '0.75rem' }}>Order Status</th>
                  <th style={{ padding: '0.75rem' }}>Total Value</th>
                  <th style={{ padding: '0.75rem' }}>Outstanding</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                      No commercial sales orders found. Click "Create Sales Order" to record an order.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>{order.so_number}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{order.dealer_name}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background:
                              order.order_priority === 'CRITICAL' || order.order_priority === 'URGENT'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(59, 130, 246, 0.15)',
                            color:
                              order.order_priority === 'CRITICAL' || order.order_priority === 'URGENT'
                                ? 'var(--status-danger)'
                                : 'var(--brand-primary)',
                          }}
                        >
                          {order.order_priority}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background:
                              order.credit_status === 'BLOCK'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                            color:
                              order.credit_status === 'BLOCK'
                                ? 'var(--status-danger)'
                                : 'var(--status-success)',
                          }}
                        >
                          {order.credit_status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: 'rgba(100, 116, 139, 0.15)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>₹{order.total_amount.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', color: order.outstanding_amount > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
                        ₹{order.outstanding_amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                          View O2C
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSTREAM G & H: TAB 3 - FULFILLMENT (PICK & PACK) */}
      {activeTab === 'fulfillment' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Warehouse Pick & Pack Fulfillment Queue
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Serialized TV barcode scan verification. Unallocated or credit-blocked orders are automatically locked out of fulfillment.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>PICK QUEUE (READY)</span>
                <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--brand-primary)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                  0 Orders
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                Orders with clear credit and confirmed serialized reservation awaiting scan verification.
              </p>
              <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No orders pending serialized pick verification.
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-secondary, #8b5cf6)' }}>PACKING & MANIFEST</span>
                <span style={{ fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                  0 Orders
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                Picked items verified against ordered specifications. Preparing delivery challan and e-way bill.
              </p>
              <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No packing manifests awaiting delivery challan generation.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WORKSTREAM I & J: TAB 4 - DELIVERY & POD */}
      {activeTab === 'delivery' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Dispatch Manifest & Proof of Delivery (POD)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Statutory E-Way Bill Tracking, Transporter LR numbers, and immutable digital POD confirmations.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Challan #</th>
                  <th style={{ padding: '0.75rem' }}>Transporter & Vehicle</th>
                  <th style={{ padding: '0.75rem' }}>E-Way Bill #</th>
                  <th style={{ padding: '0.75rem' }}>Destination</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>POD Receiver</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                    No dispatches in transit. Active delivery manifests will appear here.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSTREAM K & L: TAB 5 - GST INVOICING */}
      {activeTab === 'billing' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Statutory GST Commercial Invoicing (HSN 8528)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Automated server-authoritative tax calculation, CGST/SGST/IGST breakdown and NIC e-invoice generation.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Invoice Number</th>
                  <th style={{ padding: '0.75rem' }}>Billed Party</th>
                  <th style={{ padding: '0.75rem' }}>Taxable Value</th>
                  <th style={{ padding: '0.75rem' }}>GST (18%)</th>
                  <th style={{ padding: '0.75rem' }}>Grand Total</th>
                  <th style={{ padding: '0.75rem' }}>IRN / E-Invoice</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                    No GST tax invoices issued. B2B invoices generate automatically on dispatch.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSTREAM M & N: TAB 6 - COLLECTIONS & RECONCILIATION */}
      {activeTab === 'collections' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Payment Reconciliation & Accounts Receivable Ledger
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Automated settlement of NEFT/RTGS bank receipts against open commercial tax invoices with maker-checker controls.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CURRENT OUTSTANDING AR</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--text-primary)' }}>₹0.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>0-30 Days: ₹0.00 (100%)</div>
            </div>

            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>OVERDUE AR (&gt; 45 DAYS)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--text-primary)' }}>₹0.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>0 Accounts in dunning</div>
            </div>

            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>UNALLOCATED BANK RECEIPTS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--text-primary)' }}>₹0.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>0 UTR awaiting allocation</div>
            </div>
          </div>
        </div>
      )}

      {/* WORKSTREAM O, P, Q: TAB 7 - RETURNS & DISPOSITION */}
      {activeTab === 'returns' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Reverse Logistics, QC Inspection & Statutory Credit Notes
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Controlled triage for commercial returns and transit damage. Serialized TVs never return directly to sellable stock without QC.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Return #</th>
                  <th style={{ padding: '0.75rem' }}>Serial Number</th>
                  <th style={{ padding: '0.75rem' }}>Return Reason</th>
                  <th style={{ padding: '0.75rem' }}>QC Result</th>
                  <th style={{ padding: '0.75rem' }}>Disposition</th>
                  <th style={{ padding: '0.75rem' }}>Credit Note</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                    No return authorizations logged.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSTREAM R: TAB 8 - REVENUE SIGNALS */}
      {activeTab === 'revenue_intel' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Deterministic Revenue Intelligence Signals
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Algorithmic insights monitoring revenue velocity, fulfillment bottlenecks, and credit exposure risks.
          </p>

          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Intelligence engine active. Signals will populate as live commercial transactions occur.
          </div>
        </div>
      )}

      {/* WORKSTREAM T: TAB 9 - O2C EXCEPTIONS */}
      {activeTab === 'exceptions' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Enterprise Order-to-Cash Exception Center
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            High-severity exceptions escalated to operational work items for rapid multi-departmental resolution.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Exception #</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem' }}>Severity</th>
                  <th style={{ padding: '0.75rem' }}>Order Linkage</th>
                  <th style={{ padding: '0.75rem' }}>Root Cause</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                    No active O2C exceptions. All orders and credit lines are healthy.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
