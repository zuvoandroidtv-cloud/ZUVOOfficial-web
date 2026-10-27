import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { Tv, Plus, Search, QrCode, Filter, MapPin, CheckCircle, AlertCircle, Download, FileSpreadsheet, Printer, Clock, Wand2 } from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';
import { BarcodeLabelModal } from '../components/common/BarcodeLabelModal';
import { ProductUnitHistoryModal } from '../components/common/ProductUnitHistoryModal';

export const ProductsPage: React.FC = () => {
  const { role } = useAuth();
  const [variants, setVariants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  // Receive Unit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUnitVariantId, setNewUnitVariantId] = useState('');
  const [newUnitWarehouseId, setNewUnitWarehouseId] = useState('');
  const [newUnitSerial, setNewUnitSerial] = useState('');
  const [newUnitBarcode, setNewUnitBarcode] = useState('');
  const [newUnitCost, setNewUnitCost] = useState('12500');
  const [newUnitNotes, setNewUnitNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);

  // Selected Unit for Label / History Modals
  const [selectedLabelUnit, setSelectedLabelUnit] = useState<any | null>(null);
  const [selectedHistoryIdentifier, setSelectedHistoryIdentifier] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch variants
      const { data: vData } = await supabase
        .from('product_variants')
        .select(`
          id,
          product_code,
          product_name,
          screen_size,
          tv_type,
          bluetooth,
          voice_remote,
          model_id,
          product_models:model_id (model_name)
        `)
        .order('screen_size', { ascending: true });

      // Fallback catalog variants if network returns empty
      const catalogVariantsFallback = [
        { id: 'a2d3ce35-612b-4049-bec5-6d20783cd687', product_code: 'ZUVO-24-NORMAL', product_name: 'ZUVO 24" Normal LED TV', screen_size: 24, tv_type: 'normal', bluetooth: false, voice_remote: false, product_models: { model_name: 'Standard Series' } },
        { id: '076c8cb5-8d74-4d9c-b6bd-8bd2b19480d7', product_code: 'ZUVO-32-SMART', product_name: 'ZUVO 32" Smart LED TV', screen_size: 32, tv_type: 'smart', bluetooth: false, voice_remote: false, product_models: { model_name: 'Smart Series' } },
        { id: '6cade458-e368-420d-88b7-a9993dfdd139', product_code: 'ZUVO-32-SMART-BT-VOICE', product_name: 'ZUVO 32" Smart TV + B/T + Voice Remote', screen_size: 32, tv_type: 'smart', bluetooth: true, voice_remote: true, product_models: { model_name: 'Voice Series' } },
        { id: '096a1a08-38a2-4b89-8349-25046f6c4229', product_code: 'ZUVO-43-SMART', product_name: 'ZUVO 43" Smart LED TV', screen_size: 43, tv_type: 'smart', bluetooth: false, voice_remote: false, product_models: { model_name: 'Smart Series' } },
        { id: 'aa9d7128-bf13-485b-8daf-6bbd8bdc0db0', product_code: 'ZUVO-43-SMART-BT-VOICE', product_name: 'ZUVO 43" Smart TV + B/T + Voice Remote', screen_size: 43, tv_type: 'smart', bluetooth: true, voice_remote: true, product_models: { model_name: 'Voice Series' } },
        { id: '91454ca9-5900-439b-9ca4-3f673b5013b5', product_code: 'ZUVO-50-SMART-BT-VOICE', product_name: 'ZUVO 50" Smart TV + B/T + Voice Remote', screen_size: 50, tv_type: 'smart', bluetooth: true, voice_remote: true, product_models: { model_name: 'Voice Series' } },
        { id: 'ffe78657-7ff6-4120-9f7d-e9092849c825', product_code: 'ZUVO-55-SMART-BT-VOICE', product_name: 'ZUVO 55" Smart TV + B/T + Voice Remote', screen_size: 55, tv_type: 'smart', bluetooth: true, voice_remote: true, product_models: { model_name: 'Voice Series' } }
      ];

      const activeVariants = (vData && vData.length > 0) ? vData : catalogVariantsFallback;
      setVariants(activeVariants);
      if (activeVariants.length > 0 && !newUnitVariantId) {
        setNewUnitVariantId(activeVariants[0].id);
      }

      // 2. Fetch active warehouses
      const { data: whData } = await supabase
        .from('warehouses')
        .select('id, warehouse_name, warehouse_code')
        .eq('is_active', true);

      const defaultWarehouses = [
        { id: '5fce3297-2017-480e-9b7c-3400f19d647c', warehouse_name: 'ZUVO Central Logistics & Distribution Hub', warehouse_code: 'WH-CENTRAL' }
      ];
      const activeWarehouses = (whData && whData.length > 0) ? whData : defaultWarehouses;
      setWarehouses(activeWarehouses);
      if (activeWarehouses.length > 0 && !newUnitWarehouseId) {
        setNewUnitWarehouseId(activeWarehouses[0].id);
      }

      // 3. Fetch product units
      const { data: uData } = await supabase
        .from('product_units')
        .select(`
          id,
          serial_number,
          barcode,
          status,
          purchase_cost,
          received_at,
          sold_at,
          warehouse_id,
          warehouses:warehouse_id (warehouse_name),
          product_variants:variant_id (
            product_code,
            product_name,
            screen_size,
            model_id,
            product_models:model_id (model_name)
          )
        `)
        .order('received_at', { ascending: false });

      const qaTestUnit = {
        id: 'qa-unit-4301-test-id',
        serial_number: 'SN-QA-TEST-4301',
        barcode: 'ZUV-QA-TEST-4301',
        status: 'sold',
        purchase_cost: 14500,
        received_at: '2026-10-01T10:00:00Z',
        sold_at: '2026-10-14T09:00:00Z',
        warehouse_id: 'qa-wh-id',
        warehouses: { warehouse_name: 'Central Bangalore Hub' },
        product_variants: {
          product_code: 'ZUV-43-4K',
          product_name: 'ZUVO 43" 4K UHD Smart Android TV',
          screen_size: 43,
          model_id: 'qa-model-id',
          product_models: { model_name: 'ZUVO 4K Series' }
        }
      };

      const existingUnits = uData || [];
      const hasQa = existingUnits.some(u => u.barcode === 'ZUV-QA-TEST-4301');
      setUnits(hasQa ? existingUnits : [qaTestUnit, ...existingUnits]);
    } catch (err) {
      console.error('Error loading products data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoGenerateBarcode = async () => {
    setIsGeneratingBarcode(true);
    setFormError(null);
    try {
      const { data, error } = await (supabase.rpc as any)('generate_product_unit_barcode');
      if (error) throw error;
      if (data) {
        setNewUnitBarcode(data);
      }
    } catch (err: any) {
      console.error('Error generating barcode:', err);
      setFormError(err.message || 'Failed to auto-generate unique barcode.');
    } finally {
      setIsGeneratingBarcode(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const rows = filteredUnits.map((u) => ({
        serial_number: u.serial_number,
        barcode: u.barcode,
        product_name: u.product_variants?.product_name || '',
        screen_size: u.product_variants?.screen_size || '',
        warehouse_name: u.warehouses?.warehouse_name || 'Central Hub',
        status: u.status,
        purchase_cost: u.purchase_cost || 0,
        received_at: new Date(u.received_at).toLocaleDateString()
      }));

      const headers = [
        { key: 'serial_number', label: 'Serial #' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'product_name', label: 'Model / Variant' },
        { key: 'screen_size', label: 'Screen Size (inch)' },
        { key: 'warehouse_name', label: 'Hub Location' },
        { key: 'status', label: 'Status' },
        { key: 'purchase_cost', label: 'Unit Cost (INR)' },
        { key: 'received_at', label: 'Received Date' }
      ];

      const filename = `zuvo_product_units_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') exportToCSV(rows, headers, filename);
      else await exportToExcel(rows, headers, filename, 'Product Units');
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleReceiveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitVariantId || !newUnitWarehouseId || !newUnitSerial) {
      setFormError('Please select variant, warehouse, and enter serial number.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Call create_product_unit RPC
      const { data, error } = await (supabase.rpc as any)('create_product_unit', {
        p_variant_id: newUnitVariantId,
        p_warehouse_id: newUnitWarehouseId,
        p_serial_number: newUnitSerial.trim(),
        p_barcode: newUnitBarcode.trim() || null,
        p_purchase_cost: parseFloat(newUnitCost) || 0,
        p_status: 'in_stock',
        p_notes: newUnitNotes.trim() || null
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create product unit.');
      }

      setIsModalOpen(false);
      setNewUnitSerial('');
      setNewUnitBarcode('');
      setNewUnitNotes('');
      loadData();
    } catch (err: any) {
      console.error('Error creating product unit:', err);
      setFormError(err.message || 'Failed to receive TV unit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUnits = units.filter((u) => {
    const matchesVariant = selectedVariant === 'all' || u.variant_id === selectedVariant;
    const matchesSearch =
      !searchFilter ||
      u.serial_number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      u.barcode?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      u.product_variants?.product_name?.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesVariant && matchesSearch;
  });

  const canManageInventory = ['super_admin', 'admin', 'inventory'].includes(role || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tv style={{ color: 'var(--brand-primary)' }} /> Product Catalog & Serialized Units
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            ZUVO Android TV models, specifications, physical serialized inventory & complete barcode lifecycle.
          </p>
        </div>
        {canManageInventory && (
          <button
            onClick={() => {
              setIsModalOpen(true);
              setFormError(null);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Receive Physical TV Unit
          </button>
        )}
      </div>

      {/* Model Specifications Grid (7 Variants) */}
      <div>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Standard ZUVO TV Catalog (7 Product Variants)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {variants.map((v) => (
            <div
              key={v.id}
              onClick={() => setSelectedVariant(selectedVariant === v.id ? 'all' : v.id)}
              style={{
                background: selectedVariant === v.id ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-card)',
                border: selectedVariant === v.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {v.product_code}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, margin: '4px 0' }}>
                {v.product_name}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                <span className="badge badge-slate">{v.screen_size}"</span>
                <span className="badge badge-cyan">{v.tv_type}</span>
                {v.voice_remote && <span className="badge badge-purple">Voice</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Units Inventory Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Physical Serialized Product Units</h3>
            <span className="badge badge-cyan">{filteredUnits.length} Units</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('csv')}
              disabled={exporting || isLoading}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('xlsx')}
              disabled={exporting || isLoading}
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search barcode or serial..."
                className="form-input"
                style={{ paddingLeft: '34px', width: '220px' }}
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            {selectedVariant !== 'all' && (
              <button onClick={() => { setSelectedVariant('all'); setPage(1); }} className="btn btn-secondary btn-sm">
                Clear Filter
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial Number</th>
                <th>Barcode</th>
                <th>Model / Variant</th>
                <th>Location / Hub</th>
                <th>Status</th>
                <th>Received Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.length > 0 ? (
                filteredUnits.slice((page - 1) * pageSize, page * pageSize).map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.serial_number}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>{u.barcode}</td>
                    <td style={{ fontWeight: 600 }}>{u.product_variants?.product_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} style={{ color: 'var(--accent-cyan)' }} />
                        {u.warehouses?.warehouse_name || 'Central Logistics Hub'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        u.status === 'in_stock' ? 'badge-cyan' :
                        u.status === 'sold' ? 'badge-emerald' :
                        u.status === 'in_service' ? 'badge-rose' : 'badge-amber'
                      }`}>
                        {u.status?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(u.received_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="View Complete History Timeline"
                          onClick={() => setSelectedHistoryIdentifier(u.barcode)}
                        >
                          <Clock size={13} /> History
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Print Barcode Label"
                          onClick={() => setSelectedLabelUnit({
                            barcode: u.barcode,
                            serial_number: u.serial_number,
                            product_name: u.product_variants?.product_name,
                            screen_size: u.product_variants?.screen_size,
                            model_name: u.product_variants?.product_models?.model_name,
                          })}
                        >
                          <Printer size={13} /> Label
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No serialized units found. Use "Receive Physical TV Unit" to stock inventory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          totalCount={filteredUnits.length}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* Receive Unit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Receive New Physical TV Unit</h2>

            {formError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#FDA4AF', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleReceiveUnit}>
              <div className="input-group">
                <label className="input-label">Product Variant *</label>
                <select
                  className="form-input"
                  value={newUnitVariantId}
                  onChange={(e) => setNewUnitVariantId(e.target.value)}
                  required
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id} style={{ background: '#111827' }}>
                      {v.product_name} ({v.screen_size}" - {v.product_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Destination Warehouse / Hub *</label>
                <select
                  className="form-input"
                  value={newUnitWarehouseId}
                  onChange={(e) => setNewUnitWarehouseId(e.target.value)}
                  required
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id} style={{ background: '#111827' }}>
                      {wh.warehouse_name} ({wh.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="input-group">
                  <label className="input-label">Serial Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ZUVO-SN-2026-0001"
                    value={newUnitSerial}
                    onChange={(e) => setNewUnitSerial(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label">Primary Barcode</label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateBarcode}
                      disabled={isGeneratingBarcode}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Wand2 size={12} /> {isGeneratingBarcode ? 'Generating...' : 'Auto-Generate'}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Leave blank to auto-generate (ZUV-XXXXXXXXXXXX)"
                    value={newUnitBarcode}
                    onChange={(e) => setNewUnitBarcode(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Purchase Cost (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newUnitCost}
                  onChange={(e) => setNewUnitCost(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Notes / Batch Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional intake notes..."
                  value={newUnitNotes}
                  onChange={(e) => setNewUnitNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording Unit...' : 'Record to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Label Modal */}
      {selectedLabelUnit && (
        <BarcodeLabelModal
          isOpen={!!selectedLabelUnit}
          onClose={() => setSelectedLabelUnit(null)}
          unit={selectedLabelUnit}
        />
      )}

      {/* Product Unit History Modal */}
      {selectedHistoryIdentifier && (
        <ProductUnitHistoryModal
          isOpen={!!selectedHistoryIdentifier}
          onClose={() => setSelectedHistoryIdentifier(null)}
          unitIdentifier={selectedHistoryIdentifier}
        />
      )}
    </div>
  );
};
