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

  // Dynamic Operational KPIs
  interface EmployeeItem {
    code: string;
    name: string;
    department: string;
    designation: string;
    grade: string;
    territory: string;
    status: string;
    joiningDate: string;
    attendanceRate: string;
    fvrScore: string;
  }
  const [employees] = useState<EmployeeItem[]>([]);

  interface AttendanceItem {
    employee: string;
    code: string;
    date: string;
    shift: string;
    inTime: string;
    outTime: string;
    hours: string;
    ot: string;
    status: string;
  }
  const [attendanceRecords] = useState<AttendanceItem[]>([]);

  interface LeaveItem {
    reqNumber: string;
    employee: string;
    type: string;
    dates: string;
    reason: string;
    status: string;
  }
  const [leaveRequests] = useState<LeaveItem[]>([]);

  interface CertItem {
    employee: string;
    cert: string;
    authority: string;
    expiry: string;
    status: string;
  }
  const [certifications] = useState<CertItem[]>([]);

  const kpis = [
    { label: 'Total Headcount', value: `${employees.length} staff`, sub: '100% Active Roster', color: '#10b981', icon: Users },
    { label: 'Present Today', value: `${attendanceRecords.filter(a => a.status === 'PRESENT' || a.status === 'FIELD_WORK').length} staff`, sub: 'Daily Adherence', color: '#3b82f6', icon: UserCheck },
    { label: 'On Approved Leave', value: `${leaveRequests.filter(l => l.status === 'APPROVED').length} staff`, sub: 'Leave Approvals', color: '#8b5cf6', icon: Calendar },
    { label: 'Pending HR Approvals', value: `${leaveRequests.filter(l => l.status.startsWith('PENDING')).length} items`, sub: 'Pending Reviews', color: '#f59e0b', icon: Clock },
    { label: 'Compliance & Cert Exceptions', value: `${certifications.filter(c => c.status === 'EXPIRED').length} alerts`, sub: 'Certification Audits', color: '#ef4444', icon: AlertTriangle },
  ];

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
                <strong style={{ color: 'var(--text-primary)' }}>{employees.filter(e => e.department === 'MANUFACTURING').length} staff (0.0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Field Service & Warranty Engineering</span>
                <strong style={{ color: 'var(--text-primary)' }}>{employees.filter(e => e.department === 'SERVICE').length} staff (0.0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Supply Chain & Warehouse Logistics</span>
                <strong style={{ color: 'var(--text-primary)' }}>{employees.filter(e => e.department === 'WAREHOUSE').length} staff (0.0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Commercial Sales & Dealer Distribution</span>
                <strong style={{ color: 'var(--text-primary)' }}>{employees.filter(e => e.department === 'SALES').length} staff (0.0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Finance, HR & Executive Administration</span>
                <strong style={{ color: 'var(--text-primary)' }}>{employees.filter(e => e.department === 'HR' || e.department === 'FINANCE').length} staff (0.0%)</strong>
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
                <strong style={{ color: '#10b981' }}>0.0% (Target: &gt; 88%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Factory MES Assembly Output Adherence</span>
                <strong style={{ color: '#10b981' }}>0.0% (Yield: 0.0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Average Monthly Overtime Per Worker</span>
                <strong style={{ color: 'var(--text-primary)' }}>0.0 hrs / month</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Mandatory Certification Compliance</span>
                <strong style={{ color: '#10b981' }}>100.0% (0 Action Items)</strong>
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
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No employees registered in roster. Add employees via the HR onboarding form.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
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
                  ))
                )}
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
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No shift attendance entries recorded for today.
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((att, idx) => (
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
                  ))
                )}
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
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No active leave requests submitted.
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((req) => (
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
                  ))
                )}
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
                {certifications.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '30px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No staff certifications logged in registry.
                    </td>
                  </tr>
                ) : (
                  certifications.map((cert, idx) => (
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
                  ))
                )}
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
            {certifications.filter(c => c.status === 'EXPIRED').length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No active workforce compliance exceptions or unaddressed alerts.
              </div>
            ) : (
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ color: '#ef4444' }}>EXP-CERT: Mandatory Safety Certification Expired</strong>
                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '11px' }}>HIGH SEVERITY</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Certifications requiring immediate recertification audit detected in employee records.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
