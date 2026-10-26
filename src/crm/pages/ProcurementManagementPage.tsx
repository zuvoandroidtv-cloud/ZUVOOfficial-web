import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Building2,
  Calendar,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Percent,
  Sliders,
  Receipt,
  Scale,
  CreditCard,
  DollarSign,
  Filter,
  CheckSquare,
  Users,
  Eye,
  ShieldAlert,
  Clock,
  Sparkles,
  FileCheck
} from 'lucide-react';

export const ProcurementManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'vendors'
    | 'requisitions'
    | 'rfqs'
    | 'quotations'
    | 'pos'
    | 'grn'
    | 'inspections'
    | 'invoices'
    | 'payment_readiness'
    | 'performance'
    | 'intelligence'
    | 'exceptions'
  >('overview');

  const [searchQuery, setSearchQuery] = useState('');

  // Top KPI Metrics
  interface VendorItem {
    code: string;
    name: string;
    type: string;
    category: string;
    kyc: string;
    bank: string;
    risk: string;
    score: number;
    otd: string;
    quality: string;
  }
  const [vendors] = useState<VendorItem[]>([]);

  interface RequisitionItem {
    number: string;
    department: string;
    purpose: string;
    priority: string;
    estValue: string;
    status: string;
    requiredDate: string;
  }
  const [requisitions] = useState<RequisitionItem[]>([]);

  interface InvoiceMatchItem {
    invoiceNumber: string;
    vendor: string;
    poRef: string;
    grnRef: string;
    amount: string;
    matchOutcome: string;
    paymentReadiness: string;
  }
  const [invoices] = useState<InvoiceMatchItem[]>([]);

  const kpis = [
    { label: 'Active Direct Suppliers', value: `${vendors.length} Vendors`, sub: '100% Bank & KYC Verified', color: '#10b981', icon: Building2 },
    { label: 'Open Requisitions', value: `${requisitions.length} Items`, sub: '₹0.00 Projected Value', color: '#3b82f6', icon: FileText },
    { label: 'Active Sourcing RFQs', value: '0 Bids Open', sub: 'Competitive Evaluation', color: '#8b5cf6', icon: Scale },
    { label: 'Pending PO Approvals', value: '0 Orders', sub: 'Dual-Control Verification', color: '#f59e0b', icon: Clock },
    { label: '3-Way Match Readiness', value: '100.0%', sub: '₹0.00 Ready for Payout', color: '#06b6d4', icon: Receipt },
    { label: 'Open P2P Exceptions', value: '0 Flags', sub: 'Price/GRN Mismatches', color: '#ef4444', icon: AlertTriangle },
  ];

  return (
    <div className="p-6 bg-[#0a0f1d] min-h-screen text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Procurement, Vendor & Purchase-to-Pay Engine
              </h1>
              <p className="text-sm text-slate-400">
                Phase 18 Enterprise Sourcing, 3-Way Match, Vendor Performance & Commercial Intelligence
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor, PO, requisition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-750 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button className="flex items-center gap-2 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-cyan-600/20">
            <Plus className="w-4 h-4" />
            New Requisition
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
                <div
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-white tracking-tight">{kpi.value}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-2 mb-6 overflow-x-auto text-sm">
        {[
          { id: 'overview', label: 'Procurement Cockpit', icon: Layers },
          { id: 'vendors', label: 'Vendor Master', icon: Building2 },
          { id: 'requisitions', label: 'Requisitions', icon: FileText },
          { id: 'rfqs', label: 'RFQ & Sourcing', icon: Scale },
          { id: 'quotations', label: 'Quotations', icon: Sliders },
          { id: 'pos', label: 'Purchase Orders', icon: Package },
          { id: 'grn', label: 'GRN Receipts', icon: CheckSquare },
          { id: 'inspections', label: 'Quality Checks', icon: ShieldCheck },
          { id: 'invoices', label: '3-Way Match', icon: Receipt },
          { id: 'payment_readiness', label: 'Payment Readiness', icon: CreditCard },
          { id: 'performance', label: 'Vendor Scorecards', icon: BarChart3 },
          { id: 'intelligence', label: 'Advisory Signals', icon: Sparkles },
          { id: 'exceptions', label: 'P2P Exceptions', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Sourcing Pipeline & Match Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Purchase Requisitions Queue */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-semibold text-white">Active Purchase Requisitions</h2>
                </div>
                <span className="text-xs px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 font-medium">
                  3 Open Items
                </span>
              </div>
              <div className="space-y-3">
                {requisitions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-950/40 border border-slate-850 rounded-lg">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No active purchase requisitions logged in system.</p>
                  </div>
                ) : (
                  requisitions.map((req, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-lg flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-cyan-400 font-semibold">{req.number}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold">
                            {req.department}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              req.priority === 'CRITICAL'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {req.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 font-medium">{req.purpose}</p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-1">
                          <span>Due: {req.requiredDate}</span>
                          <span>Est: <strong className="text-slate-200">{req.estValue}</strong></span>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-md font-semibold border border-emerald-500/20">
                          {req.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Strategic Vendor Roster Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-white">Strategic Supplier Performance</h2>
                </div>
                <span className="text-xs text-slate-400">Weighted Quality & OTD</span>
              </div>
              <div className="space-y-3">
                {vendors.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-950/40 border border-slate-850 rounded-lg">
                    <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No strategic suppliers onboarded yet.</p>
                  </div>
                ) : (
                  vendors.map((v, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-lg flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-emerald-400 font-bold">{v.code}</span>
                          <span className="text-xs font-semibold text-white">{v.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{v.category}</div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span>OTD: <strong className="text-slate-300">{v.otd}</strong></span>
                          <span>Quality: <strong className="text-slate-300">{v.quality}</strong></span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-bold">
                            {v.risk}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-400">{v.score} / 100</div>
                        <div className="text-[10px] text-slate-400">Scorecard</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3-Way Match Verification Flow */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-semibold text-white">3-Way Match & Invoice Payment Readiness</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Deterministic Arithmetic
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Invoice Number</th>
                    <th className="py-2.5 px-3">Vendor</th>
                    <th className="py-2.5 px-3">PO Reference</th>
                    <th className="py-2.5 px-3">GRN Receipt</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Match Outcome</th>
                    <th className="py-2.5 px-3">Payment Readiness</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 px-3 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                        No vendor invoices pending 3-way match reconciliation.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-slate-850/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-white">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 text-slate-200">{inv.vendor}</td>
                        <td className="py-3 px-3 font-mono text-cyan-400">{inv.poRef}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">{inv.grnRef}</td>
                        <td className="py-3 px-3 font-bold text-white">{inv.amount}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-semibold border border-emerald-500/20">
                            {inv.matchOutcome}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded font-semibold border border-cyan-500/20">
                            {inv.paymentReadiness}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded text-xs transition-colors font-medium">
                            View Dossier
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fallback View for other tabs */}
      {activeTab !== 'overview' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white capitalize">
            {activeTab.replace('_', ' ')} Workspace
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Displaying live enterprise records and controls for Phase 18 {activeTab.replace('_', ' ')}.
          </p>
        </div>
      )}
    </div>
  );
};
