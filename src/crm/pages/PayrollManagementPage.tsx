import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Wallet,
  FileText,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Download,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Receipt
} from 'lucide-react';
import {
  EmployeeMaster,
  EmployeeCompensation,
  PayrollPeriod,
  PayrollRun,
  PayrollEmployeeEntry,
  EmployeeExpenseClaim,
  EmployeeAdvance,
  PayslipRecord
} from '../types/payroll';

type PayrollTab =
  | 'cockpit'
  | 'employees'
  | 'runs'
  | 'statutory'
  | 'expenses'
  | 'advances'
  | 'payslips'
  | 'audit';

export const PayrollManagementPage: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<PayrollTab>('cockpit');
  const [loading, setLoading] = useState(true);

  // Data states
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [entries, setEntries] = useState<PayrollEmployeeEntry[]>([]);
  const [claims, setClaims] = useState<EmployeeExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  // New Employee Form
  const [empFirstName, setEmpFirstName] = useState('');
  const [empLastName, setEmpLastName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empDept, setEmpDept] = useState<'MANUFACTURING' | 'WAREHOUSE' | 'SERVICE' | 'SALES' | 'FINANCE' | 'HR' | 'MANAGEMENT'>('MANUFACTURING');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empJoiningDate, setEmpJoiningDate] = useState('2026-10-01');
  const [empBasic, setEmpBasic] = useState('25000');
  const [empCtc, setEmpCtc] = useState('500000');
  const [savingEmp, setSavingEmp] = useState(false);

  // New Claim Form
  const [claimEmpId, setClaimEmpId] = useState('');
  const [claimTitle, setClaimTitle] = useState('');
  const [claimAmount, setClaimAmount] = useState('2500');
  const [claimCategory, setClaimCategory] = useState<'TRAVEL_CONVEYANCE' | 'MEALS_LODGING' | 'CLIENT_ENTERTAINMENT' | 'OFFICE_SUPPLIES' | 'TRAINING' | 'OTHER'>('TRAVEL_CONVEYANCE');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, compRes, prdRes, runRes, entRes, clmRes, advRes, slipRes] = await Promise.all([
        (supabase.from as any)('employee_master').select('*').order('created_at', { ascending: false }),
        (supabase.from as any)('employee_compensation').select('*').order('created_at', { ascending: false }),
        (supabase.from as any)('payroll_periods').select('*').order('period_start', { ascending: false }),
        (supabase.from as any)('payroll_runs').select('*').order('created_at', { ascending: false }),
        (supabase.from as any)('payroll_employee_entries').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase.from as any)('employee_expense_claims').select('*').order('created_at', { ascending: false }),
        (supabase.from as any)('employee_advances').select('*').order('created_at', { ascending: false }),
        (supabase.from as any)('payslip_records').select('*').order('generated_at', { ascending: false })
      ]);

      if (empRes.data) setEmployees(empRes.data as EmployeeMaster[]);
      if (compRes.data) setCompensations(compRes.data as EmployeeCompensation[]);
      if (prdRes.data) setPeriods(prdRes.data as PayrollPeriod[]);
      if (runRes.data) setRuns(runRes.data as PayrollRun[]);
      if (entRes.data) setEntries(entRes.data as PayrollEmployeeEntry[]);
      if (clmRes.data) setClaims(clmRes.data as EmployeeExpenseClaim[]);
      if (advRes.data) setAdvances(advRes.data as EmployeeAdvance[]);
      if (slipRes.data) setPayslips(slipRes.data as PayslipRecord[]);
    } catch (err) {
      console.error('Error loading payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;
  const latestRun = runs[0];
  const totalGrossPayroll = latestRun ? latestRun.total_gross_payroll : 0;
  const totalNetPayable = latestRun ? latestRun.total_net_payroll : 0;
  const totalEmployerCost = latestRun ? latestRun.total_employer_cost : 0;
  const pendingClaimsAmount = claims
    .filter(c => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW')
    .reduce((sum, c) => sum + Number(c.total_amount || 0), 0);

  // Handle Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmp(true);
    try {
      const { data: empData, error: empErr } = await (supabase.rpc as any)('fn_create_employee', {
        p_employee_data: {
          first_name: empFirstName,
          last_name: empLastName,
          email: empEmail,
          department: empDept,
          designation: empDesignation,
          date_of_joining: empJoiningDate,
          employment_type: 'FULL_TIME'
        }
      });
      if (empErr) throw empErr;

      // Add compensation
      await (supabase.rpc as any)('fn_create_compensation_revision', {
        p_comp_data: {
          employee_id: empData.employee_id,
          effective_from: empJoiningDate,
          basic_salary: Number(empBasic),
          hra: Math.round(Number(empBasic) * 0.4),
          special_allowance: 3000,
          other_allowances: 1000,
          annual_ctc: Number(empCtc),
          employee_pf_enabled: true,
          employer_pf_enabled: true,
          esi_enabled: Number(empBasic) <= 15000,
          professional_tax_enabled: true,
          payroll_tds_enabled: false
        }
      });

      setShowAddEmpModal(false);
      setEmpFirstName('');
      setEmpLastName('');
      setEmpEmail('');
      setEmpDesignation('');
      await loadData();
    } catch (err: any) {
      alert(`Failed to add employee: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingEmp(false);
    }
  };

  // Handle Submit Expense Claim
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClaim(true);
    try {
      const empId = claimEmpId || (employees[0] ? employees[0].id : null);
      if (!empId) throw new Error('No employee available for claim');

      const claimNumber = `EXP-202610-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await (supabase.from as any)('employee_expense_claims').insert({
        claim_number: claimNumber,
        employee_id: empId,
        expense_date: new Date().toISOString().split('T')[0],
        category: claimCategory,
        title: claimTitle,
        amount: Number(claimAmount),
        tax_amount: 0,
        total_amount: Number(claimAmount),
        status: 'SUBMITTED'
      });
      if (error) throw error;

      setShowClaimModal(false);
      setClaimTitle('');
      setClaimAmount('2500');
      await loadData();
    } catch (err: any) {
      alert(`Failed to submit claim: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Wallet className="w-7 h-7 text-indigo-400" />
              Enterprise Payroll, Expenses & HR Finance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Phase 8.13
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Server-authoritative monthly payroll processing, EPF/ESIC/PT calculations, Section 192 TDS, expense reimbursements, advances & cryptographic payslips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowClaimModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <Receipt className="w-4 h-4" />
            Submit Expense
          </button>
          <button
            onClick={() => setShowAddEmpModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Active Staff Headcount</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{activeEmployees}</div>
          <div className="mt-1 text-xs text-slate-400">Manufacturing, Service, Sales & Depots</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Total Gross Payroll</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            ₹{totalGrossPayroll.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">Latest run: {latestRun ? latestRun.run_number : 'No runs'}</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Net Take-Home Payable</span>
            <CreditCard className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            ₹{totalNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">Account 2300 (Salaries Payable)</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Pending Expense Claims</span>
            <Receipt className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            ₹{pendingClaimsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">{claims.filter(c => c.status === 'SUBMITTED').length} claims awaiting review</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'cockpit', label: 'Payroll Cockpit', icon: Layers },
          { id: 'employees', label: 'Employee Register', icon: Users },
          { id: 'runs', label: 'Payroll Runs', icon: Wallet },
          { id: 'statutory', label: 'Statutory (PF/ESI/PT)', icon: ShieldCheck },
          { id: 'expenses', label: 'Employee Expenses', icon: Receipt },
          { id: 'advances', label: 'Advances & Recovery', icon: TrendingUp },
          { id: 'payslips', label: 'Payslips & Hash', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as PayrollTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Cockpit */}
      {activeTab === 'cockpit' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Monthly Payroll & HR Finance Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <span className="text-xs text-slate-400">Total Employer Monthly Cost</span>
                <div className="text-xl font-bold text-white mt-1">₹{totalEmployerCost.toLocaleString('en-IN')}</div>
                <div className="text-xs text-slate-500 mt-2">Includes Gross + Employer EPF (12%) + Employer ESIC (3.25%)</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <span className="text-xs text-slate-400">Statutory Tax & Deductions</span>
                <div className="text-xl font-bold text-amber-400 mt-1">
                  ₹{latestRun ? (latestRun.total_employee_pf + latestRun.total_employee_esi + latestRun.total_professional_tax + latestRun.total_salary_tds).toLocaleString('en-IN') : '0'}
                </div>
                <div className="text-xs text-slate-500 mt-2">EPF, ESI, Professional Tax & Section 192 TDS</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <span className="text-xs text-slate-400">Advance Recoveries</span>
                <div className="text-xl font-bold text-indigo-400 mt-1">
                  ₹{latestRun ? latestRun.total_advance_recovery.toLocaleString('en-IN') : '0'}
                </div>
                <div className="text-xs text-slate-500 mt-2">Auto-offset against Account 1150</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employee Register */}
      {activeTab === 'employees' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee code, name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Employee Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Joining Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No employees registered. Click "Add Employee" to create one.
                    </td>
                  </tr>
                ) : (
                  employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-400">{emp.employee_code}</td>
                      <td className="px-4 py-3 font-medium text-white">{emp.full_name || `${emp.first_name} ${emp.last_name}`}</td>
                      <td className="px-4 py-3">{emp.department}</td>
                      <td className="px-4 py-3">{emp.designation}</td>
                      <td className="px-4 py-3">{emp.date_of_joining}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {emp.status}
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

      {/* Tab 3: Payroll Runs */}
      {activeTab === 'runs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-white">Monthly Payroll Processing Runs</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Run #</th>
                  <th className="px-4 py-3">Run Date</th>
                  <th className="px-4 py-3">Staff Count</th>
                  <th className="px-4 py-3">Gross Total</th>
                  <th className="px-4 py-3">Net Take-Home</th>
                  <th className="px-4 py-3">Employer Cost</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No payroll runs generated yet.
                    </td>
                  </tr>
                ) : (
                  runs.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-bold text-white">{r.run_number}</td>
                      <td className="px-4 py-3">{r.run_date}</td>
                      <td className="px-4 py-3">{r.employee_count}</td>
                      <td className="px-4 py-3 font-mono">₹{r.total_gross_payroll.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-400">₹{r.total_net_payroll.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-mono text-indigo-400">₹{r.total_employer_cost.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {r.status}
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

      {/* Tab 5: Employee Expenses */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-white">Employee Expense & Reimbursement Register</h3>
            <button
              onClick={() => setShowClaimModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
            >
              Submit New Claim
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Claim #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Title / Description</th>
                  <th className="px-4 py-3">Claim Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No expense claims submitted.
                    </td>
                  </tr>
                ) : (
                  claims.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-bold text-white">{c.claim_number}</td>
                      <td className="px-4 py-3">{c.expense_date}</td>
                      <td className="px-4 py-3">{c.category}</td>
                      <td className="px-4 py-3">{c.title}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-400">₹{c.total_amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          c.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {c.status}
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

      {/* Add Employee Modal */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Create Employee Master & Compensation</h3>
            <form onSubmit={handleAddEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">First Name</label>
                  <input
                    type="text"
                    required
                    value={empFirstName}
                    onChange={e => setEmpFirstName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Last Name</label>
                  <input
                    type="text"
                    required
                    value={empLastName}
                    onChange={e => setEmpLastName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Work Email</label>
                <input
                  type="email"
                  required
                  value={empEmail}
                  onChange={e => setEmpEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Department</label>
                  <select
                    value={empDept}
                    onChange={e => setEmpDept(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  >
                    <option value="MANUFACTURING">Manufacturing</option>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="SERVICE">Service</option>
                    <option value="SALES">Sales</option>
                    <option value="FINANCE">Finance</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Designation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Technician / Engineer"
                    value={empDesignation}
                    onChange={e => setEmpDesignation(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Basic Monthly (₹)</label>
                  <input
                    type="number"
                    required
                    value={empBasic}
                    onChange={e => setEmpBasic(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Annual CTC (₹)</label>
                  <input
                    type="number"
                    required
                    value={empCtc}
                    onChange={e => setEmpCtc(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEmp}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                >
                  {savingEmp ? 'Saving...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Submit Reimbursement Claim</h3>
            <form onSubmit={handleSubmitClaim} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Claim Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Travel to Pune Service Hub"
                  value={claimTitle}
                  onChange={e => setClaimTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Category</label>
                  <select
                    value={claimCategory}
                    onChange={e => setClaimCategory(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  >
                    <option value="TRAVEL_CONVEYANCE">Travel / Conveyance</option>
                    <option value="MEALS_LODGING">Meals & Lodging</option>
                    <option value="OFFICE_SUPPLIES">Office Supplies</option>
                    <option value="TRAINING">Training</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={claimAmount}
                    onChange={e => setClaimAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                >
                  {submittingClaim ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
