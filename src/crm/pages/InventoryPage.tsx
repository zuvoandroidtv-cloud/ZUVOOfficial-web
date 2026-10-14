import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { Warehouse, ArrowRightLeft, Plus, MapPin, Box, ArrowRight, CheckCircle, Clock, Search, RefreshCw, Download, FileSpreadsheet } from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';

export const InventoryPage: React.FC = () => {
  const { role } = useAuth();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [inStockUnits, setInStockUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matrix' | 'incoming' | 'history'>('matrix');

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

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [transferReason, setTransferReason] = useState('Stock rebalance between hubs');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Receiving Action state
  const [receivingUnitId, setReceivingUnitId] = useState<string | null>(null);

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
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setIsLoading(false);
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
            <button onClick={() => setIsTransferModalOpen(true)} className="btn btn-primary">
              <ArrowRightLeft size={16} />
              Initiate Stock Transfer
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
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'matrix' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('matrix')}
        >
          <Warehouse size={15} /> Facility Stock Matrix ({stockSummary.length})
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
    </div>
  );
};
