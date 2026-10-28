import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Warehouse, ArrowRightLeft, Plus, MapPin, Box, ArrowRight, CheckCircle, Clock,
  Search, RefreshCw, Download, FileSpreadsheet, Truck, FileText, Barcode as BarcodeIcon,
  AlertTriangle, ShieldCheck, CheckCircle2, X, Trash2
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';
import { TransferManifestModal, TransferManifestData } from '../components/common/TransferManifestModal';

export const InventoryPage: React.FC = () => {
  const { role } = useAuth();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [inStockUnits, setInStockUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matrix' | 'manifests' | 'incoming' | 'history'>('matrix');

  // Filter states for history
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Pagination state for audit ledger
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  // New Warehouse Modal
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whType, setWhType] = useState('regional_warehouse');
  const [whCity, setWhCity] = useState('');
  const [whState, setWhState] = useState('');

  // Transfer Modal (Legacy / Single Unit)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [transferReason, setTransferReason] = useState('Stock rebalance between hubs');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Receiving Action state
  const [receivingUnitId, setReceivingUnitId] = useState<string | null>(null);

  // Phase 7.1: Stock Transfer Manifests state
  const [stockTransfers, setStockTransfers] = useState<any[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [transferItems, setTransferItems] = useState<any[]>([]);
  const [isCreateManifestModalOpen, setIsCreateManifestModalOpen] = useState(false);
  const [isScanDispatchModalOpen, setIsScanDispatchModalOpen] = useState(false);
  const [isScanReceiveModalOpen, setIsScanReceiveModalOpen] = useState(false);
  const [isManifestViewOpen, setIsManifestViewOpen] = useState(false);
  const [activeManifestData, setActiveManifestData] = useState<TransferManifestData | null>(null);

  // Create Manifest form
  const [manifestSourceWh, setManifestSourceWh] = useState('');
  const [manifestDestWh, setManifestDestWh] = useState('');
  const [manifestCarrier, setManifestCarrier] = useState('ZUVO National Logistics');
  const [manifestVehicle, setManifestVehicle] = useState('');
  const [manifestDriver, setManifestDriver] = useState('');
  const [manifestDriverPhone, setManifestDriverPhone] = useState('');
  const [manifestNotes, setManifestNotes] = useState('');
  const [manifestFormError, setManifestFormError] = useState<string | null>(null);

  // Barcode Scanning state (Dispatch & Receive)
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scanDamaged, setScanDamaged] = useState(false);
  const [scanNotes, setScanNotes] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      if (activeTab === 'matrix') {
        const rows = stockSummary.map((s) => ({
          warehouse_code: s.warehouse_code,
          warehouse_name: s.warehouse_name,
          warehouse_type: s.warehouse_type,
          city: s.city || 'HQ',
          state: s.state || '',
          in_stock_units: s.in_stock_units || 0,
          in_transit_units: s.in_transit_units || 0,
          reserved_units: s.reserved_units || 0,
          damaged_units: s.damaged_units || 0,
          total_units: s.total_units || 0
        }));
        const headers = [
          { key: 'warehouse_code', label: 'Facility Code' },
          { key: 'warehouse_name', label: 'Facility Name' },
          { key: 'warehouse_type', label: 'Type' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'in_stock_units', label: 'In Stock' },
          { key: 'in_transit_units', label: 'In Transit' },
          { key: 'reserved_units', label: 'Reserved' },
          { key: 'damaged_units', label: 'Damaged' },
          { key: 'total_units', label: 'Total Units' }
        ];
        const filename = `zuvo_stock_matrix_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'Stock Matrix');
      } else {
        const rows = transactions.map((tx) => ({
          transaction_type: tx.transaction_type,
          serial_number: tx.product_units?.serial_number || '',
          barcode: tx.product_units?.barcode || '',
          product_name: tx.product_units?.product_variants?.product_name || '',
          from_facility: tx.from_wh?.warehouse_name || '',
          to_facility: tx.to_wh?.warehouse_name || '',
          previous_status: tx.previous_status || '',
          new_status: tx.new_status || '',
          movement_reason: tx.movement_reason || '',
          created_at: new Date(tx.created_at).toLocaleString()
        }));
        const headers = [
          { key: 'transaction_type', label: 'Type' },
          { key: 'serial_number', label: 'Serial #' },
          { key: 'barcode', label: 'Barcode' },
          { key: 'product_name', label: 'Product Name' },
          { key: 'from_facility', label: 'From Hub' },
          { key: 'to_facility', label: 'To Hub' },
          { key: 'previous_status', label: 'Previous Status' },
          { key: 'new_status', label: 'New Status' },
          { key: 'movement_reason', label: 'Reason' },
          { key: 'created_at', label: 'Timestamp' }
        ];
        const filename = `zuvo_inventory_ledger_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'Audit Ledger');
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Facilities
      const { data: whData } = await supabase.from('warehouses').select('*').order('created_at');
      setWarehouses(whData || []);

      // 2. Stock summary view
      const { data: stData } = await supabase.from('stock_by_warehouse').select('*');
      setStockSummary(stData || []);

      // 3. In-stock product units for transfer dropdown
      const { data: unitsData } = await supabase
        .from('product_units')
        .select(`
          id,
          serial_number,
          barcode,
          status,
          warehouse_id,
          warehouses(warehouse_name, warehouse_code),
          product_variants(product_name)
        `)
        .eq('status', 'in_stock');
      setInStockUnits(unitsData || []);

      // 4. Pending incoming transfers (units in_transit)
      const { data: pendingData } = await supabase
        .from('product_units')
        .select(`
          id,
          serial_number,
          barcode,
          status,
          updated_at,
          product_variants(product_name),
          warehouses:warehouse_id(warehouse_name)
        `)
        .eq('status', 'in_transit');

      // Hydrate with latest transfer details
      if (pendingData && pendingData.length > 0) {
        const unitIds = pendingData.map((u) => u.id);
        const { data: txs } = await supabase
          .from('inventory_transactions')
          .select(`
            product_unit_id,
            movement_reason,
            created_at,
            from_wh:from_warehouse_id(warehouse_name, warehouse_code),
            to_wh:to_warehouse_id(warehouse_name, warehouse_code)
          `)
          .in('product_unit_id', unitIds)
          .eq('transaction_type', 'warehouse_transfer')
          .eq('new_status', 'in_transit')
          .order('created_at', { ascending: false });

        const mapped = pendingData.map((u) => {
          const tx = txs?.find((t) => t.product_unit_id === u.id);
          return {
            ...u,
            transfer_details: tx
          };
        });
        setPendingTransfers(mapped);
      } else {
        setPendingTransfers([]);
      }

      // 5. Complete Movement Audit Ledger
      const { data: txData } = await supabase
        .from('inventory_transactions')
        .select(`
          id,
          transaction_type,
          previous_status,
          new_status,
          movement_reason,
          reference_note,
          created_at,
          product_units:product_unit_id (serial_number, barcode, product_variants(product_name)),
          from_wh:from_warehouse_id (warehouse_name, warehouse_code),
          to_wh:to_warehouse_id (warehouse_name, warehouse_code)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      setTransactions(txData || []);

      // 6. Phase 7.1 Stock Transfers
      const { data: stDataList } = await (supabase.from as any)('stock_transfers')
        .select(`
          *,
          source_warehouse:source_warehouse_id(warehouse_name, warehouse_code, city),
          destination_warehouse:destination_warehouse_id(warehouse_name, warehouse_code, city)
        `)
        .order('created_at', { ascending: false });
      setStockTransfers(stDataList || []);
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWarehouse = async (warehouseId: string, warehouseName: string) => {
    if (!window.confirm(`Are you sure you want to delete facility "${warehouseName}"?\nThis action cannot be undone.`)) {
      return;
    }
    try {
      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)('fn_delete_warehouse_cascade', {
        p_warehouse_id: warehouseId
      });

      if (rpcErr) {
        console.warn('RPC delete fallback:', rpcErr);
        const { error } = await supabase.from('warehouses').delete().eq('id', warehouseId);
        if (error) throw error;
      } else if (rpcRes && rpcRes.success === false) {
        throw new Error(rpcRes.message || 'Failed to delete warehouse facility.');
      }

      alert(`Facility "${warehouseName}" deleted successfully from both CRM web and Supabase.`);
      loadData();
    } catch (err: any) {
      console.error('Failed to delete facility:', err);
      alert(`Delete failed: ${err.message || 'Check if there are linked inventory units or active transactions first'}`);
    }
  };

  // Phase 7.1: Load items for a specific transfer
  const loadTransferItems = async (transferId: string) => {
    try {
      const { data: items } = await (supabase.from as any)('stock_transfer_items')
        .select(`
          *,
          product_unit:product_unit_id(
            serial_number,
            barcode,
            product_variants(product_name, screen_size)
          )
        `)
        .eq('transfer_id', transferId)
        .order('created_at', { ascending: true });
      setTransferItems(items || []);
    } catch (err) {
      console.error('Error loading transfer items:', err);
    }
  };

  // Phase 7.1: Open Digital Manifest Modal
  const handleOpenManifest = async (transfer: any) => {
    try {
      const { data: items } = await (supabase.from as any)('stock_transfer_items')
        .select(`
          *,
          product_unit:product_unit_id(
            serial_number,
            barcode,
            product_variants(product_name, screen_size)
          )
        `)
        .eq('transfer_id', transfer.id);

      const manifestPayload: TransferManifestData = {
        transferNumber: transfer.transfer_number,
        sourceWarehouse: `${transfer.source_warehouse?.warehouse_name} (${transfer.source_warehouse?.warehouse_code})`,
        destinationWarehouse: `${transfer.destination_warehouse?.warehouse_name} (${transfer.destination_warehouse?.warehouse_code})`,
        carrierName: transfer.carrier_name || 'ZUVO Fleet Logistics',
        vehicleNumber: transfer.vehicle_number,
        driverName: transfer.driver_name,
        driverPhone: transfer.driver_phone,
        dispatchDate: transfer.dispatched_at,
        expectedArrival: transfer.expected_arrival_at,
        status: transfer.status,
        expectedCount: transfer.expected_unit_count || 0,
        dispatchedCount: transfer.dispatched_unit_count || 0,
        receivedCount: transfer.received_unit_count || 0,
        missingCount: transfer.missing_unit_count || 0,
        unexpectedCount: transfer.unexpected_unit_count || 0,
        damagedCount: transfer.damaged_unit_count || 0,
        items: (items || []).map((it: any) => ({
          barcode: it.barcode,
          serialNumber: it.serial_number || it.product_unit?.serial_number || 'N/A',
          modelName: it.product_unit?.product_variants?.product_name || 'ZUVO Android TV',
          screenSize: it.product_unit?.product_variants?.screen_size,
          status: it.item_status,
          isDamaged: it.is_damaged || false,
          conditionNotes: it.condition_notes
        }))
      };

      setActiveManifestData(manifestPayload);
      setIsManifestViewOpen(true);
    } catch (err: any) {
      alert(`Failed to load manifest: ${err.message}`);
    }
  };

  // Phase 7.1: Handle Create Stock Transfer Draft
  const handleCreateManifestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManifestFormError(null);

    if (!manifestSourceWh || !manifestDestWh) {
      setManifestFormError('Both source and destination warehouses are required.');
      return;
    }

    if (manifestSourceWh === manifestDestWh) {
      setManifestFormError('Destination warehouse must be different from source warehouse.');
      return;
    }

    setIsExecuting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_create_stock_transfer', {
        p_source_warehouse_id: manifestSourceWh,
        p_destination_warehouse_id: manifestDestWh,
        p_carrier_name: manifestCarrier.trim() || null,
        p_vehicle_number: manifestVehicle.trim() || null,
        p_driver_name: manifestDriver.trim() || null,
        p_driver_phone: manifestDriverPhone.trim() || null,
        p_dispatch_notes: manifestNotes.trim() || null
      });

      if (error) throw error;

      setIsCreateManifestModalOpen(false);
      setManifestSourceWh('');
      setManifestDestWh('');
      setManifestVehicle('');
      setManifestDriver('');
      setManifestDriverPhone('');
      setManifestNotes('');
      loadData();
      alert(`Stock Transfer Manifest ${data.transfer_number} created in DRAFT status.`);
    } catch (err: any) {
      setManifestFormError(err.message || 'Failed to create transfer manifest');
    } finally {
      setIsExecuting(false);
    }
  };

  // Phase 7.1: Scan barcode for dispatch
  const handleDispatchScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer || !scannedBarcode.trim()) return;

    setScanFeedback(null);
    setIsSubmittingScan(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_scan_barcode_for_dispatch', {
        p_transfer_id: selectedTransfer.id,
        p_barcode_or_serial: scannedBarcode.trim()
      });

      if (error) throw error;

      setScanFeedback({
        type: 'success',
        message: `Unit ${data.barcode} (SN: ${data.serial_number}) added to manifest.`
      });
      setScannedBarcode('');
      loadTransferItems(selectedTransfer.id);
      loadData();
    } catch (err: any) {
      setScanFeedback({
        type: 'error',
        message: err.message || 'Scan failed'
      });
    } finally {
      setIsSubmittingScan(false);
    }
  };

  // Phase 7.1: Authorize Dispatch
  const handleAuthorizeDispatch = async (transferId: string) => {
    if (!window.confirm('Authorize and dispatch this manifest? All units will enter IN_TRANSIT status.')) return;
    setIsExecuting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_dispatch_stock_transfer', {
        p_transfer_id: transferId
      });
      if (error) throw error;
      alert(`Manifest successfully dispatched! ${data.dispatched_count} unit(s) moved to IN_TRANSIT.`);
      setIsScanDispatchModalOpen(false);
      setSelectedTransfer(null);
      loadData();
    } catch (err: any) {
      alert(`Dispatch authorization failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Phase 7.1: Scan barcode for receiving
  const handleReceivingScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer || !scannedBarcode.trim()) return;

    setScanFeedback(null);
    setIsSubmittingScan(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_scan_barcode_for_receiving', {
        p_transfer_id: selectedTransfer.id,
        p_barcode_or_serial: scannedBarcode.trim(),
        p_is_damaged: scanDamaged,
        p_condition_notes: scanNotes.trim() || null
      });

      if (error) throw error;

      const flag = data.is_unexpected ? ' (UNEXPECTED UNIT RECORDED)' : data.is_damaged ? ' (DAMAGED RECORDED)' : '';
      setScanFeedback({
        type: 'success',
        message: `Barcode ${data.barcode} received and verified${flag}.`
      });
      setScannedBarcode('');
      setScanDamaged(false);
      setScanNotes('');
      loadTransferItems(selectedTransfer.id);
      loadData();
    } catch (err: any) {
      setScanFeedback({
        type: 'error',
        message: err.message || 'Receiving scan failed'
      });
    } finally {
      setIsSubmittingScan(false);
    }
  };

  // Phase 7.1: Reconcile Manifest
  const handleReconcileTransfer = async (transferId: string) => {
    const notes = prompt('Enter final reconciliation review notes (optional):');
    if (notes === null) return;

    setIsExecuting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_reconcile_stock_transfer', {
        p_transfer_id: transferId,
        p_reconciliation_notes: notes.trim() || null
      });
      if (error) throw error;
      alert(
        `Manifest Reconciliation Complete!\nFinal Status: ${data.status.toUpperCase()}\n` +
        `Expected: ${data.expected_count} | Received: ${data.received_count} | Missing: ${data.missing_count} | Unexpected: ${data.unexpected_count} | Damaged: ${data.damaged_count}`
      );
      setIsScanReceiveModalOpen(false);
      setSelectedTransfer(null);
      loadData();
    } catch (err: any) {
      alert(`Reconciliation failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('warehouses').insert({
        warehouse_code: whCode.trim().toUpperCase(),
        warehouse_name: whName.trim(),
        warehouse_type: whType,
        city: whCity.trim(),
        state: whState.trim(),
      });
      if (error) throw error;
      setIsWhModalOpen(false);
      setWhCode('');
      setWhName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating warehouse');
    }
  };

  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    if (!selectedUnitId || !targetWarehouseId) {
      setTransferError('Please select both a Product Unit and Destination Warehouse.');
      return;
    }

    const unit = inStockUnits.find((u) => u.id === selectedUnitId);
    if (!unit) {
      setTransferError('Selected unit is no longer available.');
      return;
    }

    if (unit.warehouse_id === targetWarehouseId) {
      setTransferError('Destination warehouse must be different from current source warehouse.');
      return;
    }

    setIsExecuting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('initiate_warehouse_transfer', {
        p_unit_id: selectedUnitId,
        p_to_warehouse_id: targetWarehouseId,
        p_reason: transferReason.trim() || 'Inter-warehouse stock transfer initiated'
      });

      if (error) throw error;

      setIsTransferModalOpen(false);
      setSelectedUnitId('');
      setTargetWarehouseId('');
      setTransferReason('Stock rebalance between hubs');
      loadData();
      alert('Inter-warehouse stock transfer initiated successfully! Unit set to IN TRANSIT status.');
    } catch (err: any) {
      setTransferError(err.message || 'Failed to initiate transfer');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReceiveTransfer = async (unitId: string) => {
    if (!window.confirm('Confirm receiving this TV unit into destination facility stock?')) return;
    setReceivingUnitId(unitId);
    try {
      const { data, error } = await (supabase.rpc as any)('receive_warehouse_transfer', {
        p_unit_id: unitId,
        p_notes: 'Received and physically verified at destination hub'
      });

      if (error) throw error;
      loadData();
      alert('Stock transfer completed! TV unit received and added to facility in-stock inventory.');
    } catch (err: any) {
      alert(`Receiving failed: ${err.message}`);
    } finally {
      setReceivingUnitId(null);
    }
  };

  const canManageInventory = ['super_admin', 'admin', 'inventory'].includes(role || '');

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const sn = tx.product_units?.serial_number?.toLowerCase() || '';
      const bc = tx.product_units?.barcode?.toLowerCase() || '';
      const fromWh = tx.from_wh?.warehouse_name?.toLowerCase() || '';
      const toWh = tx.to_wh?.warehouse_name?.toLowerCase() || '';
      return sn.includes(q) || bc.includes(q) || fromWh.includes(q) || toWh.includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Warehouse style={{ color: 'var(--brand-primary)' }} /> Multi-Facility Inventory & Transfers
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Hub stock matrix, inter-facility transfers, and serialized unit ledger.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={exporting || isLoading}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || isLoading}
          >
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          {canManageInventory && (
            <button onClick={() => setIsCreateManifestModalOpen(true)} className="btn btn-primary">
              <Truck size={16} />
              New Transfer Manifest
            </button>
          )}
          {canManageInventory && (
            <button onClick={() => setIsTransferModalOpen(true)} className="btn btn-secondary">
              <ArrowRightLeft size={16} />
              Single Unit Transfer
            </button>
          )}
          {canManageInventory && (
            <button onClick={() => setIsWhModalOpen(true)} className="btn btn-secondary">
              <Plus size={16} />
              Add Facility / Hub
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'matrix' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('matrix')}
        >
          <Warehouse size={15} /> Facility Stock Matrix ({stockSummary.length})
        </button>
        <button
          className={`btn ${activeTab === 'manifests' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('manifests')}
          style={{ position: 'relative' }}
        >
          <Truck size={15} /> Transfer Manifests ({stockTransfers.length})
          {stockTransfers.filter((t) => ['draft', 'prepared', 'in_transit'].includes(t.status)).length > 0 && (
            <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--brand-primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '999px' }}>
              {stockTransfers.filter((t) => ['draft', 'prepared', 'in_transit'].includes(t.status)).length}
            </span>
          )}
        </button>
        <button
          className={`btn ${activeTab === 'incoming' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('incoming')}
          style={{ position: 'relative' }}
        >
          <Clock size={15} /> Pending Incoming Transfers ({pendingTransfers.length})
          {pendingTransfers.length > 0 && (
            <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--accent-rose)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '999px' }}>
              {pendingTransfers.length}
            </span>
          )}
        </button>
        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('history')}
        >
          <ArrowRightLeft size={15} /> Movement Audit Ledger ({transactions.length})
        </button>
      </div>

      {/* TAB: Transfer Manifests (Phase 7.1) */}
      {activeTab === 'manifests' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Multi-Warehouse Stock Transfer Manifests</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Inter-depot transit manifests, barcode dispatch scanning, receiving audits, and discrepancy reconciliation.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {canManageInventory && (
                <button className="btn btn-primary btn-sm" onClick={() => setIsCreateManifestModalOpen(true)}>
                  <Plus size={14} /> Create Manifest
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={loadData}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Manifest #</th>
                  <th>Source Depot</th>
                  <th>Destination Depot</th>
                  <th>Carrier / Vehicle</th>
                  <th>Units (Exp / Rec)</th>
                  <th>Discrepancies</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stockTransfers.length > 0 ? (
                  stockTransfers.map((trf) => (
                    <tr key={trf.id}>
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary)' }}>
                          {trf.transfer_number}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(trf.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-slate">
                          {trf.source_warehouse?.warehouse_name || 'Source'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-warning">
                          ➔ {trf.destination_warehouse?.warehouse_name || 'Destination'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{trf.carrier_name || 'ZUVO Fleet'}</div>
                        {trf.vehicle_number && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Veh: {trf.vehicle_number} {trf.driver_name ? `(${trf.driver_name})` : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{trf.expected_unit_count || 0}</span> exp /{' '}
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{trf.received_unit_count || 0}</span> rec
                      </td>
                      <td>
                        {trf.missing_unit_count > 0 || trf.unexpected_unit_count > 0 || trf.damaged_unit_count > 0 ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {trf.missing_unit_count > 0 && <span className="badge badge-danger">Miss: {trf.missing_unit_count}</span>}
                            {trf.unexpected_unit_count > 0 && <span className="badge badge-purple">Unexp: {trf.unexpected_unit_count}</span>}
                            {trf.damaged_unit_count > 0 && <span className="badge badge-warning">Dam: {trf.damaged_unit_count}</span>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          trf.status === 'reconciled' ? 'badge-success' :
                          trf.status === 'in_transit' ? 'badge-warning' :
                          trf.status === 'discrepancy' ? 'badge-danger' :
                          trf.status === 'prepared' ? 'badge-cyan' :
                          trf.status === 'partially_received' ? 'badge-purple' : 'badge-slate'
                        }`}>
                          {trf.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="View Printable / CSV Manifest"
                            onClick={() => handleOpenManifest(trf)}
                          >
                            <FileText size={13} /> Manifest
                          </button>

                          {canManageInventory && ['draft', 'prepared'].includes(trf.status) && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedTransfer(trf);
                                setScanFeedback(null);
                                loadTransferItems(trf.id);
                                setIsScanDispatchModalOpen(true);
                              }}
                            >
                              <BarcodeIcon size={13} /> Dispatch Scan
                            </button>
                          )}

                          {canManageInventory && ['in_transit', 'partially_received'].includes(trf.status) && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => {
                                setSelectedTransfer(trf);
                                setScanFeedback(null);
                                loadTransferItems(trf.id);
                                setIsScanReceiveModalOpen(true);
                              }}
                            >
                              <CheckCircle2 size={13} /> Receive & Scan
                            </button>
                          )}

                          {canManageInventory && ['in_transit', 'partially_received', 'received'].includes(trf.status) && (
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => handleReconcileTransfer(trf.id)}
                            >
                              <ShieldCheck size={13} /> Reconcile
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No inter-depot stock transfer manifests found. Create a manifest to begin tracked transit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 1: Facilities & Stock Overview */}
      {activeTab === 'matrix' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Facility Stock Matrix</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Facility Name</th>
                  <th>Type</th>
                  <th>City / State</th>
                  <th>In Stock</th>
                  <th>In Transit</th>
                  <th>Reserved</th>
                  <th>Damaged</th>
                  <th>Total Units</th>
                  {canManageInventory && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {stockSummary.map((wh) => (
                  <tr key={wh.warehouse_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{wh.warehouse_code}</td>
                    <td style={{ fontWeight: 600 }}>{wh.warehouse_name}</td>
                    <td><span className="badge badge-slate">{wh.warehouse_type?.replace('_', ' ')}</span></td>
                    <td>{wh.city ? `${wh.city}, ${wh.state}` : 'Headquarters'}</td>
                    <td style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{wh.in_stock_units}</td>
                    <td style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{wh.in_transit_units || 0}</td>
                    <td>{wh.reserved_units}</td>
                    <td style={{ color: 'var(--accent-rose)' }}>{wh.damaged_units}</td>
                    <td style={{ fontWeight: 700 }}>{wh.total_units}</td>
                    {canManageInventory && (
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--accent-rose, #f43f5e)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                          onClick={() => handleDeleteWarehouse(wh.warehouse_id, wh.warehouse_name)}
                          title="Delete Facility"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Pending Incoming Transfers */}
      {activeTab === 'incoming' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Pending Incoming Stock Transfers</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TV Variant</th>
                  <th>Barcode / Serial</th>
                  <th>Source Facility</th>
                  <th>Destination Hub</th>
                  <th>Transfer Reason</th>
                  <th>Transfer Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransfers.length > 0 ? (
                  pendingTransfers.map((unit) => (
                    <tr key={unit.id}>
                      <td style={{ fontWeight: 600 }}>{unit.product_variants?.product_name || 'ZUVO TV'}</td>
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{unit.barcode}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SN: {unit.serial_number}</div>
                      </td>
                      <td>
                        <span className="badge badge-slate">
                          {unit.transfer_details?.from_wh?.warehouse_name || 'Source Hub'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                          ➔ {unit.transfer_details?.to_wh?.warehouse_name || 'Destination Hub'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{unit.transfer_details?.movement_reason || 'Stock Transfer'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(unit.updated_at).toLocaleString()}
                      </td>
                      <td>
                        {canManageInventory && (
                          <button
                            className="btn btn-success btn-sm"
                            disabled={receivingUnitId === unit.id}
                            onClick={() => handleReceiveTransfer(unit.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <CheckCircle size={14} />
                            {receivingUnitId === unit.id ? 'Receiving...' : 'Receive & Verify Stock'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No units currently in transit between warehouses.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Movement Audit Ledger */}
      {activeTab === 'history' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Inventory Movement Audit Ledger</h3>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search serial / barcode / hub..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                />
              </div>

              <select
                className="input-field"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="all">All Movements</option>
                <option value="warehouse_transfer">Warehouse Transfers</option>
                <option value="stock_received">Stock Received</option>
                <option value="sale">Sales</option>
                <option value="return">RMA Returns</option>
                <option value="service">Service Movements</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Unit Serial / Barcode</th>
                  <th>From Facility</th>
                  <th>To Facility</th>
                  <th>Status Change</th>
                  <th>Reason / Reference</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className={`badge ${
                          tx.transaction_type === 'warehouse_transfer' ? 'badge-warning' :
                          tx.transaction_type === 'stock_received' ? 'badge-success' :
                          tx.transaction_type === 'return' ? 'badge-purple' : 'badge-cyan'
                        }`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {tx.product_units?.serial_number || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {tx.product_units?.barcode} ({tx.product_units?.product_variants?.product_name})
                        </div>
                      </td>
                      <td>{tx.from_wh?.warehouse_name || '—'}</td>
                      <td>{tx.to_wh?.warehouse_name || '—'}</td>
                      <td>
                        <span className="text-muted">{tx.previous_status}</span> ➔ <strong style={{ color: 'var(--brand-primary)' }}>{tx.new_status}</strong>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        <div>{tx.movement_reason || 'System update'}</div>
                        {tx.reference_note && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.reference_note}</div>}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No inventory movement records match search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Warehouse Modal */}
      {isWhModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsWhModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Add Storage Facility / Hub</h2>
            <form onSubmit={handleCreateWarehouse}>
              <div className="input-group">
                <label className="input-label">Facility Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. WH-MUMBAI"
                  value={whCode}
                  onChange={(e) => setWhCode(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Facility Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ZUVO West Distribution Hub"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Facility Type</label>
                <select className="form-input" value={whType} onChange={(e) => setWhType(e.target.value)}>
                  <option value="central_warehouse" style={{ background: '#111827' }}>Central Warehouse</option>
                  <option value="regional_warehouse" style={{ background: '#111827' }}>Regional Warehouse</option>
                  <option value="showroom" style={{ background: '#111827' }}>Showroom</option>
                  <option value="service_center" style={{ background: '#111827' }}>Service Center Attached</option>
                  <option value="dealer_location" style={{ background: '#111827' }}>Dealer Hub</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="input-group">
                  <label className="input-label">City</label>
                  <input type="text" className="form-input" value={whCity} onChange={(e) => setWhCity(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">State</label>
                  <input type="text" className="form-input" value={whState} onChange={(e) => setWhState(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsWhModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Facility</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {isTransferModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsTransferModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Initiate Inter-Warehouse Stock Transfer</h2>
            {transferError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#FDA4AF', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
                {transferError}
              </div>
            )}
            <form onSubmit={handleInitiateTransfer}>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Select In-Stock TV Unit to Transfer *</label>
                {inStockUnits.length === 0 ? (
                  <div style={{ color: 'var(--status-warning)', fontSize: '0.875rem' }}>
                    No units currently in IN_STOCK status across warehouses.
                  </div>
                ) : (
                  <select
                    className="form-input"
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    required
                  >
                    <option value="" style={{ background: '#111827' }}>-- Select TV Unit (Barcode / Serial) --</option>
                    {inStockUnits.map((u) => (
                      <option key={u.id} value={u.id} style={{ background: '#111827' }}>
                        {u.product_variants?.product_name} | Barcode: {u.barcode} | SN: {u.serial_number} (Current Hub: {u.warehouses?.warehouse_name})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Destination Warehouse / Facility *</label>
                <select
                  className="form-input"
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  required
                >
                  <option value="" style={{ background: '#111827' }}>-- Select Destination Hub --</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id} style={{ background: '#111827' }}>
                      {wh.warehouse_name} ({wh.warehouse_code}) - {wh.city || 'HQ'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">Transfer Reason / Reference Note</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Stock rebalance for North Region"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isExecuting || inStockUnits.length === 0}>
                  {isExecuting ? 'Initiating Transfer...' : 'Initiate Stock Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 7.1: Create Stock Transfer Manifest Modal */}
      {isCreateManifestModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateManifestModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck style={{ color: 'var(--brand-primary)' }} /> Create Inter-Depot Stock Transfer
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsCreateManifestModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {manifestFormError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#FDA4AF', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
                {manifestFormError}
              </div>
            )}

            <form onSubmit={handleCreateManifestSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="input-group">
                  <label className="input-label">Source Depot / Warehouse *</label>
                  <select
                    className="form-input"
                    value={manifestSourceWh}
                    onChange={(e) => setManifestSourceWh(e.target.value)}
                    required
                  >
                    <option value="" style={{ background: '#111827' }}>-- Select Origin Depot --</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id} style={{ background: '#111827' }}>
                        {wh.warehouse_name} ({wh.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Destination Depot / Warehouse *</label>
                  <select
                    className="form-input"
                    value={manifestDestWh}
                    onChange={(e) => setManifestDestWh(e.target.value)}
                    required
                  >
                    <option value="" style={{ background: '#111827' }}>-- Select Target Depot --</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id} style={{ background: '#111827' }}>
                        {wh.warehouse_name} ({wh.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="input-group">
                  <label className="input-label">Carrier / Logistics Provider</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ZUVO Fleet / BlueDart Logistics"
                    value={manifestCarrier}
                    onChange={(e) => setManifestCarrier(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Vehicle Registration #</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. DL-01-AB-1234"
                    value={manifestVehicle}
                    onChange={(e) => setManifestVehicle(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="input-group">
                  <label className="input-label">Driver Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rajesh Kumar"
                    value={manifestDriver}
                    onChange={(e) => setManifestDriver(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Driver Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. +91 98765 43210"
                    value={manifestDriverPhone}
                    onChange={(e) => setManifestDriverPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label">Dispatch Notes & Security Instructions</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Security seal numbers, route details, special transit instructions..."
                  value={manifestNotes}
                  onChange={(e) => setManifestNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsCreateManifestModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isExecuting}>
                  {isExecuting ? 'Creating Manifest...' : 'Create Transfer Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 7.1: Barcode Dispatch Scanning Modal */}
      {isScanDispatchModalOpen && selectedTransfer && (
        <div className="modal-backdrop" onClick={() => setIsScanDispatchModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarcodeIcon style={{ color: 'var(--brand-primary)' }} /> Dispatch Scanning & Manifest Intake
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Manifest #{selectedTransfer.transfer_number} | Origin: {selectedTransfer.source_warehouse?.warehouse_name} ➔ {selectedTransfer.destination_warehouse?.warehouse_name}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsScanDispatchModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {scanFeedback && (
              <div style={{
                background: scanFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                color: scanFeedback.type === 'success' ? 'var(--accent-emerald)' : '#FDA4AF',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {scanFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {scanFeedback.message}
              </div>
            )}

            <form onSubmit={handleDispatchScanSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                className="form-input"
                autoFocus
                placeholder="Scan or type TV Barcode / Serial Number (e.g. ZUV-55-4K-001)..."
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                disabled={isSubmittingScan}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '1rem', letterSpacing: '0.5px' }}
              />
              <button type="submit" className="btn btn-primary" disabled={isSubmittingScan || !scannedBarcode.trim()}>
                {isSubmittingScan ? 'Validating...' : 'Add Unit'}
              </button>
            </form>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Manifest Scanned Units ({transferItems.length})</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {selectedTransfer.status.toUpperCase()}</span>
              </h4>

              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Serial Number</th>
                      <th>Model</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferItems.length > 0 ? (
                      transferItems.map((it) => (
                        <tr key={it.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{it.barcode}</td>
                          <td>{it.serial_number || it.product_unit?.serial_number || 'N/A'}</td>
                          <td>{it.product_unit?.product_variants?.product_name || 'ZUVO TV'}</td>
                          <td>
                            <span className="badge badge-success">{it.item_status}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No units scanned onto this manifest yet. Scan a barcode above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenManifest(selectedTransfer)}
              >
                <FileText size={15} /> Preview Manifest
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setIsScanDispatchModalOpen(false)} className="btn btn-secondary">
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={transferItems.length === 0 || isExecuting}
                  onClick={() => handleAuthorizeDispatch(selectedTransfer.id)}
                >
                  <Truck size={15} /> Authorize & Dispatch Manifest ({transferItems.length} Units)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 7.1: Barcode Receiving & Inspection Modal */}
      {isScanReceiveModalOpen && selectedTransfer && (
        <div className="modal-backdrop" onClick={() => setIsScanReceiveModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 style={{ color: 'var(--accent-emerald)' }} /> Receiving Dock Barcode Audit
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Manifest #{selectedTransfer.transfer_number} | Dest Hub: {selectedTransfer.destination_warehouse?.warehouse_name}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsScanReceiveModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {scanFeedback && (
              <div style={{
                background: scanFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                color: scanFeedback.type === 'success' ? 'var(--accent-emerald)' : '#FDA4AF',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {scanFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {scanFeedback.message}
              </div>
            )}

            <form onSubmit={handleReceivingScanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-input"
                  autoFocus
                  placeholder="Scan receiving barcode or serial..."
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  disabled={isSubmittingScan}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}
                />
                <button type="submit" className="btn btn-success" disabled={isSubmittingScan || !scannedBarcode.trim()}>
                  {isSubmittingScan ? 'Verifying...' : 'Receive Unit'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--accent-rose)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={scanDamaged}
                    onChange={(e) => setScanDamaged(e.target.checked)}
                  />
                  Mark Unit as Damaged / Broken Packaging
                </label>
                {scanDamaged && (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Describe transit damage (e.g. cracked display, wet carton)..."
                    value={scanNotes}
                    onChange={(e) => setScanNotes(e.target.value)}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  />
                )}
              </div>
            </form>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>
                Manifest Line Items ({transferItems.length})
              </h4>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Serial Number</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th>Damaged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferItems.map((it) => (
                      <tr key={it.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{it.barcode}</td>
                        <td>{it.serial_number || it.product_unit?.serial_number || 'N/A'}</td>
                        <td>{it.product_unit?.product_variants?.product_name || 'ZUVO TV'}</td>
                        <td>
                          <span className={`badge ${
                            it.item_status === 'received' ? 'badge-success' :
                            it.item_status === 'unexpected' ? 'badge-purple' :
                            it.item_status === 'damaged' ? 'badge-warning' : 'badge-slate'
                          }`}>
                            {it.item_status}
                          </span>
                        </td>
                        <td>{it.is_damaged ? <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>YES</span> : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenManifest(selectedTransfer)}
              >
                <FileText size={15} /> View Full Manifest
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setIsScanReceiveModalOpen(false)} className="btn btn-secondary">
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={() => handleReconcileTransfer(selectedTransfer.id)}
                  disabled={isExecuting}
                >
                  <ShieldCheck size={15} /> Finalize Reconciliation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 7.1: Printable / PDF / CSV Digital Manifest Modal */}
      <TransferManifestModal
        isOpen={isManifestViewOpen}
        onClose={() => setIsManifestViewOpen(false)}
        manifest={activeManifestData}
      />
    </div>
  );
};
