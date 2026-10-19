import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Percent,
  FileText,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Landmark,
  Scale
} from 'lucide-react';
import {
  TdsSectionMaster,
  VendorTdsProfile,
  TdsDeductionRecord,
  TdsChallanSettlement,
  TdsForm26qBatch,
  TdsForm16aCertificate
} from '../types/withholdingTax';

type TdsTab =
  | 'cockpit'
  | 'deductions'
  | 'thresholds'
  | 'challans'
  | 'form_26q'
  | 'form_16a';

export const WithholdingTaxTdsPage: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<TdsTab>('cockpit');
  const [loading, setLoading] = useState(true);

  // Data states
  const [sections, setSections] = useState<TdsSectionMaster[]>([]);
  const [deductions, setDeductions] = useState<TdsDeductionRecord[]>([]);
  const [vendorProfiles, setVendorProfiles] = useState<VendorTdsProfile[]>([]);
  const [challans, setChallans] = useState<TdsChallanSettlement[]>([]);
  const [batches, setBatches] = useState<TdsForm26qBatch[]>([]);
  const [certificates, setCertificates] = useState<TdsForm16aCertificate[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [challanBsr, setChallanBsr] = useState('');
  const [challanCin, setChallanCin] = useState('');
  const [challanSection, setChallanSection] = useState('194Q_GOODS');
  const [challanMonth, setChallanMonth] = useState('2026-10');
  const [challanAmount, setChallanAmount] = useState('0');
  const [submittingChallan, setSubmittingChallan] = useState(false);

  // Fetch all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [secRes, dedRes, profRes, chlRes, batRes, certRes] = await Promise.all([
        (supabase.from as any)('tds_sections_master').select('*').order('section_code'),
        (supabase.from as any)('tds_deduction_ledger').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase.from as any)('vendor_tds_profiles').select('*').order('created_at', { ascending: false }),
        (supabase.from as any)('tds_challan_settlements').select('*').order('challan_tender_date', { ascending: false }),
        (supabase.from as any)('tds_form_26q_batches').select('*').order('fiscal_year', { ascending: false }),
        (supabase.from as any)('tds_form_16a_certificates').select('*').order('issue_date', { ascending: false })
      ]);

      if (secRes.data) setSections(secRes.data as TdsSectionMaster[]);
      if (dedRes.data) setDeductions(dedRes.data as TdsDeductionRecord[]);
      if (profRes.data) setVendorProfiles(profRes.data as VendorTdsProfile[]);
      if (chlRes.data) setChallans(chlRes.data as TdsChallanSettlement[]);
      if (batRes.data) setBatches(batRes.data as TdsForm26qBatch[]);
      if (certRes.data) setCertificates(certRes.data as TdsForm16aCertificate[]);
    } catch (err) {
      console.error('Error loading TDS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const totalAccrued = deductions
    .filter(d => d.settlement_status === 'ACCRUED')
    .reduce((sum, d) => sum + Number(d.total_tds_deducted || 0), 0);

  const totalDeposited = challans.reduce((sum, c) => sum + Number(c.total_challan_amount || 0), 0);
  const totalDeductionsYtd = deductions.reduce((sum, d) => sum + Number(d.total_tds_deducted || 0), 0);

  // Handle Challan Submission
  const handleRecordChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingChallan(true);
    try {
      const payload = {
        bsr_code: challanBsr,
        challan_tender_date: new Date().toISOString().split('T')[0],
        challan_serial_number: challanCin,
        tax_month: challanMonth,
        section_code: challanSection,
        tax_amount: Number(challanAmount),
        interest_amount: 0,
        fee_penalty_amount: 0
      };

      const { data, error } = await (supabase.rpc as any)('fn_record_tds_challan_payment', {
        p_challan_data: payload
      });

      if (error) throw error;
      setShowChallanModal(false);
      setChallanBsr('');
      setChallanCin('');
      setChallanAmount('0');
      await loadData();
    } catch (err: any) {
      alert(`Challan Settlement Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmittingChallan(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Percent className="w-7 h-7 text-emerald-400" />
              Statutory Withholding Tax & TDS Governance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Income Tax Act
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Server-authoritative TDS/TCS calculation (194Q, 194C, 194J, 194H), ITNS-281 Challan payments, 26Q Schedules & Form 16A issuance.
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
            onClick={() => setShowChallanModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Deposit ITNS-281 Challan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">TDS Accrued (Pending Deposit)</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            ₹{totalAccrued.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">Statutory due date: 7th of subsequent month</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Deposited via ITNS-281</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            ₹{totalDeposited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">{challans.length} verified government challans</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">YTD Gross TDS Deducted</span>
            <DollarSign className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            ₹{totalDeductionsYtd.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">{deductions.length} recorded deductions</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Active Vendor Profiles</span>
            <Building2 className="w-5 h-5 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-400">{vendorProfiles.length}</div>
          <div className="mt-1 text-xs text-slate-400">PAN & Section 197 compliant</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'cockpit', label: 'TDS Cockpit', icon: Layers },
          { id: 'deductions', label: 'Deductions Ledger', icon: FileText },
          { id: 'thresholds', label: 'Vendor ₹50L Thresholds', icon: Building2 },
          { id: 'challans', label: 'ITNS-281 Challans', icon: Landmark },
          { id: 'form_26q', label: 'Form 26Q Returns', icon: Scale },
          { id: 'form_16a', label: 'Form 16A Certificates', icon: ShieldCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TdsTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
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
            <h3 className="text-lg font-semibold text-white mb-4">Statutory Sections Master</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sections.map(sec => (
                <div key={sec.id} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{sec.section_code}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                      {sec.act_section}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300 font-medium">{sec.section_title}</div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-700/50 pt-2">
                    <span>Default Rate: <strong className="text-white">{sec.default_rate_pct}%</strong></span>
                    <span>Threshold: <strong className="text-white">₹{sec.threshold_amount.toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Deductions Ledger */}
      {activeTab === 'deductions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search deduction # or party..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Deduction #</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Gross Base</th>
                  <th className="px-4 py-3">Taxable Base</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">TDS Deducted</th>
                  <th className="px-4 py-3">Net Payable</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {deductions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No statutory TDS deductions recorded yet.
                    </td>
                  </tr>
                ) : (
                  deductions.map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-medium text-white">{d.deduction_number}</td>
                      <td className="px-4 py-3">{d.source_type}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                          {d.tds_section_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">₹{d.gross_base_amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-mono">₹{d.taxable_base_amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{d.applied_rate_pct}%</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-400">₹{d.total_tds_deducted.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400">₹{d.net_payable_amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          d.settlement_status === 'DEPOSITED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {d.settlement_status}
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

      {/* Tab 3: Thresholds */}
      {activeTab === 'thresholds' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Section 194Q Vendor Turnover & Threshold Tracker</h3>
          <p className="text-sm text-slate-400 mb-6">
            Monitors cumulative turnover per vendor against the ₹50,00,000 threshold. Once crossed, subsequent purchases trigger 0.1% TDS (or 5% under Section 206AA if PAN is invalid).
          </p>

          <div className="space-y-4">
            {vendorProfiles.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No vendor profiles configured.</div>
            ) : (
              vendorProfiles.map(p => {
                const pct = Math.min(100, Math.round((p.cumulative_financial_turnover / 5000000) * 100));
                const isCrossed = p.cumulative_financial_turnover > 5000000;
                return (
                  <div key={p.id} className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="font-semibold text-white">Vendor ID: {p.vendor_id}</span>
                        <span className="ml-3 text-xs font-mono text-slate-400">PAN: {p.pan_number}</span>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        isCrossed
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {isCrossed ? 'THRESHOLD CROSSED (0.1% TDS ACTIVE)' : 'BELOW THRESHOLD (EXEMPT)'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden my-2">
                      <div
                        className={`h-full rounded-full ${isCrossed ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Cumulative: <strong>₹{p.cumulative_financial_turnover.toLocaleString('en-IN')}</strong></span>
                      <span>Threshold: <strong>₹50,00,000</strong> ({pct}%)</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 4: ITNS-281 Challans */}
      {activeTab === 'challans' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-white">Government ITNS-281 Challan Settlement Register</h3>
            <button
              onClick={() => setShowChallanModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
            >
              Record New Challan
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Challan Ref</th>
                  <th className="px-4 py-3">BSR Code</th>
                  <th className="px-4 py-3">Tender Date</th>
                  <th className="px-4 py-3">CIN Sequence</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Tax Deposited</th>
                  <th className="px-4 py-3">Allocated Rows</th>
                  <th className="px-4 py-3">GL Journal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {challans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No ITNS-281 Challan payments recorded.
                    </td>
                  </tr>
                ) : (
                  challans.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-medium text-white">{c.challan_reference_number}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400">{c.bsr_code}</td>
                      <td className="px-4 py-3">{c.challan_tender_date}</td>
                      <td className="px-4 py-3 font-mono">{c.challan_serial_number}</td>
                      <td className="px-4 py-3">{c.section_code}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white">₹{c.total_challan_amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{c.allocated_deductions_count}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.gl_journal_entry_id || 'POSTED'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Form 26Q Returns */}
      {activeTab === 'form_26q' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Quarterly Form 26Q Schedules</h3>
          <p className="text-sm text-slate-400 mb-6">
            Aggregates all deductions and validates 100% CIN coverage before statutory e-TDS filing.
          </p>

          <div className="space-y-4">
            {batches.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No quarterly 26Q schedules generated yet.</div>
            ) : (
              batches.map(b => (
                <div key={b.id} className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{b.batch_reference_number}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 font-medium">
                        {b.fiscal_year} {b.quarter}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Period: {b.period_start_date} to {b.period_end_date} | {b.total_deductions_count} Deductions
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-400">₹{b.total_tds_deposited.toLocaleString('en-IN')}</div>
                    <span className="text-xs text-slate-400">Status: {b.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Form 16A Certificates */}
      {activeTab === 'form_16a' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Form 16A TDS Certificates</h3>
          <p className="text-sm text-slate-400 mb-6">
            Digital statutory certificates issued to vendors and dealers detailing gross credits and tax deposited.
          </p>

          <div className="space-y-4">
            {certificates.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No Form 16A certificates generated yet.</div>
            ) : (
              certificates.map(c => (
                <div key={c.id} className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50 flex justify-between items-center">
                  <div>
                    <div className="font-mono font-bold text-white">{c.certificate_number}</div>
                    <div className="text-sm text-slate-300">{c.legal_name} ({c.pan_number})</div>
                    <div className="text-xs text-slate-400">{c.fiscal_year} {c.quarter}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <div className="text-sm font-bold text-white">₹{c.total_tds_deposited.toLocaleString('en-IN')}</div>
                      <div className="text-xs text-slate-400">Credited: ₹{c.total_amount_credited.toLocaleString('en-IN')}</div>
                    </div>
                    <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Challan Record Modal */}
      {showChallanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Record ITNS-281 Government Challan</h3>
            <form onSubmit={handleRecordChallan} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">7-Digit BSR Code</label>
                <input
                  type="text"
                  required
                  maxLength={7}
                  placeholder="e.g. 0510001"
                  value={challanBsr}
                  onChange={e => setChallanBsr(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Challan Serial Number (CIN)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CIN-992140"
                  value={challanCin}
                  onChange={e => setChallanCin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Tax Month</label>
                  <input
                    type="text"
                    value={challanMonth}
                    onChange={e => setChallanMonth(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Section Code</label>
                  <select
                    value={challanSection}
                    onChange={e => setChallanSection(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  >
                    <option value="194Q_GOODS">194Q Goods</option>
                    <option value="194C_COMPANY">194C Corporate</option>
                    <option value="194H_COMMISSION">194H Commission</option>
                    <option value="194J_TECH">194J Technical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Tax Deposited (₹)</label>
                <input
                  type="number"
                  required
                  value={challanAmount}
                  onChange={e => setChallanAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowChallanModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingChallan}
                  className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                >
                  {submittingChallan ? 'Recording...' : 'Record Payment & Post GL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
