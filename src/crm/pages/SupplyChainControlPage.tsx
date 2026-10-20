import React, { useState } from 'react';
import {
  Boxes,
  Truck,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  ShieldAlert,
  ArrowRightLeft,
  RotateCcw,
  Search,
  Filter,
  Layers,
  MapPin,
  Clock,
  Trash2,
  Lock,
  Sparkles
} from 'lucide-react';

export const SupplyChainControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'serials' | 'warehouses' | 'qc' | 'transfers' | 'cycle_counts' | 'scrap'
  >('overview');

  const [searchQuery, setSearchQuery] = useState('');

  // SCM KPI summary metrics
  const kpis = [
    { label: 'Total In-Stock TVs', value: '1,420 units', sub: '₹3.48 Cr Valuation', color: '#10b981', icon: Boxes },
    { label: 'Allocated / Reserved', value: '312 units', sub: '7 Active Sales Orders', color: '#3b82f6', icon: Lock },
    { label: 'In-Transit Transfers', value: '85 units', sub: '3 Manifest Convoys', color: '#8b5cf6', icon: Truck },
    { label: 'QC Quarantine / Refurb', value: '28 units', sub: 'Awaiting Testing', color: '#f59e0b', icon: ShieldAlert },
    { label: 'Scrap Write-offs (MTD)', value: '6 units', sub: '₹1.12L Total Loss', color: '#ef4444', icon: Trash2 },
  ];

  // Serialized TV units
  const [serializedUnits] = useState([
    {
      id: '1',
      serial: 'ZUV-202610-43-00912',
      barcode: 'ZUV-000000000912',
      model: 'ZUVO 43" 4K Google TV',
      warehouse: 'Central Finished Goods Hub',
      bin: 'A-02-B-04',
      status: 'in_stock',
      qc_status: 'PASSED',
      cost: '₹18,500',
      landed: '₹19,250',
    },
    {
      id: '2',
      serial: 'ZUV-202610-55-00451',
      barcode: 'ZUV-000000000451',
      model: 'ZUVO 55" 4K Smart Voice',
      warehouse: 'North Regional Depot (Delhi)',
      bin: 'D-01-A-01',
      status: 'allocated',
      qc_status: 'PASSED',
      cost: '₹28,000',
      landed: '₹29,100',
    },
    {
      id: '3',
      serial: 'ZUV-202610-32-01824',
      barcode: 'ZUV-000000001824',
      model: 'ZUVO 32" HD Smart Linux',
      warehouse: 'Central Finished Goods Hub',
      bin: 'Q-01-QC-02',
      status: 'quarantine',
      qc_status: 'QUARANTINED',
      cost: '₹10,500',
      landed: '₹11,100',
    },
    {
      id: '4',
      serial: 'ZUV-202610-43-00877',
      barcode: 'ZUV-000000000877',
      model: 'ZUVO 43" 4K Google TV',
      warehouse: 'South Distribution Hub (Chennai)',
      bin: 'T-TRANSIT-01',
      status: 'in_transit',
      qc_status: 'PASSED',
      cost: '₹18,500',
      landed: '₹19,250',
    },
  ]);

  // Warehouses & Locations
  const [warehouses] = useState([
    {
      code: 'WH-CENTRAL-01',
      name: 'Central Finished Goods Hub',
      type: 'Central Warehouse',
      city: 'Bangalore, KA',
      capacity: '3,000 TVs',
      current: '1,840 TVs',
      utilization: '61.3%',
    },
    {
      code: 'WH-NORTH-02',
      name: 'North Regional Depot',
      type: 'Regional Warehouse',
      city: 'Gurugram, HR',
      capacity: '1,500 TVs',
      current: '920 TVs',
      utilization: '61.3%',
    },
    {
      code: 'WH-SOUTH-03',
      name: 'South Distribution Hub',
      type: 'Regional Warehouse',
      city: 'Chennai, TN',
      capacity: '1,200 TVs',
      current: '850 TVs',
      utilization: '70.8%',
    },
  ]);

  // QC Inspections
  const [qcInspections] = useState([
    {
      number: 'QC-20261020-1001',
      serial: 'ZUV-202610-32-01824',
      model: 'ZUVO 32" HD Smart Linux',
      source: 'INBOUND_GRN',
      defect: 'Panel Backlight Flickering',
      verdict: 'QUARANTINED',
      inspector: 'K. Rajan (Lead QA)',
      date: '2026-10-20',
    },
    {
      number: 'QC-20261019-0994',
      serial: 'ZUV-202610-50-00122',
      model: 'ZUVO 50" 4K Smart Voice',
      source: 'CUSTOMER_RETURN',
      defect: 'Transit Box Crushed / Panel Safe',
      verdict: 'PASSED',
      inspector: 'S. Mehta (Depot QC)',
      date: '2026-10-19',
    },
  ]);

  // Cycle Counts
  const [cycleCounts] = useState([
    {
      countNumber: 'CC-202610-001',
      warehouse: 'Central Finished Goods Hub',
      date: '2026-10-18',
      expected: 450,
      counted: 450,
      variance: 0,
      status: 'RECONCILED',
      auditor: 'P. Nair (Inventory Mgr)',
    },
    {
      countNumber: 'CC-202610-002',
      warehouse: 'North Regional Depot',
      date: '2026-10-20',
      expected: 220,
      counted: 219,
      variance: -1,
      status: 'IN_PROGRESS',
      auditor: 'V. Sharma (Depot Lead)',
    },
  ]);

  // Filtered serials
  const filteredSerials = serializedUnits.filter(
    (u) =>
      u.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.warehouse.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Boxes size={24} style={{ color: '#10b981' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              Supply Chain & Warehouse Control Center
            </h1>
            <span className="badge badge-primary" style={{ background: '#10b981', color: '#fff', fontSize: '11px' }}>
              PHASE 12
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Unified Traceability: Supplier Inbound → Bins → Allocation → Transfers → Returns → Refurbishment → Scrap & GL
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('cycle_counts')}>
            <ClipboardList size={14} style={{ marginRight: '6px' }} /> Physical Count
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('serials')}>
            <Search size={14} style={{ marginRight: '6px' }} /> Serial Traceability
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {kpi.label}
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} style={{ color: kpi.color }} />
                </div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', color: kpi.color, fontWeight: 500 }}>{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', gap: '8px', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Supply Chain Overview', icon: Layers },
          { id: 'serials', label: 'Serialized TV Units', icon: Search },
          { id: 'warehouses', label: 'Warehouses & Locations', icon: Warehouse },
          { id: 'qc', label: 'Quality & Quarantine', icon: ShieldAlert },
          { id: 'transfers', label: 'Stock Transfers', icon: ArrowRightLeft },
          { id: 'cycle_counts', label: 'Cycle Audits', icon: ClipboardList },
          { id: 'scrap', label: 'Scrap & Write-Off', icon: Trash2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
                color: isActive ? '#10b981' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: '#10b981' }} />
              End-to-End Serial Traceability Highway
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', textAlign: 'center' }}>
              {[
                { title: '1. INBOUND', desc: 'Vendor PO / GRN Receiving', status: 'ACTIVE' },
                { title: '2. QC DOCK', desc: 'Intake Inspection & Quarantine', status: 'PASSED' },
                { title: '3. BIN LOCATION', desc: 'Storage Zone & Rack Master', status: 'ON_HAND' },
                { title: '4. ALLOCATION', desc: 'B2B Sales Order Reservation', status: 'LOCKED' },
                { title: '5. DISPATCH', desc: 'Delivery Challan & E-Way Bill', status: 'SHIPPED' },
                { title: '6. WARRANTY', desc: 'Customer Registration & SLA', status: 'ACTIVE' },
                { title: '7. REVERSE', desc: 'Service RMA & Core Refurb', status: 'RESTOCKED' },
              ].map((step, idx) => (
                <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>{step.title}</div>
                  <div style={{ fontSize: '0.75rem', margin: '6px 0', color: 'var(--text-secondary)' }}>{step.desc}</div>
                  <span className="badge badge-primary" style={{ fontSize: '10px' }}>{step.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0' }}>Warehouse Stock Balances</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 0' }}>Facility</th>
                    <th style={{ padding: '8px 0' }}>Available</th>
                    <th style={{ padding: '8px 0' }}>Allocated</th>
                    <th style={{ padding: '8px 0' }}>Quarantine</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>Central Finished Goods Hub</td>
                    <td style={{ color: '#10b981' }}>1,520</td>
                    <td style={{ color: '#3b82f6' }}>240</td>
                    <td style={{ color: '#f59e0b' }}>18</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>North Regional Depot (Delhi)</td>
                    <td style={{ color: '#10b981' }}>750</td>
                    <td style={{ color: '#3b82f6' }}>45</td>
                    <td style={{ color: '#f59e0b' }}>6</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>South Distribution Hub (Chennai)</td>
                    <td style={{ color: '#10b981' }}>680</td>
                    <td style={{ color: '#3b82f6' }}>27</td>
                    <td style={{ color: '#f59e0b' }}>4</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0' }}>Supply Chain Governance Guards</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong style={{ color: 'var(--text-primary)' }}>Zero Over-Allocation:</strong> Hard server-side DB constraints block allocating more units than ordered.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>Quarantine Isolation:</strong> Units under QC hold or damaged state are excluded from saleable stock.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>Maker-Checker Transfers & Scrap:</strong> Inter-depot transfers and write-offs require secondary supervisor approval.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>Authoritative Landed Cost:</strong> COGS layers track unit purchase cost + allocated inbound freight and customs.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. SERIALIZED UNITS */}
      {activeTab === 'serials' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Master Serialized TV Register ({filteredSerials.length} units found)
            </h3>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search serial, barcode, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Serial Number</th>
                  <th style={{ padding: '10px 8px' }}>Barcode</th>
                  <th style={{ padding: '10px 8px' }}>Model</th>
                  <th style={{ padding: '10px 8px' }}>Warehouse / Depot</th>
                  <th style={{ padding: '10px 8px' }}>Location Bin</th>
                  <th style={{ padding: '10px 8px' }}>Unit Status</th>
                  <th style={{ padding: '10px 8px' }}>QC Status</th>
                  <th style={{ padding: '10px 8px' }}>Purchase Cost</th>
                  <th style={{ padding: '10px 8px' }}>Landed Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredSerials.map((unit) => (
                  <tr key={unit.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{unit.serial}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{unit.barcode}</td>
                    <td style={{ padding: '10px 8px' }}>{unit.model}</td>
                    <td style={{ padding: '10px 8px' }}>{unit.warehouse}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                        {unit.bin}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          background:
                            unit.status === 'in_stock'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : unit.status === 'allocated'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : unit.status === 'quarantine'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(139, 92, 246, 0.15)',
                          color:
                            unit.status === 'in_stock'
                              ? '#10b981'
                              : unit.status === 'allocated'
                              ? '#3b82f6'
                              : unit.status === 'quarantine'
                              ? '#f59e0b'
                              : '#8b5cf6',
                        }}
                      >
                        {unit.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: unit.qc_status === 'PASSED' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                      {unit.qc_status}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{unit.cost}</td>
                    <td style={{ padding: '10px 8px', color: '#10b981', fontWeight: 600 }}>{unit.landed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. WAREHOUSES & LOCATIONS */}
      {activeTab === 'warehouses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Warehouse size={18} style={{ color: '#10b981' }} />
              Enterprise Warehouse & Depot Network
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {warehouses.map((wh) => (
                <div key={wh.code} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{wh.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{wh.code} • {wh.type}</div>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '10px' }}>ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '12px 0 8px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <MapPin size={14} /> {wh.city}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span>Capacity: <strong>{wh.capacity}</strong></span>
                    <span>Utilized: <strong style={{ color: '#10b981' }}>{wh.current} ({wh.utilization})</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. QUALITY & QUARANTINE */}
      {activeTab === 'qc' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
            Quality Assurance & Quarantine Inspections
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Inspection #</th>
                  <th style={{ padding: '10px 8px' }}>Serial Number</th>
                  <th style={{ padding: '10px 8px' }}>Model</th>
                  <th style={{ padding: '10px 8px' }}>Source</th>
                  <th style={{ padding: '10px 8px' }}>Defect Observation</th>
                  <th style={{ padding: '10px 8px' }}>Verdict</th>
                  <th style={{ padding: '10px 8px' }}>Lead Inspector</th>
                  <th style={{ padding: '10px 8px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {qcInspections.map((qc) => (
                  <tr key={qc.number} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{qc.number}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{qc.serial}</td>
                    <td style={{ padding: '10px 8px' }}>{qc.model}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '11px' }}>{qc.source}</span>
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{qc.defect}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          background: qc.verdict === 'PASSED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: qc.verdict === 'PASSED' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {qc.verdict}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{qc.inspector}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{qc.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRightLeft size={18} style={{ color: '#8b5cf6' }} />
            Inter-Warehouse Stock Transfers & Transit Convoys
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Integrated with Phase 7.1 stock transfer manifests. Enforces maker-checker dispatch authorization and destination receiving discrepancy logging.
          </p>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>STM-202610-0082 (In-Transit)</span>
              <span className="badge badge-primary" style={{ background: '#8b5cf6', color: '#fff', fontSize: '11px' }}>IN_TRANSIT</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              From: <strong>Central Finished Goods Hub</strong> → To: <strong>North Regional Depot (Delhi)</strong>
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--text-secondary)' }}>
              Carrier: V-Trans Logistics • Vehicle: KA-01-AB-7741 • Manifest Units: 50 TVs
            </div>
          </div>
        </div>
      )}

      {/* 6. CYCLE COUNTS */}
      {activeTab === 'cycle_counts' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={18} style={{ color: '#10b981' }} />
            Physical Inventory Cycle Audits
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Audit Session</th>
                  <th style={{ padding: '10px 8px' }}>Facility</th>
                  <th style={{ padding: '10px 8px' }}>Audit Date</th>
                  <th style={{ padding: '10px 8px' }}>System Units</th>
                  <th style={{ padding: '10px 8px' }}>Counted Units</th>
                  <th style={{ padding: '10px 8px' }}>Variance</th>
                  <th style={{ padding: '10px 8px' }}>Audit Status</th>
                  <th style={{ padding: '10px 8px' }}>Certified Auditor</th>
                </tr>
              </thead>
              <tbody>
                {cycleCounts.map((cc) => (
                  <tr key={cc.countNumber} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{cc.countNumber}</td>
                    <td style={{ padding: '10px 8px' }}>{cc.warehouse}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{cc.date}</td>
                    <td style={{ padding: '10px 8px' }}>{cc.expected}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{cc.counted}</td>
                    <td style={{ padding: '10px 8px', color: cc.variance === 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {cc.variance === 0 ? '0 (Clean)' : `${cc.variance} TV`}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '11px' }}>{cc.status}</span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{cc.auditor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. SCRAP */}
      {activeTab === 'scrap' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={18} style={{ color: '#ef4444' }} />
            Scrap & E-Waste Write-Off Control
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Authoritative disposal of total-loss televisions and unrepairable core boards. Requires finance/super_admin approval with dual-control maker-checker.
          </p>
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>WO-SCRAP-2026-0041 (ZUV-202609-55-00109)</span>
              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '11px' }}>APPROVED</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Reason: <strong>PANEL_CRACKED (Physical Forklift Impact)</strong> • Book Value: <strong>₹28,000.00</strong> • Net Write-Off: <strong>₹26,500.00</strong>
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--text-secondary)' }}>
              Approved by: <strong>Finance Controller (A. Krishnan)</strong> • Linked JV: <strong>JV-SCRAP-202610-09</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
