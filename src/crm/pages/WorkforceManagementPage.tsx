import React, { useState } from 'react';
import {
  Users,
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  AlertTriangle,
  FileText,
  TrendingUp,
  ShieldCheck,
  Building,
  UserCheck,
  Briefcase,
  Layers,
  Search,
  Filter,
  CheckSquare
} from 'lucide-react';

export const WorkforceManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'employees' | 'attendance' | 'leave' | 'performance' | 'certifications' | 'documents' | 'exceptions'
  >('overview');

  const [searchQuery, setSearchQuery] = useState('');

  // Workforce KPI Summary Metrics
  const kpis = [
    { label: 'Total Headcount', value: '148 staff', sub: '96.2% Active Roster', color: '#10b981', icon: Users },
    { label: 'Present Today', value: '138 staff', sub: '93.2% Daily Adherence', color: '#3b82f6', icon: UserCheck },
    { label: 'On Approved Leave', value: '7 staff', sub: '2 Medical, 5 Earned', color: '#8b5cf6', icon: Calendar },
    { label: 'Pending HR Approvals', value: '4 items', sub: '3 Leave, 1 Onboarding', color: '#f59e0b', icon: Clock },
    { label: 'Compliance & Cert Exceptions', value: '2 alerts', sub: 'Expiring Certifications', color: '#ef4444', icon: AlertTriangle },
  ];

  // Employee Sample Roster
  const [employees] = useState([
    {
      code: 'EMP-1001',
      name: 'Rajesh V. Sharma',
      department: 'SERVICE',
      designation: 'Senior Lead Field Engineer',
      grade: 'L3_SENIOR',
      territory: 'South Hub (Bangalore)',
      status: 'CONFIRMED',
      joiningDate: '2023-04-12',
      attendanceRate: '98.5%',
      fvrScore: '92.4%',
    },
    {
      code: 'EMP-1002',
      name: 'Anjali P. Nair',
      department: 'MANUFACTURING',
      designation: 'SMT Line Quality Supervisor',
      grade: 'L3_SENIOR',
      territory: 'Smart Factory Unit-1',
      status: 'CONFIRMED',
      joiningDate: '2023-08-15',
      attendanceRate: '99.1%',
      fvrScore: '96.0%',
    },
    {
      code: 'EMP-1003',
      name: 'Karan M. Patel',
      department: 'SALES',
      designation: 'Enterprise Channel Manager',
      grade: 'L2_PROFESSIONAL',
      territory: 'Western Distributor Region',
      status: 'CONFIRMED',
      joiningDate: '2024-01-10',
      attendanceRate: '95.8%',
      fvrScore: 'N/A',
    },
    {
      code: 'EMP-1004',
      name: 'Suresh B. Rao',
      department: 'WAREHOUSE',
      designation: 'Central Hub Dispatch Lead',
      grade: 'L2_PROFESSIONAL',
      territory: 'Central Depot',
      status: 'CONFIRMED',
      joiningDate: '2024-06-01',
      attendanceRate: '97.2%',
      fvrScore: 'N/A',
    },
    {
      code: 'EMP-1005',
      name: 'Neha K. Deshmukh',
      department: 'HR',
      designation: 'Talent & Compliance Specialist',
      grade: 'L2_PROFESSIONAL',
      territory: 'Corporate Headquarters',
      status: 'PROBATION',
      joiningDate: '2026-08-01',
      attendanceRate: '100%',
      fvrScore: 'N/A',
    },
  ]);

  // Attendance Records
  const [attendanceRecords] = useState([
    { employee: 'Rajesh V. Sharma', code: 'EMP-1001', date: '2026-10-22', shift: 'General (09:00 - 18:00)', inTime: '08:52 AM', outTime: '06:15 PM', hours: '8.4 hrs', ot: '0.4 hrs', status: 'PRESENT' },
    { employee: 'Anjali P. Nair', code: 'EMP-1002', date: '2026-10-22', shift: 'Morning Shift A (06:00 - 14:30)', inTime: '05:50 AM', outTime: '02:40 PM', hours: '8.2 hrs', ot: '0.2 hrs', status: 'PRESENT' },
    { employee: 'Karan M. Patel', code: 'EMP-1003', date: '2026-10-22', shift: 'Field Sales Schedule', inTime: '09:15 AM', outTime: '06:30 PM', hours: '8.5 hrs', ot: '0.0 hrs', status: 'FIELD_WORK' },
    { employee: 'Suresh B. Rao', code: 'EMP-1004', date: '2026-10-22', shift: 'General (09:00 - 18:00)', inTime: '09:22 AM', outTime: '06:00 PM', hours: '7.8 hrs', ot: '0.0 hrs', status: 'LATE' },
  ]);

  // Leave Requests
  const [leaveRequests] = useState([
    { reqNumber: 'LEV-202610-001', employee: 'Suresh B. Rao', type: 'CASUAL_LEAVE', dates: '2026-10-25 to 2026-10-26 (2 days)', reason: 'Family Function in native town', status: 'PENDING_MANAGER' },
    { reqNumber: 'LEV-202610-002', employee: 'Neha K. Deshmukh', type: 'EARNED_LEAVE', dates: '2026-11-02 to 2026-11-05 (4 days)', reason: 'Pre-planned travel', status: 'APPROVED' },
  ]);

  // Certifications
  const [certifications] = useState([
    { employee: 'Rajesh V. Sharma', cert: 'OLED / QLED Advanced Panel Micro-Soldering', authority: 'Bureau of Electronics Standards', expiry: '2027-04-12', status: 'VERIFIED' },
    { employee: 'Anjali P. Nair', cert: 'IPC-A-610 Class 3 Electronics Assembly', authority: 'IPC International', expiry: '2026-11-15', status: 'VERIFIED' },
    { employee: 'Ramesh K. Yadav', cert: 'Factory High Voltage Safety & Hi-Pot Testing', authority: 'National Safety Council', expiry: '2026-10-18', status: 'EXPIRED' },
  ]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Users size={24} style={{ color: '#10b981' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              People, HR & Workforce Management
            </h1>
            <span className="badge badge-primary" style={{ background: '#10b981', color: '#fff', fontSize: '11px' }}>
              PHASE 17
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Unified Workforce Engine: Organization, Attendance, Shifts, Leave, Performance KPIs, Certifications & Capacity
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('attendance')}>
            <Clock size={14} style={{ marginRight: '6px' }} /> Daily Attendance
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('employees')}>
            <UserCheck size={14} style={{ marginRight: '6px' }} /> Employee Directory
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
          { id: 'overview', label: 'Workforce Overview', icon: Layers },
          { id: 'employees', label: 'Employee Master', icon: Users },
          { id: 'attendance', label: 'Attendance & Shifts', icon: Clock },
          { id: 'leave', label: 'Leave Management', icon: Calendar },
          { id: 'performance', label: 'Performance & KPIs', icon: TrendingUp },
          { id: 'certifications', label: 'Skills & Certifications', icon: Award },
          { id: 'documents', label: 'Employee Documents', icon: FileText },
          { id: 'exceptions', label: 'Workforce Exceptions', icon: AlertTriangle },
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
                cursor: 'pointer',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} style={{ color: '#10b981' }} />
              Departmental Headcount & Distribution
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Manufacturing & Plant Operations</span>
                <strong style={{ color: 'var(--text-primary)' }}>58 staff (39.2%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Field Service & Warranty Engineering</span>
                <strong style={{ color: 'var(--text-primary)' }}>34 staff (23.0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Supply Chain & Warehouse Logistics</span>
                <strong style={{ color: 'var(--text-primary)' }}>26 staff (17.6%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Commercial Sales & Dealer Distribution</span>
                <strong style={{ color: 'var(--text-primary)' }}>18 staff (12.2%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Finance, HR & Executive Administration</span>
                <strong style={{ color: 'var(--text-primary)' }}>12 staff (8.0%)</strong>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: '#3b82f6' }} />
              Workforce Productivity & Capacity Highlights
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Technician First-Visit Resolution (FVR)</span>
                <strong style={{ color: '#10b981' }}>91.4% (Target: &gt; 88%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Factory MES Assembly Output Adherence</span>
                <strong style={{ color: '#10b981' }}>98.2% (Yield: 98.0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Average Monthly Overtime Per Worker</span>
                <strong style={{ color: 'var(--text-primary)' }}>6.2 hrs / month</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Mandatory Certification Compliance</span>
                <strong style={{ color: '#f59e0b' }}>97.3% (2 Action Items)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EMPLOYEES */}
      {activeTab === 'employees' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Active Employee Directory</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search by code, name, designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
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
                  <th style={{ padding: '10px 8px' }}>Code</th>
                  <th style={{ padding: '10px 8px' }}>Employee Name</th>
                  <th style={{ padding: '10px 8px' }}>Department</th>
                  <th style={{ padding: '10px 8px' }}>Designation</th>
                  <th style={{ padding: '10px 8px' }}>Territory / Hub</th>
                  <th style={{ padding: '10px 8px' }}>Band</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.code} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{emp.code}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{emp.name}</td>
                    <td style={{ padding: '10px 8px' }}>{emp.department}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{emp.designation}</td>
                    <td style={{ padding: '10px 8px' }}>{emp.territory}</td>
                    <td style={{ padding: '10px 8px', fontSize: '11px' }}>{emp.grade}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '11px', background: emp.status === 'CONFIRMED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: emp.status === 'CONFIRMED' ? '#10b981' : '#f59e0b' }}>
                        {emp.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#10b981', fontWeight: 600 }}>{emp.attendanceRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#3b82f6' }} />
            Daily Shift Attendance & Working Hours Ledger
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Employee</th>
                  <th style={{ padding: '10px 8px' }}>Date</th>
                  <th style={{ padding: '10px 8px' }}>Shift Schedule</th>
                  <th style={{ padding: '10px 8px' }}>Check In</th>
                  <th style={{ padding: '10px 8px' }}>Check Out</th>
                  <th style={{ padding: '10px 8px' }}>Hours</th>
                  <th style={{ padding: '10px 8px' }}>OT</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map((att, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{att.employee} ({att.code})</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{att.date}</td>
                    <td style={{ padding: '10px 8px' }}>{att.shift}</td>
                    <td style={{ padding: '10px 8px' }}>{att.inTime}</td>
                    <td style={{ padding: '10px 8px' }}>{att.outTime}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{att.hours}</td>
                    <td style={{ padding: '10px 8px', color: '#8b5cf6' }}>{att.ot}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge" style={{ fontSize: '11px', background: att.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : att.status === 'FIELD_WORK' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)', color: att.status === 'PRESENT' ? '#10b981' : att.status === 'FIELD_WORK' ? '#3b82f6' : '#ef4444' }}>
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LEAVE */}
      {activeTab === 'leave' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: '#8b5cf6' }} />
            Enterprise Leave Applications & Entitlement Control
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Request ID</th>
                  <th style={{ padding: '10px 8px' }}>Employee</th>
                  <th style={{ padding: '10px 8px' }}>Leave Type</th>
                  <th style={{ padding: '10px 8px' }}>Requested Dates</th>
                  <th style={{ padding: '10px 8px' }}>Reason</th>
                  <th style={{ padding: '10px 8px' }}>Approval Status</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((req) => (
                  <tr key={req.reqNumber} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{req.reqNumber}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{req.employee}</td>
                    <td style={{ padding: '10px 8px' }}>{req.type}</td>
                    <td style={{ padding: '10px 8px' }}>{req.dates}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{req.reason}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge" style={{ fontSize: '11px', background: req.status === 'APPROVED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: req.status === 'APPROVED' ? '#10b981' : '#f59e0b' }}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. CERTIFICATIONS */}
      {activeTab === 'certifications' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: '#f59e0b' }} />
            Workforce Technical Certifications & Expiry Audits
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Employee</th>
                  <th style={{ padding: '10px 8px' }}>Certification Title</th>
                  <th style={{ padding: '10px 8px' }}>Accredited Body</th>
                  <th style={{ padding: '10px 8px' }}>Expiry Date</th>
                  <th style={{ padding: '10px 8px' }}>Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {certifications.map((cert, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{cert.employee}</td>
                    <td style={{ padding: '10px 8px' }}>{cert.cert}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{cert.authority}</td>
                    <td style={{ padding: '10px 8px', color: cert.status === 'EXPIRED' ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>{cert.expiry}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge" style={{ fontSize: '11px', background: cert.status === 'VERIFIED' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: cert.status === 'VERIFIED' ? '#10b981' : '#ef4444' }}>
                        {cert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. EXCEPTIONS */}
      {activeTab === 'exceptions' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            Workforce Operational Exceptions & Readiness Alerts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ color: '#ef4444' }}>EXP-CERT-20261022-0941: Mandatory Safety Certification Expired</strong>
                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '11px' }}>HIGH SEVERITY</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Employee: <strong>Ramesh K. Yadav (Manufacturing Plant 1)</strong> • Certification: <strong>High Voltage Safety & Hi-Pot Testing</strong> expired on 2026-10-18. Station dispatch blocked until recertification audit completed.
              </div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ color: '#f59e0b' }}>EXP-ATT-20261022-0104: Consecutive Late Arrival Anomaly</strong>
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '11px' }}>MEDIUM SEVERITY</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Employee: <strong>Suresh B. Rao (Warehouse Logistics)</strong> • 3 consecutive late arrivals (&gt; 20 mins) logged. Line supervisor notification dispatched.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
