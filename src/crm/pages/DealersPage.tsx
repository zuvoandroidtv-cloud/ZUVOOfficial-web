import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  FileText,
  ShieldCheck,
  AlertCircle,
  X,
  Download,
  FileSpreadsheet,
  Package,
  UserPlus,
  Wrench,
  RotateCcw,
  ArrowRightLeft,
  CheckSquare,
  DollarSign,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';

export const DealersPage: React.FC = () => {
  const { currentRole } = useAuth();
  const [dealers, setDealers] = useState<any[]>([]);
  const [dealerStats, setDealerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingDealer, setSavingDealer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  // New Dealer form state
  const [dealerCode, setDealerCode] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [dealerType, setDealerType] = useState('retailer');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [creditLimit, setCreditLimit] = useState(500000);
  const [gstNumber, setGstNumber] = useState('');

  // Modals for Stock Assignment & Dealer Users
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [unassignedUnits, setUnassignedUnits] = useState<any[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [dispatching, setDispatching] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [managingUser, setManagingUser] = useState(false);

  // Consignment Action Modals (Recall, Transfer, Settlement, Reconciliation)
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [dealerUnits, setDealerUnits] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [recallReason, setRecallReason] = useState('Stock recall request');
  const [recalling, setRecalling] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetDealerId, setTargetDealerId] = useState('');
  const [transferReason, setTransferReason] = useState('Inter-dealer stock transfer');
  const [transferring, setTransferring] = useState(false);

  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [soldConsignments, setSoldConsignments] = useState<any[]>([]);
  const [selectedCsIds, setSelectedCsIds] = useState<string[]>([]);
  const [settlementStatus, setSettlementStatus] = useState('settled');
  const [settlementRef, setSettlementRef] = useState('');
  const [updatingSettlement, setUpdatingSettlement] = useState(false);

  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [verifiedUnitIds, setVerifiedUnitIds] = useState<string[]>([]);
  const [discrepantUnitIds, setDiscrepantUnitIds] = useState<string[]>([]);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [reconciling, setReconciling] = useState(false);

  // Detailed dealer statistics for selected dealer
  const [selectedDealerPerf, setSelectedDealerPerf] = useState<any>(null);
  const [selectedDealerInv, setSelectedDealerInv] = useState<any>(null);
  const [selectedDealerWrn, setSelectedDealerWrn] = useState<any>(null);
  const [dealerCreditExposure, setDealerCreditExposure] = useState<any>(null);
  const [dealerStatements, setDealerStatements] = useState<any[]>([]);
  const [stagnantRecommendations, setStagnantRecommendations] = useState<any[]>([]);
  const [generatingStatement, setGeneratingStatement] = useState(false);
  const [evaluatingStagnant, setEvaluatingStagnant] = useState(false);

  const fetchDealers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('dealers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`dealer_name.ilike.${q},dealer_code.ilike.${q},city.ilike.${q}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: dealerData, count, error: dealerErr } = await query;
      if (dealerErr) throw dealerErr;

      const { data: summaryData } = await supabase
        .from('vw_dealer_sales_performance')
        .select('*');

      setDealers(dealerData || []);
      setTotalCount(count || 0);
      setDealerStats(summaryData || []);
    } catch (err: any) {
      console.error('Error fetching dealers:', err);
      setErrorMsg(err.message || 'Failed to fetch dealers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, [searchQuery, page, pageSize]);

  const loadDealerDetails = async (dealer: any) => {
    setSelectedDealer(dealer);
    try {
      const { data: perf } = await supabase.from('vw_dealer_sales_performance' as any).select('*').eq('dealer_id', dealer.id).maybeSingle();
      const { data: inv } = await supabase.from('vw_dealer_consignment_summary' as any).select('*').eq('dealer_id', dealer.id).maybeSingle();
      const { data: wrn } = await supabase.from('vw_dealer_warranty_summary' as any).select('*').eq('dealer_id', dealer.id).maybeSingle();

      setSelectedDealerPerf(perf);
      setSelectedDealerInv(inv);
      setSelectedDealerWrn(wrn);

      // Phase 8.1 Authoritative Credit Engine & Statements fetch
      const { data: exposure } = await (supabase.rpc as any)('fn_evaluate_dealer_credit_exposure', { p_dealer_id: dealer.id });
      setDealerCreditExposure(exposure);

      const { data: stmts } = await (supabase.from as any)('dealer_statements')
        .select('*')
        .eq('dealer_id', dealer.id)
        .order('period_end', { ascending: false })
        .limit(10);
      setDealerStatements(stmts || []);

      const { data: recs } = await (supabase.from as any)('dealer_recall_recommendations')
        .select('*, product_units(barcode, serial_number)')
        .eq('dealer_id', dealer.id)
        .order('age_days', { ascending: false });
      setStagnantRecommendations(recs || []);
    } catch (err) {
      console.error('Error fetching dealer detail metrics:', err);
    }
  };

  const handleGenerateStatement = async () => {
    if (!selectedDealer) return;
    setGeneratingStatement(true);
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

      const { data, error }: any = await (supabase.rpc as any)('fn_generate_dealer_statement', {
        p_dealer_id: selectedDealer.id,
        p_period_start: startOfMonth,
        p_period_end: endOfMonth,
        p_statement_type: 'MONTHLY'
      });
      if (error) throw error;
      alert(`Statement ${data?.statement_number || ''} generated successfully.`);
      loadDealerDetails(selectedDealer);
    } catch (err: any) {
      alert(`Statement generation failed: ${err.message}`);
    } finally {
      setGeneratingStatement(false);
    }
  };

  const handleRunStagnantCheck = async () => {
    if (!selectedDealer) return;
    setEvaluatingStagnant(true);
    try {
      const { data, error }: any = await (supabase.rpc as any)('fn_evaluate_stagnant_consignment_stock');
      if (error) throw error;
      alert(`Evaluated stagnant stock: ${data?.evaluated_count || 0} unit(s) flagged.`);
      loadDealerDetails(selectedDealer);
    } catch (err: any) {
      alert(`Stagnant stock evaluation failed: ${err.message}`);
    } finally {
      setEvaluatingStagnant(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      let query = supabase.from('dealers').select('*').order('created_at', { ascending: false });
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`dealer_name.ilike.${q},dealer_code.ilike.${q},city.ilike.${q}`);
      }
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []).map((d: any) => {
        const metrics = dealerStats.find((s) => s.dealer_id === d.id) || {};
        return {
          dealer_code: d.dealer_code,
          dealer_name: d.dealer_name,
          dealer_type: d.dealer_type,
          contact_person: d.contact_person || '',
          phone: d.phone || '',
          email: d.email || '',
          city: d.city || '',
          state: d.state || '',
          credit_limit: d.credit_limit || 0,
          gst_number: d.gst_number || '',
          total_sales_value: metrics.total_sales_amount || 0,
          total_units_sold: metrics.total_units_sold || 0,
          is_active: d.is_active ? 'Active' : 'Inactive'
        };
      });

      const headers = [
        { key: 'dealer_code', label: 'Dealer Code' },
        { key: 'dealer_name', label: 'Dealer Name' },
        { key: 'dealer_type', label: 'Type' },
        { key: 'contact_person', label: 'Contact Person' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'credit_limit', label: 'Credit Limit (INR)' },
        { key: 'gst_number', label: 'GSTIN' },
        { key: 'total_sales_value', label: 'Sales Volume (INR)' },
        { key: 'total_units_sold', label: 'Units Sold' },
        { key: 'is_active', label: 'Status' }
      ];

      const filename = `zuvo_dealers_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        exportToCSV(rows, headers, filename);
      } else {
        await exportToExcel(rows, headers, filename, 'Dealers');
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCreateDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealerName.trim()) {
      alert('Dealer Name is required');
      return;
    }

    setSavingDealer(true);
    try {
      const genCode = dealerCode.trim() || `DLR-${Date.now().toString().slice(-5)}`;
      const { error } = await supabase
        .from('dealers')
        .insert({
          dealer_code: genCode,
          dealer_name: dealerName.trim(),
          dealer_type: dealerType,
          contact_person: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          pincode: pincode.trim() || null,
          credit_limit: Number(creditLimit) || 0,
          gst_number: gstNumber.trim() || null,
          is_active: true
        });

      if (error) throw error;

      setShowAddModal(false);
      setDealerCode('');
      setDealerName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setCity('');
      setState('');
      setPincode('');
      setGstNumber('');
      fetchDealers();
    } catch (err: any) {
      alert(`Failed to add dealer: ${err.message}`);
    } finally {
      setSavingDealer(false);
    }
  };

  // Dispatch Stock to Dealer Modal
  const handleOpenDispatchModal = async () => {
    if (!selectedDealer) return;
    try {
      const { data } = await supabase
        .from('product_units')
        .select('*, product_variants(product_name, screen_size)')
        .eq('status', 'in_stock')
        .is('dealer_id', null)
        .limit(50);
      setUnassignedUnits(data || []);
      setSelectedUnitIds([]);
      setShowDispatchModal(true);
    } catch (err) {
      console.error('Error fetching unassigned stock:', err);
    }
  };

  const handleDispatchUnits = async () => {
    if (!selectedDealer || selectedUnitIds.length === 0) {
      alert('Please select at least one TV product unit');
      return;
    }

    setDispatching(true);
    try {
      const { data, error } = await supabase.rpc('fn_dispatch_consignment_to_dealer', {
        p_dealer_id: selectedDealer.id,
        p_product_unit_ids: selectedUnitIds,
        p_warehouse_id: null,
        p_notes: `Consignment stock dispatch to ${selectedDealer.dealer_name}`
      });

      if (error) throw error;

      alert(`Successfully dispatched ${selectedUnitIds.length} TV units to ${selectedDealer.dealer_name} on consignment.`);
      setShowDispatchModal(false);
      loadDealerDetails(selectedDealer);
    } catch (err: any) {
      alert(`Dispatch failed: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  };

  // Open Recall Stock Modal
  const handleOpenRecallModal = async () => {
    if (!selectedDealer) return;
    try {
      const { data: units } = await supabase
        .from('vw_dealer_consignment_inventory' as any)
        .select('*')
        .eq('dealer_id', selectedDealer.id)
        .neq('consignment_status', 'sold');

      const { data: whs } = await supabase.from('warehouses').select('*').eq('is_active', true);

      setDealerUnits(units || []);
      setWarehousesList(whs || []);
      if (whs && whs.length > 0) setTargetWarehouseId((whs[0] as any).id);
      setSelectedUnitIds([]);
      setShowRecallModal(true);
    } catch (err) {
      console.error('Error fetching dealer units for recall:', err);
    }
  };

  const handleRecallStock = async () => {
    if (!targetWarehouseId || selectedUnitIds.length === 0) {
      alert('Please select target warehouse and at least one unit to recall');
      return;
    }
    setRecalling(true);
    try {
      const { error } = await supabase.rpc('fn_recall_consignment_stock', {
        p_product_unit_ids: selectedUnitIds,
        p_to_warehouse_id: targetWarehouseId,
        p_reason: recallReason
      });
      if (error) throw error;
      alert(`Recalled ${selectedUnitIds.length} unit(s) back to warehouse.`);
      setShowRecallModal(false);
      loadDealerDetails(selectedDealer);
    } catch (err: any) {
      alert(`Recall failed: ${err.message}`);
    } finally {
      setRecalling(false);
    }
  };

  // Open Inter-Dealer Transfer Modal
  const handleOpenTransferModal = async () => {
    if (!selectedDealer) return;
    try {
      const { data: units } = await supabase
        .from('vw_dealer_consignment_inventory' as any)
        .select('*')
        .eq('dealer_id', selectedDealer.id)
        .eq('consignment_status', 'available');

      setDealerUnits(units || []);
      setSelectedUnitIds([]);
      setTargetDealerId('');
      setShowTransferModal(true);
    } catch (err) {
      console.error('Error fetching units for transfer:', err);
    }
  };

  const handleTransferStock = async () => {
    if (!selectedDealer || !targetDealerId || selectedUnitIds.length === 0) {
      alert('Please select target dealer and at least one unit');
      return;
    }
    setTransferring(true);
    try {
      const { error } = await supabase.rpc('fn_transfer_dealer_consignment_stock', {
        p_from_dealer_id: selectedDealer.id,
        p_to_dealer_id: targetDealerId,
        p_product_unit_ids: selectedUnitIds,
        p_reason: transferReason
      });
      if (error) throw error;
      alert(`Transferred ${selectedUnitIds.length} consignment unit(s) to destination dealer.`);
      setShowTransferModal(false);
      loadDealerDetails(selectedDealer);
    } catch (err: any) {
      alert(`Inter-dealer transfer failed: ${err.message}`);
    } finally {
      setTransferring(false);
    }
  };

  // Open Settlement Tracking Modal
  const handleOpenSettlementModal = async () => {
    if (!selectedDealer) return;
    try {
      const { data } = await supabase
        .from('vw_dealer_consignment_inventory' as any)
        .select('*')
        .eq('dealer_id', selectedDealer.id)
        .eq('consignment_status', 'sold');

      setSoldConsignments(data || []);
      setSelectedCsIds([]);
      setSettlementStatus('settled');
      setSettlementRef(`SETTL-${Date.now().toString().slice(-6)}`);
      setShowSettlementModal(true);
    } catch (err) {
      console.error('Error fetching sold consignment stock:', err);
    }
  };

  const handleUpdateSettlement = async () => {
    if (selectedCsIds.length === 0) {
      alert('Please select at least one sold consignment item to update settlement');
      return;
    }
    setUpdatingSettlement(true);
    try {
      const { error } = await supabase.rpc('fn_update_consignment_settlement', {
        p_consignment_ids: selectedCsIds,
        p_settlement_status: settlementStatus,
        p_settlement_reference: settlementRef,
        p_notes: 'Settlement status updated by staff'
      });
      if (error) throw error;
      alert(`Updated settlement status for ${selectedCsIds.length} item(s).`);
      setShowSettlementModal(false);
      loadDealerDetails(selectedDealer);
    } catch (err: any) {
      alert(`Settlement update failed: ${err.message}`);
    } finally {
      setUpdatingSettlement(false);
    }
  };

  // Open Physical Reconciliation Modal
  const handleOpenReconcileModal = async () => {
    if (!selectedDealer) return;
    try {
      const { data: units } = await supabase
        .from('vw_dealer_consignment_inventory' as any)
        .select('*')
        .eq('dealer_id', selectedDealer.id);

      setDealerUnits(units || []);
      setVerifiedUnitIds([]);
      setDiscrepantUnitIds([]);
      setReconciliationNotes('');
      setShowReconcileModal(true);
    } catch (err) {
      console.error('Error fetching dealer units for audit:', err);
    }
  };

  const handleReconcileStock = async () => {
    setReconciling(true);
    try {
      const { error } = await supabase.rpc('fn_reconcile_dealer_consignment', {
        p_dealer_id: selectedDealer.id,
        p_verified_unit_ids: verifiedUnitIds,
        p_discrepant_unit_ids: discrepantUnitIds,
        p_notes: reconciliationNotes || 'Physical stock audit completed'
      });
      if (error) throw error;
      alert(`Stock audit complete: ${verifiedUnitIds.length} verified, ${discrepantUnitIds.length} marked as discrepant.`);
      setShowReconcileModal(false);
      loadDealerDetails(selectedDealer);
    } catch (err: any) {
      alert(`Reconciliation failed: ${err.message}`);
    } finally {
      setReconciling(false);
    }
  };

  // Manage Dealer User Modal
  const handleOpenUserModal = async () => {
    if (!selectedDealer) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, employee_code, roles:role_id(name)')
        .order('full_name', { ascending: true });
      setProfilesList(data || []);
      setSelectedProfileId('');
      setShowUserModal(true);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  const handleLinkDealerUser = async () => {
    if (!selectedDealer || !selectedProfileId) {
      alert('Please select a user profile');
      return;
    }

    setManagingUser(true);
    try {
      const { data, error } = await supabase.rpc('fn_admin_manage_dealer_user', {
        p_profile_id: selectedProfileId,
        p_dealer_id: selectedDealer.id,
        p_is_active: true
      });

      if (error) throw error;

      alert(`Successfully linked user profile to ${selectedDealer.dealer_name} with 'dealer' role`);
      setShowUserModal(false);
    } catch (err: any) {
      alert(`User Assignment Failed: ${err.message}`);
    } finally {
      setManagingUser(false);
    }
  };

  const getDealerMetrics = (dealerId: string) => {
    return dealerStats.find((s) => s.dealer_id === dealerId) || {
      total_sales_count: 0,
      total_sales_amount: 0,
      total_units_sold: 0
    };
  };

  const canEdit = ['super_admin', 'admin', 'sales'].includes(currentRole);

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 style={{ color: 'var(--brand-primary)' }} /> Dealer & Consignment Operations
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Authorized distributors, retail consignment inventory, stock recalls, settlements, and physical audits
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
          >
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Register Dealer
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by dealer name, code, or city..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="card" style={{ borderColor: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--status-danger)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--status-danger)' }}>Error loading dealers</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Dealers Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dealer Code</th>
                <th>Dealer Name</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Sales Volume</th>
                <th>Units Sold</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted">Loading dealer records...</p>
                  </td>
                </tr>
              ) : dealers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <Building2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Dealers Registered</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {searchQuery ? 'Try a different search term' : 'Add your first channel partner or retail dealer'}
                    </p>
                  </td>
                </tr>
              ) : (
                dealers.map((d) => {
                  const metrics = getDealerMetrics(d.id);
                  return (
                    <tr key={d.id}>
                      <td>
                        <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {d.dealer_code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{d.dealer_name}</td>
                      <td>
                        <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                          {d.dealer_type}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>{d.contact_person || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.phone}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.875rem' }}>
                          {[d.city, d.state].filter(Boolean).join(', ') || '—'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>
                        ₹{(metrics.total_sales_amount || 0).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {metrics.total_units_sold || 0} units
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${d.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => loadDealerDetails(d)}
                        >
                          View Consignment
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          totalRecords={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* Dealer Detail & Consignment Control Modal */}
      {selectedDealer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '840px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedDealer.dealer_name}</h3>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  Code: {selectedDealer.dealer_code} | Type: {selectedDealer.dealer_type} | Location: {[selectedDealer.city, selectedDealer.state].filter(Boolean).join(', ')}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedDealer(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Consignment Performance Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ padding: '0.875rem', background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consignment Stock</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
                    {selectedDealerInv?.available_units || 0} Available
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total: {selectedDealerInv?.total_consignment_units || 0}</div>
                </div>
                <div className="card" style={{ padding: '0.875rem', background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Receipts</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#2563eb', marginTop: '0.25rem' }}>
                    {selectedDealerInv?.dispatched_units || 0} Units
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In Transit</div>
                </div>
                <div className="card" style={{ padding: '0.875rem', background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sold Units</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#059669', marginTop: '0.25rem' }}>
                    {selectedDealerInv?.sold_units || 0} Sold
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Settlement: {selectedDealerInv?.pending_settlement_units || 0}</div>
                </div>
                <div className="card" style={{ padding: '0.875rem', background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disputed / Damaged</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#dc2626', marginTop: '0.25rem' }}>
                    {selectedDealerInv?.disputed_units || 0} Units
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Under Inspection</div>
                </div>
              </div>

              {/* Phase 8.1 Real-Time Credit Engine & Exposure Dashboard */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Credit Limit Engine & Exposure State:</div>
                  {dealerCreditExposure && (
                    <span className={`badge ${
                      dealerCreditExposure.risk_state === 'AVAILABLE' ? 'badge-success' :
                      ['WARNING', 'NEAR_LIMIT'].includes(dealerCreditExposure.risk_state) ? 'badge-warning' :
                      'badge-danger'
                    }`} style={{ fontWeight: 700 }}>
                      {dealerCreditExposure.risk_state}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved Credit Limit</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                      ₹{Number(dealerCreditExposure?.credit_limit || selectedDealer.credit_limit || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Exposure</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626', marginTop: '0.25rem' }}>
                      ₹{Number(dealerCreditExposure?.current_exposure || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Util: {dealerCreditExposure?.utilization_percent || 0}%
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available Credit</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#059669', marginTop: '0.25rem' }}>
                      ₹{Number(dealerCreditExposure?.available_credit || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dispatch Eligibility</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, marginTop: '0.25rem', color: dealerCreditExposure?.dispatch_allowed ? '#059669' : '#dc2626' }}>
                      {dealerCreditExposure?.dispatch_allowed ? 'GATE APPROVED' : 'DISPATCH BLOCKED'}
                    </div>
                    {dealerCreditExposure?.blocking_reason && (
                      <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>
                        {dealerCreditExposure.blocking_reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Consignment Management Workflows */}
              {['super_admin', 'admin', 'inventory', 'sales'].includes(currentRole) && (
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Consignment Inventory Operations:</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleOpenDispatchModal}>
                      <Package size={14} /> Dispatch Consignment Stock
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleOpenRecallModal}>
                      <RotateCcw size={14} /> Recall Stock
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleOpenTransferModal}>
                      <ArrowRightLeft size={14} /> Inter-Dealer Transfer
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleOpenSettlementModal}>
                      <DollarSign size={14} /> Settlement Tracking
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleOpenReconcileModal}>
                      <CheckSquare size={14} /> Physical Stock Audit
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={handleGenerateStatement} disabled={generatingStatement}>
                      <FileText size={14} /> {generatingStatement ? 'Generating...' : 'Generate Statement'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={handleRunStagnantCheck} disabled={evaluatingStagnant}>
                      <AlertTriangle size={14} /> {evaluatingStagnant ? 'Auditing...' : 'Evaluate Stagnant'}
                    </button>
                    {['super_admin', 'admin'].includes(currentRole) && (
                      <button className="btn btn-outline btn-sm" onClick={handleOpenUserModal}>
                        <UserPlus size={14} /> Link Portal User
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Periodic Statements List */}
              {dealerStatements.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Recent Statements:</div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.375rem', overflow: 'hidden' }}>
                    <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                      <thead>
                        <tr>
                          <th>Statement #</th>
                          <th>Period</th>
                          <th>Dispatched Val</th>
                          <th>Sales Val</th>
                          <th>Closing Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dealerStatements.map((st) => (
                          <tr key={st.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{st.statement_number}</td>
                            <td>{st.period_start} to {st.period_end}</td>
                            <td>₹{Number(st.consignments_dispatched_val || 0).toLocaleString()}</td>
                            <td>₹{Number(st.sales_reported_val || 0).toLocaleString()}</td>
                            <td style={{ fontWeight: 600 }}>₹{Number(st.closing_balance || 0).toLocaleString()}</td>
                            <td>
                              <span className={`badge ${st.status === 'FINALIZED' ? 'badge-success' : 'badge-neutral'}`}>
                                {st.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Stagnant Stock Recommendations */}
              {stagnantRecommendations.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#dc2626' }}>
                    Stagnant Stock Recall Recommendations ({stagnantRecommendations.length}):
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.375rem', overflow: 'hidden' }}>
                    <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                      <thead>
                        <tr>
                          <th>Unit / Barcode</th>
                          <th>Age (Days)</th>
                          <th>Cost Value</th>
                          <th>Severity</th>
                          <th>Trigger Reason</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stagnantRecommendations.map((rec) => (
                          <tr key={rec.id}>
                            <td style={{ fontFamily: 'monospace' }}>{rec.product_units?.barcode || rec.product_unit_id}</td>
                            <td style={{ fontWeight: 600 }}>{rec.age_days} days</td>
                            <td>₹{Number(rec.unit_cost_value || 0).toLocaleString()}</td>
                            <td>
                              <span className={`badge ${rec.stagnant_severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>
                                {rec.stagnant_severity}
                              </span>
                            </td>
                            <td>{rec.trigger_reason}</td>
                            <td><span className="badge badge-neutral">{rec.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Information Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>CONTACT PERSON</div>
                  <div style={{ fontWeight: 600 }}>{selectedDealer.contact_person || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PHONE NUMBER</div>
                  <div style={{ fontWeight: 600 }}>{selectedDealer.phone || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>EMAIL ADDRESS</div>
                  <div>{selectedDealer.email || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>GST NUMBER</div>
                  <div style={{ fontFamily: 'monospace' }}>{selectedDealer.gst_number || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>CREDIT LIMIT</div>
                  <div style={{ fontWeight: 600 }}>₹{(selectedDealer.credit_limit || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>LOCATION</div>
                  <div>{[selectedDealer.city, selectedDealer.state, selectedDealer.pincode].filter(Boolean).join(', ') || '—'}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedDealer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consignment Dispatch Modal */}
      {showDispatchModal && selectedDealer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Dispatch Consignment Stock to {selectedDealer.dealer_name}</h3>
              <button className="btn-icon" onClick={() => setShowDispatchModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                Select available ZUVO warehouse TV product units to dispatch under consignment.
              </p>

              {unassignedUnits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No available unassigned warehouse stock units found.
                </div>
              ) : (
                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.375rem', padding: '0.5rem' }}>
                  {unassignedUnits.map((u) => {
                    const isSelected = selectedUnitIds.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedUnitIds(selectedUnitIds.filter((id) => id !== u.id));
                          } else {
                            setSelectedUnitIds([...selectedUnitIds, u.id]);
                          }
                        }}
                        style={{
                          padding: '0.625rem',
                          borderRadius: '0.25rem',
                          marginBottom: '0.375rem',
                          background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-secondary)',
                          border: isSelected ? '1px solid var(--brand-primary)' : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.product_variants?.product_name} ({u.product_variants?.screen_size}")</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {u.barcode} | S/N: {u.serial_number}</div>
                        </div>
                        <input type="checkbox" checked={isSelected} readOnly />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDispatchModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={dispatching || selectedUnitIds.length === 0} onClick={handleDispatchUnits}>
                {dispatching ? 'Dispatching...' : `Dispatch (${selectedUnitIds.length}) Units`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Recall Modal */}
      {showRecallModal && selectedDealer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Recall Stock from {selectedDealer.dealer_name}</h3>
              <button className="btn-icon" onClick={() => setShowRecallModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Target Destination Warehouse *</label>
                <select
                  className="input-field"
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.id}>{w.warehouse_name} ({w.city})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Recall Reason *</label>
                <input
                  type="text"
                  className="input-field"
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Select Units to Recall:</div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.375rem', padding: '0.5rem' }}>
                {dealerUnits.map((u) => {
                  const isSelected = selectedUnitIds.includes(u.product_unit_id);
                  return (
                    <div
                      key={u.consignment_id}
                      onClick={() => {
                        if (isSelected) setSelectedUnitIds(selectedUnitIds.filter(id => id !== u.product_unit_id));
                        else setSelectedUnitIds([...selectedUnitIds, u.product_unit_id]);
                      }}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '0.25rem',
                        marginBottom: '0.25rem',
                        background: isSelected ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.model_name}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {u.barcode} | Status: {u.consignment_status}</div>
                      </div>
                      <input type="checkbox" checked={isSelected} readOnly />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRecallModal(false)}>Cancel</button>
              <button className="btn btn-danger" disabled={recalling || selectedUnitIds.length === 0} onClick={handleRecallStock}>
                {recalling ? 'Recalling...' : `Recall (${selectedUnitIds.length}) Units`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inter-Dealer Transfer Modal */}
      {showTransferModal && selectedDealer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Transfer Stock from {selectedDealer.dealer_name}</h3>
              <button className="btn-icon" onClick={() => setShowTransferModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Destination Dealer *</label>
                <select
                  className="input-field"
                  value={targetDealerId}
                  onChange={(e) => setTargetDealerId(e.target.value)}
                >
                  <option value="">-- Select Target Dealer --</option>
                  {dealers.filter(d => d.id !== selectedDealer.id).map((d) => (
                    <option key={d.id} value={d.id}>{d.dealer_name} ({d.city})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Transfer Reason *</label>
                <input
                  type="text"
                  className="input-field"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Select Available Units to Transfer:</div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.375rem', padding: '0.5rem' }}>
                {dealerUnits.map((u) => {
                  const isSelected = selectedUnitIds.includes(u.product_unit_id);
                  return (
                    <div
                      key={u.consignment_id}
                      onClick={() => {
                        if (isSelected) setSelectedUnitIds(selectedUnitIds.filter(id => id !== u.product_unit_id));
                        else setSelectedUnitIds([...selectedUnitIds, u.product_unit_id]);
                      }}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '0.25rem',
                        marginBottom: '0.25rem',
                        background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.model_name}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {u.barcode}</div>
                      </div>
                      <input type="checkbox" checked={isSelected} readOnly />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={transferring || selectedUnitIds.length === 0 || !targetDealerId} onClick={handleTransferStock}>
                {transferring ? 'Transferring...' : `Transfer (${selectedUnitIds.length}) Units`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Tracking Modal */}
      {showSettlementModal && selectedDealer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Consignment Settlement for {selectedDealer.dealer_name}</h3>
              <button className="btn-icon" onClick={() => setShowSettlementModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Settlement Status *</label>
                  <select
                    className="input-field"
                    value={settlementStatus}
                    onChange={(e) => setSettlementStatus(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="submitted">Submitted</option>
                    <option value="settled">Settled / Paid</option>
                    <option value="disputed">Disputed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Settlement Reference Ref #</label>
                  <input
                    type="text"
                    className="input-field"
                    value={settlementRef}
                    onChange={(e) => setSettlementRef(e.target.value)}
                    placeholder="e.g. INV-904812"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Select Sold Consignment Items to Update:</div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.375rem', padding: '0.5rem' }}>
                {soldConsignments.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sold consignment items currently pending settlement.</div>
                ) : (
                  soldConsignments.map((u) => {
                    const isSelected = selectedCsIds.includes(u.consignment_id);
                    return (
                      <div
                        key={u.consignment_id}
                        onClick={() => {
                          if (isSelected) setSelectedCsIds(selectedCsIds.filter(id => id !== u.consignment_id));
                          else setSelectedCsIds([...selectedCsIds, u.consignment_id]);
                        }}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          marginBottom: '0.25rem',
                          background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.model_name} (Barcode: {u.barcode})</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sold Date: {new Date(u.sold_at || u.dispatched_at).toLocaleDateString()} | Current Settlement: {u.settlement_status}</div>
                        </div>
                        <input type="checkbox" checked={isSelected} readOnly />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSettlementModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={updatingSettlement || selectedCsIds.length === 0} onClick={handleUpdateSettlement}>
                {updatingSettlement ? 'Updating...' : `Update Settlement (${selectedCsIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Physical Stock Reconciliation Modal */}
      {showReconcileModal && selectedDealer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Physical Stock Audit: {selectedDealer.dealer_name}</h3>
              <button className="btn-icon" onClick={() => setShowReconcileModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                Verify physical TV units present at the dealer store against CRM system records.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Audit Notes</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Quarterly physical stock count audit"
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                />
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.375rem', padding: '0.5rem' }}>
                {dealerUnits.map((u) => {
                  const isVerified = verifiedUnitIds.includes(u.product_unit_id);
                  const isDiscrepant = discrepantUnitIds.includes(u.product_unit_id);

                  return (
                    <div
                      key={u.consignment_id}
                      style={{
                        padding: '0.625rem',
                        borderRadius: '0.25rem',
                        marginBottom: '0.375rem',
                        background: isVerified ? 'rgba(16, 185, 129, 0.08)' : isDiscrepant ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.model_name}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {u.barcode} | Status: {u.consignment_status}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          className={`btn btn-sm ${isVerified ? 'btn-success' : 'btn-outline-secondary'}`}
                          onClick={() => {
                            if (isVerified) setVerifiedUnitIds(verifiedUnitIds.filter(id => id !== u.product_unit_id));
                            else {
                              setVerifiedUnitIds([...verifiedUnitIds, u.product_unit_id]);
                              setDiscrepantUnitIds(discrepantUnitIds.filter(id => id !== u.product_unit_id));
                            }
                          }}
                        >
                          Verified
                        </button>
                        <button
                          className={`btn btn-sm ${isDiscrepant ? 'btn-danger' : 'btn-outline-danger'}`}
                          onClick={() => {
                            if (isDiscrepant) setDiscrepantUnitIds(discrepantUnitIds.filter(id => id !== u.product_unit_id));
                            else {
                              setDiscrepantUnitIds([...discrepantUnitIds, u.product_unit_id]);
                              setVerifiedUnitIds(verifiedUnitIds.filter(id => id !== u.product_unit_id));
                            }
                          }}
                        >
                          Discrepant
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReconcileModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={reconciling} onClick={handleReconcileStock}>
                {reconciling ? 'Completing Audit...' : `Complete Audit (${verifiedUnitIds.length} Verified, ${discrepantUnitIds.length} Discrepant)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Link Modal */}
      {showUserModal && selectedDealer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Link User to {selectedDealer.dealer_name}</h3>
              <button className="btn-icon" onClick={() => setShowUserModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select User Profile *</label>
                <select
                  className="input-field"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                >
                  <option value="">-- Select Profile --</option>
                  {profilesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || 'User'} ({p.phone || p.id.slice(0, 8)}) — Role: {p.roles?.name || 'none'}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Assigning a user to this dealer will grant them access to the Dealer Self-Service Portal (`/dealer`) for this specific branch.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={managingUser || !selectedProfileId} onClick={handleLinkDealerUser}>
                {managingUser ? 'Linking...' : 'Assign Dealer Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
