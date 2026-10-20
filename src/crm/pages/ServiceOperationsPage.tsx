import React, { useState } from 'react';
import {
  Wrench,
  ShieldCheck,
  Clock,
  Truck,
  Boxes,
  Users,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  ClipboardList,
  Layers,
  Activity,
  Award,
  TrendingUp,
  MapPin,
  RefreshCw,
  PhoneCall,
  Tv,
  Check
} from 'lucide-react';

export const ServiceOperationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'live_cases'
    | 'sla_monitor'
    | 'dispatch'
    | 'parts_waiting'
    | 'replacements'
    | 'root_cause'
  >('overview');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Operational KPIs for Service Command Center
  const kpis = [
    { label: 'Active Tickets', value: '42 cases', sub: '8 In-Progress, 14 Scheduled', color: '#3b82f6', icon: Wrench },
    { label: 'SLA Compliance', value: '94.8%', sub: 'Target: >95.0%', color: '#10b981', icon: Clock },
    { label: 'First-Visit Resolution', value: '88.5%', sub: 'Last 30 Days (Direct)', color: '#8b5cf6', icon: Award },
    { label: 'Awaiting Spare Parts', value: '5 cases', sub: '3 Mainboards, 2 T-Con', color: '#f59e0b', icon: Boxes },
    { label: 'Pending TV Replacements', value: '2 units', sub: 'Chassis Swap Authorizations', color: '#ef4444', icon: Tv },
  ];

  // Mock Active Service Tickets
  const [serviceCases, setServiceCases] = useState([
    {
      id: 'TCK-202610-00101',
      customer: 'Rajesh Sharma',
      phone: '+91 98201 11223',
      city: 'Mumbai (Andheri West)',
      model: 'ZUVO 55" 4K Google TV',
      serial: 'ZUV-202610-55-00451',
      issue: 'Horizontal green lines on display panel',
      category: 'Display / Panel',
      priority: 'high',
      status: 'in_progress',
      technician: 'Vikram Singh',
      warrantyStatus: 'ACTIVE_WARRANTY',
      slaDue: 'Today, 6:00 PM',
      slaBreached: false,
      partsRequired: '55" UHD Panel (PNL-55-UHD)',
    },
    {
      id: 'TCK-202610-00102',
      customer: 'Pooja Verma',
      phone: '+91 97112 44556',
      city: 'Delhi (Rohini)',
      model: 'ZUVO 43" 4K Smart TV',
      serial: 'ZUV-202610-43-00912',
      issue: 'No power, red standby LED blinking 3 times',
      category: 'Power Supply',
      priority: 'critical',
      status: 'waiting_parts',
      technician: 'Amit Deshmukh',
      warrantyStatus: 'ACTIVE_WARRANTY',
      slaDue: 'Today, 4:30 PM',
      slaBreached: true,
      partsRequired: 'Power Supply Board (PSU-43-ZUVO)',
    },
    {
      id: 'TCK-202610-00103',
      customer: 'Karthik Raman',
      phone: '+91 98450 77889',
      city: 'Bengaluru (Koramangala)',
      model: 'ZUVO 65" QLED Master Edition',
      serial: 'ZUV-202610-65-00118',
      issue: 'HDMI Port 2 and eARC not detecting audio system',
      category: 'Mainboard / Ports',
      priority: 'medium',
      status: 'scheduled',
      technician: 'Suresh Nair',
      warrantyStatus: 'ACTIVE_WARRANTY',
      slaDue: 'Tomorrow, 11:00 AM',
      slaBreached: false,
      partsRequired: 'None (Firmware / Cable Check)',
    },
    {
      id: 'TCK-202610-00104',
      customer: 'Sunil Mehta',
      phone: '+91 99001 22334',
      city: 'Ahmedabad (Satellite)',
      model: 'ZUVO 32" HD Smart TV',
      serial: 'ZUV-202511-32-00562',
      issue: 'Audio distortion / speaker buzzing at >40% volume',
      category: 'Audio / Speaker',
      priority: 'low',
      status: 'en_route',
      technician: 'Deepak Patel',
      warrantyStatus: 'EXPIRED_OUT_OF_WARRANTY',
      slaDue: 'Tomorrow, 3:00 PM',
      slaBreached: false,
      partsRequired: 'Left/Right Speaker Kit (SPK-32-SET)',
    },
  ]);

  // Root Cause Intelligence Mock Data
  const rootCauseAnalysis = [
    {
      category: 'Display / Open Cell Defect',
      occurrences: 18,
      percentage: '38.2%',
      primarySupplier: 'BOE Display Tech',
      avgCost: '₹8,450',
      action: 'Batch firmware voltage tweak & cold solder review',
      alertLevel: 'HIGH_FAILURE',
    },
    {
      category: 'Power Surge / PSU Capacitor Breakdown',
      occurrences: 12,
      percentage: '25.5%',
      primarySupplier: 'Delta Power Electronics',
      avgCost: '₹1,950',
      action: 'Recommend external MOV surge suppressors to tier-2 areas',
      alertLevel: 'WATCH',
    },
    {
      category: 'Software / Boot Loop / WiFi Dropout',
      occurrences: 9,
      percentage: '19.1%',
      primarySupplier: 'Internal Firmware Team',
      avgCost: '₹350',
      action: 'OTA Hotfix v3.4.1 scheduled for rolling push',
      alertLevel: 'NORMAL',
    },
    {
      category: 'Physical Panel Impact / Transit Shock',
      occurrences: 5,
      percentage: '10.6%',
      primarySupplier: 'Logistics / 3PL Couriers',
      avgCost: '₹14,200',
      action: 'Strengthen inner corner EPS cushioning on 55" & 65"',
      alertLevel: 'WATCH',
    },
    {
      category: 'No Fault Found (Customer Education)',
      occurrences: 3,
      percentage: '6.4%',
      primarySupplier: 'N/A (User Error)',
      avgCost: '₹400',
      action: 'Update initial setup wizard & quick start manual',
      alertLevel: 'NORMAL',
    },
  ];

  // Replacement authorisations
  const [replacements, setReplacements] = useState([
    {
      id: 'REP-202610-001',
      ticketId: 'TCK-202610-00089',
      customer: 'Anita Krishnan',
      defectSerial: 'ZUV-202610-55-00109',
      replacementSerial: 'ZUV-202610-55-00890',
      reason: 'Repeated panel failure (3rd visit within 14 days) - DOA Replacement',
      approvedBy: 'Service Director (Operations)',
      status: 'APPROVED',
      date: '2026-10-20',
    },
    {
      id: 'REP-202610-002',
      ticketId: 'TCK-202610-00115',
      customer: 'Manoj Bajpai',
      defectSerial: 'ZUV-202610-65-00045',
      replacementSerial: 'Awaiting Serial Allocation',
      reason: 'Unresolvable chassis frame warp & optical light bleed',
      approvedBy: 'Pending Regional Head Review',
      status: 'PENDING_APPROVAL',
      date: '2026-10-20',
    },
  ]);

  const handleApproveReplacement = (repId: string) => {
    setReplacements(prev =>
      prev.map(r => (r.id === repId ? { ...r, status: 'APPROVED', approvedBy: 'Super Admin (Override)' } : r))
    );
    setActionMessage(`Replacement ${repId} approved and unit swap authorized.`);
    setTimeout(() => setActionMessage(null), 4000);
  };

  const filteredTickets = serviceCases.filter(t => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              PHASE 12 COMMAND CENTER
            </span>
            <span
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              LIVE TELEMETRY
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench style={{ color: 'var(--brand-primary)' }} />
            Service, Warranty & Field Operations Intelligence
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Unified ticket resolution, SLA breach protection, mobile field dispatch, parts tracking, and TV chassis replacement governance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setActionMessage('Telemetry synchronized with depot and field technician nodes.');
              setTimeout(() => setActionMessage(null), 3000);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} /> Refresh Feed
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} /> {actionMessage}
        </div>
      )}

      {/* Top Level KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {kpis.map((kpi, idx) => {
          const IconComp = kpi.icon;
          return (
            <div
              key={idx}
              className="card"
              style={{
                padding: '1rem',
                background: 'var(--card-bg, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  background: `${kpi.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: kpi.color,
                  flexShrink: 0,
                }}
              >
                <IconComp size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{kpi.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #94a3b8)' }}>{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color, #334155)',
          marginBottom: '1.25rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}
      >
        {[
          { id: 'overview', label: 'Command Cockpit', icon: Activity },
          { id: 'live_cases', label: 'Live Ticket Queue', icon: ClipboardList },
          { id: 'sla_monitor', label: 'SLA & Escalations', icon: Clock },
          { id: 'dispatch', label: 'Field Technician Dispatch', icon: Truck },
          { id: 'parts_waiting', label: 'Parts Waiting & Consumption', icon: Boxes },
          { id: 'replacements', label: 'TV Unit Replacements', icon: Tv },
          { id: 'root_cause', label: 'Quality & Root Cause Intel', icon: Sparkles },
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
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? 'var(--brand-primary, #6366f1)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.825rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Command Cockpit */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
          <div
            className="card"
            style={{
              padding: '1.25rem',
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '10px',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} style={{ color: '#10b981' }} />
              Live Operations Funnel & Field Velocity
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Open / Unassigned</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>6 cases</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Avg. Queue: 18 mins</div>
              </div>
              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Scheduled / En Route</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>14 visits</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>4 field techs moving</div>
              </div>
              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>In Progress / Repair</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>8 units</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Active bench/field</div>
              </div>
              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Resolved (Today)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>19 closed</div>
                <div style={{ fontSize: '0.65rem', color: '#10b981' }}>CSAT: 4.8 / 5.0</div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '1rem 0 0.5rem 0' }}>Urgent Attention Required</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  padding: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>
                    SLA Breached: TCK-202610-00102 (Pooja Verma - Delhi)
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    Power supply failure on 43" 4K. Spare part awaiting depot dispatch from Central Finished Goods Hub.
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('sla_monitor')}
                  style={{ fontSize: '0.75rem' }}
                >
                  Expedite SLA
                </button>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>
                    Replacement Pending Approval: REP-202610-002 (Manoj Bajpai)
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    Optical light bleed defect on 65" QLED Master Edition requires regional manager sign-off.
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('replacements')}
                  style={{ fontSize: '0.75rem' }}
                >
                  View Chassis Swap
                </button>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '1.25rem',
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '10px',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--brand-primary)' }} />
              Warranty Settlement Status
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Warranty Claims (MTD)</span>
                <span style={{ fontWeight: 700 }}>128 claims</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Parts Covered Cost</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>₹4,18,500</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Labour & Travel Reimbursed</span>
                <span style={{ fontWeight: 700 }}>₹96,200</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Customer Paid Repairs (OOW)</span>
                <span style={{ fontWeight: 700, color: '#3b82f6' }}>₹64,300</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Warranty Reserve Balance</span>
                <span style={{ fontWeight: 700, color: '#8b5cf6' }}>₹14,50,000</span>
              </div>
              <div style={{ padding: '0.5rem', background: '#0f172a', borderRadius: '6px', fontSize: '0.7rem', color: '#94a3b8' }}>
                Balance is maintained in accordance with double-entry General Ledger Account 2150 (Warranty Reserve Provision).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Live Ticket Queue */}
      {activeTab === 'live_cases' && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search ticket, customer, serial, city..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem 0.45rem 2rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Showing {filteredTickets.length} of {serviceCases.length} service tickets
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '0.6rem' }}>Ticket Number</th>
                  <th style={{ padding: '0.6rem' }}>Customer & Location</th>
                  <th style={{ padding: '0.6rem' }}>TV Unit & Serial</th>
                  <th style={{ padding: '0.6rem' }}>Issue / Category</th>
                  <th style={{ padding: '0.6rem' }}>Priority</th>
                  <th style={{ padding: '0.6rem' }}>Status</th>
                  <th style={{ padding: '0.6rem' }}>Assigned Tech</th>
                  <th style={{ padding: '0.6rem' }}>SLA Due</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {t.id}
                      <div style={{ fontSize: '0.65rem', color: t.warrantyStatus === 'ACTIVE_WARRANTY' ? '#10b981' : '#f59e0b' }}>
                        {t.warrantyStatus === 'ACTIVE_WARRANTY' ? '• Warranty Active' : '• Out of Warranty'}
                      </div>
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      <div style={{ fontWeight: 600 }}>{t.customer}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{t.city}</div>
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      <div>{t.model}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>{t.serial}</div>
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      <div>{t.category}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{t.issue}</div>
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background:
                            t.priority === 'critical'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : t.priority === 'high'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(59, 130, 246, 0.2)',
                          color:
                            t.priority === 'critical'
                              ? '#ef4444'
                              : t.priority === 'high'
                              ? '#f59e0b'
                              : '#3b82f6',
                        }}
                      >
                        {t.priority.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background:
                            t.status === 'in_progress'
                              ? 'rgba(139, 92, 246, 0.2)'
                              : t.status === 'waiting_parts'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)',
                          color:
                            t.status === 'in_progress'
                              ? '#8b5cf6'
                              : t.status === 'waiting_parts'
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      >
                        {t.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem' }}>{t.technician}</td>
                    <td style={{ padding: '0.6rem' }}>
                      <div style={{ color: t.slaBreached ? '#ef4444' : '#94a3b8', fontWeight: t.slaBreached ? 700 : 400 }}>
                        {t.slaDue}
                        {t.slaBreached && ' (BREACHED)'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: SLA & Escalations */}
      {activeTab === 'sla_monitor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div
            className="card"
            style={{
              padding: '1.25rem',
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '10px',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} style={{ color: '#ef4444' }} />
              Active SLA Thresholds & Targets
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>Critical Priority SLA</span>
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Target: 4 Hours</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Applies to complete TV blackouts, fire/smoke risk, VIP customers, and commercial displays.
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#f59e0b' }}>High Priority SLA</span>
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Target: 24 Hours</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Panel display distortion, sound failure, remote sensor malfunction in warranty period.
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#3b82f6' }}>Standard / Out-of-Warranty</span>
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Target: 48 Hours</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Minor connectivity issues, demo/installation assistance, paid out-of-warranty replacements.
                </div>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '1.25rem',
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '10px',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
              Breach Mitigation Protocol
            </h3>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Tickets approaching 80% SLA elapsed automatically trigger push notifications to the Regional Service Supervisor.
              When parts are marked as 'waiting_parts', an automated procurement stock query searches adjacent depot bins.
            </p>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setActionMessage('Automated SLA Sweep executed: 1 breached ticket flagged for escalation.');
                  setTimeout(() => setActionMessage(null), 3000);
                }}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw size={14} /> Run Idempotent SLA Integrity Sweep (Cron)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Field Technician Dispatch */}
      {activeTab === 'dispatch' && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={18} style={{ color: 'var(--brand-primary)' }} />
            Active Field Technician Rostering & Conflict Check
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {[
              {
                name: 'Vikram Singh',
                territory: 'Mumbai Metro (West)',
                status: 'ON_VISIT',
                activeJob: 'TCK-202610-00101',
                todayCompleted: 3,
                vehicleStock: '2 Panels, 4 Power Boards',
              },
              {
                name: 'Amit Deshmukh',
                territory: 'Delhi NCR (North)',
                status: 'WAITING_PARTS',
                activeJob: 'TCK-202610-00102',
                todayCompleted: 2,
                vehicleStock: '1 Motherboard, 2 Speakers',
              },
              {
                name: 'Suresh Nair',
                territory: 'Bengaluru Urban',
                status: 'AVAILABLE',
                activeJob: 'Scheduled for 11:00 AM',
                todayCompleted: 4,
                vehicleStock: 'Full Diagnostic Kit, 3 PSU Boards',
              },
              {
                name: 'Deepak Patel',
                territory: 'Gujarat Central (Ahmedabad)',
                status: 'EN_ROUTE',
                activeJob: 'TCK-202610-00104',
                todayCompleted: 2,
                vehicleStock: 'Speaker Kits, LVDS Cables',
              },
            ].map((tech, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{tech.name}</div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>{tech.territory}</div>
                  </div>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: tech.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: tech.status === 'AVAILABLE' ? '#10b981' : '#3b82f6',
                    }}
                  >
                    {tech.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ color: '#94a3b8' }}>Current Assignment:</div>
                  <div style={{ fontWeight: 600 }}>{tech.activeJob}</div>
                </div>

                <div style={{ fontSize: '0.725rem', marginTop: '0.5rem', color: '#64748b' }}>
                  Van Inventory: {tech.vehicleStock}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Parts Waiting & Consumption */}
      {activeTab === 'parts_waiting' && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Boxes size={18} style={{ color: '#f59e0b' }} />
            Spare Parts Requisitions & Core Returns
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '0.6rem' }}>Part SKU</th>
                  <th style={{ padding: '0.6rem' }}>Description</th>
                  <th style={{ padding: '0.6rem' }}>Linked Ticket</th>
                  <th style={{ padding: '0.6rem' }}>Allocated Warehouse</th>
                  <th style={{ padding: '0.6rem' }}>Coverage</th>
                  <th style={{ padding: '0.6rem' }}>Defective Core Return</th>
                  <th style={{ padding: '0.6rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 700, fontFamily: 'monospace' }}>PNL-55-UHD</td>
                  <td style={{ padding: '0.6rem' }}>55" UHD Replacement Open-Cell Panel</td>
                  <td style={{ padding: '0.6rem', color: 'var(--brand-primary)' }}>TCK-202610-00101</td>
                  <td style={{ padding: '0.6rem' }}>Central Finished Goods Hub</td>
                  <td style={{ padding: '0.6rem', color: '#10b981' }}>100% Warranty (₹0 charge)</td>
                  <td style={{ padding: '0.6rem', color: '#f59e0b' }}>Pending Return (Quarantine)</td>
                  <td style={{ padding: '0.6rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setActionMessage('Part PNL-55-UHD issued from Central Hub to Tech van inventory.');
                        setTimeout(() => setActionMessage(null), 3000);
                      }}
                      style={{ fontSize: '0.7rem' }}
                    >
                      Issue Part
                    </button>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 700, fontFamily: 'monospace' }}>PSU-43-ZUVO</td>
                  <td style={{ padding: '0.6rem' }}>43" Integrated Power Supply Board</td>
                  <td style={{ padding: '0.6rem', color: 'var(--brand-primary)' }}>TCK-202610-00102</td>
                  <td style={{ padding: '0.6rem' }}>North Regional Depot (Delhi)</td>
                  <td style={{ padding: '0.6rem', color: '#10b981' }}>100% Warranty (₹0 charge)</td>
                  <td style={{ padding: '0.6rem', color: '#10b981' }}>Returned to Scrap/Refurb</td>
                  <td style={{ padding: '0.6rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setActionMessage('Stock dispatched from North Depot.');
                        setTimeout(() => setActionMessage(null), 3000);
                      }}
                      style={{ fontSize: '0.7rem' }}
                    >
                      Dispatch
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: TV Unit Replacements */}
      {activeTab === 'replacements' && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tv size={18} style={{ color: '#ef4444' }} />
              Controlled Chassis Swaps & DOA Replacements (Maker-Checker Rule)
            </h3>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Full TV unit swaps retire the defective unit to quarantine and preserve the original customer purchase history, remaining warranty tenure, and invoice lineage on the replacement serial number.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {replacements.map(rep => (
              <div
                key={rep.id}
                style={{
                  padding: '1rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--brand-primary)' }}>{rep.id}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: rep.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: rep.status === 'APPROVED' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {rep.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem' }}>
                    Customer: {rep.customer} (Ticket: {rep.ticketId})
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Defective Serial: <span style={{ fontFamily: 'monospace' }}>{rep.defectSerial}</span> → Replacement Serial: <span style={{ fontFamily: 'monospace' }}>{rep.replacementSerial}</span>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Reason: {rep.reason}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Authorized by:</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rep.approvedBy}</div>
                  {rep.status === 'PENDING_APPROVAL' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleApproveReplacement(rep.id)}
                      style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Check size={14} /> Authorize Unit Swap
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Quality & Root Cause Intel */}
      {activeTab === 'root_cause' && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} style={{ color: 'var(--brand-primary)' }} />
            Deterministic Product Quality & Component Root-Cause Telemetry
          </h3>

          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Root-cause analytics aggregated across all service completions. Alerts are computed through deterministic thresholds without blackbox models.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '0.6rem' }}>Failure Mode / Category</th>
                  <th style={{ padding: '0.6rem' }}>Occurrences</th>
                  <th style={{ padding: '0.6rem' }}>Share</th>
                  <th style={{ padding: '0.6rem' }}>Key Component Vendor</th>
                  <th style={{ padding: '0.6rem' }}>Avg. Cost</th>
                  <th style={{ padding: '0.6rem' }}>Intelligence Status</th>
                  <th style={{ padding: '0.6rem' }}>Engineering Action Plan</th>
                </tr>
              </thead>
              <tbody>
                {rootCauseAnalysis.map((rc, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 700 }}>{rc.category}</td>
                    <td style={{ padding: '0.6rem' }}>{rc.occurrences}</td>
                    <td style={{ padding: '0.6rem' }}>{rc.percentage}</td>
                    <td style={{ padding: '0.6rem', color: '#94a3b8' }}>{rc.primarySupplier}</td>
                    <td style={{ padding: '0.6rem', fontWeight: 600 }}>{rc.avgCost}</td>
                    <td style={{ padding: '0.6rem' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          background:
                            rc.alertLevel === 'HIGH_FAILURE'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : rc.alertLevel === 'WATCH'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)',
                          color:
                            rc.alertLevel === 'HIGH_FAILURE'
                              ? '#ef4444'
                              : rc.alertLevel === 'WATCH'
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      >
                        {rc.alertLevel}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>{rc.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
