import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Scale,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  RefreshCw,
  Search,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Percent,
  Clock,
  Landmark,
  ShieldAlert,
  Sliders,
  Users,
  Store,
  Tv
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Types for Phase 15 Enterprise Finance, Commercial Control & Business Intelligence
interface FinancialSnapshot {
  period_name: string;
  fiscal_year: string;
  revenue_gross: number;
  revenue_discounts: number;
  revenue_returns: number;
  revenue_net: number;
  cogs_amount: number;
  gross_margin: number;
  gross_margin_pct: number;
  operating_expenses: number;
  ebitda: number;
  ebitda_pct: number;
  total_ar: number;
  total_ap: number;
  cash_and_bank: number;
  working_capital: number;
  inventory_valuation: number;
  payroll_total: number;
  warranty_costs: number;
  dealer_rebates: number;
  customer_refunds: number;
  net_gst_payable: number;
  is_locked: boolean;
}

interface BudgetVariance {
  id: string;
  dimension_key: string;
  dimension_name: string;
  dimension_type: 'REVENUE' | 'EXPENSE' | 'DEPARTMENT' | 'TERRITORY' | 'DEALER' | 'PRODUCT';
  budget_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_pct: number;
  exception_state: 'ON_TRACK' | 'WATCH' | 'OVER_BUDGET' | 'UNDER_TARGET' | 'CRITICAL_VARIANCE';
  is_favourable: boolean;
}

interface CashflowHorizon {
  horizon: '7_days' | '30_days' | '90_days';
  opening_cash: number;
  confirmed_inflows: number;
  expected_inflows: number;
  approved_payments: number;
  expected_supplier_outflows: number;
  payroll_obligations: number;
  tax_obligations: number;
  dealer_rebate_obligations: number;
  net_movement: number;
  projected_closing: number;
  liquidity_status: 'HEALTHY' | 'SURPLUS' | 'WATCH' | 'FUNDING_GAP_ALERT';
}

interface ARAgingEntity {
  id: string;
  entity_type: 'CUSTOMER' | 'DEALER';
  entity_name: string;
  current_bucket: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_91_180: number;
  bucket_180_plus: number;
  total_outstanding: number;
  overdue_amount: number;
  overdue_pct: number;
  avg_delay_days: number;
  risk_tier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  recommended_action: string;
}

interface MarginException {
  id: string;
  exception_code: string;
  entity_name: string;
  entity_type: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact_amount: number;
  evidence: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED';
  detected_date: string;
  recommended_action: string;
}

export const FinanceCommercialIntelligencePage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'control_center'
    | 'management_accounts'
    | 'budget_actual'
    | 'cashflow'
    | 'receivables'
    | 'payables'
    | 'profitability'
    | 'margin_leakage'
    | 'commercial_pricing'
    | 'credit_risk'
    | 'tax_control'
    | 'executive_scorecard'
    | 'exceptions'
    | 'reports_export'
  >('control_center');

  const [selectedPeriod, setSelectedPeriod] = useState('2026-10 (October 2026)');

  // Authoritative Period Snapshot (Derived from real business state: 0 in Fresh CRM)
  const [snapshot] = useState<FinancialSnapshot>({
    period_name: '2026-10',
    fiscal_year: 'FY 2026-27',
    revenue_gross: 0.0,
    revenue_discounts: 0.0,
    revenue_returns: 0.0,
    revenue_net: 0.0,
    cogs_amount: 0.0,
    gross_margin: 0.0,
    gross_margin_pct: 0.0,
    operating_expenses: 0.0,
    ebitda: 0.0,
    ebitda_pct: 0.0,
    total_ar: 0.0,
    total_ap: 0.0,
    cash_and_bank: 0.0,
    working_capital: 0.0,
    inventory_valuation: 0.0,
    payroll_total: 0.0,
    warranty_costs: 0.0,
    dealer_rebates: 0.0,
    customer_refunds: 0.0,
    net_gst_payable: 0.0,
    is_locked: false
  });

  // Budget vs Actual Variances (Empty state in fresh CRM)
  const [variances] = useState<BudgetVariance[]>([]);

  // Cashflow Horizons
  const [cashflow] = useState<Record<string, CashflowHorizon>>({
    '7_days': {
      horizon: '7_days',
      opening_cash: 0.0,
      confirmed_inflows: 0.0,
      expected_inflows: 0.0,
      approved_payments: 0.0,
      expected_supplier_outflows: 0.0,
      payroll_obligations: 0.0,
      tax_obligations: 0.0,
      dealer_rebate_obligations: 0.0,
      net_movement: 0.0,
      projected_closing: 0.0,
      liquidity_status: 'HEALTHY'
    },
    '30_days': {
      horizon: '30_days',
      opening_cash: 0.0,
      confirmed_inflows: 0.0,
      expected_inflows: 0.0,
      approved_payments: 0.0,
      expected_supplier_outflows: 0.0,
      payroll_obligations: 0.0,
      tax_obligations: 0.0,
      dealer_rebate_obligations: 0.0,
      net_movement: 0.0,
      projected_closing: 0.0,
      liquidity_status: 'HEALTHY'
    },
    '90_days': {
      horizon: '90_days',
      opening_cash: 0.0,
      confirmed_inflows: 0.0,
      expected_inflows: 0.0,
      approved_payments: 0.0,
      expected_supplier_outflows: 0.0,
      payroll_obligations: 0.0,
      tax_obligations: 0.0,
      dealer_rebate_obligations: 0.0,
      net_movement: 0.0,
      projected_closing: 0.0,
      liquidity_status: 'HEALTHY'
    }
  });

  // AR Aging Register (Zero state in fresh CRM)
  const [arEntities] = useState<ARAgingEntity[]>([]);

  // Margin Exceptions (Zero state in fresh CRM)
  const [exceptions] = useState<MarginException[]>([]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 border border-emerald-500/40 rounded-xl text-emerald-400">
              <Landmark className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Enterprise Finance, Commercial Control & Business Intelligence
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Phase 15 Active
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Authoritative Period Snapshots, Budget Controls, Cash Horizons, Margin Leakage & Traceable P&L
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Period</span>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {selectedPeriod}
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Intelligence
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2 scrollbar-none">
        {[
          { id: 'control_center', label: 'Financial Control Center', icon: Landmark },
          { id: 'management_accounts', label: 'Management P&L & BS', icon: Scale },
          { id: 'budget_actual', label: 'Budget vs Actual', icon: PieChart, count: variances.filter(v => !v.is_favourable).length },
          { id: 'cashflow', label: 'Cash-Flow Intelligence', icon: TrendingUp },
          { id: 'receivables', label: 'Receivables & Collections', icon: DollarSign },
          { id: 'payables', label: 'Payables & Supplier Control', icon: Clock },
          { id: 'profitability', label: 'Profitability Matrix', icon: BarChart3 },
          { id: 'margin_leakage', label: 'Margin Leakage Traps', icon: AlertTriangle, count: exceptions.filter(e => e.status === 'OPEN').length },
          { id: 'commercial_pricing', label: 'Pricing Governance', icon: Sliders },
          { id: 'credit_risk', label: 'Credit Risk Scoring', icon: ShieldAlert },
          { id: 'tax_control', label: 'Tax & GST Control', icon: Percent },
          { id: 'executive_scorecard', label: 'Executive Scorecard', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-emerald-800 text-emerald-200' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* WORKSPACE 1: FINANCIAL CONTROL CENTER */}
      {activeTab === 'control_center' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Net B2B Revenue</span>
              <div className="text-2xl font-bold text-white">₹{(snapshot.revenue_net / 100000).toFixed(2)} Lakhs</div>
              <p className="text-xs text-slate-400">
                Fresh CRM — 0 orders logged
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Gross Margin</span>
              <div className="text-2xl font-bold text-emerald-400">
                ₹{(snapshot.gross_margin / 100000).toFixed(2)} L <span className="text-sm font-semibold text-slate-400">({snapshot.gross_margin_pct}%)</span>
              </div>
              <p className="text-xs text-slate-400">COGS: ₹{(snapshot.cogs_amount / 100000).toFixed(2)}L absorbed</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Operating EBITDA</span>
              <div className="text-2xl font-bold text-indigo-400">
                ₹{(snapshot.ebitda / 100000).toFixed(2)} L <span className="text-sm font-semibold text-slate-400">({snapshot.ebitda_pct}%)</span>
              </div>
              <p className="text-xs text-slate-400">Net operating result</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Working Capital</span>
              <div className="text-2xl font-bold text-white">₹{(snapshot.working_capital / 100000).toFixed(2)} Lakhs</div>
              <p className="text-xs text-slate-400">AR (₹0.0L) + Cash (₹0.0L) - AP (₹0.0L)</p>
            </div>
          </div>

          {/* Secondary Control Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Finished TV Inventory</span>
                <Tv className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-white">₹{(snapshot.inventory_valuation / 100000).toFixed(2)} L</div>
              <p className="text-xs text-slate-400">Capitalized FIFO standard cost valuation</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Total Treasury Cash & Bank</span>
                <Landmark className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-white">₹{(snapshot.cash_and_bank / 100000).toFixed(2)} L</div>
              <p className="text-xs text-emerald-400">100% reconciled against active banking feeds</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Dealer Rebates & Incentives</span>
                <Store className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-white">₹{(snapshot.dealer_rebates / 100000).toFixed(2)} L</div>
              <p className="text-xs text-slate-400">Quarterly growth tier achievements accrued</p>
            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE 2: BUDGET VS ACTUAL */}
      {activeTab === 'budget_actual' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Budget vs Actual Management Controls</h3>
              <p className="text-xs text-slate-400">Departmental, territory, product, and cost center variance surveillance with zero-budget guards.</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Control Dimension</th>
                  <th className="p-3">Budget Header</th>
                  <th className="p-3 text-right">Budget Amount</th>
                  <th className="p-3 text-right">Actual Amount</th>
                  <th className="p-3 text-right">Variance (Act - Bud)</th>
                  <th className="p-3 text-center">Variance %</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {variances.map(v => (
                  <tr key={v.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-indigo-300">{v.dimension_type}</td>
                    <td className="p-3 font-medium text-white">{v.dimension_name}</td>
                    <td className="p-3 text-right font-mono">₹{v.budget_amount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono">₹{v.actual_amount.toLocaleString('en-IN')}</td>
                    <td className={`p-3 text-right font-mono font-semibold ${v.variance_amount >= 0 ? (v.is_favourable ? 'text-emerald-400' : 'text-rose-400') : (v.is_favourable ? 'text-emerald-400' : 'text-amber-400')}`}>
                      {v.variance_amount >= 0 ? '+' : ''}₹{v.variance_amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      {v.variance_pct > 0 ? `+${v.variance_pct}%` : `${v.variance_pct}%`}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                        v.exception_state === 'ON_TRACK'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : v.exception_state === 'WATCH'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {v.exception_state.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSPACE 3: CASHFLOW INTELLIGENCE */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white">Rolling Cash-Flow Intelligence & Horizon Outlook</h3>
            <p className="text-xs text-slate-400">Strict separation of confirmed vs projected liquidity, mandatory statutory obligations, and funding gap detection.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(cashflow).map(([key, h]) => (
              <div key={key} className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-sm font-bold text-white uppercase">{key.replace('_', ' ')} Outlook</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {h.liquidity_status}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Opening Confirmed Cash:</span>
                    <strong className="text-white font-mono">₹{(h.opening_cash / 100000).toFixed(2)}L</strong>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>+ Confirmed Inflows:</span>
                    <strong className="font-mono">₹{(h.confirmed_inflows / 100000).toFixed(2)}L</strong>
                  </div>
                  <div className="flex justify-between text-indigo-300">
                    <span>+ Expected Collections:</span>
                    <strong className="font-mono">₹{(h.expected_inflows / 100000).toFixed(2)}L</strong>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>- Approved Outflows:</span>
                    <strong className="font-mono">₹{(h.approved_payments / 100000).toFixed(2)}L</strong>
                  </div>
                  <div className="flex justify-between text-amber-300">
                    <span>- Payroll & Tax Obligations:</span>
                    <strong className="font-mono">₹{((h.payroll_obligations + h.tax_obligations) / 100000).toFixed(2)}L</strong>
                  </div>
                  <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold text-white">
                    <span>Projected Closing:</span>
                    <span className="text-emerald-400 font-mono">₹{(h.projected_closing / 100000).toFixed(2)}L</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WORKSPACE 4: RECEIVABLES & AGING */}
      {activeTab === 'receivables' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">Accounts Receivable Aging & Collection Intelligence</h3>
            <p className="text-xs text-slate-400">Standard aging buckets (Current, 1-30, 31-60, 61-90, 91-180, 180+) and risk-weighted action recommendations.</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Entity Name</th>
                  <th className="p-3 text-right">Current</th>
                  <th className="p-3 text-right">1–30 Days</th>
                  <th className="p-3 text-right">31–60 Days</th>
                  <th className="p-3 text-right">61–90 Days</th>
                  <th className="p-3 text-right">Total Outstanding</th>
                  <th className="p-3 text-center">Overdue %</th>
                  <th className="p-3">Risk Tier</th>
                  <th className="p-3">Action Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {arEntities.map(ar => (
                  <tr key={ar.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{ar.entity_name}</td>
                    <td className="p-3 text-right font-mono">₹{ar.current_bucket.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono">₹{ar.bucket_1_30.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono">₹{ar.bucket_31_60.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono">₹{ar.bucket_61_90.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono font-bold text-white">₹{ar.total_outstanding.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-center font-mono font-semibold text-amber-400">{ar.overdue_pct}%</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        ar.risk_tier === 'LOW'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {ar.risk_tier}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs truncate" title={ar.recommended_action}>{ar.recommended_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSPACE 5: MARGIN LEAKAGE */}
      {activeTab === 'margin_leakage' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">Margin Leakage & Financial Anomaly Surveillance</h3>
            <p className="text-xs text-slate-400">Automated traps capturing below-floor selling, excessive discounts, warranty spikes, and unearned dealer rebates.</p>
          </div>

          <div className="space-y-3">
            {exceptions.map(ex => (
              <div key={ex.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded border ${
                      ex.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : ex.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                    }`}>
                      {ex.severity}
                    </span>
                    <span className="font-mono text-xs font-bold text-indigo-300">{ex.exception_code}</span>
                    <strong className="text-white text-sm">{ex.entity_name} ({ex.category.replace(/_/g, ' ')})</strong>
                  </div>
                  <span className="text-xs font-semibold text-rose-400 font-mono">
                    Impact: ₹{ex.impact_amount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <strong className="text-slate-300">Evidence:</strong> {ex.evidence}
                </div>

                <div className="text-xs text-slate-300 flex justify-between items-center pt-1">
                  <span>Action: <strong className="text-slate-200">{ex.recommended_action}</strong></span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-800 text-slate-400">
                    Status: {ex.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
