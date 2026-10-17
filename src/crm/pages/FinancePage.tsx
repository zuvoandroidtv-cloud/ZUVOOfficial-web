import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Scale,
  FileText,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Lock,
  ArrowRight,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  Percent,
  Plus
} from 'lucide-react';
import type {
  ChartOfAccount,
  AccountingPeriod,
  JournalEntry,
  TrialBalanceResult,
  ProfitAndLossResult,
  BalanceSheetResult,
  GstReconciliationResult
} from '../types/finance';

export const FinancePage: React.FC = () => {
  const { currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'coa' | 'journal' | 'trial_balance' | 'statements' | 'periods'>('trial_balance');

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Statements
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(null);
  const [statementType, setStatementType] = useState<'PROFIT_AND_LOSS' | 'BALANCE_SHEET' | 'GST_RECONCILIATION'>('PROFIT_AND_LOSS');
  const [pnlData, setPnlData] = useState<ProfitAndLossResult | null>(null);
  const [bsData, setBsData] = useState<BalanceSheetResult | null>(null);
  const [gstData, setGstData] = useState<GstReconciliationResult | null>(null);

  // Date filters for statements
  const [statementStartDate, setStatementStartDate] = useState('2026-10-01');
  const [statementEndDate, setStatementEndDate] = useState('2026-10-31');

  // Search filter
  const [coaSearch, setCoaSearch] = useState('');
  const [jeSearch, setJeSearch] = useState('');

  // Period close modal
  const [closeNotes, setCloseNotes] = useState('');
  const [closingPeriod, setClosingPeriod] = useState<AccountingPeriod | null>(null);

  const isFinanceOrAdmin = ['super_admin', 'admin', 'finance'].includes(currentRole);

  useEffect(() => {
    loadAccountingPeriods();
    loadChartOfAccounts();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      if (activeTab === 'trial_balance') {
        loadTrialBalance(selectedPeriodId);
      } else if (activeTab === 'journal') {
        loadJournalEntries(selectedPeriodId);
      }
    }
  }, [selectedPeriodId, activeTab]);

  useEffect(() => {
    if (activeTab === 'statements') {
      loadFinancialStatement();
    }
  }, [activeTab, statementType, statementStartDate, statementEndDate]);

  const loadAccountingPeriods = async () => {
    try {
      const { data, error } = await (supabase.from as any)('accounting_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
      if (data && data.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load accounting periods:', err);
    }
  };

  const loadChartOfAccounts = async () => {
    try {
      const { data, error } = await (supabase.from as any)('chart_of_accounts')
        .select('*')
        .order('account_number', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err: any) {
      console.error('Failed to load Chart of Accounts:', err);
    }
  };

  const loadJournalEntries = async (periodId?: string) => {
    setIsLoading(true);
    try {
      let query = (supabase.from as any)('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            id,
            line_number,
            account_id,
            debit_amount,
            credit_amount,
            description,
            account:chart_of_accounts(account_number, account_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (periodId) {
        query = query.eq('accounting_period_id', periodId);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      setJournalEntries(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load journal entries');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrialBalance = async (periodId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_generate_trial_balance', {
        p_period_id: periodId
      });
      if (error) throw error;
      setTrialBalance(data as any);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate trial balance');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFinancialStatement = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_generate_financial_statement', {
        p_statement_type: statementType,
        p_start_date: statementStartDate,
        p_end_date: statementEndDate
      });

      if (error) throw error;

      if (statementType === 'PROFIT_AND_LOSS') {
        setPnlData(data as any);
      } else if (statementType === 'BALANCE_SHEET') {
        setBsData(data as any);
      } else if (statementType === 'GST_RECONCILIATION') {
        setGstData(data as any);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate financial statement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePeriod = async (periodId: string) => {
    if (!window.confirm('Are you sure you want to lock this accounting period? Once locked, no new postings or modifications are permitted.')) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_close_accounting_period', {
        p_period_id: periodId,
        p_notes: closeNotes || 'Closed via Finance Management Workbench'
      });

      if (error) throw error;
      setSuccessMsg((data as any)?.message || 'Period closed successfully');
      setClosingPeriod(null);
      setCloseNotes('');
      await loadAccountingPeriods();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to close accounting period');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCoa = accounts.filter(acc =>
    acc.account_number.toLowerCase().includes(coaSearch.toLowerCase()) ||
    acc.account_name.toLowerCase().includes(coaSearch.toLowerCase()) ||
    acc.account_type.toLowerCase().includes(coaSearch.toLowerCase())
  );

  const filteredJe = journalEntries.filter(je =>
    je.entry_number.toLowerCase().includes(jeSearch.toLowerCase()) ||
    je.narration.toLowerCase().includes(jeSearch.toLowerCase()) ||
    je.source_document_type.toLowerCase().includes(jeSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Scale size={28} style={{ color: 'var(--brand-primary)' }} />
            Enterprise General Ledger & Finance
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.875rem' }}>
            Double-Entry Accounting Core, Statutory Chart of Accounts (Ind AS) & Financial Statements
          </p>
        </div>

        {/* Global Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Accounting Period:</label>
          <select
            className="input-select"
            style={{ minWidth: '160px', padding: '6px 12px', fontSize: '0.875rem' }}
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {p.period_name} ({p.status})
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (activeTab === 'trial_balance' && selectedPeriodId) loadTrialBalance(selectedPeriodId);
              if (activeTab === 'journal' && selectedPeriodId) loadJournalEntries(selectedPeriodId);
              if (activeTab === 'statements') loadFinancialStatement();
            }}
            title="Refresh Ledger"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'trial_balance' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('trial_balance')}
        >
          <Scale size={15} /> Trial Balance
        </button>
        <button
          className={`btn ${activeTab === 'statements' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('statements')}
        >
          <FileText size={15} /> Financial Statements (P&L, BS, GST)
        </button>
        <button
          className={`btn ${activeTab === 'journal' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('journal')}
        >
          <Layers size={15} /> Journal Entries Ledger
        </button>
        <button
          className={`btn ${activeTab === 'coa' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('coa')}
        >
          <BookOpen size={15} /> Chart of Accounts (COA)
        </button>
        <button
          className={`btn ${activeTab === 'periods' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('periods')}
        >
          <Calendar size={15} /> Accounting Periods & Close
        </button>
      </div>

      {/* TAB 1: TRIAL BALANCE */}
      {activeTab === 'trial_balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {trialBalance && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div className="glass-card" style={{ padding: '16px' }}>
                <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>PERIOD STATUS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span className={`badge ${trialBalance.period_status === 'OPEN' ? 'badge-success' : 'badge-slate'}`}>
                    {trialBalance.period_status}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{trialBalance.period_name}</span>
                </div>
              </div>
              <div className="glass-card" style={{ padding: '16px' }}>
                <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>TOTAL DEBITS</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: 'var(--brand-primary)' }}>
                  ₹{Number(trialBalance.total_debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="glass-card" style={{ padding: '16px' }}>
                <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>TOTAL CREDITS</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: 'var(--brand-primary)' }}>
                  ₹{Number(trialBalance.total_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="glass-card" style={{ padding: '16px' }}>
                <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>EQUILIBRIUM AUDIT</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  {trialBalance.is_balanced ? (
                    <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> BALANCED (Variance: ₹0.00)
                    </span>
                  ) : (
                    <span className="badge badge-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldAlert size={12} /> UNBALANCED (Variance: ₹{trialBalance.variance})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Code</th>
                  <th>Account Title</th>
                  <th style={{ width: '100px' }}>Type</th>
                  <th style={{ width: '80px' }}>Normal</th>
                  <th style={{ textAlign: 'right' }}>Opening (₹)</th>
                  <th style={{ textAlign: 'right' }}>Period Debit (₹)</th>
                  <th style={{ textAlign: 'right' }}>Period Credit (₹)</th>
                  <th style={{ textAlign: 'right' }}>Closing Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance?.accounts.map((acc) => {
                  const closing = acc.normal_balance === 'DEBIT' ? acc.closing_debit : acc.closing_credit;
                  return (
                    <tr key={acc.account_number}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{acc.account_number}</td>
                      <td>{acc.account_name}</td>
                      <td>
                        <span className={`badge ${
                          acc.account_type === 'ASSET' ? 'badge-primary' :
                          acc.account_type === 'LIABILITY' ? 'badge-warning' :
                          acc.account_type === 'REVENUE' ? 'badge-success' : 'badge-slate'
                        }`} style={{ fontSize: '0.65rem' }}>
                          {acc.account_type}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>{acc.normal_balance}</td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(acc.opening_debit || acc.opening_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', color: acc.period_debit > 0 ? 'var(--brand-primary)' : 'inherit' }}>
                        {Number(acc.period_debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', color: acc.period_credit > 0 ? 'var(--brand-primary)' : 'inherit' }}>
                        {Number(acc.period_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{Number(closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {trialBalance && (
                <tfoot>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', fontWeight: 800 }}>
                    <td colSpan={5} style={{ textAlign: 'right' }}>TOTALS:</td>
                    <td style={{ textAlign: 'right', color: 'var(--brand-primary)' }}>
                      ₹{Number(trialBalance.total_debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--brand-primary)' }}>
                      ₹{Number(trialBalance.total_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {trialBalance.is_balanced ? (
                        <span style={{ color: 'var(--status-success)' }}>✓ BALANCED</span>
                      ) : (
                        <span style={{ color: 'var(--status-error)' }}>⚠ VARIANCE: ₹{trialBalance.variance}</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL STATEMENTS (P&L, BS, GST) */}
      {activeTab === 'statements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Statement Controls */}
          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn ${statementType === 'PROFIT_AND_LOSS' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setStatementType('PROFIT_AND_LOSS')}
              >
                Profit & Loss (P&L)
              </button>
              <button
                className={`btn ${statementType === 'BALANCE_SHEET' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setStatementType('BALANCE_SHEET')}
              >
                Balance Sheet
              </button>
              <button
                className={`btn ${statementType === 'GST_RECONCILIATION' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setStatementType('GST_RECONCILIATION')}
              >
                GST Input/Output Reconciliation
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>From:</label>
              <input
                type="date"
                className="input-text"
                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                value={statementStartDate}
                onChange={(e) => setStatementStartDate(e.target.value)}
              />
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>To:</label>
              <input
                type="date"
                className="input-text"
                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                value={statementEndDate}
                onChange={(e) => setStatementEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Statement 1: Profit & Loss */}
          {statementType === 'PROFIT_AND_LOSS' && pnlData && (
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Statement of Profit & Loss</h2>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                  For period {pnlData.start_date} to {pnlData.end_date} (Ind AS Compliance)
                </span>
              </div>

              {/* Revenue */}
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '8px' }}>I. REVENUE</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>Television Commercial Sales Revenue</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(pnlData.revenue.television_sales_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>Other Operating Revenue</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(pnlData.revenue.other_operating_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 800, fontSize: '1rem' }}>
                  <span>TOTAL REVENUE (A)</span>
                  <span>₹{Number(pnlData.revenue.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* COGS & Gross Profit */}
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '8px' }}>II. DIRECT COSTS</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>Cost of Goods Sold (COGS Landed Basis)</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(pnlData.cost_of_goods_sold).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', fontWeight: 800, marginTop: '8px' }}>
                  <span>GROSS PROFIT (A - B)</span>
                  <span style={{ color: pnlData.gross_profit >= 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
                    ₹{Number(pnlData.gross_profit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Operating Expenses */}
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '8px' }}>III. OPERATING EXPENSES</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>Warranty & Service Claim Reimbursements</span>
                  <span>₹{Number(pnlData.operating_expenses.warranty_expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>Technician Travel & Field Service Claims</span>
                  <span>₹{Number(pnlData.operating_expenses.travel_service_expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>Authorized Bad Debt Write-Offs</span>
                  <span>₹{Number(pnlData.operating_expenses.bad_debt_expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>Other Operating Expenses & Scrap Variances</span>
                  <span>₹{Number(pnlData.operating_expenses.other_operating_expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700 }}>
                  <span>TOTAL OPERATING EXPENSES (C)</span>
                  <span>₹{Number(pnlData.operating_expenses.total_operating_expenses).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Net Profit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 800, fontSize: '1.15rem' }}>
                <span>NET PROFIT / (LOSS)</span>
                <span style={{ color: pnlData.net_profit >= 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
                  ₹{Number(pnlData.net_profit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Statement 2: Balance Sheet */}
          {statementType === 'BALANCE_SHEET' && bsData && (
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Balance Sheet</h2>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>As of {bsData.as_of_date}</span>
                </div>
                {bsData.is_balanced ? (
                  <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>✓ Assets = Liabilities + Equity</span>
                ) : (
                  <span className="badge badge-error" style={{ fontSize: '0.8rem' }}>⚠ Variance: ₹{bsData.variance}</span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Assets Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '4px' }}>
                    ASSETS
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Operating Bank Balance</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.assets.bank_operating).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Cash & Clearing Accounts</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.assets.cash_and_clearing).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Trade Accounts Receivable (AR)</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.assets.accounts_receivable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Finished Goods TV Inventory</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.assets.inventory_finished_goods).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Dealer Consignment Stock</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.assets.consignment_inventory).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>GST Input Tax Credit (ITC)</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.assets.gst_input_tax_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '6px', fontWeight: 800, marginTop: 'auto' }}>
                    <span>TOTAL ASSETS</span>
                    <span style={{ color: 'var(--brand-primary)' }}>₹{Number(bsData.assets.total_assets).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Liabilities & Equity Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--status-warning)', borderBottom: '2px solid var(--border-color)', paddingBottom: '4px' }}>
                    LIABILITIES & EQUITY
                  </h3>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>LIABILITIES</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Trade Accounts Payable (AP)</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.liabilities.accounts_payable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>GST Output Tax Liability</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.liabilities.gst_output_tax_liability).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>EQUITY</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Share Capital</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.equity.share_capital).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Retained Earnings</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.equity.retained_earnings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Current Period Net Profit</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(bsData.equity.current_period_profit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '6px', fontWeight: 800, marginTop: 'auto' }}>
                    <span>TOTAL LIABILITIES & EQUITY</span>
                    <span style={{ color: 'var(--status-warning)' }}>₹{Number(bsData.total_liabilities_and_equity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statement 3: GST Input/Output Reconciliation */}
          {statementType === 'GST_RECONCILIATION' && gstData && (
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Statutory GST Reconciliation Report</h2>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Output Tax Collected vs Input Tax Credit (ITC)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--status-error)', marginBottom: '12px' }}>
                    OUTPUT GST LIABILITY (GSTR-1)
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span>CGST Output (9%)</span>
                    <span>₹{Number(gstData.output_gst_liability.cgst_output).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span>SGST Output (9%)</span>
                    <span>₹{Number(gstData.output_gst_liability.sgst_output).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span>IGST Output (18%)</span>
                    <span>₹{Number(gstData.output_gst_liability.igst_output).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 800, marginTop: '8px' }}>
                    <span>TOTAL OUTPUT LIABILITY</span>
                    <span style={{ color: 'var(--status-error)' }}>
                      ₹{Number(gstData.output_gst_liability.total_output_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--status-success)', marginBottom: '12px' }}>
                    INPUT TAX CREDIT ITC (GSTR-2B)
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span>CGST Input ITC (9%)</span>
                    <span>₹{Number(gstData.input_gst_itc.cgst_itc).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span>SGST Input ITC (9%)</span>
                    <span>₹{Number(gstData.input_gst_itc.sgst_itc).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span>IGST Input ITC (18%)</span>
                    <span>₹{Number(gstData.input_gst_itc.igst_itc).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 800, marginTop: '8px' }}>
                    <span>TOTAL ELIGIBLE ITC</span>
                    <span style={{ color: 'var(--status-success)' }}>
                      ₹{Number(gstData.input_gst_itc.total_input_itc).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 800, fontSize: '1.15rem' }}>
                <span>NET GST PAYABLE IN CASH (3B Net Liability)</span>
                <span style={{ color: gstData.net_gst_payable > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
                  ₹{Number(gstData.net_gst_payable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: JOURNAL ENTRIES */}
      {activeTab === 'journal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search JE number, narration, source..."
                className="input-text"
                style={{ paddingLeft: '36px', width: '100%' }}
                value={jeSearch}
                onChange={(e) => setJeSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>JE Number</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '170px' }}>Source Document</th>
                  <th>Narration</th>
                  <th style={{ textAlign: 'right', width: '130px' }}>Total (₹)</th>
                  <th style={{ width: '90px' }}>Status</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredJe.map((je) => (
                  <tr key={je.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{je.entry_number}</td>
                    <td>{je.entry_date}</td>
                    <td>
                      <span className="badge badge-slate" style={{ fontSize: '0.7rem' }}>
                        {je.source_document_type}
                      </span>
                    </td>
                    <td>{je.narration}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{Number(je.total_debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                        {je.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => setSelectedEntry(je)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredJe.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No journal entries found for selected accounting period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Journal Entry Line Item Drilldown Drawer/Modal */}
          {selectedEntry && (
            <div className="modal-backdrop" onClick={() => setSelectedEntry(null)}>
              <div className="modal-card" style={{ maxWidth: '750px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Journal Entry {selectedEntry.entry_number}</h3>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Date: {selectedEntry.entry_date} | Source: {selectedEntry.source_document_type}</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEntry(null)}>Close</button>
                </div>

                <div style={{ padding: '12px 0' }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.875rem' }}><strong>Narration:</strong> {selectedEntry.narration}</p>
                  <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Debit (₹)</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntry.lines?.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{line.account?.account_name || 'Account'}</div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              #{line.account?.account_number}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>{line.description}</td>
                          <td style={{ textAlign: 'right', color: line.debit_amount > 0 ? 'var(--brand-primary)' : 'inherit', fontWeight: line.debit_amount > 0 ? 700 : 400 }}>
                            {line.debit_amount > 0 ? `₹${Number(line.debit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: line.credit_amount > 0 ? 'var(--brand-primary)' : 'inherit', fontWeight: line.credit_amount > 0 ? 700 : 400 }}>
                            {line.credit_amount > 0 ? `₹${Number(line.credit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.05)' }}>
                        <td colSpan={2} style={{ textAlign: 'right' }}>TOTALS:</td>
                        <td style={{ textAlign: 'right', color: 'var(--brand-primary)' }}>
                          ₹{Number(selectedEntry.total_debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--brand-primary)' }}>
                          ₹{Number(selectedEntry.total_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CHART OF ACCOUNTS */}
      {activeTab === 'coa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search account code, name, or group..."
                className="input-text"
                style={{ paddingLeft: '36px', width: '100%' }}
                value={coaSearch}
                onChange={(e) => setCoaSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Account Code</th>
                  <th>Account Title</th>
                  <th style={{ width: '120px' }}>Classification</th>
                  <th style={{ width: '160px' }}>Subtype</th>
                  <th style={{ width: '100px' }}>Normal Balance</th>
                  <th style={{ width: '160px' }}>System Control Role</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoa.map((acc) => (
                  <tr key={acc.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{acc.account_number}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{acc.account_name}</div>
                      {acc.description && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{acc.description}</span>}
                    </td>
                    <td>
                      <span className={`badge ${
                        acc.account_type === 'ASSET' ? 'badge-primary' :
                        acc.account_type === 'LIABILITY' ? 'badge-warning' :
                        acc.account_type === 'EQUITY' ? 'badge-slate' :
                        acc.account_type === 'REVENUE' ? 'badge-success' : 'badge-slate'
                      }`} style={{ fontSize: '0.7rem' }}>
                        {acc.account_type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{acc.account_subtype}</td>
                    <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{acc.normal_balance}</td>
                    <td>
                      {acc.system_control_type ? (
                        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                          {acc.system_control_type}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>Standard</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ACCOUNTING PERIODS & CLOSE */}
      {activeTab === 'periods' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Period Code</th>
                  <th>Fiscal Year</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Closed Date</th>
                  <th>Audit Notes</th>
                  {isFinanceOrAdmin && <th style={{ textAlign: 'center', width: '120px' }}>Governance</th>}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.period_name}</td>
                    <td>{p.fiscal_year}</td>
                    <td>{p.start_date}</td>
                    <td>{p.end_date}</td>
                    <td>
                      <span className={`badge ${p.status === 'OPEN' ? 'badge-success' : 'badge-slate'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {p.status === 'LOCKED' && <Lock size={12} />}
                        {p.status}
                      </span>
                    </td>
                    <td>{p.closed_at ? new Date(p.closed_at).toLocaleDateString() : '-'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.notes || '-'}</td>
                    {isFinanceOrAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        {p.status === 'OPEN' && (
                          <button
                            className="btn btn-warning btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => setClosingPeriod(p)}
                          >
                            <Lock size={13} /> Close Period
                          </button>
                        )}
                        {p.status === 'LOCKED' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 600 }}>Finalized</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Period Close Confirmation Modal */}
          {closingPeriod && (
            <div className="modal-backdrop" onClick={() => setClosingPeriod(null)}>
              <div className="modal-card" style={{ maxWidth: '500px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={20} style={{ color: 'var(--status-warning)' }} />
                  Lock Accounting Period {closingPeriod.period_name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Closing an accounting period locks the General Ledger from new postings and prevents back-dated modifications. 
                  An automated Trial Balance equality audit will be enforced before locking.
                </p>
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Audit / Closing Justification Notes</label>
                  <textarea
                    className="input-textarea"
                    rows={3}
                    placeholder="e.g. Month-end audit complete. Subledgers reconciled."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setClosingPeriod(null)}>Cancel</button>
                  <button
                    className="btn btn-warning btn-sm"
                    disabled={isLoading}
                    onClick={() => handleClosePeriod(closingPeriod.id)}
                  >
                    Confirm & Lock Period
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default FinancePage;
