import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  Search,
  Plus,
  Tv,
  CheckCircle,
  AlertTriangle,
  Layers,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Truck,
  ClipboardCheck,
  ArrowRightLeft,
  ShieldCheck,
  Check,
  Wrench,
  Cpu,
  Recycle
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';

export const SparePartsPage: React.FC = () => {
  const { currentRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'catalog' | 'compatibility' | 'consumption' | 'trunk_management' | 'reverse_logistics' | 'refurb_bench'>('catalog');
  const [parts, setParts] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [compatibilities, setCompatibilities] = useState<any[]>([]);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Phase 7.4: Admin Trunk Management State
  const [techniciansList, setTechniciansList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [allTrunkStocks, setAllTrunkStocks] = useState<any[]>([]);
  const [pendingReconciliations, setPendingReconciliations] = useState<any[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    technicianId: '',
    warehouseId: '',
    sparePartId: '',
    quantity: 1,
    reason: 'Initial stock issuance to field van'
  });
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [reviewingReconciliation, setReviewingReconciliation] = useState(false);

  // Phase 7.5: Reverse Logistics & Core Quarantine State
  const [reverseManifests, setReverseManifests] = useState<any[]>([]);
  const [allDefectiveCores, setAllDefectiveCores] = useState<any[]>([]);
  const [selectedManifest, setSelectedManifest] = useState<any | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedCoreToInspect, setSelectedCoreToInspect] = useState<any | null>(null);
  const [receiveManifestForm, setReceiveManifestForm] = useState({
    intakeNotes: '',
    itemConditions: {} as Record<string, string>,
    itemStatuses: {} as Record<string, string>
  });
  const [inspectCoreForm, setInspectCoreForm] = useState({
    action: 'APPROVED_FOR_REFURB' as 'APPROVED_FOR_REFURB' | 'SCRAPPED',
    qaPassed: true,
    conditionGrading: 'GRADE_B',
    coreCreditAmount: 0,
    inspectionNotes: ''
  });
  const [submittingIntake, setSubmittingIntake] = useState(false);
  const [submittingInspect, setSubmittingInspect] = useState(false);

  // Phase 7.6: Engineering Rework, Bench QA & Restock / Scrap State
  const [refurbWorkOrders, setRefurbWorkOrders] = useState<any[]>([]);
  const [scrapDispositionRecords, setScrapDispositionRecords] = useState<any[]>([]);
  const [showCreateWorkOrderModal, setShowCreateWorkOrderModal] = useState(false);
  const [showBenchTestModal, setShowBenchTestModal] = useState(false);
  const [showCertifyRestockModal, setShowCertifyRestockModal] = useState(false);
  const [showScrapBatchModal, setShowScrapBatchModal] = useState(false);
  const [selectedCoreForRework, setSelectedCoreForRework] = useState<any | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any | null>(null);
  const [selectedScrapCores, setSelectedScrapCores] = useState<string[]>([]);

  const [createWoForm, setCreateWoForm] = useState({
    assignedEngineerId: '',
    diagnosticsNotes: ''
  });
  const [benchTestForm, setBenchTestForm] = useState({
    rail12vTested: true,
    rail24vTested: true,
    rail5vTested: true,
    burnInDurationHours: 2,
    opticalPanelPassed: true,
    audioChassisPassed: true,
    laborMinutes: 45,
    diagnosticsNotes: ''
  });
  const [certifyRestockForm, setCertifyRestockForm] = useState({
    destinationWarehouseId: '',
    restockNotes: ''
  });
  const [scrapBatchForm, setScrapBatchForm] = useState({
    recyclerVendorName: 'EcoRecycle Solutions India Pvt Ltd',
    authorizedCpcbId: 'CPCB-REG-2026-EW-0982',
    totalWeightKg: 12.5,
    salvageCreditRealized: 1500,
    dispositionNotes: 'Scrapped beyond economical repair'
  });
  const [submittingWo, setSubmittingWo] = useState(false);
  const [submittingTest, setSubmittingTest] = useState(false);
  const [submittingRestock, setSubmittingRestock] = useState(false);
  const [submittingScrapBatch, setSubmittingScrapBatch] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const fetchPartsData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'catalog') {
        const [partsRes, stockRes] = await Promise.all([
          supabase.from('spare_parts').select('*').order('part_code', { ascending: true }),
          supabase.from('spare_parts_stock_summary').select('*')
        ]);
        setParts(partsRes.data || []);
        setStockSummary(stockRes.data || []);
      } else if (activeTab === 'compatibility') {
        const { data, error } = await supabase
          .from('spare_part_compatibility')
          .select(`
            *,
            spare_parts(part_code, part_name, category),
            product_variants(product_name, product_code, screen_size)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setCompatibilities(data || []);
      } else if (activeTab === 'consumption') {
        const { data, error } = await supabase
          .from('spare_parts_consumption')
          .select('*')
          .order('total_quantity_used', { ascending: false });
        if (error) throw error;
        setConsumptions(data || []);
      } else if (activeTab === 'trunk_management') {
        const [techsRes, whRes, partsRes, trunkRes, recRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, phone, employee_code, roles(name)').eq('roles.name', 'technician'),
          supabase.from('warehouses').select('id, warehouse_name, warehouse_code').eq('is_active', true),
          supabase.from('spare_parts').select('id, part_name, part_code').eq('is_active', true),
          supabase.from('technician_trunk_inventory').select(`
            *,
            profiles!technician_trunk_inventory_technician_id_fkey(full_name, employee_code),
            spare_parts!technician_trunk_inventory_spare_part_id_fkey(part_name, part_code, category)
          `),
          supabase.from('technician_van_reconciliations').select(`
            *,
            profiles!technician_van_reconciliations_technician_id_fkey(full_name, employee_code),
            technician_van_reconciliation_lines(
              id,
              spare_part_id,
              system_quantity,
              physical_count,
              variance,
              reason,
              spare_parts(part_name, part_code)
            )
          `).order('created_at', { ascending: false })
        ]);

        setTechniciansList(techsRes.data || []);
        setWarehousesList(whRes.data || []);
        setParts(partsRes.data || []);
        setAllTrunkStocks(trunkRes.data || []);
        setPendingReconciliations(recRes.data || []);

        if (techsRes.data && techsRes.data.length > 0 && !issueForm.technicianId) {
          setIssueForm(prev => ({ ...prev, technicianId: techsRes.data[0].id }));
        }
        if (whRes.data && whRes.data.length > 0 && !issueForm.warehouseId) {
          setIssueForm(prev => ({ ...prev, warehouseId: whRes.data[0].id }));
        }
        if (partsRes.data && partsRes.data.length > 0 && !issueForm.sparePartId) {
          setIssueForm(prev => ({ ...prev, sparePartId: partsRes.data[0].id }));
        }
      } else if (activeTab === 'reverse_logistics') {
        const [manifestsRes, coresRes, whRes] = await Promise.all([
          supabase.from('rma_reverse_manifests').select(`
            *,
            profiles!rma_reverse_manifests_technician_id_fkey(full_name, employee_code, phone),
            warehouses!rma_reverse_manifests_destination_warehouse_id_fkey(warehouse_name, warehouse_code),
            rma_reverse_manifest_items(
              id,
              manifest_id,
              defective_core_id,
              item_status,
              received_condition,
              received_at,
              technician_defective_cores(
                id,
                core_tag_number,
                item_type,
                serial_number,
                barcode,
                defect_symptom,
                core_credit_eligible,
                estimated_core_value,
                custody_status,
                spare_parts(part_name, part_code),
                product_units(serial_number, barcode, product_variants(product_name))
              )
            )
          `).order('created_at', { ascending: false }),
          supabase.from('technician_defective_cores').select(`
            *,
            profiles!technician_defective_cores_technician_id_fkey(full_name, employee_code),
            spare_parts(part_name, part_code, category),
            product_units(serial_number, barcode, product_variants(product_name)),
            service_tickets(ticket_number)
          `).order('created_at', { ascending: false }),
          supabase.from('warehouses').select('id, warehouse_name, warehouse_code').eq('is_active', true)
        ]);

        setReverseManifests(manifestsRes.data || []);
        setAllDefectiveCores(coresRes.data || []);
        setWarehousesList(whRes.data || []);
      } else if (activeTab === 'refurb_bench') {
        const [woRes, coresRes, whRes, scrapRes] = await Promise.all([
          supabase.from('core_refurbishment_work_orders').select(`
            *,
            assigned_engineer:profiles!core_refurbishment_work_orders_assigned_engineer_id_fkey(full_name, employee_code),
            restocked_warehouse:warehouses!core_refurbishment_work_orders_restocked_warehouse_id_fkey(warehouse_name, warehouse_code),
            defective_core:technician_defective_cores(
              id,
              core_tag_number,
              item_type,
              serial_number,
              barcode,
              defect_symptom,
              custody_status,
              spare_parts(part_name, part_code),
              product_units(serial_number, barcode, product_variants(product_name))
            )
          `).order('created_at', { ascending: false }),
          supabase.from('technician_defective_cores').select(`
            *,
            profiles!technician_defective_cores_technician_id_fkey(full_name, employee_code),
            spare_parts(part_name, part_code, category),
            product_units(serial_number, barcode, product_variants(product_name))
          `).order('created_at', { ascending: false }),
          supabase.from('warehouses').select('id, warehouse_name, warehouse_code').eq('is_active', true),
          supabase.from('core_scrap_disposition_records').select('*').order('created_at', { ascending: false })
        ]);

        setRefurbWorkOrders(woRes.data || []);
        setAllDefectiveCores(coresRes.data || []);
        setWarehousesList(whRes.data || []);
        setScrapDispositionRecords(scrapRes.data || []);
        if (whRes.data && whRes.data.length > 0 && !certifyRestockForm.destinationWarehouseId) {
          setCertifyRestockForm(prev => ({ ...prev, destinationWarehouseId: whRes.data[0].id }));
        }
      }
    } catch (err: any) {
      console.error('Error fetching spare parts data:', err);
      setErrorMsg(err.message || 'Failed to fetch spare parts data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartsData();
  }, [activeTab, searchQuery]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      if (activeTab === 'catalog') {
        const rows = parts.map((p) => {
          const stock = stockSummary.find((s) => s.spare_part_id === p.id);
          return {
            part_code: p.part_code,
            part_name: p.part_name,
            category: p.category,
            standard_cost: p.standard_cost,
            selling_price: p.selling_price,
            available_stock: stock?.total_quantity_available ?? 0,
            unit_of_measure: p.unit_of_measure,
            stock_health_status: stock?.stock_health_status || 'Adequate',
            is_active: p.is_active ? 'Active' : 'Inactive'
          };
        });
        const headers = [
          { key: 'part_code', label: 'Part Code' },
          { key: 'part_name', label: 'Part Name' },
          { key: 'category', label: 'Category' },
          { key: 'standard_cost', label: 'Standard Cost (INR)' },
          { key: 'selling_price', label: 'Selling Price (INR)' },
          { key: 'available_stock', label: 'Available Stock' },
          { key: 'unit_of_measure', label: 'Unit' },
          { key: 'stock_health_status', label: 'Stock Health' },
          { key: 'is_active', label: 'Status' }
        ];
        const filename = `zuvo_spare_parts_catalog_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'Parts Catalog');
      } else if (activeTab === 'compatibility') {
        const rows = compatibilities.map((c) => ({
          part_code: c.spare_parts?.part_code || '',
          part_name: c.spare_parts?.part_name || '',
          category: c.spare_parts?.category || '',
          product_name: c.product_variants?.product_name || '',
          screen_size: c.product_variants?.screen_size || '',
          notes: c.notes || 'Verified factory fit'
        }));
        const headers = [
          { key: 'part_code', label: 'Part Code' },
          { key: 'part_name', label: 'Spare Part Name' },
          { key: 'category', label: 'Category' },
          { key: 'product_name', label: 'Compatible TV Variant' },
          { key: 'screen_size', label: 'Screen Size (inch)' },
          { key: 'notes', label: 'Compatibility Notes' }
        ];
        const filename = `zuvo_part_compatibility_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'TV Compatibility');
      } else if (activeTab === 'consumption') {
        const rows = consumptions.map((cs) => ({
          part_code: cs.part_code,
          part_name: cs.part_name,
          category: cs.category,
          total_quantity_used: cs.total_quantity_used,
          usage_count: cs.usage_count,
          warranty_covered_cost: cs.warranty_covered_cost,
          chargeable_cost: cs.chargeable_cost,
          total_cost: cs.total_cost
        }));
        const headers = [
          { key: 'part_code', label: 'Part Code' },
          { key: 'part_name', label: 'Part Name' },
          { key: 'category', label: 'Category' },
          { key: 'total_quantity_used', label: 'Quantity Used' },
          { key: 'usage_count', label: 'Repairs Count' },
          { key: 'warranty_covered_cost', label: 'Warranty Covered Cost (INR)' },
          { key: 'chargeable_cost', label: 'Chargeable Cost (INR)' },
          { key: 'total_cost', label: 'Total Cost (INR)' }
        ];
        const filename = `zuvo_rma_parts_consumption_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'RMA Consumption');
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Phase 7.4: Issue Stock to Technician Van
  const handleIssueStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.technicianId || !issueForm.warehouseId || !issueForm.sparePartId) {
      setErrorMsg('Please select a technician, warehouse, and spare part.');
      return;
    }

    setSubmittingIssue(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.rpc('fn_issue_spare_part_to_technician', {
        p_technician_id: issueForm.technicianId,
        p_warehouse_id: issueForm.warehouseId,
        p_spare_part_id: issueForm.sparePartId,
        p_quantity: Number(issueForm.quantity),
        p_reason: issueForm.reason || 'Warehouse stock issued to technician trunk',
        p_idempotency_key: `ISSUE-${issueForm.technicianId}-${issueForm.sparePartId}-${Date.now()}`
      });

      if (error) throw error;

      setSuccessMsg('Spare parts successfully issued to technician trunk!');
      setShowIssueModal(false);
      setIssueForm(prev => ({ ...prev, quantity: 1 }));
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to issue spare part to technician.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  // Phase 7.4: Review Van Reconciliation (Approve / Reject)
  const handleReviewReconciliation = async (recId: string, action: 'APPROVE' | 'REJECT') => {
    const notes = prompt(`Enter review notes for ${action.toLowerCase()}ing this van reconciliation:`, `Audited and ${action.toLowerCase()}ed by management`);
    if (notes === null) return; // User cancelled prompt

    setReviewingReconciliation(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.rpc('fn_review_van_reconciliation', {
        p_reconciliation_id: recId,
        p_action: action,
        p_review_notes: notes || undefined
      });

      if (error) throw error;

      setSuccessMsg(`Van reconciliation #${(data as any)?.reconciliation_number || ''} was ${action}D successfully.`);
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to ${action.toLowerCase()} reconciliation.`);
    } finally {
      setReviewingReconciliation(false);
    }
  };

  // Phase 7.5: Receive RMA Reverse Manifest at Depot
  const handleReceiveManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManifest) return;

    setSubmittingIntake(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const itemsPayload = selectedManifest.rma_reverse_manifest_items?.map((item: any) => ({
        item_id: item.id,
        item_status: receiveManifestForm.itemStatuses[item.id] || 'RECEIVED',
        received_condition: receiveManifestForm.itemConditions[item.id] || 'Clean intact board'
      })) || [];

      const { data, error } = await supabase.rpc('fn_receive_rma_reverse_manifest', {
        p_manifest_id: selectedManifest.id,
        p_received_by: user?.id || null,
        p_items: itemsPayload,
        p_warehouse_intake_notes: receiveManifestForm.intakeNotes || 'Depot quarantine intake verified'
      });

      if (error) throw error;

      setSuccessMsg(`Manifest #${(data as any)?.manifest_number || ''} received & processed at warehouse.`);
      setShowReceiveModal(false);
      setSelectedManifest(null);
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to receive RMA reverse manifest.');
    } finally {
      setSubmittingIntake(false);
    }
  };

  // Phase 7.5: QA Inspect & Settle Defective Core
  const handleInspectCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoreToInspect) return;

    setSubmittingInspect(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.rpc('fn_inspect_and_settle_defective_core', {
        p_defective_core_id: selectedCoreToInspect.id,
        p_action: inspectCoreForm.action,
        p_qa_passed: inspectCoreForm.action === 'APPROVED_FOR_REFURB',
        p_condition_grading: inspectCoreForm.conditionGrading,
        p_core_credit_amount: Number(inspectCoreForm.coreCreditAmount) || 0,
        p_inspection_notes: inspectCoreForm.inspectionNotes || 'Depot engineering assessment'
      });

      if (error) throw error;

      setSuccessMsg(`Core tag ${(data as any)?.core_tag_number || ''} settled: ${inspectCoreForm.action}. Core credit: ₹${(data as any)?.core_credit_amount || 0}`);
      setShowInspectModal(false);
      setSelectedCoreToInspect(null);
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inspect & settle defective core.');
    } finally {
      setSubmittingInspect(false);
    }
  };

  // Phase 7.6: Create Refurb Work Order
  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoreForRework) return;

    setSubmittingWo(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.rpc('fn_create_refurb_work_order', {
        p_core_id: selectedCoreForRework.id,
        p_assigned_engineer_id: createWoForm.assignedEngineerId || user?.id || null,
        p_notes: createWoForm.diagnosticsNotes || 'Bench rework order initialized'
      });

      if (error) throw error;

      setSuccessMsg(`Refurbishment Work Order #${(data as any)?.work_order_number || ''} created successfully! Core moved to IN_REWORK.`);
      setShowCreateWorkOrderModal(false);
      setSelectedCoreForRework(null);
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create refurb work order.');
    } finally {
      setSubmittingWo(false);
    }
  };

  // Phase 7.6: Log Bench Test & Burn-In
  const handleLogBenchTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkOrder) return;

    setSubmittingTest(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.rpc('fn_log_refurb_bench_test', {
        p_work_order_id: selectedWorkOrder.id,
        p_rail_12v_tested: benchTestForm.rail12vTested,
        p_rail_24v_tested: benchTestForm.rail24vTested,
        p_rail_5v_tested: benchTestForm.rail5vTested,
        p_burn_in_duration_hours: Number(benchTestForm.burnInDurationHours) || 0,
        p_optical_panel_passed: benchTestForm.opticalPanelPassed,
        p_audio_chassis_passed: benchTestForm.audioChassisPassed,
        p_labor_minutes: Number(benchTestForm.laborMinutes) || 45,
        p_diagnostics_notes: benchTestForm.diagnosticsNotes || 'Bench tests and burn-in chamber soak recorded'
      });

      if (error) throw error;

      setSuccessMsg(`Bench electrical test & burn-in results logged for Work Order #${(data as any)?.work_order_number}. Status: ${(data as any)?.status}.`);
      setShowBenchTestModal(false);
      setSelectedWorkOrder(null);
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to log bench test results.');
    } finally {
      setSubmittingTest(false);
    }
  };

  // Phase 7.6: Certify & Restock into Usable Inventory
  const handleCertifyAndRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkOrder) return;

    setSubmittingRestock(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.rpc('fn_certify_and_restock_refurb_item', {
        p_work_order_id: selectedWorkOrder.id,
        p_destination_warehouse_id: certifyRestockForm.destinationWarehouseId,
        p_notes: certifyRestockForm.restockNotes || 'Certified refurbished unit returned to available stock'
      });

      if (error) throw error;

      setSuccessMsg(`Work Order #${selectedWorkOrder.work_order_number} certified & atomically restocked into warehouse inventory!`);
      setShowCertifyRestockModal(false);
      setSelectedWorkOrder(null);
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to certify and restock refurbished item.');
    } finally {
      setSubmittingRestock(false);
    }
  };

  // Phase 7.6: Batch Scrap Disposition Manifest
  const handleScrapBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScrapCores.length === 0) {
      setErrorMsg('Please select at least one scrapped core for batch e-waste disposition.');
      return;
    }

    setSubmittingScrapBatch(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.rpc('fn_scrap_defective_cores_batch', {
        p_core_ids: selectedScrapCores,
        p_recycler_vendor_name: scrapBatchForm.recyclerVendorName,
        p_authorized_cpcb_id: scrapBatchForm.authorizedCpcbId || null,
        p_total_weight_kg: Number(scrapBatchForm.totalWeightKg) || 0,
        p_salvage_credit_realized: Number(scrapBatchForm.salvageCreditRealized) || 0,
        p_disposition_notes: scrapBatchForm.dispositionNotes || 'Hazardous e-waste scrap manifest'
      });

      if (error) throw error;

      setSuccessMsg(`Scrap disposition manifest #${(data as any)?.scrap_batch_number || ''} created for ${selectedScrapCores.length} cores!`);
      setShowScrapBatchModal(false);
      setSelectedScrapCores([]);
      fetchPartsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate scrap disposition manifest.');
    } finally {
      setSubmittingScrapBatch(false);
    }
  };

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package style={{ color: 'var(--brand-primary)' }} /> Spare Parts & Components
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Hardware catalog, variant cross-compatibility, buffer stock levels & RMA replacement analytics
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
          <button
            className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('catalog')}
          >
            Catalog & Stock
          </button>
          <button
            className={`btn ${activeTab === 'compatibility' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('compatibility')}
          >
            <Tv size={15} /> TV Compatibility
          </button>
          <button
            className={`btn ${activeTab === 'consumption' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('consumption')}
          >
            <TrendingDown size={15} /> RMA Consumption
          </button>
          <button
            className={`btn ${activeTab === 'trunk_management' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('trunk_management')}
          >
            <Truck size={15} /> Field Trunk & Van Stock
          </button>
          <button
            className={`btn ${activeTab === 'reverse_logistics' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('reverse_logistics')}
            style={activeTab === 'reverse_logistics' ? { background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderColor: '#F59E0B' } : {}}
          >
            <ArrowRightLeft size={15} /> Reverse Logistics & Core Quarantine
          </button>
          <button
            className={`btn ${activeTab === 'refurb_bench' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('refurb_bench')}
            style={activeTab === 'refurb_bench' ? { background: 'linear-gradient(135deg, #10B981, #059669)', borderColor: '#10B981' } : {}}
          >
            <Wrench size={15} /> Workshop Refurb Bench & Restock
          </button>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="card" style={{ borderColor: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--status-danger)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--status-danger)' }}>Error loading spare parts data</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* TAB 1: Parts Catalog & Stock */}
      {activeTab === 'catalog' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Part Code</th>
                  <th>Part Name</th>
                  <th>Category</th>
                  <th>Std Cost</th>
                  <th>Selling Price</th>
                  <th>Available Stock</th>
                  <th>Health Status</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                      <p className="text-muted">Loading spare parts catalog...</p>
                    </td>
                  </tr>
                ) : parts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <Package size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <p className="text-muted">No spare parts in catalog.</p>
                    </td>
                  </tr>
                ) : (
                  parts.map((p) => {
                    const stock = stockSummary.find((s) => s.spare_part_id === p.id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {p.part_code}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.part_name}</td>
                        <td>
                          <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                            {p.category}
                          </span>
                        </td>
                        <td>₹{p.standard_cost?.toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>₹{p.selling_price?.toLocaleString()}</td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                            {stock?.total_quantity_available ?? 0}
                          </span>
                          <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                            {p.unit_of_measure}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${stock?.stock_health_status === 'healthy' ? 'badge-success' : 'badge-warning'}`}>
                            {stock?.stock_health_status || 'Adequate'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Compatibility Matrix */}
      {activeTab === 'compatibility' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Hardware Cross-Compatibility Mapping</h3>
            <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Maps genuine ZUVO spare parts to approved TV model variants for RMA servicing
            </p>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Spare Part</th>
                  <th>Category</th>
                  <th>Compatible TV Variant</th>
                  <th>Screen Size</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                      <p className="text-muted">Loading compatibility matrix...</p>
                    </td>
                  </tr>
                ) : compatibilities.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                      <p className="text-muted">No compatibility rules defined.</p>
                    </td>
                  </tr>
                ) : (
                  compatibilities.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.spare_parts?.part_name}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.spare_parts?.part_code}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                          {c.spare_parts?.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {c.product_variants?.product_name}
                      </td>
                      <td>{c.product_variants?.screen_size}"</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {c.notes || 'Verified factory fit'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Phase 7.4 Field Trunk & Van Stock Management */}
      {activeTab === 'trunk_management' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Action Bar */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-secondary)' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck style={{ color: 'var(--brand-primary)' }} /> Technician Trunk & Van Stock Custody
              </h2>
              <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                Central warehouse spare part allocations, field vehicle inventory balances & audit reconciliation review
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowIssueModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Issue Parts to Technician Van
            </button>
          </div>

          {/* Section 1: Pending Van Reconciliations Requiring Review */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardCheck size={18} style={{ color: 'var(--brand-accent)' }} /> Van Reconciliations Audit & Review
                </h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Field counts with non-zero physical variance requiring manager authorization
                </span>
              </div>
              <span className="badge badge-warning">
                {pendingReconciliations.filter(r => r.status === 'PENDING_REVIEW').length} Pending Review
              </span>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rec #</th>
                    <th>Technician</th>
                    <th>Discrepant Items</th>
                    <th>Net Variance</th>
                    <th>Status</th>
                    <th>Submitted At</th>
                    <th>Review Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReconciliations.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem' }}>
                        <p className="text-muted">No van reconciliations logged yet.</p>
                      </td>
                    </tr>
                  ) : (
                    pendingReconciliations.map((rec) => {
                      const lines = rec.technician_van_reconciliation_lines || [];
                      const netVariance = lines.reduce((acc: number, l: any) => acc + (l.variance || 0), 0);
                      return (
                        <tr key={rec.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rec.reconciliation_number}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{rec.profiles?.full_name || 'Technician'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rec.profiles?.employee_code || ''}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {lines.map((l: any, idx: number) => (
                                <div key={idx} style={{ fontSize: '0.8125rem' }}>
                                  <span style={{ fontWeight: 500 }}>{l.spare_parts?.part_name || l.spare_part_id}</span>: System {l.system_quantity} → Counted {l.physical_count} (
                                  <span style={{ color: l.variance > 0 ? 'var(--status-success)' : l.variance < 0 ? 'var(--status-danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                                    {l.variance > 0 ? `+${l.variance}` : l.variance}
                                  </span>)
                                  {l.reason && <span className="text-muted" style={{ fontStyle: 'italic', marginLeft: '0.25rem' }}>— {l.reason}</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              fontWeight: 700,
                              color: netVariance === 0 ? 'var(--status-success)' : netVariance > 0 ? 'var(--brand-accent)' : 'var(--status-danger)'
                            }}>
                              {netVariance > 0 ? `+${netVariance}` : netVariance}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              rec.status === 'APPROVED' ? 'badge-success' :
                              rec.status === 'COMPLETED' ? 'badge-neutral' :
                              rec.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>{new Date(rec.created_at).toLocaleString()}</td>
                          <td>
                            {rec.status === 'PENDING_REVIEW' ? (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--status-success)' }}
                                  disabled={reviewingReconciliation}
                                  onClick={() => handleReviewReconciliation(rec.id, 'APPROVE')}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--status-danger)' }}
                                  disabled={reviewingReconciliation}
                                  onClick={() => handleReviewReconciliation(rec.id, 'REJECT')}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {rec.status} {rec.reviewed_at ? `on ${new Date(rec.reviewed_at).toLocaleDateString()}` : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Active Trunk Balances across all Technicians */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>All Field Technician Trunk Balances</h3>
              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Real-time active spare parts in service vans across the entire technician fleet
              </p>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Technician</th>
                    <th>Part Code</th>
                    <th>Part Name</th>
                    <th>Category</th>
                    <th>Available in Van</th>
                    <th>Allocated / Reserved</th>
                    <th>Last Reconciled</th>
                  </tr>
                </thead>
                <tbody>
                  {allTrunkStocks.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                        <p className="text-muted">No technician van stock assigned yet. Click "Issue Parts to Technician Van" above.</p>
                      </td>
                    </tr>
                  ) : (
                    allTrunkStocks.map((stk) => (
                      <tr key={stk.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{stk.profiles?.full_name || 'Technician'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stk.profiles?.employee_code || ''}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{stk.spare_parts?.part_code}</td>
                        <td style={{ fontWeight: 600 }}>{stk.spare_parts?.part_name}</td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                            {stk.spare_parts?.category}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: stk.quantity_available > 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                            {stk.quantity_available}
                          </span>
                        </td>
                        <td>{stk.quantity_allocated || 0}</td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {stk.last_reconciled_at ? new Date(stk.last_reconciled_at).toLocaleString() : 'Never'}
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

      {/* TAB 5: Reverse Logistics & Core Quarantine */}
      {activeTab === 'reverse_logistics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #F59E0B' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Manifests Dispatched (In Transit)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F59E0B', marginTop: '0.25rem' }}>
                {reverseManifests.filter(m => m.status === 'DISPATCHED').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Awaiting depot warehouse receipt
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #06B6D4' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Cores in Depot Quarantine
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#06B6D4', marginTop: '0.25rem' }}>
                {allDefectiveCores.filter(c => c.custody_status === 'RECEIVED_AT_DEPOT').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Pending engineering QA inspection
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10B981' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Approved For Refurbishment
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10B981', marginTop: '0.25rem' }}>
                {allDefectiveCores.filter(c => c.custody_status === 'REFURB_APPROVED').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Ready for component-level repair
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #EF4444' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Core Credit Value
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                ₹{allDefectiveCores.reduce((sum, c) => sum + (c.core_credit_amount || 0), 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Settled core credits credited to accounts
              </div>
            </div>
          </div>

          {/* Section 1: RMA Reverse Logistics Manifests */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Truck style={{ color: 'var(--brand-primary)' }} />
                  <span>Reverse Logistics Manifests (Technician → Depot)</span>
                </h3>
                <p className="text-muted" style={{ fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
                  Track incoming shipment batches from field vans and process warehouse intake receipt.
                </p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Manifest #</th>
                    <th>Field Technician</th>
                    <th>Destination Depot</th>
                    <th>Tracking #</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Dispatched At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reverseManifests.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        <p className="text-muted">No reverse logistics manifests found.</p>
                      </td>
                    </tr>
                  ) : (
                    reverseManifests.map((m) => {
                      const isDispatched = m.status === 'DISPATCHED';

                      return (
                        <tr key={m.id}>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>
                              {m.manifest_number}
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{m.profiles?.full_name || 'Technician'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.profiles?.employee_code || m.profiles?.phone || ''}</div>
                          </td>
                          <td>
                            <div>{m.warehouses?.warehouse_name || 'Central Depot'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.warehouses?.warehouse_code}</div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            {m.carrier_tracking_number || <span className="text-muted">Direct Van Transfer</span>}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{m.total_items_count} item(s)</span>
                            {m.discrepant_items_count > 0 && (
                              <div style={{ color: 'var(--status-danger)', fontSize: '0.75rem' }}>
                                {m.discrepant_items_count} discrepant
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${
                              m.status === 'DISPATCHED' ? 'badge-warning' :
                              m.status === 'RECEIVED' ? 'badge-success' :
                              m.status === 'RECONCILED' ? 'badge-primary' : 'badge-neutral'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            {m.dispatched_at ? new Date(m.dispatched_at).toLocaleString() : 'N/A'}
                          </td>
                          <td>
                            {isDispatched ? (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                                onClick={() => {
                                  setSelectedManifest(m);
                                  const initialConditions: Record<string, string> = {};
                                  const initialStatuses: Record<string, string> = {};
                                  m.rma_reverse_manifest_items?.forEach((item: any) => {
                                    initialConditions[item.id] = 'Intact condition';
                                    initialStatuses[item.id] = 'RECEIVED';
                                  });
                                  setReceiveManifestForm({
                                    intakeNotes: '',
                                    itemConditions: initialConditions,
                                    itemStatuses: initialStatuses
                                  });
                                  setShowReceiveModal(true);
                                }}
                              >
                                Receive & Inspect
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 600 }}>
                                ✓ Received
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Defective Cores Quarantine & QA Inspection Registry */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <ArrowRightLeft style={{ color: '#F59E0B' }} />
                  <span>Defective Cores & Harvested Units Quarantine Registry</span>
                </h3>
                <p className="text-muted" style={{ fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
                  Full lifecycle custody tracking, engineering QA triage, core credit settlements & scrap logging.
                </p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Core Tag #</th>
                    <th>Type</th>
                    <th>Part / Unit Details</th>
                    <th>Custody State</th>
                    <th>Field Technician</th>
                    <th>Defect Symptom</th>
                    <th>Core Credit</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allDefectiveCores.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        <p className="text-muted">No defective cores currently registered.</p>
                      </td>
                    </tr>
                  ) : (
                    allDefectiveCores.map((core) => {
                      const canInspect = core.custody_status === 'RECEIVED_AT_DEPOT';

                      return (
                        <tr key={core.id}>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: '#F59E0B' }}>
                              {core.core_tag_number}
                            </strong>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(core.harvested_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {core.item_type === 'WHOLE_TV_UNIT' ? 'Whole TV Swap' : 'Spare Part Core'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {core.item_type === 'WHOLE_TV_UNIT' ? (
                                core.product_units?.product_variants?.product_name || 'ZUVO TV Unit'
                              ) : (
                                core.spare_parts?.part_name || 'Component Board'
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {core.serial_number || core.barcode || core.spare_parts?.part_code || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${
                              core.custody_status === 'WITH_TECHNICIAN' ? 'badge-warning' :
                              core.custody_status === 'DISPATCHED_TO_DEPOT' ? 'badge-primary' :
                              core.custody_status === 'RECEIVED_AT_DEPOT' ? 'badge-neutral' :
                              core.custody_status === 'REFURB_APPROVED' ? 'badge-success' : 'badge-danger'
                            }`}>
                              {core.custody_status}
                            </span>
                          </td>
                          <td>
                            <div>{core.profiles?.full_name || 'Technician'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{core.profiles?.employee_code || ''}</div>
                          </td>
                          <td style={{ fontSize: '0.8125rem', maxWidth: '220px' }}>
                            {core.defect_symptom}
                          </td>
                          <td>
                            {core.core_credit_amount > 0 ? (
                              <span style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                                ₹{core.core_credit_amount}
                              </span>
                            ) : core.core_credit_eligible ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                Est. ₹{core.estimated_core_value || 0}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ineligible</span>
                            )}
                          </td>
                          <td>
                            {canInspect ? (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', background: 'linear-gradient(135deg, #10B981, #059669)' }}
                                onClick={() => {
                                  setSelectedCoreToInspect(core);
                                  setInspectCoreForm({
                                    action: 'APPROVED_FOR_REFURB',
                                    qaPassed: true,
                                    conditionGrading: 'GRADE_B',
                                    coreCreditAmount: core.estimated_core_value || 500,
                                    inspectionNotes: ''
                                  });
                                  setShowInspectModal(true);
                                }}
                              >
                                QA Inspect & Settle
                              </button>
                            ) : (core.custody_status === 'APPROVED_FOR_REFURB' || core.custody_status === 'REFURB_APPROVED') ? (
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: '#10B981', borderColor: '#10B981' }}
                                onClick={() => {
                                  setSelectedCoreForRework(core);
                                  setCreateWoForm({
                                    assignedEngineerId: user?.id || '',
                                    diagnosticsNotes: `Bench rework for ${core.core_tag_number}`
                                  });
                                  setShowCreateWorkOrderModal(true);
                                }}
                              >
                                <Wrench size={13} style={{ display: 'inline', marginRight: '4px' }} />
                                Start Rework
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {core.custody_status === 'IN_REWORK' ? 'In Workshop Rework' :
                                 core.custody_status === 'RESTOCKED' ? 'Restocked (Usable)' :
                                 core.custody_status === 'SCRAPPED' ? 'Marked for Scrap' :
                                 core.custody_status === 'SCRAP_DISPOSED' ? 'Scrap Disposed' :
                                 'In Field Custody'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Phase 7.6: Workshop Engineering Refurbishment Bench & Restock Tab */}
      {activeTab === 'refurb_bench' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Refurb Bench KPI Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10B981' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Active Bench Work Orders
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10B981', marginTop: '0.25rem' }}>
                {refurbWorkOrders.filter(w => w.status !== 'QA_CERTIFIED' && w.status !== 'FAILED_SCRAP').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Currently on workshop repair benches
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #3B82F6' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Burn-In Chamber Testing
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3B82F6', marginTop: '0.25rem' }}>
                {refurbWorkOrders.filter(w => w.status === 'BURN_IN_TESTING').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Thermal soak & signal stress verified
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #8B5CF6' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Certified & Restocked
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#8B5CF6', marginTop: '0.25rem' }}>
                {refurbWorkOrders.filter(w => w.status === 'QA_CERTIFIED').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Added to sellable/field spare inventory
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #EF4444' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Scrap Dispositions (E-Waste)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#EF4444', marginTop: '0.25rem' }}>
                {scrapDispositionRecords.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Certified recycling vendor batches
              </div>
            </div>
          </div>

          {/* Section 1: Active Refurbishment Bench Work Orders */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Wrench style={{ color: '#10B981' }} />
                  <span>Workshop Engineering Rework Orders (RWO)</span>
                </h3>
                <p className="text-muted" style={{ fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
                  Micro-component soldering, rail voltage diagnostics (12V/24V/5V), burn-in testing & inventory restock certification.
                </p>
              </div>

              {allDefectiveCores.filter(c => c.custody_status === 'SCRAPPED').length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', color: '#EF4444', borderColor: '#EF4444' }}
                  onClick={() => {
                    const scrapped = allDefectiveCores.filter(c => c.custody_status === 'SCRAPPED').map(c => c.id);
                    setSelectedScrapCores(scrapped);
                    setShowScrapBatchModal(true);
                  }}
                >
                  <Recycle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Batch Scrap Manifest ({allDefectiveCores.filter(c => c.custody_status === 'SCRAPPED').length})
                </button>
              )}
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Work Order #</th>
                    <th>Core Tag #</th>
                    <th>Item Description</th>
                    <th>Assigned Engineer</th>
                    <th>Status</th>
                    <th>Electrical Rails</th>
                    <th>Burn-In Soak</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refurbWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        <p className="text-muted">No active refurbishment work orders found. Triage cores in Reverse Logistics to start rework.</p>
                      </td>
                    </tr>
                  ) : (
                    refurbWorkOrders.map((wo) => {
                      const allRailsPass = wo.rail_12v_tested && wo.rail_24v_tested && wo.rail_5v_tested;
                      const canCertify = allRailsPass && wo.burn_in_passed && wo.status !== 'QA_CERTIFIED';

                      return (
                        <tr key={wo.id}>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>
                              {wo.work_order_number}
                            </strong>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(wo.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: '#F59E0B' }}>
                              {wo.defective_core?.core_tag_number || 'CORE'}
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {wo.defective_core?.item_type === 'WHOLE_TV_UNIT' ? (
                                wo.defective_core?.product_units?.product_variants?.product_name || 'ZUVO TV Unit'
                              ) : (
                                wo.defective_core?.spare_parts?.part_name || 'Component Board'
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {wo.defective_core?.defect_symptom || 'Component failure'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{wo.assigned_engineer?.full_name || 'Unassigned'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{wo.assigned_engineer?.employee_code || ''}</div>
                          </td>
                          <td>
                            <span className={`badge ${
                              wo.status === 'ASSIGNED' ? 'badge-warning' :
                              wo.status === 'BURN_IN_TESTING' ? 'badge-primary' :
                              wo.status === 'QA_CERTIFIED' ? 'badge-success' : 'badge-neutral'
                            }`}>
                              {wo.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ color: wo.rail_12v_tested ? '#10B981' : '#EF4444' }}>
                                12V Rail: {wo.rail_12v_tested ? '✓ PASS' : '✗ PENDING'}
                              </span>
                              <span style={{ color: wo.rail_24v_tested ? '#10B981' : '#EF4444' }}>
                                24V Rail: {wo.rail_24v_tested ? '✓ PASS' : '✗ PENDING'}
                              </span>
                              <span style={{ color: wo.rail_5v_tested ? '#10B981' : '#EF4444' }}>
                                5V Rail: {wo.rail_5v_tested ? '✓ PASS' : '✗ PENDING'}
                              </span>
                            </div>
                          </td>
                          <td>
                            {wo.burn_in_passed ? (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                ✓ {wo.burn_in_duration_hours}h Passed
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                {wo.burn_in_duration_hours > 0 ? `${wo.burn_in_duration_hours}h Incomplete` : 'Pending Chamber'}
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {wo.status !== 'QA_CERTIFIED' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                  onClick={() => {
                                    setSelectedWorkOrder(wo);
                                    setBenchTestForm({
                                      rail12vTested: wo.rail_12v_tested,
                                      rail24vTested: wo.rail_24v_tested,
                                      rail5vTested: wo.rail_5v_tested,
                                      burnInDurationHours: wo.burn_in_duration_hours || 2,
                                      opticalPanelPassed: wo.optical_panel_passed,
                                      audioChassisPassed: wo.audio_chassis_passed,
                                      laborMinutes: wo.labor_minutes || 45,
                                      diagnosticsNotes: wo.diagnostics_notes || ''
                                    });
                                    setShowBenchTestModal(true);
                                  }}
                                >
                                  <Cpu size={12} style={{ display: 'inline', marginRight: '3px' }} />
                                  Log Tests
                                </button>
                              )}

                              {canCertify && (
                                <button
                                  className="btn btn-primary"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'linear-gradient(135deg, #10B981, #059669)' }}
                                  onClick={() => {
                                    setSelectedWorkOrder(wo);
                                    setShowCertifyRestockModal(true);
                                  }}
                                >
                                  <CheckCircle size={12} style={{ display: 'inline', marginRight: '3px' }} />
                                  Certify & Restock
                                </button>
                              )}

                              {wo.status === 'QA_CERTIFIED' && (
                                <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
                                  ✓ Restocked in {wo.restocked_warehouse?.warehouse_code || 'Depot'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Receive RMA Reverse Manifest at Depot */}
      {showReceiveModal && selectedManifest && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck style={{ color: 'var(--brand-primary)' }} />
                <span>Receive Reverse Manifest #{selectedManifest.manifest_number}</span>
              </h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setShowReceiveModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReceiveManifest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div><strong>Technician:</strong> {selectedManifest.profiles?.full_name} ({selectedManifest.profiles?.employee_code || 'Field Tech'})</div>
                <div><strong>Carrier Tracking:</strong> {selectedManifest.carrier_tracking_number || 'Direct Handover'}</div>
                <div><strong>Items in Shipment:</strong> {selectedManifest.rma_reverse_manifest_items?.length || 0}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Verify Received Items & Physical Condition *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedManifest.rma_reverse_manifest_items?.map((item: any) => {
                    const core = item.technician_defective_cores;

                    return (
                      <div key={item.id} style={{ border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                            {core?.core_tag_number} — {core?.item_type === 'WHOLE_TV_UNIT' ? 'Whole TV Unit' : core?.spare_parts?.part_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {core?.serial_number || core?.barcode || 'N/A'} • {core?.defect_symptom}
                          </div>
                        </div>

                        <div>
                          <select
                            className="input"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            value={receiveManifestForm.itemStatuses[item.id] || 'RECEIVED'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiveManifestForm(prev => ({
                                ...prev,
                                itemStatuses: { ...prev.itemStatuses, [item.id]: val }
                              }));
                            }}
                          >
                            <option value="RECEIVED">✓ Received</option>
                            <option value="MISSING">✕ Missing</option>
                            <option value="DISCREPANT">⚠ Discrepant</option>
                          </select>
                        </div>

                        <div>
                          <input
                            type="text"
                            className="input"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            placeholder="Condition notes..."
                            value={receiveManifestForm.itemConditions[item.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiveManifestForm(prev => ({
                                ...prev,
                                itemConditions: { ...prev.itemConditions, [item.id]: val }
                              }));
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Depot Warehouse Intake Notes
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={receiveManifestForm.intakeNotes}
                  onChange={(e) => setReceiveManifestForm({ ...receiveManifestForm, intakeNotes: e.target.value })}
                  placeholder="e.g. Shipment delivered in intact cartons, all security seals intact"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReceiveModal(false)}
                  disabled={submittingIntake}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingIntake}
                >
                  {submittingIntake ? 'Processing Intake...' : 'Confirm Shipment Intake'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QA Inspect & Settle Defective Core */}
      {showInspectModal && selectedCoreToInspect && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck style={{ color: 'var(--brand-primary)' }} />
                <span>Engineering QA Assessment: {selectedCoreToInspect.core_tag_number}</span>
              </h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setShowInspectModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInspectCore} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div><strong>Item:</strong> {selectedCoreToInspect.item_type === 'WHOLE_TV_UNIT' ? 'Whole TV Swap' : selectedCoreToInspect.spare_parts?.part_name}</div>
                <div><strong>Reported Defect:</strong> {selectedCoreToInspect.defect_symptom}</div>
                <div><strong>Harvested By:</strong> {selectedCoreToInspect.profiles?.full_name} ({selectedCoreToInspect.profiles?.employee_code || 'Technician'})</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  QA Disposition Decision *
                </label>
                <select
                  className="input"
                  value={inspectCoreForm.action}
                  onChange={(e) => setInspectCoreForm({ ...inspectCoreForm, action: e.target.value as any })}
                  required
                >
                  <option value="APPROVED_FOR_REFURB">Approved for In-House Refurbishment / Component Replacement</option>
                  <option value="SCRAPPED">Scrapped (Beyond Economical Repair / Hazardous E-Waste)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Condition Grading *
                  </label>
                  <select
                    className="input"
                    value={inspectCoreForm.conditionGrading}
                    onChange={(e) => setInspectCoreForm({ ...inspectCoreForm, conditionGrading: e.target.value })}
                  >
                    <option value="GRADE_A">Grade A (Minor cosmetic / quick rework)</option>
                    <option value="GRADE_B">Grade B (Standard component failure)</option>
                    <option value="GRADE_C">Grade C (Heavy wear / extensive soldering needed)</option>
                    <option value="GRADE_F">Grade F (Scrap / burnt traces)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Core Credit Settlement Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={inspectCoreForm.coreCreditAmount}
                    onChange={(e) => setInspectCoreForm({ ...inspectCoreForm, coreCreditAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Engineering Inspection Notes
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={inspectCoreForm.inspectionNotes}
                  onChange={(e) => setInspectCoreForm({ ...inspectCoreForm, inspectionNotes: e.target.value })}
                  placeholder="e.g. Diode D3 replaced, bench tested with 12V rail OK"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowInspectModal(false)}
                  disabled={submittingInspect}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingInspect}
                  style={inspectCoreForm.action === 'APPROVED_FOR_REFURB' ? { background: 'linear-gradient(135deg, #10B981, #059669)' } : { background: 'var(--status-danger)' }}
                >
                  {submittingInspect ? 'Saving Assessment...' : `Confirm: ${inspectCoreForm.action === 'APPROVED_FOR_REFURB' ? 'Approve Refurb' : 'Scrap Core'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Issue Spare Part to Technician Van */}
      {showIssueModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck style={{ color: 'var(--brand-primary)' }} /> Issue Stock to Technician Van
              </h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setShowIssueModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIssueStock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Target Field Technician *
                </label>
                <select
                  className="input"
                  value={issueForm.technicianId}
                  onChange={(e) => setIssueForm({ ...issueForm, technicianId: e.target.value })}
                  required
                >
                  <option value="">Select Technician...</option>
                  {techniciansList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.employee_code || t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Source Warehouse Location *
                </label>
                <select
                  className="input"
                  value={issueForm.warehouseId}
                  onChange={(e) => setIssueForm({ ...issueForm, warehouseId: e.target.value })}
                  required
                >
                  <option value="">Select Source Warehouse...</option>
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name} ({w.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Spare Part / Component *
                </label>
                <select
                  className="input"
                  value={issueForm.sparePartId}
                  onChange={(e) => setIssueForm({ ...issueForm, sparePartId: e.target.value })}
                  required
                >
                  <option value="">Select Spare Part...</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_name} [{p.part_code}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Issuance Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Custody Transfer Reason / Dispatch Note
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={issueForm.reason}
                  onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })}
                  placeholder="e.g. Monthly replenishment for South Region field van"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowIssueModal(false)}
                  disabled={submittingIssue}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingIssue}
                >
                  {submittingIssue ? 'Transferring Stock...' : 'Confirm Stock Issuance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 7.6 Modal: Create Refurb Work Order */}
      {showCreateWorkOrderModal && selectedCoreForRework && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wrench style={{ color: '#10B981' }} />
                <span>Initialize Workshop Rework: {selectedCoreForRework.core_tag_number}</span>
              </h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setShowCreateWorkOrderModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div><strong>Component:</strong> {selectedCoreForRework.item_type === 'WHOLE_TV_UNIT' ? 'Whole TV Swap' : selectedCoreForRework.spare_parts?.part_name}</div>
                <div><strong>Defect Symptom:</strong> {selectedCoreForRework.defect_symptom}</div>
                <div><strong>Harvested By:</strong> {selectedCoreForRework.profiles?.full_name || 'Field Tech'}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Assign Bench Repair Engineer *
                </label>
                <select
                  className="input"
                  value={createWoForm.assignedEngineerId}
                  onChange={(e) => setCreateWoForm({ ...createWoForm, assignedEngineerId: e.target.value })}
                  required
                >
                  <option value={user?.id || ''}>Current User ({user?.email})</option>
                  {techniciansList.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name} ({t.employee_code || 'Technician'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Diagnostics Notes & Initial Triage Plan
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={createWoForm.diagnosticsNotes}
                  onChange={(e) => setCreateWoForm({ ...createWoForm, diagnosticsNotes: e.target.value })}
                  placeholder="e.g. Inspect power rails, replace blown capacitors, test HDMI signal lock"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateWorkOrderModal(false)}
                  disabled={submittingWo}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                  disabled={submittingWo}
                >
                  {submittingWo ? 'Assigning...' : 'Create Rework Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 7.6 Modal: Log Bench Test & Burn-In Chamber Soak */}
      {showBenchTestModal && selectedWorkOrder && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu style={{ color: 'var(--brand-primary)' }} />
                <span>Bench Electrical Tests & Burn-In: {selectedWorkOrder.work_order_number}</span>
              </h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setShowBenchTestModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogBenchTest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>1. Multimeter Voltage Rail Diagnostics</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                    <input
                      type="checkbox"
                      checked={benchTestForm.rail12vTested}
                      onChange={(e) => setBenchTestForm({ ...benchTestForm, rail12vTested: e.target.checked })}
                    />
                    <span>12V Main Rail</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                    <input
                      type="checkbox"
                      checked={benchTestForm.rail24vTested}
                      onChange={(e) => setBenchTestForm({ ...benchTestForm, rail24vTested: e.target.checked })}
                    />
                    <span>24V Inverter Rail</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                    <input
                      type="checkbox"
                      checked={benchTestForm.rail5vTested}
                      onChange={(e) => setBenchTestForm({ ...benchTestForm, rail5vTested: e.target.checked })}
                    />
                    <span>5V Standby Rail</span>
                  </label>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>2. Burn-In Chamber & Physical QA</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Burn-In Duration (Hours) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="input"
                      value={benchTestForm.burnInDurationHours}
                      onChange={(e) => setBenchTestForm({ ...benchTestForm, burnInDurationHours: parseFloat(e.target.value) || 0 })}
                      required
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Min 1.5h required for certification pass</div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Repair Labor (Minutes) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={benchTestForm.laborMinutes}
                      onChange={(e) => setBenchTestForm({ ...benchTestForm, laborMinutes: parseInt(e.target.value) || 45 })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                    <input
                      type="checkbox"
                      checked={benchTestForm.opticalPanelPassed}
                      onChange={(e) => setBenchTestForm({ ...benchTestForm, opticalPanelPassed: e.target.checked })}
                    />
                    <span>Optical Uniformity Pass</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                    <input
                      type="checkbox"
                      checked={benchTestForm.audioChassisPassed}
                      onChange={(e) => setBenchTestForm({ ...benchTestForm, audioChassisPassed: e.target.checked })}
                    />
                    <span>Audio & Ports Pass</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Bench Notes & Components Replaced
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={benchTestForm.diagnosticsNotes}
                  onChange={(e) => setBenchTestForm({ ...benchTestForm, diagnosticsNotes: e.target.value })}
                  placeholder="e.g. Replaced diode D104 and capacitor C201. Thermal camera shows stable 42C"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBenchTestModal(false)}
                  disabled={submittingTest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingTest}
                >
                  {submittingTest ? 'Recording...' : 'Save Bench Test Results'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 7.6 Modal: Certify & Restock into Usable Inventory */}
      {showCertifyRestockModal && selectedWorkOrder && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle style={{ color: '#10B981' }} />
                <span>Certify Rework & Restock: {selectedWorkOrder.work_order_number}</span>
              </h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setShowCertifyRestockModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCertifyAndRestock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 600, color: '#10B981', marginBottom: '0.25rem' }}>QA Certification Ready</div>
                <div>All electrical voltage rails passed. Burn-in chamber soak completed ({selectedWorkOrder.burn_in_duration_hours}h).</div>
                <div style={{ marginTop: '0.25rem' }}>This action will atomically update the inventory ledger and return this unit to available stock.</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Destination Warehouse *
                </label>
                <select
                  className="input"
                  value={certifyRestockForm.destinationWarehouseId}
                  onChange={(e) => setCertifyRestockForm({ ...certifyRestockForm, destinationWarehouseId: e.target.value })}
                  required
                >
                  <option value="">Select Warehouse Location...</option>
                  {warehousesList.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Certification & Inventory Ledger Notes
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={certifyRestockForm.restockNotes}
                  onChange={(e) => setCertifyRestockForm({ ...certifyRestockForm, restockNotes: e.target.value })}
                  placeholder="e.g. Certified refurbished component restored to central depot bin A-12"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCertifyRestockModal(false)}
                  disabled={submittingRestock}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                  disabled={submittingRestock}
                >
                  {submittingRestock ? 'Certifying & Restocking...' : 'Confirm Restock into Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 7.6 Modal: Batch Scrap Disposition Manifest */}
      {showScrapBatchModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Recycle style={{ color: '#EF4444' }} />
                <span>Generate Hazardous E-Waste Scrap Manifest</span>
              </h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setShowScrapBatchModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScrapBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div><strong>Selected Scrapped Units:</strong> {selectedScrapCores.length} cores</div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  CPCB-authorized hazardous e-waste recycler batch creation and statutory certificate logging.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Authorized Recycler Vendor Name *
                </label>
                <input
                  type="text"
                  className="input"
                  value={scrapBatchForm.recyclerVendorName}
                  onChange={(e) => setScrapBatchForm({ ...scrapBatchForm, recyclerVendorName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Pollution Control ID (CPCB)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={scrapBatchForm.authorizedCpcbId}
                    onChange={(e) => setScrapBatchForm({ ...scrapBatchForm, authorizedCpcbId: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Total Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="input"
                    value={scrapBatchForm.totalWeightKg}
                    onChange={(e) => setScrapBatchForm({ ...scrapBatchForm, totalWeightKg: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Salvage Value Credit Realized (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={scrapBatchForm.salvageCreditRealized}
                  onChange={(e) => setScrapBatchForm({ ...scrapBatchForm, salvageCreditRealized: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Disposition & Destruction Notes
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={scrapBatchForm.dispositionNotes}
                  onChange={(e) => setScrapBatchForm({ ...scrapBatchForm, dispositionNotes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowScrapBatchModal(false)}
                  disabled={submittingScrapBatch}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                  disabled={submittingScrapBatch}
                >
                  {submittingScrapBatch ? 'Generating Manifest...' : 'Issue E-Waste Scrap Manifest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
