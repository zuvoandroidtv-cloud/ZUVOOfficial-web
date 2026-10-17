import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  PackageCheck,
  Calculator,
  Wrench,
  Trash2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertCircle,
  Eye,
  Filter
} from 'lucide-react';
import type {
  FixedAsset,
  FixedAssetCategory,
  AssetDepreciationSchedule,
  AssetMaintenanceLog,
  AssetDisposal,
  AssetRegisterMetrics,
  DepreciationMethod,
  MaintenanceType,
  DisposalReason
} from '../types/fixedAssets';

export const FixedAssetsPage: React.FC = () => {
  const { currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'register' | 'details' | 'workbench' | 'maintenance' | 'disposal' | 'statutory'>('register');

  // Loading & notification states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Core Data States
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [metrics, setMetrics] = useState<AssetRegisterMetrics | null>(null);

  // Accounting Periods for Depreciation Run
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [depreciationSchedules, setDepreciationSchedules] = useState<AssetDepreciationSchedule[]>([]);
  const [isDepreciating, setIsDepreciating] = useState(false);

  // Maintenance & Calibration
  const [maintenanceLogs, setMaintenanceLogs] = useState<AssetMaintenanceLog[]>([]);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [maintAssetId, setMaintAssetId] = useState('');
  const [maintType, setMaintType] = useState<MaintenanceType>('CALIBRATION');
  const [maintProvider, setMaintProvider] = useState('');
  const [maintCost, setMaintCost] = useState('0');
  const [maintDowntime, setMaintDowntime] = useState('0');
  const [maintNextDue, setMaintNextDue] = useState('');
  const [maintNotes, setMaintNotes] = useState('');

  // Capitalization Modal
  const [isCapitalizeModalOpen, setIsCapitalizeModalOpen] = useState(false);
  const [capName, setCapName] = useState('');
  const [capCategoryId, setCapCategoryId] = useState('');
  const [capCost, setCapCost] = useState('');
  const [capDirectCost, setCapDirectCost] = useState('0');
  const [capSerial, setCapSerial] = useState('');
  const [capMethod, setCapMethod] = useState<DepreciationMethod>('SLM');
  const [capLife, setCapLife] = useState('');
  const [capSalvage, setCapSalvage] = useState('');
  const [capLocation, setCapLocation] = useState('Central Assembly Plant');
  const [capCustodian, setCapCustodian] = useState('');

  // Disposal State
  const [disposalAssetId, setDisposalAssetId] = useState('');
  const [disposalProceeds, setDisposalProceeds] = useState('0');
  const [disposalReason, setDisposalReason] = useState<DisposalReason>('SCRAP');
  const [isDisposing, setIsDisposing] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCategories();
    loadPeriods();
    loadAssets();
    loadMaintenanceLogs();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      loadDepreciationSchedules(selectedPeriodId);
    }
  }, [selectedPeriodId]);

  const loadCategories = async () => {
    try {
      const { data, error } = await (supabase.from as any)('fixed_asset_categories')
        .select('*')
        .order('category_name', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
      if (data && data.length > 0 && !capCategoryId) {
        setCapCategoryId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error loading categories:', err);
    }
  };

  const loadPeriods = async () => {
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
      console.error('Error loading periods:', err);
    }
  };

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.from as any)('fixed_assets')
        .select('*, category:fixed_asset_categories(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const assetList: FixedAsset[] = data || [];
      setAssets(assetList);

      // Compute register metrics
      let totalGross = 0;
      let totalAccum = 0;
      let totalNbv = 0;
      let activeCnt = 0;
      let maintCnt = 0;
      let fullyDeprecCnt = 0;
      let disposedCnt = 0;
      let overdueCalib = 0;
      const todayStr = new Date().toISOString().split('T')[0];

      for (const a of assetList) {
        if (a.status !== 'DISPOSED') {
          totalGross += Number(a.total_capitalized_cost);
          totalAccum += Number(a.accumulated_depreciation);
          totalNbv += Number(a.current_book_value);
        }
        if (a.status === 'ACTIVE') activeCnt++;
        if (a.status === 'IN_MAINTENANCE') maintCnt++;
        if (a.status === 'FULLY_DEPRECIATED') fullyDeprecCnt++;
        if (a.status === 'DISPOSED') disposedCnt++;
        if (a.next_calibration_due_at && a.next_calibration_due_at < todayStr && a.status !== 'DISPOSED') {
          overdueCalib++;
        }
      }

      setMetrics({
        total_assets: assetList.length,
        active_assets: activeCnt,
        in_maintenance: maintCnt,
        fully_depreciated: fullyDeprecCnt,
        disposed_assets: disposedCnt,
        total_gross_block: totalGross,
        total_accumulated_depreciation: totalAccum,
        total_net_book_value: totalNbv,
        overdue_calibrations_count: overdueCalib
      });
    } catch (err: any) {
      console.error('Error loading fixed assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepreciationSchedules = async (periodId: string) => {
    try {
      const { data, error } = await (supabase.from as any)('asset_depreciation_schedules')
        .select('*')
        .eq('accounting_period_id', periodId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDepreciationSchedules(data || []);
    } catch (err: any) {
      console.error('Error loading depreciation schedules:', err);
    }
  };

  const loadMaintenanceLogs = async () => {
    try {
      const { data, error } = await (supabase.from as any)('asset_maintenance_logs')
        .select('*')
        .order('performed_at', { ascending: false });
      if (error) throw error;
      setMaintenanceLogs(data || []);
    } catch (err: any) {
      console.error('Error loading maintenance logs:', err);
    }
  };

  const handleCapitalizeAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const costNum = parseFloat(capCost);
      const directNum = parseFloat(capDirectCost || '0');
      if (isNaN(costNum) || costNum <= 0) {
        throw new Error('Please enter a valid acquisition cost.');
      }

      const { data, error } = await (supabase.rpc as any)('fn_capitalize_fixed_asset', {
        p_asset_name: capName,
        p_category_id: capCategoryId,
        p_acquisition_cost: costNum,
        p_directly_attributable_cost: directNum,
        p_serial_number: capSerial || null,
        p_salvage_value: capSalvage ? parseFloat(capSalvage) : null,
        p_useful_life_months: capLife ? parseInt(capLife, 10) : null,
        p_depreciation_method: capMethod,
        p_location_depot: capLocation,
        p_custodian: capCustodian || null
      });

      if (error) throw error;
      setSuccessMsg(`Asset capitalized successfully: ${data.asset_tag}`);
      setIsCapitalizeModalOpen(false);
      setCapName('');
      setCapCost('');
      setCapSerial('');
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Capitalization failed.');
    }
  };

  const handleExecuteDepreciationRun = async () => {
    if (!selectedPeriodId) return;
    setIsDepreciating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_run_monthly_depreciation', {
        p_period_id: selectedPeriodId
      });
      if (error) throw error;
      setSuccessMsg(`Depreciation run complete: ₹${data.total_depreciation} across ${data.assets_processed} assets.`);
      loadAssets();
      loadDepreciationSchedules(selectedPeriodId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Depreciation run failed.');
    } finally {
      setIsDepreciating(false);
    }
  };

  const handleRecordMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintAssetId) return;
    setErrorMsg(null);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_record_asset_maintenance', {
        p_asset_id: maintAssetId,
        p_maintenance_type: maintType,
        p_service_provider: maintProvider,
        p_maintenance_cost: parseFloat(maintCost || '0'),
        p_downtime_hours: parseFloat(maintDowntime || '0'),
        p_next_due_at: maintNextDue || null,
        p_notes: maintNotes || null
      });
      if (error) throw error;
      setSuccessMsg(`Maintenance record created: ${data.log_number}`);
      setIsMaintenanceModalOpen(false);
      setMaintProvider('');
      setMaintCost('0');
      setMaintNotes('');
      loadMaintenanceLogs();
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record maintenance.');
    }
  };

  const handleDisposeAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalAssetId) return;
    setIsDisposing(true);
    setErrorMsg(null);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_dispose_fixed_asset', {
        p_asset_id: disposalAssetId,
        p_proceeds: parseFloat(disposalProceeds || '0'),
        p_disposal_reason: disposalReason
      });
      if (error) throw error;
      setSuccessMsg(`Asset ${data.asset_tag} disposed: ${data.gain_loss >= 0 ? 'Gain' : 'Loss'} of ₹${Math.abs(data.gain_loss)}`);
      setDisposalAssetId('');
      setDisposalProceeds('0');
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Disposal failed.');
    } finally {
      setIsDisposing(false);
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.asset_tag.toLowerCase().includes(q) ||
      a.asset_name.toLowerCase().includes(q) ||
      (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
      a.location_depot.toLowerCase().includes(q)
    );
  });

  const selectedDisposalAsset = assets.find((a) => a.id === disposalAssetId);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <PackageCheck size={28} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                Fixed Asset Register & Depreciation
              </h1>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Phase 8.5 Ind AS 16 Capital Equipment Lifecycle, Statutory Schedules & Maintenance Workbench
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setIsCapitalizeModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> Capitalize Asset
          </button>
          <button
            onClick={() => {
              loadAssets();
              loadMaintenanceLogs();
              if (selectedPeriodId) loadDepreciationSchedules(selectedPeriodId);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '8px', color: '#22c55e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metric Cards Banner */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Gross Block (Cost)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: '#3b82f6' }}>₹{metrics.total_gross_block.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total capital acquisitions</div>
          </div>
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Accumulated Depreciation</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: '#ef4444' }}>₹{metrics.total_accumulated_depreciation.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reserve offset against block</div>
          </div>
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Net Book Value (NBV)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: '#22c55e' }}>₹{metrics.total_net_book_value.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Carrying value on Balance Sheet</div>
          </div>
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Equipment Fleet</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{metrics.active_assets} Active / {metrics.total_assets} Total</div>
            <div style={{ fontSize: '0.75rem', color: metrics.overdue_calibrations_count > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
              {metrics.overdue_calibrations_count} Overdue Calibration
            </div>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {[
          { id: 'register', label: 'Asset Register', icon: PackageCheck },
          { id: 'workbench', label: 'Depreciation Workbench', icon: Calculator },
          { id: 'maintenance', label: 'Maintenance & Calibration', icon: Wrench },
          { id: 'disposal', label: 'Asset Disposal & Retirement', icon: Trash2 },
          { id: 'statutory', label: 'Statutory Asset Register (Ind AS 16)', icon: FileSpreadsheet }
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                border: 'none',
                background: isActive ? 'var(--bg-secondary)' : 'transparent',
                borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                color: isActive ? '#3b82f6' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ASSET REGISTER */}
      {activeTab === 'register' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <input
                type="text"
                placeholder="Search tag, equipment, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Asset Tag</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Asset Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Capitalized Cost</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Accumulated Deprec</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Current NBV</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Method</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Calibration Due</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No fixed assets found. Click "Capitalize Asset" to record new capital equipment.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{a.asset_tag}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div>{a.asset_name}</div>
                        {a.serial_number && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SN: {a.serial_number}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{a.category?.category_name || a.category_id}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>₹{Number(a.total_capitalized_cost).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#ef4444' }}>₹{Number(a.accumulated_depreciation).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#22c55e' }}>₹{Number(a.current_book_value).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{a.depreciation_method}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background:
                              a.status === 'ACTIVE'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : a.status === 'IN_MAINTENANCE'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              a.status === 'ACTIVE'
                                ? '#22c55e'
                                : a.status === 'IN_MAINTENANCE'
                                ? '#f59e0b'
                                : '#ef4444'
                          }}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {a.next_calibration_due_at || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          onClick={() => {
                            setSelectedAsset(a);
                            setActiveTab('details' as any);
                          }}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ASSET DETAILS */}
      {(activeTab as any) === 'details' && selectedAsset && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Asset Details: {selectedAsset.asset_tag}</h3>
            <button
              onClick={() => setActiveTab('register')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Back to Register
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Specification & Location</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Asset Name</span>
                  <span style={{ fontWeight: 600 }}>{selectedAsset.asset_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Serial Number</span>
                  <span>{selectedAsset.serial_number || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Location / Depot</span>
                  <span>{selectedAsset.location_depot}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Assigned Custodian</span>
                  <span>{selectedAsset.custodian || 'Unassigned'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Next Calibration</span>
                  <span>{selectedAsset.next_calibration_due_at || 'None'}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Valuation & Depreciation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Capitalized Cost</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(selectedAsset.total_capitalized_cost).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Salvage Value Floor</span>
                  <span>₹{Number(selectedAsset.salvage_value).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Depreciation Method</span>
                  <span>{selectedAsset.depreciation_method}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Useful Life</span>
                  <span>{selectedAsset.useful_life_months} Months</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Accumulated Depreciation</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>₹{Number(selectedAsset.accumulated_depreciation).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>
                  <span>Current Net Book Value</span>
                  <span style={{ color: '#22c55e' }}>₹{Number(selectedAsset.current_book_value).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEPRECIATION WORKBENCH */}
      {activeTab === 'workbench' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Monthly Statutory Depreciation Workbench</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Server-authoritative Ind AS 16 depreciation run for the selected accounting period
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({p.status})
                  </option>
                ))}
              </select>

              <button
                onClick={handleExecuteDepreciationRun}
                disabled={isDepreciating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#22c55e',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Calculator size={16} className={isDepreciating ? 'animate-spin' : ''} />
                Run Period Depreciation
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Asset ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Opening Book Value</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Depreciation Amount</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Accumulated Deprec</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Closing Book Value</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Method</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Journal ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {depreciationSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No depreciation records for this period. Click "Run Period Depreciation" to execute.
                    </td>
                  </tr>
                ) : (
                  depreciationSchedules.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.asset_id}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>₹{Number(s.opening_book_value).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#ef4444', fontWeight: 600 }}>₹{Number(s.depreciation_amount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>₹{Number(s.accumulated_depreciation).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#22c55e' }}>₹{Number(s.closing_book_value).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{s.method}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.journal_entry_id || '-'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 600 }}>
                          {s.status}
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

      {/* TAB 4: MAINTENANCE & CALIBRATION */}
      {activeTab === 'maintenance' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Preventative Maintenance & Calibration Log</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Track statutory calibration schedules, repair costs, and equipment downtime
              </p>
            </div>
            <button
              onClick={() => setIsMaintenanceModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Log Maintenance / Calibration
            </button>
          </div>

          <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Log No</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Asset ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Provider</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Performed Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cost</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Downtime</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Next Due</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No maintenance or calibration logs recorded.
                    </td>
                  </tr>
                ) : (
                  maintenanceLogs.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{m.log_number}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{m.asset_id}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 600 }}>
                          {m.maintenance_type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{m.service_provider || '-'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{m.performed_at}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>₹{Number(m.maintenance_cost).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{m.downtime_hours} hrs</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#f59e0b', fontWeight: 600 }}>{m.next_due_at || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ASSET DISPOSAL */}
      {activeTab === 'disposal' && (
        <div style={{ maxWidth: '650px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Asset Derecognition & Disposal</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Authorize asset retirement, calculate net book value, and post gain/loss journal entries to GL
            </p>
          </div>

          <form onSubmit={handleDisposeAsset} style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Select Asset for Disposal</label>
              <select
                value={disposalAssetId}
                onChange={(e) => setDisposalAssetId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">-- Choose Asset --</option>
                {assets.filter(a => a.status !== 'DISPOSED').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} — {a.asset_name} (NBV: ₹{Number(a.current_book_value).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            {selectedDisposalAsset && (
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span>Gross Capitalized Cost</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(selectedDisposalAsset.total_capitalized_cost).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span>Accumulated Depreciation</span>
                  <span style={{ color: '#ef4444' }}>-₹{Number(selectedDisposalAsset.accumulated_depreciation).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Current Net Book Value (NBV)</span>
                  <span style={{ color: '#22c55e' }}>₹{Number(selectedDisposalAsset.current_book_value).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Disposal Proceeds (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={disposalProceeds}
                onChange={(e) => setDisposalProceeds(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Disposal Reason</label>
              <select
                value={disposalReason}
                onChange={(e) => setDisposalReason(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="SCRAP">Scrap / Salvage Sale</option>
                <option value="OBSOLETE">Technologically Obsolete</option>
                <option value="SOLD">Commercial Sale</option>
                <option value="DESTROYED">Damaged / Destroyed</option>
                <option value="TRADE_IN">Vendor Trade-In</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isDisposing || !disposalAssetId}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isDisposing ? 'Executing Derecognition...' : 'Authorize Asset Disposal'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: STATUTORY REGISTER REPORT (IND AS 16) */}
      {activeTab === 'statutory' && metrics && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Statutory Fixed Asset Register (Ind AS 16 / Companies Act Schedule II)</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Gross Block, Depreciation Reserve, and Net Block Schedule
            </p>
          </div>

          <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Asset Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Useful Life</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Gross Block</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Accumulated Depreciation</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Net Block (Carrying Amt)</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const catAssets = assets.filter(a => a.category_id === c.id && a.status !== 'DISPOSED');
                  const catGross = catAssets.reduce((sum, a) => sum + Number(a.total_capitalized_cost), 0);
                  const catAccum = catAssets.reduce((sum, a) => sum + Number(a.accumulated_depreciation), 0);
                  const catNet = catGross - catAccum;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.category_name}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{c.default_useful_life_months} Months ({c.default_depreciation_method})</td>
                      <td style={{ padding: '0.75rem 1rem' }}>₹{catGross.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#ef4444' }}>₹{catAccum.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#22c55e' }}>₹{catNet.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700, fontSize: '0.9rem' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>TOTAL STATUTORY PPE</td>
                  <td style={{ padding: '0.75rem 1rem' }}>-</td>
                  <td style={{ padding: '0.75rem 1rem' }}>₹{metrics.total_gross_block.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#ef4444' }}>₹{metrics.total_accumulated_depreciation.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#22c55e' }}>₹{metrics.total_net_book_value.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Capitalize Asset Modal */}
      {isCapitalizeModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', width: '500px', maxWidth: '90%', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Capitalize Fixed Asset</h3>
            <form onSubmit={handleCapitalizeAsset} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem' }}>Asset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Automated 55 inch TV Burn-In Test Rack"
                  value={capName}
                  onChange={(e) => setCapName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem' }}>Equipment Category</label>
                <select
                  value={capCategoryId}
                  onChange={(e) => setCapCategoryId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Acquisition Cost (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="150000"
                    value={capCost}
                    onChange={(e) => setCapCost(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Direct Costs (Freight/Inst)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="5000"
                    value={capDirectCost}
                    onChange={(e) => setCapDirectCost(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Serial Number</label>
                  <input
                    type="text"
                    placeholder="SN-RIG-0045"
                    value={capSerial}
                    onChange={(e) => setCapSerial(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Depreciation Method</label>
                  <select
                    value={capMethod}
                    onChange={(e) => setCapMethod(e.target.value as any)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  >
                    <option value="SLM">Straight Line (SLM)</option>
                    <option value="WDV">Written Down Value (WDV)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Useful Life (Months)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="60"
                    value={capLife}
                    onChange={(e) => setCapLife(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Salvage Floor (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Default 5%"
                    value={capSalvage}
                    onChange={(e) => setCapSalvage(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem' }}>Location / Operating Depot</label>
                <input
                  type="text"
                  value={capLocation}
                  onChange={(e) => setCapLocation(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCapitalizeModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Capitalize & Post to GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Maintenance Modal */}
      {isMaintenanceModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', width: '480px', maxWidth: '90%', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Log Maintenance / Calibration</h3>
            <form onSubmit={handleRecordMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem' }}>Asset</label>
                <select
                  value={maintAssetId}
                  onChange={(e) => setMaintAssetId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="">-- Choose Asset --</option>
                  {assets.filter(a => a.status !== 'DISPOSED').map((a) => (
                    <option key={a.id} value={a.id}>{a.asset_tag} — {a.asset_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem' }}>Activity Type</label>
                <select
                  value={maintType}
                  onChange={(e) => setMaintType(e.target.value as any)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="CALIBRATION">Optical / Electrical Calibration</option>
                  <option value="PREVENTATIVE">Preventative Maintenance</option>
                  <option value="CORRECTIVE_REPAIR">Corrective Repair</option>
                  <option value="BREAKDOWN">Breakdown Report</option>
                  <option value="ANNUAL_AUDIT">Annual Verification Audit</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem' }}>Service Vendor / Engineer</label>
                <input
                  type="text"
                  placeholder="e.g. Fluke Calibration Services India"
                  value={maintProvider}
                  onChange={(e) => setMaintProvider(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Downtime (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={maintDowntime}
                    onChange={(e) => setMaintDowntime(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem' }}>Next Calibration Due Date</label>
                <input
                  type="date"
                  value={maintNextDue}
                  onChange={(e) => setMaintNextDue(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
