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

  // Realistic sample enterprise data mirroring backend views
  const sampleOrders: SalesOrder[] = [
    {
      id: 'so-1001',
      so_number: 'SO-2026-1001',
      order_date: '2026-10-22',
      customer_name: 'Metro Retail Mart',
      dealer_name: 'Apex Consumer Electronics',
      order_priority: 'HIGH',
      status: 'APPROVED',
      credit_status: 'CLEAR',
      total_amount: 1450000.0,
      advance_received: 290000.0,
      outstanding_amount: 1160000.0,
      item_count: 50,
    },
    {
      id: 'so-1002',
      so_number: 'SO-2026-1002',
      order_date: '2026-10-21',
      customer_name: 'Croma Regional Hub Pune',
      dealer_name: 'Direct Dealer Network',
      order_priority: 'CRITICAL',
      status: 'CREDIT_HOLD',
      credit_status: 'BLOCK',
      total_amount: 3200000.0,
      advance_received: 0.0,
      outstanding_amount: 3200000.0,
      item_count: 100,
    },
    {
      id: 'so-1003',
      so_number: 'SO-2026-1003',
      order_date: '2026-10-20',
      customer_name: 'Vijay Sales Mumbai Central',
      dealer_name: 'Western Hub Distributor',
      order_priority: 'MEDIUM',
      status: 'ALLOCATED',
      credit_status: 'CLEAR',
      total_amount: 875000.0,
      advance_received: 175000.0,
      outstanding_amount: 700000.0,
      item_count: 25,
    },
    {
      id: 'so-1004',
      so_number: 'SO-2026-1004',
      order_date: '2026-10-19',
      customer_name: 'Reliance Digital Nashik',
      dealer_name: 'Apex Consumer Electronics',
      order_priority: 'URGENT',
      status: 'DISPATCHED',
      credit_status: 'CLEAR',
      total_amount: 2150000.0,
      advance_received: 500000.0,
      outstanding_amount: 1650000.0,
      item_count: 75,
    },
    {
      id: 'so-1005',
      so_number: 'SO-2026-1005',
      order_date: '2026-10-18',
      customer_name: 'Sharma Electronics Thane',
      dealer_name: 'Eastern Retail Group',
      order_priority: 'LOW',
      status: 'DELIVERED',
      credit_status: 'CLEAR',
      total_amount: 450000.0,
      advance_received: 450000.0,
      outstanding_amount: 0.0,
      item_count: 15,
    },
  ];

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
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹81,25,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)', marginTop: '0.25rem' }}>↑ 14.8% vs last month</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>INVOICED REVENUE</span>
                <Receipt size={18} style={{ color: 'var(--brand-secondary, #3b82f6)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹56,40,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>69.4% conversion rate</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COLLECTED CASH</span>
                <DollarSign size={18} style={{ color: 'var(--status-success)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹42,10,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)', marginTop: '0.25rem' }}>DSO: 28.4 Days (Target: &lt;30)</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>BLOCKED CREDIT</span>
                <ShieldAlert size={18} style={{ color: 'var(--status-danger)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-danger)' }}>₹32,00,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.25rem' }}>1 Order pending override</div>
            </div>
          </div>

          {/* O2C Funnel Stage Progression */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Order-to-Cash End-to-End Pipeline
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', textAlign: 'center' }}>
              {[
                { stage: 'Draft & Submitted', count: 4, value: '₹12.4L', color: '#64748b' },
                { stage: 'Pending Approval', count: 2, value: '₹6.8L', color: '#f59e0b' },
                { stage: 'Credit Approved', count: 8, value: '₹28.5L', color: '#3b82f6' },
                { stage: 'Allocated (Serials)', count: 5, value: '₹17.2L', color: '#8b5cf6' },
                { stage: 'Dispatched (In Transit)', count: 6, value: '₹21.5L', color: '#06b6d4' },
                { stage: 'Delivered & Installed', count: 12, value: '₹42.0L', color: '#10b981' },
                { stage: 'Fully Settled / Paid', count: 19, value: '₹64.2L', color: '#059669' },
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
                {filteredOrders.map((order) => (
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
                ))}
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
                  2 Orders
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                Orders with clear credit and confirmed serialized reservation awaiting scan verification.
              </p>
              <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>SO-2026-1003 — Vijay Sales Mumbai</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>25 Units (43" 4K QLED) | Bhiwandi Central Hub</div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>Launch Barcode Pick Scanner</button>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-secondary, #8b5cf6)' }}>PACKING & MANIFEST</span>
                <span style={{ fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                  1 Order
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                Picked items verified against ordered specifications. Preparing delivery challan and e-way bill.
              </p>
              <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>SO-2026-1001 — Metro Retail Mart</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>50 Units (55" 4K Google TV) | Box Count: 50</div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}>Generate Delivery Challan</button>
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
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>DC-2026-1041</td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>SafeExpress Logistics</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MH-04-AB-1290 (LR: SE-99410)</div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>2819 0041 9821</td>
                  <td style={{ padding: '0.75rem' }}>Nashik Warehouse Hub</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                      IN_TRANSIT
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Pending OTP/Signature</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>DC-2026-1039</td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>TCI Freight Express</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MH-12-CD-5541 (LR: TCI-8812)</div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>2819 0039 1290</td>
                  <td style={{ padding: '0.75rem' }}>Thane Retail Outlet</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-success)' }}>
                      DELIVERED
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>Ramesh Sharma</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Verified via OTP + Photo POD</div>
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
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>INV-202610-1081</td>
                  <td style={{ padding: '0.75rem' }}>Metro Retail Mart</td>
                  <td style={{ padding: '0.75rem' }}>₹12,28,813.56</td>
                  <td style={{ padding: '0.75rem' }}>₹2,21,186.44</td>
                  <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹14,50,000.00</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 600 }}>GENERATED (IRN: 8a9f...41)</span>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>INV-202610-1080</td>
                  <td style={{ padding: '0.75rem' }}>Sharma Electronics Thane</td>
                  <td style={{ padding: '0.75rem' }}>₹3,81,355.93</td>
                  <td style={{ padding: '0.75rem' }}>₹68,644.07</td>
                  <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹4,50,000.00</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 600 }}>GENERATED (IRN: 2b1c...99)</span>
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
              <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--text-primary)' }}>₹24,80,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>0-30 Days: ₹19,20,000 (77.4%)</div>
            </div>

            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>OVERDUE AR (&gt; 45 DAYS)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--status-danger)' }}>₹5,60,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)' }}>3 Accounts in automated dunning</div>
            </div>

            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>UNALLOCATED BANK RECEIPTS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--status-warning)' }}>₹2,90,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-warning)' }}>1 UTR awaiting manual allocation</div>
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
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>RMA-2026-1021</td>
                  <td style={{ padding: '0.75rem' }}>ZUV-55Q-2026-00412</td>
                  <td style={{ padding: '0.75rem' }}>TRANSIT_DAMAGE</td>
                  <td style={{ padding: '0.75rem', color: 'var(--status-danger)' }}>MAJOR_PHYSICAL_DAMAGE</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}>
                      QUARANTINE / SCRAP
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--status-success)' }}>CN-2026-0019 (₹29,000)</td>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)', borderLeft: '4px solid var(--status-success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>REVENUE_GROWTH: 55" 4K QLED Category Momentum</span>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-success)', fontWeight: 700 }}>
                  LOW RISK
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                Order value grew 22.4% week-on-week driven by Tier-1 Diwali commercial stocking in Western Maharashtra.
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                Recommendation: Expand factory batch allocation at Pune assembly hub for panel SKU ZUV-55Q-4K.
              </div>
            </div>

            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)', borderLeft: '4px solid var(--status-danger)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>CREDIT_EXPOSURE: Croma Pune Credit Ceiling Breach</span>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)', fontWeight: 700 }}>
                  CRITICAL
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                Total exposure reached ₹32,00,000 against assigned credit limit of ₹25,00,000. Order dispatch blocked automatically.
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--status-danger)', fontWeight: 600 }}>
                Recommendation: Require 50% advance settlement or initiate formal credit override with Finance Director authorization.
              </div>
            </div>
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
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>EXC-1002</td>
                  <td style={{ padding: '0.75rem' }}>BLOCKED_CREDIT</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}>
                      CRITICAL
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>SO-2026-1002</td>
                  <td style={{ padding: '0.75rem' }}>Credit limit exceeded (Exposure ₹32L vs Limit ₹25L)</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--status-warning)' }}>
                      INVESTIGATING
                    </span>
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
