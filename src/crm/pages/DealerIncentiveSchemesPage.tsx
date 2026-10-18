import React, { useState } from 'react';
import {
  Award,
  TrendingUp,
  Layers,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  BarChart3,
  ShieldAlert,
  Percent,
  PlusCircle,
  Eye,
  ShieldCheck
} from 'lucide-react';
import {
  DealerSchemeProgram,
  DealerSchemeSlab,
  DealerSchemeEnrollment,
  DealerSchemeAccrual,
  DealerSchemeSettlement
} from '../types/dealerIncentives';

export const DealerIncentiveSchemesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'programs' | 'target_tracker' | 'slabs' | 'accrual_wb' | 'settlement_wb' | 'dealer_view' | 'audit'
  >('programs');

  const [searchQuery, setSearchQuery] = useState('');
  const [, setSelectedScheme] = useState<DealerSchemeProgram | null>(null);

  // Mock initial state representing live records
  const [schemesList] = useState<DealerSchemeProgram[]>([
    {
      id: 'sch-001',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_code: 'SCH-2026-DIWALI-VOL',
      scheme_name: 'Diwali 2026 Mega Volume Rebate',
      description: 'Tiered volume-based cash rebate for Q3 festival dispatches',
      scheme_type: 'VOLUME_REBATE',
      eligibility_tier: 'ALL',
      start_date: '2026-10-01',
      end_date: '2026-11-15',
      settlement_method: 'AR_CREDIT_MEMO',
      accounting_treatment: 'ACCRUAL_MATCHING',
      status: 'ACTIVE',
      budget_allocated: 500000,
      total_accrued_liability: 378000,
      total_settled_amount: 120000,
      created_at: '2026-10-01T08:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
      created_by: 'finance-admin'
    },
    {
      id: 'sch-002',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_code: 'SCH-2026-OLED-PREMIUM',
      scheme_name: 'Q3 Premium 4K/QLED Growth Incentive',
      description: 'High-margin premium screen size quarterly target program',
      scheme_type: 'PRODUCT_MIX_INCENTIVE',
      eligibility_tier: 'TIER_1_PLATINUM',
      start_date: '2026-10-01',
      end_date: '2026-12-31',
      settlement_method: 'AR_CREDIT_MEMO',
      accounting_treatment: 'ACCRUAL_MATCHING',
      status: 'ACTIVE',
      budget_allocated: 750000,
      total_accrued_liability: 270000,
      total_settled_amount: 0,
      created_at: '2026-10-05T09:30:00Z',
      updated_at: '2026-10-18T12:00:00Z',
      created_by: 'sales-director'
    },
    {
      id: 'sch-003',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_code: 'SCH-2026-TARGET-NEXUS',
      scheme_name: 'Tier-2 Dealer Expansion Target',
      description: 'Lump-sum target achievement incentive for tier-2 dealer network',
      scheme_type: 'TARGET_INCENTIVE',
      eligibility_tier: 'TIER_2_GOLD',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      settlement_method: 'COMMERCIAL_CREDIT_NOTE',
      accounting_treatment: 'ACCRUAL_MATCHING',
      status: 'SETTLED',
      budget_allocated: 300000,
      total_accrued_liability: 180000,
      total_settled_amount: 180000,
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-10-05T14:00:00Z',
      created_by: 'finance-admin'
    }
  ]);

  const [slabsList] = useState<DealerSchemeSlab[]>([
    {
      id: 'slb-001',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-001',
      slab_sequence: 1,
      slab_name: 'Tier Bronze (50 - 99 Units)',
      min_qualifying_units: 50,
      max_qualifying_units: 99,
      min_qualifying_revenue: 1500000,
      max_qualifying_revenue: 2999999,
      rebate_percentage: 2.0,
      fixed_rebate_per_unit: 0,
      created_at: '2026-10-01T08:00:00Z'
    },
    {
      id: 'slb-002',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-001',
      slab_sequence: 2,
      slab_name: 'Tier Silver (100 - 199 Units)',
      min_qualifying_units: 100,
      max_qualifying_units: 199,
      min_qualifying_revenue: 3000000,
      max_qualifying_revenue: 5999999,
      rebate_percentage: 3.5,
      fixed_rebate_per_unit: 0,
      created_at: '2026-10-01T08:00:00Z'
    },
    {
      id: 'slb-003',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-001',
      slab_sequence: 3,
      slab_name: 'Tier Gold (200+ Units)',
      min_qualifying_units: 200,
      max_qualifying_units: null,
      min_qualifying_revenue: 6000000,
      max_qualifying_revenue: null,
      rebate_percentage: 5.0,
      fixed_rebate_per_unit: 100,
      created_at: '2026-10-01T08:00:00Z'
    }
  ]);

  const [enrollmentsList] = useState<DealerSchemeEnrollment[]>([
    {
      id: 'enr-101',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-001',
      dealer_id: 'dlr-apex-01',
      target_units: 150,
      target_revenue: 4500000,
      current_qualifying_units: 165,
      current_qualifying_revenue: 4950000,
      current_slab_id: 'slb-002',
      current_earned_rebate: 173250,
      status: 'ACHIEVED',
      enrolled_at: '2026-10-01T09:00:00Z',
      last_evaluated_at: '2026-10-18T10:00:00Z'
    },
    {
      id: 'enr-102',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-001',
      dealer_id: 'dlr-metro-02',
      target_units: 220,
      target_revenue: 6600000,
      current_qualifying_units: 210,
      current_qualifying_revenue: 6300000,
      current_slab_id: 'slb-003',
      current_earned_rebate: 330000,
      status: 'ENROLLED',
      enrolled_at: '2026-10-01T09:15:00Z',
      last_evaluated_at: '2026-10-18T10:00:00Z'
    },
    {
      id: 'enr-103',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-002',
      dealer_id: 'dlr-apex-01',
      target_units: 80,
      target_revenue: 4000000,
      current_qualifying_units: 65,
      current_qualifying_revenue: 3250000,
      current_slab_id: null,
      current_earned_rebate: 97500,
      status: 'ENROLLED',
      enrolled_at: '2026-10-05T10:00:00Z',
      last_evaluated_at: '2026-10-18T10:00:00Z'
    }
  ]);

  const [accrualsList] = useState<DealerSchemeAccrual[]>([
    {
      id: 'acc-001',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-001',
      dealer_id: 'dlr-apex-01',
      accounting_period_id: 'prd-2026-10',
      qualifying_sales_value: 4950000,
      qualifying_units: 165,
      applicable_slab_id: 'slb-002',
      accrued_amount: 173250,
      prior_accrual: 0,
      incremental_accrual: 173250,
      status: 'POSTED',
      journal_entry_id: 'gl-jn-881101',
      created_at: '2026-10-15T18:00:00Z'
    },
    {
      id: 'acc-002',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      scheme_id: 'sch-001',
      dealer_id: 'dlr-metro-02',
      accounting_period_id: 'prd-2026-10',
      qualifying_sales_value: 6300000,
      qualifying_units: 210,
      applicable_slab_id: 'slb-003',
      accrued_amount: 330000,
      prior_accrual: 150000,
      incremental_accrual: 180000,
      status: 'POSTED',
      journal_entry_id: 'gl-jn-881102',
      created_at: '2026-10-15T18:00:00Z'
    }
  ]);

  const [settlementsList] = useState<DealerSchemeSettlement[]>([
    {
      id: 'stl-001',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      settlement_number: 'SCH-STL-202610-0001',
      scheme_id: 'sch-001',
      dealer_id: 'dlr-metro-02',
      settlement_date: '2026-10-16',
      qualifying_units: 210,
      qualifying_revenue: 6300000,
      eligible_amount: 120000,
      deductions: 0,
      final_payout: 120000,
      settlement_method: 'AR_CREDIT_MEMO',
      ar_transaction_id: 'ar-tx-9901',
      statutory_credit_note_id: 'cm-202610-101',
      journal_entry_id: 'gl-jn-881199',
      approval_status: 'APPROVED',
      approved_by: 'cfo-user',
      approved_at: '2026-10-16T11:00:00Z',
      settlement_status: 'SETTLED',
      created_at: '2026-10-16T10:00:00Z',
      updated_at: '2026-10-16T11:00:00Z'
    }
  ]);

  // Calculations for KPI Cards
  const totalActiveSchemes = schemesList.filter((s) => s.status === 'ACTIVE').length;
  const totalEnrolledDealers = enrollmentsList.length;
  const totalPeriodAccrued = accrualsList.reduce((acc, curr) => acc + curr.accrued_amount, 0);
  const totalSettled = settlementsList.reduce((acc, curr) => acc + curr.final_payout, 0);
  const outstandingLiability = totalPeriodAccrued - totalSettled;

  const renderBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'ACHIEVED':
      case 'POSTED':
      case 'SETTLED':
      case 'APPROVED':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> {status}
          </span>
        );
      case 'ENROLLED':
      case 'PENDING':
      case 'DRAFT':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> {status}
          </span>
        );
      case 'SUSPENDED':
      case 'DISQUALIFIED':
      case 'CANCELLED':
      case 'REJECTED':
        return (
          <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={12} /> {status}
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="crm-page" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.2), rgba(249, 115, 22, 0.1))',
                padding: '0.6rem',
                borderRadius: '12px',
                border: '1px solid rgba(249, 115, 22, 0.3)'
              }}
            >
              <Award size={24} style={{ color: '#f97316' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Dealer Commercial Incentives & Volume Rebates
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Phase 8.11 — Volume/Revenue Rebate Slabs, Target Accruals & Statutory Trade Discount Settlement
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => alert('Recalculating dealer qualification progress against eligible sales & returns...')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <TrendingUp size={15} /> Recalculate Attainment
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => alert('Launch new Scheme Configuration Wizard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={15} /> Create Incentive Scheme
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem'
        }}
      >
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span>Active Schemes</span>
            <Award size={18} style={{ color: '#f97316' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
            {totalActiveSchemes}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {schemesList.length} total defined programs
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span>Enrolled Dealers</span>
            <Layers size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
            {totalEnrolledDealers}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
            100% verified sales qualification
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span>Current Period Accrued</span>
            <DollarSign size={18} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
            ₹{totalPeriodAccrued.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            GL Account 2150 Provisioned
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span>Settled / Credited</span>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.5rem', color: '#10b981' }}>
            ₹{totalSettled.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            AR offsets & credit notes issued
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span>Outstanding Liability</span>
            <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.5rem', color: '#f59e0b' }}>
            ₹{outstandingLiability.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Pending final finance release
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.5rem',
          overflowX: 'auto'
        }}
      >
        <button
          className={`tab-btn ${activeTab === 'programs' ? 'active' : ''}`}
          onClick={() => setActiveTab('programs')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'programs' ? 'var(--card-bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'programs' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'programs' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'programs' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Award size={16} /> Scheme Programs
        </button>

        <button
          className={`tab-btn ${activeTab === 'target_tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('target_tracker')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'target_tracker' ? 'var(--card-bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'target_tracker' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'target_tracker' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'target_tracker' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <BarChart3 size={16} /> Dealer Target Tracker
        </button>

        <button
          className={`tab-btn ${activeTab === 'slabs' ? 'active' : ''}`}
          onClick={() => setActiveTab('slabs')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'slabs' ? 'var(--card-bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'slabs' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'slabs' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'slabs' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Percent size={16} /> Volume / Revenue Slabs
        </button>

        <button
          className={`tab-btn ${activeTab === 'accrual_wb' ? 'active' : ''}`}
          onClick={() => setActiveTab('accrual_wb')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'accrual_wb' ? 'var(--card-bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'accrual_wb' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'accrual_wb' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'accrual_wb' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Calendar size={16} /> Accrual Workbench
        </button>

        <button
          className={`tab-btn ${activeTab === 'settlement_wb' ? 'active' : ''}`}
          onClick={() => setActiveTab('settlement_wb')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'settlement_wb' ? 'var(--card-bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'settlement_wb' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'settlement_wb' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'settlement_wb' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <DollarSign size={16} /> Settlement Workbench
        </button>

        <button
          className={`tab-btn ${activeTab === 'dealer_view' ? 'active' : ''}`}
          onClick={() => setActiveTab('dealer_view')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'dealer_view' ? 'var(--card-bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'dealer_view' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'dealer_view' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'dealer_view' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Eye size={16} /> Dealer Self-Service View
        </button>

        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'audit' ? 'var(--card-bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'audit' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'audit' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <ShieldCheck size={16} /> Audit History
        </button>
      </div>

      {/* TAB 1: Scheme Programs */}
      {activeTab === 'programs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
              />
              <input
                type="text"
                placeholder="Search scheme code, name, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: '100%', paddingLeft: '32px' }}
              />
            </div>
            <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={14} /> Filter
            </button>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Scheme Code & Name</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Tier Eligibility</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Effective Window</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Settlement Method</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Accrued Rebate</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Settled Amount</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schemesList.map((scheme) => (
                    <tr key={scheme.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{scheme.scheme_code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{scheme.scheme_name}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                          {scheme.scheme_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{scheme.eligibility_tier}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                        {scheme.start_date} to {scheme.end_date}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{scheme.settlement_method}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f97316' }}>
                        ₹{scheme.total_accrued_liability.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                        ₹{scheme.total_settled_amount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{renderBadge(scheme.status)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedScheme(scheme)}
                          style={{ padding: '4px 8px' }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Dealer Target Tracker */}
      {activeTab === 'target_tracker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontWeight: 600, fontSize: '0.9rem' }}>
              <ShieldCheck size={18} /> Verified Commercial Attainment Invariant
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              All unit and revenue qualifications reflect gross authoritative commercial sales minus cancelled orders, rejected consignments, and Phase 8.10 accepted commercial returns.
            </p>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Dealer Code</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Scheme</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Target Units</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Achieved Units</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Progress %</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Current Slab</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Earned Rebate</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollmentsList.map((enr) => {
                    const progress = Math.min(100, Math.round((enr.current_qualifying_units / enr.target_units) * 100));
                    return (
                      <tr key={enr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{enr.dealer_id}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{enr.scheme_id}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{enr.target_units}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>{enr.current_qualifying_units}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                            <div style={{ width: '60px', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? '#10b981' : '#f97316' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{progress}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="badge badge-neutral">{enr.current_slab_id || 'None'}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f97316' }}>
                          ₹{enr.current_earned_rebate.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>{renderBadge(enr.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Volume / Revenue Slabs */}
      {activeTab === 'slabs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Active Incentive Tier Slabs</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Enforced tier boundaries — prevents slab overlapping and invalid negative percentages.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => alert('Add tier slab to scheme')}>
                + Add Slab
              </button>
            </div>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Seq</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Slab Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Qualifying Volume Range</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Qualifying Revenue Range</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Rebate %</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Fixed Per Unit</th>
                </tr>
              </thead>
              <tbody>
                {slabsList.map((slab) => (
                  <tr key={slab.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{slab.slab_sequence}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{slab.slab_name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {slab.min_qualifying_units ?? 0} — {slab.max_qualifying_units ? `${slab.max_qualifying_units} units` : 'Above'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {slab.min_qualifying_revenue ? `₹${slab.min_qualifying_revenue.toLocaleString('en-IN')}` : 'Any'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f97316' }}>
                      {slab.rebate_percentage}%
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      ₹{slab.fixed_rebate_per_unit.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Accrual Workbench */}
      {activeTab === 'accrual_wb' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a855f7', fontWeight: 600, fontSize: '0.9rem' }}>
              <Calendar size={18} /> Phase 8.3 GL Integration & Matching Principle
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Accruals are posted via balanced double-entry journals: Debit Account 5150 (Commercial Scheme Expense) / Credit Account 2150 (Provision for Dealer Rebates). Idempotency guarantees prevent duplicate posting for the same dealer and accounting period.
            </p>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Period</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Dealer</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Scheme</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Qualifying Revenue</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Accrual</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Prior Accrual</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Incremental Posted</th>
                  <th style={{ padding: '0.75rem 1rem' }}>GL Journal</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {accrualsList.map((accrual) => (
                  <tr key={accrual.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{accrual.accounting_period_id}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{accrual.dealer_id}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{accrual.scheme_id}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      ₹{accrual.qualifying_sales_value.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      ₹{accrual.accrued_amount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      ₹{accrual.prior_accrual.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#a855f7' }}>
                      ₹{accrual.incremental_accrual.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                      <code>{accrual.journal_entry_id}</code>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{renderBadge(accrual.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Settlement Workbench */}
      {activeTab === 'settlement_wb' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>
              <CheckCircle2 size={18} /> Phase 8.2 AR Credit Offset & Dual Authorization Gate
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Rebate payouts apply automatic credit memo offsets into dealer accounts receivable or commercial credit notes. Self-approval is blocked; CFO / Finance Controller authorization is required before release.
            </p>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Settlement No</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Dealer</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Method</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Eligible</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Deductions</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Final Payout</th>
                  <th style={{ padding: '0.75rem 1rem' }}>AR Offset / CM Ref</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Approval</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {settlementsList.map((stl) => (
                  <tr key={stl.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{stl.settlement_number}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{stl.dealer_id}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="badge badge-neutral">{stl.settlement_method}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>₹{stl.eligible_amount.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      ₹{stl.deductions.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                      ₹{stl.final_payout.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                      <div>{stl.statutory_credit_note_id || 'N/A'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{stl.ar_transaction_id}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {renderBadge(stl.approval_status)}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>by {stl.approved_by}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{renderBadge(stl.settlement_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Dealer Self-Service View */}
      {activeTab === 'dealer_view' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f97316', fontWeight: 600, fontSize: '0.9rem' }}>
              <ShieldAlert size={18} /> Tenant & Dealer Row-Level Security Isolation
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              In the Dealer Portal, authenticated dealer principals are strictly isolated via Supabase RLS. Internal GL postings, finance approval notes, and competitor progress are invisible.
            </p>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Dealer Self-Service Portal Preview (dlr-apex-01)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Eligible Scheme</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.25rem' }}>Diwali 2026 Mega Volume Rebate</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target Progress</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', color: '#10b981' }}>165 / 150 Units (110%)</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current Attained Slab</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.25rem' }}>Tier Silver (3.5% Rebate)</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Earned Incentive</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', color: '#f97316' }}>₹1,73,250</div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Settlement Status: <span className="badge badge-warning">ACCRUAL POSTED — SETTLEMENT AT PERIOD CLOSE</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Audit History */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>Immutable Scheme Audit Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>SCHEME_ACCRUAL_POSTED</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>2026-10-15 18:00 UTC</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Posted incremental accrual of ₹1,73,250 for dealer <code>dlr-apex-01</code> under scheme <code>SCH-2026-DIWALI-VOL</code>. GL journal <code>gl-jn-881101</code> created.
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>SETTLEMENT_AR_OFFSET_APPLIED</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>2026-10-16 11:00 UTC</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Approved payout of ₹1,20,000 for dealer <code>dlr-metro-02</code>. Customer AR ledger offset applied via credit memo <code>cm-202610-101</code>.
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>COMMERCIAL_RETURN_ADJUSTMENT</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>2026-10-18 10:15 UTC</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Phase 8.10 accepted return RMA <code>RET-202610-1001</code> (2 units) deducted from dealer <code>dlr-apex-01</code> qualifying attainment.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
