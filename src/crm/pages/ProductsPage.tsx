import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Tv, Plus, Search, QrCode, Filter, MapPin, CheckCircle, AlertCircle,
  Download, FileSpreadsheet, Printer, Clock, Wand2, ArrowRight, Check,
  Store, ShieldCheck, RotateCcw, Box, CheckCircle2, Trash2
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';
import { BarcodeLabelModal } from '../components/common/BarcodeLabelModal';
import { ProductUnitHistoryModal } from '../components/common/ProductUnitHistoryModal';
import { FilterDrawer, FilterField } from '../components/common/FilterDrawer';

export const ProductsPage: React.FC = () => {
  const { role } = useAuth();
  const [variants, setVariants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    variant: '',
    status: '',
    warehouse: '',
    search: '',
  });
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
    variant: '',
    status: '',
    warehouse: '',
    search: '',
  });

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  // Multi-step Structured Intake Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3 | 4>(1);
  const [newUnitVariantId, setNewUnitVariantId] = useState('');
  const [newUnitWarehouseId, setNewUnitWarehouseId] = useState('');
  const [newUnitSource, setNewUnitSource] = useState('ZUVO Factory Direct Assembly');
  const [newUnitCost, setNewUnitCost] = useState('12500');
  const [newUnitPurchaseDate, setNewUnitPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newUnitNotes, setNewUnitNotes] = useState('');
  const [customSerialInput, setCustomSerialInput] = useState('');
  const [customBarcodeInput, setCustomBarcodeInput] = useState('');

  // Post-Creation Result State (Section 12 requirement)
  const [creationResult, setCreationResult] = useState<{
    unit: any;
    serialNumber: string;
    barcode: string;
    variantName: string;
    source: string;
    cost: number;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Product Variant Modal State
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [newVarCode, setNewVarCode] = useState('');
  const [newVarName, setNewVarName] = useState('');
  const [newVarSize, setNewVarSize] = useState('32');
  const [newVarType, setNewVarType] = useState('smart');
  const [newVarBt, setNewVarBt] = useState(true);
  const [newVarVoice, setNewVarVoice] = useState(true);
  const [newVarCost, setNewVarCost] = useState('12500');
  const [isSubmittingVariant, setIsSubmittingVariant] = useState(false);
  const [variantFormError, setVariantFormError] = useState<string | null>(null);

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
            id,
            product_code,
            product_name,
            screen_size,
            model_id,
            product_models:model_id (model_name)
          )
        `)
        .order('received_at', { ascending: false });

      setUnits(uData || []);
    } catch (err) {
      console.error('Error loading products data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenIntakeModal = (preselectedVariantId?: string) => {
    setFormError(null);
    setCreationResult(null);
    setIntakeStep(1);
    if (preselectedVariantId) {
      setNewUnitVariantId(preselectedVariantId);
    } else if (variants.length > 0 && !newUnitVariantId) {
      setNewUnitVariantId(variants[0].id);
    }
    setCustomSerialInput('');
    setCustomBarcodeInput('');
    setNewUnitNotes('');
    setIsModalOpen(true);
  };

  const generateSafeSerialNumber = (variant: any): string => {
    const code = variant?.product_code?.replace(/[^A-Z0-9]/g, '') || 'ZUV';
    const year = new Date().getFullYear();
    const randomHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    return `${code}-${year}-${randomHex}`;
  };

  const handleCreateUnitFinal = async () => {
    if (!newUnitVariantId || !newUnitWarehouseId) {
      setFormError('Product variant and destination warehouse are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const selectedVar = variants.find(v => v.id === newUnitVariantId);
    const assignedSerial = customSerialInput.trim() || generateSafeSerialNumber(selectedVar);

    try {
      // 1. If barcode not explicitly entered, generate using server sequence RPC
      let assignedBarcode = customBarcodeInput.trim();
      if (!assignedBarcode) {
        try {
          const { data: bCode } = await (supabase.rpc as any)('generate_product_unit_barcode');
          if (bCode) assignedBarcode = bCode;
        } catch (bErr) {
          console.warn('Barcode RPC fallback:', bErr);
        }
      }

      // 2. Call create_product_unit RPC with validated parameters
      const notePayload = [
        newUnitSource ? `Source: ${newUnitSource}` : null,
        newUnitPurchaseDate ? `Date: ${newUnitPurchaseDate}` : null,
        newUnitNotes.trim() ? newUnitNotes.trim() : null
      ].filter(Boolean).join(' | ');

      const { data, error } = await (supabase.rpc as any)('create_product_unit', {
        p_variant_id: newUnitVariantId,
        p_warehouse_id: newUnitWarehouseId,
        p_serial_number: assignedSerial,
        p_barcode: assignedBarcode || null,
        p_purchase_cost: parseFloat(newUnitCost) || 0,
        p_status: 'in_stock',
        p_notes: notePayload || null
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create product unit.');
      }

      // 3. Immediately show the verified creation result screen
      setCreationResult({
        unit: data.unit,
        serialNumber: data.serial_number || assignedSerial,
        barcode: data.barcode || assignedBarcode,
        variantName: selectedVar?.product_name || 'ZUVO TV',
        source: newUnitSource,
        cost: parseFloat(newUnitCost) || 0
      });

      setIntakeStep(4);
      loadData();
    } catch (err: any) {
      console.error('Error creating product unit:', err);
      setFormError(err.message || 'Failed to create physical unit. Please check input parameters and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unitId: string, serial: string) => {
    if (!window.confirm(`Are you sure you want to delete unit "${serial}"? This will permanently remove it from Supabase database and inventory.`)) {
      return;
    }
    try {
      // 1. Delete or uncouple all child records that reference this product_unit_id to satisfy foreign key constraints
      // Explicitly check for errors on child table deletions so foreign key violations are prevented
      const childDeletes = [
        { table: 'inventory_transactions', col: 'product_unit_id' },
        { table: 'stock_transfer_items', col: 'product_unit_id' },
        { table: 'stock_transfer_audit_logs', col: 'product_unit_id' },
        { table: 'dealer_consignment_movements', col: 'product_unit_id' },
        { table: 'dealer_consignment_stock', col: 'product_unit_id' },
        { table: 'landed_cost_unit_allocations', col: 'product_unit_id' },
        { table: 'sales_order_deliveries', col: 'product_unit_id' },
        { table: 'sales_order_items', col: 'product_unit_id' },
        { table: 'warranty_claims', col: 'product_unit_id' },
        { table: 'warranty_extensions', col: 'product_unit_id' },
        { table: 'warranty_transfers', col: 'product_unit_id' },
        { table: 'warranties', col: 'product_unit_id' },
        { table: 'service_tickets', col: 'product_unit_id' },
        { table: 'sales_returns', col: 'product_unit_id' },
        { table: 'sale_items', col: 'product_unit_id' },
        { table: 'media_attachments', col: 'product_unit_id' },
      ];

      for (const item of childDeletes) {
        const { error: childErr } = await (supabase.from as any)(item.table).delete().eq(item.col, unitId);
        if (childErr && childErr.code !== 'PGRST116' && childErr.code !== '42P01') {
          // If table exists and has permission error or foreign key error, log and check
          console.warn(`Cleaned up ${item.table} for unit ${unitId}:`, childErr);
        }
      }

      // 2. Delete the unit itself from Supabase
      const { error } = await supabase.from('product_units').delete().eq('id', unitId);
      if (error) {
        console.error('Error deleting product unit:', error);
        throw error;
      }

      // 3. Immediately reflect in UI state
      setUnits(prev => prev.filter(u => u.id !== unitId));
      alert(`Unit ${serial} successfully deleted from both CRM web and Supabase database.`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete unit:', err);
      alert(`Delete failed: ${err.message || 'Error deleting unit from database'}`);
    }
  };

  const handleDeleteVariant = async (variantId: string, modelName: string) => {
    if (!window.confirm(`Are you sure you want to delete TV variant "${modelName}"?\nThis will remove the catalog model definition and any associated units from Supabase.`)) {
      return;
    }
    try {
      // Find all units belonging to this variant to clean them up properly
      const { data: linkedUnits } = await supabase.from('product_units').select('id').eq('variant_id', variantId);
      if (linkedUnits && linkedUnits.length > 0) {
        const unitIds = linkedUnits.map(u => u.id);
        const childTables = [
          'inventory_transactions',
          'stock_transfer_items',
          'stock_transfer_audit_logs',
          'dealer_consignment_movements',
          'dealer_consignment_stock',
          'landed_cost_unit_allocations',
          'sales_order_deliveries',
          'sales_order_items',
          'warranty_claims',
          'warranty_extensions',
          'warranty_transfers',
          'warranties',
          'service_tickets',
          'sales_returns',
          'sale_items',
          'media_attachments',
        ];
        for (const tbl of childTables) {
          await (supabase.from as any)(tbl).delete().in('product_unit_id', unitIds);
        }
        await supabase.from('product_units').delete().eq('variant_id', variantId);
      }

      const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
      if (error) throw error;
      setVariants(prev => prev.filter(v => v.id !== variantId));
      alert(`Product variant "${modelName}" deleted successfully from both CRM web and Supabase.`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete variant:', err);
      alert(`Delete failed: ${err.message || 'Check if there are linked records'}`);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarCode.trim() || !newVarName.trim()) {
      setVariantFormError('Product Code and Product Name are required.');
      return;
    }

    setIsSubmittingVariant(true);
    setVariantFormError(null);

    try {
      const { data, error } = await supabase
        .from('product_variants')
        .insert([{
          product_code: newVarCode.trim().toUpperCase(),
          product_name: newVarName.trim(),
          model_id: newVarCode.trim().toUpperCase(),
          screen_size: parseInt(newVarSize) || 32,
          tv_type: newVarType,
          bluetooth: newVarBt,
          voice_remote: newVarVoice
        }])
        .select()
        .single();

      if (error) throw error;

      alert(`TV Variant "${newVarName}" created successfully!`);
      setIsAddVariantModalOpen(false);
      setNewVarCode('');
      setNewVarName('');
      loadData();
    } catch (err: any) {
      console.error('Error creating variant:', err);
      setVariantFormError(err.message || 'Failed to create variant. Code may already exist.');
    } finally {
      setIsSubmittingVariant(false);
    }
  };

  // Filter Drawer Definition
  const filterFields: FilterField[] = [
    {
      id: 'variant',
      label: 'Product Variant',
      type: 'select',
      options: variants.map(v => ({ value: v.id, label: `${v.product_name} (${v.screen_size}")` }))
    },
    {
      id: 'status',
      label: 'Stock Status',
      type: 'select',
      options: [
        { value: 'in_stock', label: 'In Stock' },
        { value: 'sold', label: 'Sold & Activated' },
        { value: 'in_service', label: 'In Service / Repair' },
        { value: 'defective', label: 'Defective Core' },
      ]
    },
    {
      id: 'warehouse',
      label: 'Logistics Facility',
      type: 'select',
      options: warehouses.map(wh => ({ value: wh.id, label: wh.warehouse_name }))
    },
    {
      id: 'search',
      label: 'Serial or Barcode',
      type: 'text',
      placeholder: 'Search serial or barcode...'
    }
  ];

  const handleApplyFilters = () => {
    setActiveFilters({ ...filterValues });
    setPage(1);
  };

  const handleClearFilters = () => {
    const empty = { variant: '', status: '', warehouse: '', search: '' };
    setFilterValues(empty);
    setActiveFilters(empty);
    setPage(1);
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  // Filter Units
  const filteredUnits = units.filter((u) => {
    const matchesVariant = !activeFilters.variant || u.variant_id === activeFilters.variant;
    const matchesStatus = !activeFilters.status || u.status === activeFilters.status;
    const matchesWarehouse = !activeFilters.warehouse || u.warehouse_id === activeFilters.warehouse;
    const query = activeFilters.search.toLowerCase().trim();
    const matchesSearch = !query ||
      u.serial_number?.toLowerCase().includes(query) ||
      u.barcode?.toLowerCase().includes(query) ||
      u.product_variants?.product_name?.toLowerCase().includes(query);

    return matchesVariant && matchesStatus && matchesWarehouse && matchesSearch;
  });

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

  const canManageInventory = ['super_admin', 'admin', 'inventory'].includes(role || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => {
                setVariantFormError(null);
                setIsAddVariantModalOpen(true);
              }}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} style={{ color: 'var(--accent-mint)' }} />
              + Add Product / Variant
            </button>
            <button
              onClick={() => handleOpenIntakeModal()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              + Add Unit
            </button>
          </div>
        )}
      </div>

      {/* Model Specifications Grid (Selectable Variants as per Section 10) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Standard ZUVO TV Catalog ({variants.length} Variants Available)
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Click a variant card to filter units or receive stock
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          {variants.map((v) => {
            const isSelected = activeFilters.variant === v.id;
            return (
              <div
                key={v.id}
                style={{
                  background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-card)',
                  border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 15px rgba(6, 182, 212, 0.2)' : 'none'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {v.product_code}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0', color: '#FFFFFF' }}>
                    {v.product_name}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <span className="badge badge-slate">{v.screen_size}" Panel</span>
                    <span className="badge badge-cyan">{v.tv_type?.toUpperCase()}</span>
                    {v.voice_remote && <span className="badge badge-purple">Voice Remote</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = isSelected ? '' : v.id;
                      setFilterValues(prev => ({ ...prev, variant: next }));
                      setActiveFilters(prev => ({ ...prev, variant: next }));
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', justifyContent: 'center' }}
                  >
                    {isSelected ? 'Deselect' : 'Select Variant'}
                  </button>
                  {canManageInventory && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenIntakeModal(v.id)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        title="Intake unit for this variant"
                      >
                        + Intake
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(v.id, v.product_name)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 6px', fontSize: '0.75rem', color: 'var(--accent-rose, #f43f5e)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                        title="Delete TV Model Variant"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Units Inventory Table & Filter Drawer Launcher */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Physical Serialized Product Units</h3>
            <span className="badge badge-cyan">{filteredUnits.length} Units</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filter Drawer Trigger Button with Active Count Badge */}
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: activeFilterCount > 0 ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                background: activeFilterCount > 0 ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                color: activeFilterCount > 0 ? 'var(--accent-cyan)' : 'var(--text-primary)'
              }}
            >
              <Filter size={14} />
              <span>FILTER</span>
              {activeFilterCount > 0 && (
                <span style={{
                  background: 'var(--accent-cyan)',
                  color: '#000000',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  fontSize: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

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

            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Table View */}
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
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                          title="Delete TV Unit"
                          onClick={() => handleDeleteUnit(u.id, u.serial_number)}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                    <Box size={36} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: '10px' }} />
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No inventory units yet</div>
                    <div style={{ fontSize: '0.85rem' }}>Add your first TV unit to begin tracking serialized inventory.</div>
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

      {/* Filter Drawer Component (Slides Left to Right) */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Filter TV Units"
        fields={filterFields}
        values={filterValues}
        onChange={(fieldId, val) => setFilterValues(prev => ({ ...prev, [fieldId]: val }))}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Multi-Step Product/Unit Lifecycle Modal (Sections 11, 12, 13, 14, 15) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Physical TV Unit Registration Lifecycle</h2>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Follows strict enterprise sequence: Product → Variant → Source → Purchase Info → Create Unit → Generate Serial & Barcode
              </div>
            </div>

            {formError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#FDA4AF', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            {/* STEP 4: Success Result Screen (Section 12) */}
            {intakeStep === 4 && creationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '10px 0' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                  <CheckCircle2 size={40} style={{ color: 'var(--accent-emerald)', margin: '0 auto 8px auto' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>UNIT CREATED SUCCESSFULLY</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Physical unit record and opening inventory movement transaction logged to database.
                  </p>
                </div>

                {/* Verified Metadata Summary */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Product & Variant</span>
                    <strong style={{ color: '#FFFFFF' }}>{creationResult.variantName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Source / Supplier</span>
                    <strong style={{ color: '#FFFFFF' }}>{creationResult.source}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Purchase Rate</span>
                    <strong style={{ color: 'var(--accent-emerald)' }}>₹ {creationResult.cost.toLocaleString('en-IN')}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Initial Status</span>
                    <span className="badge badge-cyan">IN STOCK</span>
                  </div>
                </div>

                {/* Generated Serial & Barcode Highlight (Section 12) */}
                <div style={{ background: 'rgba(6, 182, 212, 0.06)', border: '1.5px solid var(--accent-cyan)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
                      GENERATED SERIAL NUMBER
                    </span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                      {creationResult.serialNumber}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
                      GENERATED BARCODE
                    </span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {creationResult.barcode}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLabelUnit({
                        barcode: creationResult.barcode,
                        serial_number: creationResult.serialNumber,
                        product_name: creationResult.variantName,
                      });
                    }}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Printer size={15} /> Print Barcode Label
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenIntakeModal()}
                      className="btn btn-secondary"
                    >
                      + Add Another Unit
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn btn-primary"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Steps 1 to 3 Intake Form */
              <form onSubmit={(e) => { e.preventDefault(); handleCreateUnitFinal(); }}>
                {/* Step 1 & 2: Product & Variant Selection */}
                <div className="input-group">
                  <label className="input-label">Step 1 & 2 — Select Product Variant *</label>
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

                {/* Destination Facility */}
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

                {/* Step 3: Source / Supplier */}
                <div className="input-group">
                  <label className="input-label">Step 3 — Unit Source / Supplier *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ZUVO Direct Plant 1, Inward Shipment Batch A"
                    value={newUnitSource}
                    onChange={(e) => setNewUnitSource(e.target.value)}
                    required
                  />
                </div>

                {/* Step 4: Purchase Information */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="input-group">
                    <label className="input-label">Purchase Rate (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newUnitCost}
                      onChange={(e) => setNewUnitCost(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newUnitPurchaseDate}
                      onChange={(e) => setNewUnitPurchaseDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Optional Serial / Barcode overrides */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Serial & Barcode Generation Options
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="input-label" style={{ fontSize: '0.725rem' }}>Serial Number (Optional Override)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Leave blank to auto-generate"
                        value={customSerialInput}
                        onChange={(e) => setCustomSerialInput(e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: '0.725rem' }}>Barcode (Optional Override)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Leave blank to auto-generate"
                        value={customBarcodeInput}
                        onChange={(e) => setCustomBarcodeInput(e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="input-group">
                  <label className="input-label">Intake Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Optional quality remarks or batch identifier..."
                    value={newUnitNotes}
                    onChange={(e) => setNewUnitNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating Unit & Generating Barcode...' : 'Confirm & Create Unit'}
                  </button>
                </div>
              </form>
            )}
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

      {/* Add Product Variant Modal (Section 10) */}
      {isAddVariantModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddVariantModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Create New TV Product / Variant</h2>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Add a new ZUVO television model definition to the official enterprise catalog.
              </div>
            </div>

            {variantFormError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#FDA4AF', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem' }}>
                {variantFormError}
              </div>
            )}

            <form onSubmit={handleCreateVariant}>
              <div className="input-group">
                <label className="input-label">Product Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ZUVO-65-QLED-4K"
                  value={newVarCode}
                  onChange={(e) => setNewVarCode(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Product / Model Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ZUVO 65-inch 4K Ultra HD Smart QLED TV"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Screen Size (Inches) *</label>
                  <select
                    className="form-input"
                    value={newVarSize}
                    onChange={(e) => setNewVarSize(e.target.value)}
                  >
                    <option value="24">24 Inch</option>
                    <option value="32">32 Inch</option>
                    <option value="40">40 Inch</option>
                    <option value="43">43 Inch</option>
                    <option value="50">50 Inch</option>
                    <option value="55">55 Inch</option>
                    <option value="65">65 Inch</option>
                    <option value="75">75 Inch</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">TV Type *</label>
                  <select
                    className="form-input"
                    value={newVarType}
                    onChange={(e) => setNewVarType(e.target.value)}
                  >
                    <option value="smart">Smart LED TV</option>
                    <option value="normal">Normal / Non-Smart</option>
                    <option value="qled">QLED 4K</option>
                    <option value="oled">OLED Premium</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Standard Manufacturing Cost (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newVarCost}
                    onChange={(e) => setNewVarCost(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', paddingTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newVarBt}
                      onChange={(e) => setNewVarBt(e.target.checked)}
                    />
                    Bluetooth Support
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newVarVoice}
                      onChange={(e) => setNewVarVoice(e.target.checked)}
                    />
                    Voice Remote Control
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsAddVariantModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingVariant}>
                  {isSubmittingVariant ? 'Saving Variant...' : 'Save Product Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
