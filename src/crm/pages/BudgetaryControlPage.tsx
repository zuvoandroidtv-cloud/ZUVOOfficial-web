import React, { useState, useEffect } from 'react';
import {
  PieChart,
  DollarSign,
  Building2,
  FileCheck2,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  TrendingDown,
  Layers,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Plus,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import {
  CostCenter,
  BudgetEnvelope,
  BudgetCommitment,
  BudgetVarianceRow,
} from '../types/budgetaryControl';

export const BudgetaryControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'cockpit' | 'cost_centers' | 'envelopes' | 'commitments' | 'variance'
  >('cockpit');

  const [loading, setLoading] = useState<boolean>(true);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [envelopes, setEnvelopes] = useState<BudgetEnvelope[]>([]);
  const [commitments, setCommitments] = useState<BudgetCommitment[]>([]);
  const [varianceRows, setVarianceRows] = useState<BudgetVarianceRow[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // KPI Metrics
  const [totalAnnualBudget, setTotalAnnualBudget] = useState<number>(0);
  const [totalCommitted, setTotalCommitted] = useState<number>(0);
  const [totalActual, setTotalActual] = useState<number>(0);
  const [availableHeadroom, setAvailableHeadroom] = useState<number>(0);
  const [utilizationPct, setUtilizationPct] = useState<number>(0);
  const [overBudgetCount, setOverBudgetCount] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Cost Centers
      const { data: ccData } = await (supabase.from as any)('cost_centers')
        .select('*')
        .order('department', { ascending: true })
        .order('code', { ascending: true });

      if (ccData) setCostCenters(ccData as CostCenter[]);

      // 2. Fetch Budget Envelopes
      const { data: envData } = await (supabase.from as any)('budget_envelopes')
        .select(`
          *,
          cost_center:cost_centers(*)
        `)
        .order('created_at', { ascending: false });

      if (envData) setEnvelopes(envData as BudgetEnvelope[]);

      // 3. Fetch Commitments
      const { data: cmtData } = await (supabase.from as any)('budget_commitments')
        .select(`
          *,
          cost_center:cost_centers(*),
          purchase_order:purchase_orders(*)
        `)
        .order('created_at', { ascending: false });

      if (cmtData) setCommitments(cmtData as BudgetCommitment[]);

      // 4. Fetch Variance Report RPC
      const { data: varData } = await (supabase.rpc as any)('fn_generate_budget_variance_report', {
        p_fiscal_year: 2026,
      });

      if (varData) {
        const rows = varData as BudgetVarianceRow[];
        setVarianceRows(rows);

        // Compute KPIs
        const bgt = rows.reduce((acc, r) => acc + Number(r.budget_allocated || 0), 0);
        const cmt = rows.reduce((acc, r) => acc + Number(r.committed_amount || 0), 0);
        const act = rows.reduce((acc, r) => acc + Number(r.actual_spent || 0), 0);
        const avail = bgt - cmt - act;
        const util = bgt > 0 ? (act / bgt) * 100 : 0;
        const overCount = rows.filter((r) => r.status === 'CRITICAL').length;

        setTotalAnnualBudget(bgt);
        setTotalCommitted(cmt);
        setTotalActual(act);
        setAvailableHeadroom(avail);
        setUtilizationPct(util);
        setOverBudgetCount(overCount);
      }
    } catch (err) {
      console.error('Error loading budgetary data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'HEALTHY':
      case 'FULLY_RELIEVED':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'WATCH':
      case 'PARTIALLY_RELIEVED':
      case 'REVISED':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'CRITICAL':
      case 'HARD_BLOCK':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'DRAFT':
      case 'OPEN':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="p-6 space-y-6 text-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <PieChart className="w-7 h-7 text-emerald-400" />
              Budgetary Control & Cost Center Accounting
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Phase 8.8 Enterprise FICO
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Departmental Cost Centers, Approved Budget Envelopes, PO Commitment Governance & Variance Tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-px">
        {[
          { id: 'cockpit', label: 'Budget Cockpit', icon: Layers },
          { id: 'cost_centers', label: 'Cost Centers Master', icon: Building2 },
          { id: 'envelopes', label: 'Budget Envelopes', icon: FileCheck2 },
          { id: 'commitments', label: 'PO Commitment Ledger', icon: Lock },
          { id: 'variance', label: 'Budget vs Actuals Matrix', icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: COCKPIT */}
      {activeTab === 'cockpit' && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Total Annual Budget
              </span>
              <span className="text-xl font-bold text-white mt-1 block">
                {formatCurrency(totalAnnualBudget)}
              </span>
              <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> FY 2026 Authorizations
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Committed Funds (POs)
              </span>
              <span className="text-xl font-bold text-amber-400 mt-1 block">
                {formatCurrency(totalCommitted)}
              </span>
              <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Encumbered on Open POs
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Actual Spend (GL)
              </span>
              <span className="text-xl font-bold text-blue-400 mt-1 block">
                {formatCurrency(totalActual)}
              </span>
              <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-blue-400" /> Settled Invoices & Entries
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Available Headroom
              </span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {formatCurrency(availableHeadroom)}
              </span>
              <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Remaining to Spend
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Budget Utilization
              </span>
              <span className="text-xl font-bold text-purple-400 mt-1 block">
                {utilizationPct.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5 text-purple-400" /> Actual / Budget
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Over-Budget Alerts
              </span>
              <span
                className={`text-xl font-bold mt-1 block ${
                  overBudgetCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {overBudgetCount}
              </span>
              <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Critical Lines (&gt;90%)
              </span>
            </div>
          </div>

          {/* Departmental Allocation Summary */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Departmental Spend & Utilization Overview
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['FACTORY', 'SERVICE', 'SALES', 'CORPORATE'].map((dept) => {
                const deptRows = varianceRows.filter((r) => r.department === dept);
                const bgt = deptRows.reduce((acc, r) => acc + Number(r.budget_allocated || 0), 0);
                const act = deptRows.reduce((acc, r) => acc + Number(r.actual_spent || 0), 0);
                const util = bgt > 0 ? (act / bgt) * 100 : 0;

                return (
                  <div key={dept} className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200 text-sm">{dept}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {deptRows.length} Centers
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Budget: {formatCurrency(bgt)}</span>
                        <span>Spend: {formatCurrency(act)}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            util > 90
                              ? 'bg-rose-500'
                              : util >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(util, 100)}%` }}
                        />
                      </div>
                      <div className="text-right text-xs font-semibold text-slate-400">
                        {util.toFixed(1)}% utilized
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COST CENTERS */}
      {activeTab === 'cost_centers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Hierarchical Cost Center Directory</h3>
            <span className="text-xs text-slate-400">Total Active: {costCenters.length}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Cost Center Name</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5">Parent Center</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {costCenters.map((cc) => (
                  <tr key={cc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-bold text-emerald-400">{cc.code}</td>
                    <td className="p-3.5 font-sans font-medium text-slate-200">{cc.name}</td>
                    <td className="p-3.5 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
                        {cc.department}
                      </span>
                    </td>
                    <td className="p-3.5 font-sans text-slate-400">{cc.description || '—'}</td>
                    <td className="p-3.5 text-slate-400">
                      {costCenters.find((p) => p.id === cc.parent_cost_center_id)?.code || 'ROOT'}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {cc.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BUDGET ENVELOPES */}
      {activeTab === 'envelopes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Fiscal Budget Envelopes</h3>
            <span className="text-xs text-slate-400">Total Envelopes: {envelopes.length}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Envelope #</th>
                  <th className="p-3.5">Fiscal Year</th>
                  <th className="p-3.5">Cost Center</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Total Budget</th>
                  <th className="p-3.5">Version</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Approved At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {envelopes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No budget envelopes recorded yet.
                    </td>
                  </tr>
                ) : (
                  envelopes.map((env) => (
                    <tr key={env.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-bold text-emerald-400">{env.envelope_number}</td>
                      <td className="p-3.5 font-sans">FY {env.fiscal_year}</td>
                      <td className="p-3.5 font-sans font-medium text-slate-200">
                        {env.cost_center?.code} — {env.cost_center?.name}
                      </td>
                      <td className="p-3.5 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {env.budget_category}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-white">
                        {formatCurrency(env.total_budget)}
                      </td>
                      <td className="p-3.5">v{env.version}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(env.status)}`}>
                          {env.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-sans">
                        {env.approved_at ? new Date(env.approved_at).toLocaleDateString() : 'Pending'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMMITMENT LEDGER */}
      {activeTab === 'commitments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Purchase Order Encumbrance Subledger</h3>
            <span className="text-xs text-slate-400">Total Open: {commitments.length}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Commitment #</th>
                  <th className="p-3.5">Cost Center</th>
                  <th className="p-3.5">GL Account</th>
                  <th className="p-3.5">Committed Amount</th>
                  <th className="p-3.5">Relieved Amount</th>
                  <th className="p-3.5">Remaining</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {commitments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No purchase order commitments active.
                    </td>
                  </tr>
                ) : (
                  commitments.map((cmt) => (
                    <tr key={cmt.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-bold text-amber-400">{cmt.commitment_number}</td>
                      <td className="p-3.5 font-sans font-medium text-slate-200">
                        {cmt.cost_center?.code}
                      </td>
                      <td className="p-3.5 text-slate-300">{cmt.gl_account_code}</td>
                      <td className="p-3.5 font-bold text-white">
                        {formatCurrency(cmt.committed_amount)}
                      </td>
                      <td className="p-3.5 text-blue-400">
                        {formatCurrency(cmt.relieved_amount)}
                      </td>
                      <td className="p-3.5 font-bold text-emerald-400">
                        {formatCurrency(cmt.remaining_commitment)}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(cmt.status)}`}>
                          {cmt.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-sans">
                        {new Date(cmt.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: VARIANCE MATRIX */}
      {activeTab === 'variance' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Budget vs Committed vs Actuals Matrix</h3>
            <span className="text-xs text-slate-400">FY 2026 Analytical Lines: {varianceRows.length}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Cost Center</th>
                  <th className="p-3.5">GL Account</th>
                  <th className="p-3.5">Allocated Budget</th>
                  <th className="p-3.5">Committed</th>
                  <th className="p-3.5">Actual Spend</th>
                  <th className="p-3.5">Headroom</th>
                  <th className="p-3.5">Utilization %</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {varianceRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No variance lines found for FY 2026.
                    </td>
                  </tr>
                ) : (
                  varianceRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-sans font-medium text-slate-200">
                        <span className="font-mono text-emerald-400 font-bold mr-1.5">
                          {r.cost_center_code}
                        </span>
                        {r.cost_center_name}
                      </td>
                      <td className="p-3.5 text-slate-300">{r.gl_account_code}</td>
                      <td className="p-3.5 font-bold text-white">
                        {formatCurrency(r.budget_allocated)}
                      </td>
                      <td className="p-3.5 text-amber-400">
                        {formatCurrency(r.committed_amount)}
                      </td>
                      <td className="p-3.5 text-blue-400">
                        {formatCurrency(r.actual_spent)}
                      </td>
                      <td
                        className={`p-3.5 font-bold ${
                          r.available_headroom < 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatCurrency(r.available_headroom)}
                      </td>
                      <td className="p-3.5 font-sans font-semibold text-slate-300">
                        {r.utilization_pct.toFixed(1)}%
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(r.status)}`}>
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
    </div>
  );
};
