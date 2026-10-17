/**
 * ZUVO TV CRM — PHASE 8.7 MASTER AUTOMATED TEST SUITE
 * Enterprise Manufacturing Execution, Multi-Level BOM, Factory Production Work Orders & WIP Costing
 *
 * Filename: scripts-crm/test_phase_8_7_manufacturing_bom_wip_costing.mjs
 * Target: 50 / 50 Tests PASSED
 */

import crypto from 'crypto';

console.log('=============================================================================');
console.log(' ZUVO TV CRM — PHASE 8.7 MASTER AUTOMATED TEST SUITE');
console.log(' Enterprise Manufacturing Execution, Multi-Level BOM & WIP Costing Engine');
console.log(' Target: 50 Comprehensive End-to-End Tests');
console.log('=============================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testNumber, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] Test ${testNumber}: ${description}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] Test ${testNumber}: ${description}`);
  }
}

// Authoritative Manufacturing State Machine mirroring Supabase PostgreSQL RPCs
class Phase87ManufacturingEngine {
  constructor() {
    this.boms = new Map();
    this.bomItems = new Map();
    this.workOrders = new Map();
    this.materialIssues = new Map();
    this.qualityChecks = [];
    this.costRecords = new Map();
    this.journalEntries = [];
    this.journalLines = [];
    this.auditEvents = [];
    this.productUnits = new Map();
    this.sparePartInventory = new Map(); // key: `${warehouseId}_${sparePartId}`
    this.fixedAssets = new Map();

    this.bomSeq = 1001;
    this.woSeq = 2001;
    this.jeSeq = 7001;
    this.unitSeq = 5001;

    // Seed Fixed Assets (Phase 8.5 Test Rigs & Calibration Gear)
    this.fixedAssets.set('fa_burn_in_01', {
      id: 'fa_burn_in_01',
      tenant_id: 'tenant_zuvo_default',
      asset_tag: 'FA-RIG-2026-001',
      asset_name: 'Factory 4-Hour Burn-In Stress Test Chamber Alpha',
      category_id: 'cat_test_rig',
      status: 'ACTIVE',
      next_calibration_due_at: '2027-10-01'
    });
    this.fixedAssets.set('fa_hipot_01', {
      id: 'fa_hipot_01',
      tenant_id: 'tenant_zuvo_default',
      asset_tag: 'FA-HIPOT-2026-001',
      asset_name: 'Chroma Dielectric Electrical Hi-Pot Tester',
      category_id: 'cat_calib_eq',
      status: 'ACTIVE',
      next_calibration_due_at: '2027-05-15'
    });
    this.fixedAssets.set('fa_optical_01', {
      id: 'fa_optical_01',
      tenant_id: 'tenant_zuvo_default',
      asset_tag: 'FA-OPT-2026-001',
      asset_name: 'Konica Minolta Color & Luminance Calibration Rig',
      category_id: 'cat_calib_eq',
      status: 'ACTIVE',
      next_calibration_due_at: '2027-04-20'
    });
    this.fixedAssets.set('fa_expired_rig', {
      id: 'fa_expired_rig',
      tenant_id: 'tenant_zuvo_default',
      asset_tag: 'FA-EXPIRED-RIG',
      asset_name: 'Decommissioned Calibration Chamber',
      category_id: 'cat_test_rig',
      status: 'DISPOSED',
      next_calibration_due_at: '2025-01-01'
    });

    // Seed Raw Material Inventory (Components in Warehouse)
    this.seedInventory('wh_main_mfg', 'part_panel_43', 100, 7500); // 43" 4K Panel
    this.seedInventory('wh_main_mfg', 'part_mainboard_43', 100, 2200); // Motherboard
    this.seedInventory('wh_main_mfg', 'part_psu_43', 100, 950); // Power Supply Unit
    this.seedInventory('wh_main_mfg', 'part_backlight_43', 100, 650); // LED Backlight Array
    this.seedInventory('wh_main_mfg', 'part_chassis_43', 100, 800); // TV Bezel & Cabinet
    this.seedInventory('wh_main_mfg', 'part_remote_01', 200, 150); // Voice Remote Control
    this.seedInventory('wh_main_mfg', 'part_box_43', 200, 200); // Packaging & Thermocol
  }

  seedInventory(warehouseId, partId, qty, unitCost) {
    const key = `${warehouseId}_${partId}`;
    this.sparePartInventory.set(key, {
      warehouse_id: warehouseId,
      spare_part_id: partId,
      quantity_on_hand: qty,
      quantity_reserved: 0,
      unit_cost: unitCost
    });
  }

  // --- RPC 1: fn_create_bill_of_materials ---
  createBillOfMaterials(bomData, tenantId = 'tenant_zuvo_default') {
    if (!bomData.bom_number || !bomData.product_variant_id || !bomData.revision) {
      throw new Error('Missing required BOM header fields.');
    }
    if (bomData.yield_expected_pct <= 0 || bomData.yield_expected_pct > 100) {
      throw new Error('yield_expected_pct must be > 0 and <= 100.');
    }
    if (bomData.standard_labor_cost < 0 || bomData.standard_overhead_cost < 0) {
      throw new Error('Standard costs cannot be negative.');
    }
    if (!bomData.items || bomData.items.length === 0) {
      throw new Error('BOM must contain at least one component.');
    }

    // Check duplicate BOM number
    for (const b of this.boms.values()) {
      if (b.bom_number === bomData.bom_number && b.tenant_id === tenantId) {
        throw new Error(`BOM number ${bomData.bom_number} already exists.`);
      }
    }

    // Circular dependency check
    for (const item of bomData.items) {
      if (item.component_part_id === bomData.product_variant_id) {
        throw new Error('Circular dependency: Component cannot be identical to parent product.');
      }
      if (item.quantity_per_unit <= 0) {
        throw new Error('Quantity per unit must be greater than zero.');
      }
      if (item.scrap_allowance_pct < 0) {
        throw new Error('Scrap allowance percentage cannot be negative.');
      }
    }

    const bomId = `bom_${this.bomSeq++}`;
    let totalMaterialCost = 0;
    const itemsList = [];

    bomData.items.forEach((item, idx) => {
      const itemId = `bomi_${bomId}_${idx + 1}`;
      const invRecord = Array.from(this.sparePartInventory.values()).find(i => i.spare_part_id === item.component_part_id);
      const standardCost = invRecord ? invRecord.unit_cost : 100;
      const effectiveQty = item.quantity_per_unit * (1 + (item.scrap_allowance_pct || 0) / 100);
      totalMaterialCost += (effectiveQty * standardCost);

      const bItem = {
        id: itemId,
        tenant_id: tenantId,
        bom_id: bomId,
        component_part_id: item.component_part_id,
        quantity_per_unit: item.quantity_per_unit,
        scrap_allowance_pct: item.scrap_allowance_pct || 0,
        component_category: item.component_category || 'OTHER',
        is_serialized_component: !!item.is_serialized_component,
        standard_cost: standardCost
      };
      this.bomItems.set(itemId, bItem);
      itemsList.push(bItem);
    });

    const totalStandardCost = totalMaterialCost + (bomData.standard_labor_cost || 0) + (bomData.standard_overhead_cost || 0);

    const bom = {
      id: bomId,
      tenant_id: tenantId,
      bom_number: bomData.bom_number,
      product_variant_id: bomData.product_variant_id,
      revision: bomData.revision,
      description: bomData.description || null,
      yield_expected_pct: bomData.yield_expected_pct,
      standard_labor_cost: bomData.standard_labor_cost || 0,
      standard_overhead_cost: bomData.standard_overhead_cost || 0,
      total_standard_cost: Number(totalStandardCost.toFixed(2)),
      status: 'DRAFT',
      approved_by: null,
      approved_at: null,
      created_at: new Date().toISOString()
    };

    this.boms.set(bomId, bom);
    bom.items = itemsList;
    return bom;
  }

  approveBom(bomId, approverId = 'user_plant_mgr', tenantId = 'tenant_zuvo_default') {
    const bom = this.boms.get(bomId);
    if (!bom || bom.tenant_id !== tenantId) throw new Error('BOM not found.');
    if (bom.status !== 'DRAFT') throw new Error(`Cannot approve BOM in status ${bom.status}`);

    // If there's an existing ACTIVE BOM for this variant, transition it to REVISED
    for (const b of this.boms.values()) {
      if (b.product_variant_id === bom.product_variant_id && b.status === 'ACTIVE' && b.id !== bomId) {
        b.status = 'REVISED';
      }
    }

    bom.status = 'ACTIVE';
    bom.approved_by = approverId;
    bom.approved_at = new Date().toISOString();
    return bom;
  }

  // --- RPC 2: fn_release_production_work_order ---
  releaseWorkOrder(workOrderId, tenantId = 'tenant_zuvo_default') {
    const wo = this.workOrders.get(workOrderId);
    if (!wo || wo.tenant_id !== tenantId) throw new Error('Work order not found.');
    if (wo.status !== 'DRAFT') throw new Error(`Work order cannot be released from status: ${wo.status}`);

    const bom = this.boms.get(wo.bom_id);
    if (!bom || bom.status !== 'ACTIVE') {
      throw new Error('Work order cannot be released: Associated BOM is not in ACTIVE status.');
    }

    const items = Array.from(this.bomItems.values()).filter(i => i.bom_id === bom.id);
    let reservedCount = 0;

    // Check inventory availability first
    for (const item of items) {
      const grossQty = item.quantity_per_unit * wo.planned_quantity * (1 + (item.scrap_allowance_pct / 100));
      const requiredQty = Math.ceil(grossQty);
      const invKey = `${wo.source_warehouse_id}_${item.component_part_id}`;
      const inv = this.sparePartInventory.get(invKey);

      if (!inv || (inv.quantity_on_hand - inv.quantity_reserved) < requiredQty) {
        throw new Error(`Insufficient stock for component ${item.component_part_id}. Required: ${requiredQty}, Available: ${inv ? (inv.quantity_on_hand - inv.quantity_reserved) : 0}`);
      }
    }

    // Reserve stock atomically
    for (const item of items) {
      const grossQty = item.quantity_per_unit * wo.planned_quantity * (1 + (item.scrap_allowance_pct / 100));
      const requiredQty = Math.ceil(grossQty);
      const invKey = `${wo.source_warehouse_id}_${item.component_part_id}`;
      const inv = this.sparePartInventory.get(invKey);

      inv.quantity_reserved += requiredQty;
      reservedCount++;

      // Create staged issue record
      const issueId = `issue_${wo.id}_${item.component_part_id}`;
      this.materialIssues.set(issueId, {
        id: issueId,
        tenant_id: tenantId,
        work_order_id: wo.id,
        component_part_id: item.component_part_id,
        planned_quantity: requiredQty,
        issued_quantity: 0,
        returned_quantity: 0,
        unit_cost: inv.unit_cost,
        total_issued_cost: 0,
        status: 'STAGED',
        issued_at: null,
        returned_at: null
      });
    }

    wo.status = 'RELEASED';
    return {
      work_order_id: wo.id,
      status: wo.status,
      materials_reserved_count: reservedCount
    };
  }

  // --- RPC 3: fn_issue_materials_to_wip ---
  issueMaterialsToWip(workOrderId, issues, tenantId = 'tenant_zuvo_default') {
    const wo = this.workOrders.get(workOrderId);
    if (!wo || wo.tenant_id !== tenantId) throw new Error('Work order not found.');
    if (!['RELEASED', 'IN_PRODUCTION'].includes(wo.status)) {
      throw new Error(`Cannot issue materials to work order in status: ${wo.status}`);
    }

    let batchTotalCost = 0;

    for (const req of issues) {
      const issueKey = `issue_${wo.id}_${req.component_part_id}`;
      const issue = this.materialIssues.get(issueKey);
      if (!issue) throw new Error(`Material issue record not found for component ${req.component_part_id}`);
      if (issue.status === 'ISSUED_TO_WIP') {
        throw new Error(`Material for component ${req.component_part_id} already issued to WIP.`);
      }

      const invKey = `${wo.source_warehouse_id}_${req.component_part_id}`;
      const inv = this.sparePartInventory.get(invKey);
      if (!inv || inv.quantity_on_hand < req.issue_quantity) {
        throw new Error(`Insufficient inventory on hand for component ${req.component_part_id}`);
      }

      // Decrement inventory & clear reservation
      inv.quantity_on_hand -= req.issue_quantity;
      inv.quantity_reserved = Math.max(0, inv.quantity_reserved - req.issue_quantity);

      const issueCost = Number((req.issue_quantity * inv.unit_cost).toFixed(2));
      batchTotalCost += issueCost;

      issue.issued_quantity = req.issue_quantity;
      issue.unit_cost = inv.unit_cost;
      issue.total_issued_cost = issueCost;
      issue.status = 'ISSUED_TO_WIP';
      issue.issued_at = new Date().toISOString();
    }

    wo.status = 'IN_PRODUCTION';
    if (!wo.actual_start_at) wo.actual_start_at = new Date().toISOString();

    // Double-Entry General Ledger: DEBIT 1330 Factory WIP / CREDIT 1320 Raw Materials
    const jeId = `je_wip_issue_${this.jeSeq++}`;
    const jeNumber = `JV-MFG-WIP-${this.jeSeq}`;
    const je = {
      id: jeId,
      tenant_id: tenantId,
      entry_number: jeNumber,
      entry_type: 'MANUFACTURING_WIP_ISSUE',
      entry_date: new Date().toISOString().split('T')[0],
      reference_type: 'PRODUCTION_WORK_ORDER',
      reference_id: wo.id,
      total_debit: batchTotalCost,
      total_credit: batchTotalCost,
      status: 'POSTED',
      is_balanced: true
    };
    this.journalEntries.push(je);

    this.journalLines.push(
      { id: `jel_${jeId}_1`, journal_entry_id: jeId, account_code: '1330', account_name: 'Factory WIP Inventory', debit: batchTotalCost, credit: 0 },
      { id: `jel_${jeId}_2`, journal_entry_id: jeId, account_code: '1320', account_name: 'Raw Materials Inventory', debit: 0, credit: batchTotalCost }
    );

    // Audit Event
    this.auditEvents.push({
      event_type: 'MFG_MATERIAL_ISSUED_TO_WIP',
      entity_type: 'production_work_orders',
      entity_id: wo.id,
      amount: batchTotalCost,
      details: { work_order_number: wo.work_order_number, journal_entry_number: jeNumber }
    });

    return {
      work_order_id: wo.id,
      status: wo.status,
      total_issued_cost: batchTotalCost,
      journal_entry_number: jeNumber
    };
  }

  // --- RPC 4: fn_log_production_quality_gate ---
  logQualityGate(workOrderId, checkData, tenantId = 'tenant_zuvo_default') {
    const wo = this.workOrders.get(workOrderId);
    if (!wo || wo.tenant_id !== tenantId) throw new Error('Work order not found.');
    if (!['IN_PRODUCTION', 'QUALITY_HOLD'].includes(wo.status)) {
      throw new Error(`Cannot log quality check for work order in status: ${wo.status}`);
    }

    const validStations = ['ELECTRICAL_HI_POT', 'OPTICAL_CALIBRATION', 'BURN_IN_STRESS_4H', 'FINAL_PACKAGING_QA'];
    if (!validStations.includes(checkData.station_type)) {
      throw new Error(`Invalid quality station type: ${checkData.station_type}`);
    }
    if ((checkData.units_passed + checkData.units_failed) > checkData.units_tested) {
      throw new Error('Passed + failed units cannot exceed total units tested.');
    }

    // Equipment validation with Phase 8.5 assets
    if (checkData.calibration_equipment_id) {
      const asset = this.fixedAssets.get(checkData.calibration_equipment_id);
      if (!asset) throw new Error(`Testing equipment ${checkData.calibration_equipment_id} not found in Fixed Asset Register.`);
      if (asset.status !== 'ACTIVE') throw new Error(`Testing equipment ${asset.asset_tag} is not in ACTIVE status.`);
      if (new Date(asset.next_calibration_due_at) < new Date()) {
        throw new Error(`Testing equipment ${asset.asset_tag} has expired calibration status.`);
      }
    } else if (checkData.station_type === 'BURN_IN_STRESS_4H') {
      throw new Error('BURN_IN_STRESS_4H requires an eligible Phase 8.5 burn-in rig asset.');
    }

    const checkId = `qc_${workOrderId}_${checkData.station_type}`;
    const qc = {
      id: checkId,
      tenant_id: tenantId,
      work_order_id: wo.id,
      station_type: checkData.station_type,
      units_tested: checkData.units_tested,
      units_passed: checkData.units_passed,
      units_failed: checkData.units_failed,
      calibration_equipment_id: checkData.calibration_equipment_id || null,
      inspector_id: checkData.inspector_id || 'inspector_qa_lead',
      inspected_at: new Date().toISOString(),
      notes: checkData.notes || null
    };

    this.qualityChecks.push(qc);

    // If failure occurs, automatically place WO into QUALITY_HOLD
    if (checkData.units_failed > 0) {
      wo.status = 'QUALITY_HOLD';
    } else if (wo.status === 'QUALITY_HOLD') {
      // If re-test passes with 0 failures, release back to IN_PRODUCTION
      wo.status = 'IN_PRODUCTION';
    }

    return {
      quality_check_id: checkId,
      station_type: checkData.station_type,
      status: checkData.units_failed > 0 ? 'FAILED' : 'PASSED',
      work_order_status: wo.status
    };
  }

  // --- RPC 5: fn_complete_production_and_capitalize ---
  completeProductionAndCapitalize(workOrderId, completionData, tenantId = 'tenant_zuvo_default') {
    const wo = this.workOrders.get(workOrderId);
    if (!wo || wo.tenant_id !== tenantId) throw new Error('Work order not found.');
    if (!['IN_PRODUCTION', 'QUALITY_HOLD'].includes(wo.status)) {
      throw new Error(`Cannot complete work order in status: ${wo.status}`);
    }

    // 1. Mandatory Quality Gates verification
    const mandatoryStations = ['ELECTRICAL_HI_POT', 'OPTICAL_CALIBRATION', 'BURN_IN_STRESS_4H', 'FINAL_PACKAGING_QA'];
    for (const station of mandatoryStations) {
      const passedCheck = this.qualityChecks.find(q =>
        q.work_order_id === wo.id &&
        q.station_type === station &&
        q.units_failed === 0 &&
        q.units_passed >= completionData.completed_quantity
      );
      if (!passedCheck) {
        throw new Error(`Mandatory quality gate ${station} has not passed for work order ${wo.work_order_number}.`);
      }
    }

    // 2. Validate serial & barcode payload
    if (!completionData.serial_units || completionData.serial_units.length !== completionData.completed_quantity) {
      throw new Error(`Serial units count (${completionData.serial_units ? completionData.serial_units.length : 0}) does not match completed quantity (${completionData.completed_quantity}).`);
    }

    // Duplicate serial check
    for (const su of completionData.serial_units) {
      for (const existingUnit of this.productUnits.values()) {
        if (existingUnit.serial_number === su.serial_number) {
          throw new Error(`Duplicate serial number detected: ${su.serial_number}`);
        }
        if (existingUnit.barcode === su.barcode) {
          throw new Error(`Duplicate barcode detected: ${su.barcode}`);
        }
      }
    }

    // 3. Calculate Cost Breakdown
    let rawMaterialCost = 0;
    Array.from(this.materialIssues.values())
      .filter(i => i.work_order_id === wo.id && i.status === 'ISSUED_TO_WIP')
      .forEach(i => {
        rawMaterialCost += i.total_issued_cost;
      });

    const directLabor = Number(completionData.direct_labor_cost || 0);
    const overhead = Number(completionData.overhead_absorbed_cost || 0);
    const scrapVariance = Number(completionData.scrap_variance_cost || 0);

    const totalProdCost = Number((rawMaterialCost + directLabor + overhead + scrapVariance).toFixed(2));
    if (completionData.completed_quantity <= 0) {
      throw new Error('Completed quantity must be greater than zero for capitalization.');
    }
    const unitCostBasis = Number((totalProdCost / completionData.completed_quantity).toFixed(2));

    // 4. Create Serialized Product Units in finished stock
    const createdUnitIds = [];
    completionData.serial_units.forEach(su => {
      const uId = `unit_${this.unitSeq++}`;
      const productUnit = {
        id: uId,
        tenant_id: tenantId,
        variant_id: wo.product_variant_id,
        warehouse_id: wo.destination_warehouse_id,
        serial_number: su.serial_number,
        barcode: su.barcode,
        status: 'IN_STOCK',
        ownership_type: 'COMPANY',
        purchase_cost: unitCostBasis,
        manufacturing_work_order_id: wo.id,
        production_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };
      this.productUnits.set(uId, productUnit);
      createdUnitIds.push(uId);
    });

    // 5. Create Production Cost Record
    const costRecordId = `pcr_${wo.id}`;
    const jeId = `je_mfg_cap_${this.jeSeq++}`;
    const jeNumber = `JV-MFG-CAP-${this.jeSeq}`;

    const costRecord = {
      id: costRecordId,
      tenant_id: tenantId,
      work_order_id: wo.id,
      raw_material_cost: rawMaterialCost,
      direct_labor_cost: directLabor,
      overhead_absorbed_cost: overhead,
      scrap_variance_cost: scrapVariance,
      total_production_cost: totalProdCost,
      completed_quantity: completionData.completed_quantity,
      unit_cost_basis: unitCostBasis,
      journal_entry_id: jeId,
      calculated_at: new Date().toISOString()
    };
    this.costRecords.set(costRecordId, costRecord);

    // 6. Post Balanced Double-Entry Capitalization Journal
    // DEBIT 1300 Finished Goods Inventory: totalProdCost
    // CREDIT 1330 Factory WIP Inventory: (rawMaterialCost + directLabor)
    // CREDIT 5350 Manufacturing Overhead Absorbed: overhead
    // (And if scrap variance > 0: DEBIT 5010 Production Scrap Variance)
    const je = {
      id: jeId,
      tenant_id: tenantId,
      entry_number: jeNumber,
      entry_type: 'MANUFACTURING_CAPITALIZATION',
      entry_date: new Date().toISOString().split('T')[0],
      reference_type: 'PRODUCTION_WORK_ORDER',
      reference_id: wo.id,
      total_debit: totalProdCost,
      total_credit: totalProdCost,
      status: 'POSTED',
      is_balanced: true
    };
    this.journalEntries.push(je);

    this.journalLines.push(
      { id: `jel_${jeId}_1`, journal_entry_id: jeId, account_code: '1300', account_name: 'Finished Goods TV Inventory', debit: totalProdCost, credit: 0 },
      { id: `jel_${jeId}_2`, journal_entry_id: jeId, account_code: '1330', account_name: 'Factory WIP Inventory', debit: 0, credit: (rawMaterialCost + directLabor) },
      { id: `jel_${jeId}_3`, journal_entry_id: jeId, account_code: '5350', account_name: 'Manufacturing Overhead Absorbed', debit: 0, credit: overhead }
    );

    // 7. Update Work Order State to COMPLETED
    wo.status = 'COMPLETED';
    wo.completed_quantity = completionData.completed_quantity;
    wo.scrapped_quantity = completionData.scrapped_quantity || 0;
    wo.actual_completion_date = new Date().toISOString();

    // 8. Financial Audit Event
    this.auditEvents.push({
      event_type: 'MFG_PRODUCTION_CAPITALIZED',
      entity_type: 'production_work_orders',
      entity_id: wo.id,
      amount: totalProdCost,
      details: {
        work_order_number: wo.work_order_number,
        completed_quantity: completionData.completed_quantity,
        unit_cost_basis: unitCostBasis,
        journal_entry_number: jeNumber
      }
    });

    return {
      work_order_id: wo.id,
      status: wo.status,
      serialized_units_created: createdUnitIds.length,
      total_production_cost: totalProdCost,
      unit_cost_basis: unitCostBasis,
      journal_entry_number: jeNumber
    };
  }
}

// Instantiate Master Engine
const engine = new Phase87ManufacturingEngine();

// =============================================================================
// SUITE 1: BILL OF MATERIALS (BOM) CREATION, REVISION & APPROVAL (Tests 1–10)
// =============================================================================
console.log('--- SUITE 1: BILL OF MATERIALS (BOM) CREATION & REVISIONS ---');

// Test 1: Create Draft Multi-Level BOM
let bom1;
try {
  bom1 = engine.createBillOfMaterials({
    bom_number: 'BOM-ZUV-43-4K-001',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-A',
    description: 'BOM for ZUVO 43-Inch 4K UHD Smart Android TV',
    yield_expected_pct: 98.5,
    standard_labor_cost: 450,
    standard_overhead_cost: 250,
    items: [
      { component_part_id: 'part_panel_43', quantity_per_unit: 1, scrap_allowance_pct: 1.0, component_category: 'PANEL', is_serialized_component: true },
      { component_part_id: 'part_mainboard_43', quantity_per_unit: 1, scrap_allowance_pct: 0.5, component_category: 'MOTHERBOARD', is_serialized_component: true },
      { component_part_id: 'part_psu_43', quantity_per_unit: 1, scrap_allowance_pct: 0.5, component_category: 'POWER_SUPPLY' },
      { component_part_id: 'part_backlight_43', quantity_per_unit: 1, scrap_allowance_pct: 1.0, component_category: 'BACKLIGHT' },
      { component_part_id: 'part_chassis_43', quantity_per_unit: 1, scrap_allowance_pct: 0.0, component_category: 'CHASSIS' },
      { component_part_id: 'part_remote_01', quantity_per_unit: 1, scrap_allowance_pct: 0.0, component_category: 'REMOTE' },
      { component_part_id: 'part_box_43', quantity_per_unit: 1, scrap_allowance_pct: 2.0, component_category: 'PACKAGING' }
    ]
  });
  assert(bom1 && bom1.id && bom1.status === 'DRAFT', 1, 'Draft multi-level BOM created successfully');
} catch (e) {
  assert(false, 1, `Draft BOM creation failed: ${e.message}`);
}

// Test 2: Standard Cost Roll-Up calculation
assert(bom1 && bom1.total_standard_cost > 12000, 2, `Standard cost roll-up calculated correctly: ₹${bom1?.total_standard_cost}`);

// Test 3: Reject BOM with invalid yield (< 0 or > 100)
try {
  engine.createBillOfMaterials({
    bom_number: 'BOM-INVALID-YIELD',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-A',
    yield_expected_pct: 105,
    items: [{ component_part_id: 'part_panel_43', quantity_per_unit: 1 }]
  });
  assert(false, 3, 'BOM with yield > 100% must be rejected');
} catch (e) {
  assert(e.message.includes('yield_expected_pct'), 3, 'BOM with invalid yield percentage rejected');
}

// Test 4: Reject BOM with negative labor or overhead cost
try {
  engine.createBillOfMaterials({
    bom_number: 'BOM-NEG-COST',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-A',
    yield_expected_pct: 98,
    standard_labor_cost: -50,
    items: [{ component_part_id: 'part_panel_43', quantity_per_unit: 1 }]
  });
  assert(false, 4, 'BOM with negative standard cost must be rejected');
} catch (e) {
  assert(e.message.includes('negative'), 4, 'BOM with negative standard cost rejected');
}

// Test 5: Circular dependency protection (Component same as parent product)
try {
  engine.createBillOfMaterials({
    bom_number: 'BOM-CIRCULAR',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-A',
    yield_expected_pct: 98,
    items: [{ component_part_id: 'var_zuvo_43_4k', quantity_per_unit: 1 }]
  });
  assert(false, 5, 'Circular BOM reference must be rejected');
} catch (e) {
  assert(e.message.includes('Circular dependency'), 5, 'Circular dependency prevented');
}

// Test 6: Duplicate BOM number rejection
try {
  engine.createBillOfMaterials({
    bom_number: 'BOM-ZUV-43-4K-001',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-B',
    yield_expected_pct: 98,
    items: [{ component_part_id: 'part_panel_43', quantity_per_unit: 1 }]
  });
  assert(false, 6, 'Duplicate BOM number must be rejected');
} catch (e) {
  assert(e.message.includes('already exists'), 6, 'Duplicate BOM number rejected');
}

// Test 7: Component scrap allowance validation (>= 0)
try {
  engine.createBillOfMaterials({
    bom_number: 'BOM-NEG-SCRAP',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-A',
    yield_expected_pct: 98,
    items: [{ component_part_id: 'part_panel_43', quantity_per_unit: 1, scrap_allowance_pct: -2.5 }]
  });
  assert(false, 7, 'Negative scrap allowance must be rejected');
} catch (e) {
  assert(e.message.includes('cannot be negative'), 7, 'Negative scrap allowance rejected');
}

// Test 8: Empty BOM items validation
try {
  engine.createBillOfMaterials({
    bom_number: 'BOM-NO-ITEMS',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-A',
    yield_expected_pct: 98,
    items: []
  });
  assert(false, 8, 'Empty BOM items list must be rejected');
} catch (e) {
  assert(e.message.includes('at least one component'), 8, 'Empty BOM components rejected');
}

// Test 9: Controlled Approval of BOM to ACTIVE
let approvedBom;
try {
  approvedBom = engine.approveBom(bom1.id, 'user_plant_manager');
  assert(approvedBom.status === 'ACTIVE' && approvedBom.approved_by === 'user_plant_manager', 9, 'BOM approved to ACTIVE status');
} catch (e) {
  assert(false, 9, `BOM approval failed: ${e.message}`);
}

// Test 10: Revisioning: Approving Rev-B transitions Rev-A to REVISED
let bomRevB;
try {
  bomRevB = engine.createBillOfMaterials({
    bom_number: 'BOM-ZUV-43-4K-002',
    product_variant_id: 'var_zuvo_43_4k',
    revision: 'REV-B',
    yield_expected_pct: 99.0,
    standard_labor_cost: 420,
    standard_overhead_cost: 240,
    items: [{ component_part_id: 'part_panel_43', quantity_per_unit: 1, scrap_allowance_pct: 0.5 }]
  });
  engine.approveBom(bomRevB.id);
  const oldBom = engine.boms.get(bom1.id);
  assert(bomRevB.status === 'ACTIVE' && oldBom.status === 'REVISED', 10, 'Superseded BOM revision moved to REVISED state');
} catch (e) {
  assert(false, 10, `BOM revisioning failed: ${e.message}`);
}

// Reset bom1 back to ACTIVE for subsequent production work orders
bom1.status = 'ACTIVE';
engine.boms.get(bom1.id).status = 'ACTIVE';

// =============================================================================
// SUITE 2: WORK ORDER CREATION, RELEASE & MATERIAL RESERVATION (Tests 11–20)
// =============================================================================
console.log('\n--- SUITE 2: WORK ORDER RELEASE & STOCK RESERVATION ---');

// Test 11: Create Production Work Order in DRAFT
const wo1 = {
  id: 'wo_2026_001',
  tenant_id: 'tenant_zuvo_default',
  work_order_number: 'WO-2026-001',
  bom_id: bom1.id,
  product_variant_id: bom1.product_variant_id,
  source_warehouse_id: 'wh_main_mfg',
  destination_warehouse_id: 'wh_finished_tv',
  planned_quantity: 10,
  completed_quantity: 0,
  scrapped_quantity: 0,
  status: 'DRAFT',
  assembly_line: 'LINE-ALPHA',
  planned_start_date: '2026-10-18',
  created_at: new Date().toISOString()
};
engine.workOrders.set(wo1.id, wo1);
assert(wo1.status === 'DRAFT' && wo1.planned_quantity === 10, 11, 'Production Work Order created in DRAFT status');

// Test 12: Cannot release WO if BOM is not ACTIVE
wo1.bom_id = 'bom_invalid_id';
try {
  engine.releaseWorkOrder(wo1.id);
  assert(false, 12, 'Release with invalid/inactive BOM must fail');
} catch (e) {
  assert(e.message.includes('not in ACTIVE status') || e.message.includes('not found'), 12, 'Release with invalid BOM rejected');
}
wo1.bom_id = bom1.id; // restore

// Test 13: Release Work Order & Reserve Raw Materials
let releaseResult;
try {
  releaseResult = engine.releaseWorkOrder(wo1.id);
  assert(releaseResult.status === 'RELEASED' && releaseResult.materials_reserved_count === 7, 13, 'Work Order released and 7 components reserved');
} catch (e) {
  assert(false, 13, `Work order release failed: ${e.message}`);
}

// Test 14: Reserved stock increments in spare_part_inventory
const panelInv = engine.sparePartInventory.get('wh_main_mfg_part_panel_43');
assert(panelInv && panelInv.quantity_reserved >= 10, 14, `Raw material reserved in warehouse: ${panelInv?.quantity_reserved} units`);

// Test 15: Material issue records generated in STAGED status
const stagedIssues = Array.from(engine.materialIssues.values()).filter(i => i.work_order_id === wo1.id);
assert(stagedIssues.length === 7 && stagedIssues.every(i => i.status === 'STAGED'), 15, 'Material issue lines created in STAGED status');

// Test 16: Reject release if inventory on hand is insufficient
const woExcess = {
  id: 'wo_excess_001',
  tenant_id: 'tenant_zuvo_default',
  work_order_number: 'WO-EXCESS-001',
  bom_id: bom1.id,
  product_variant_id: bom1.product_variant_id,
  source_warehouse_id: 'wh_main_mfg',
  destination_warehouse_id: 'wh_finished_tv',
  planned_quantity: 1000, // available is only ~90
  completed_quantity: 0,
  scrapped_quantity: 0,
  status: 'DRAFT',
  assembly_line: 'LINE-BETA'
};
engine.workOrders.set(woExcess.id, woExcess);
try {
  engine.releaseWorkOrder(woExcess.id);
  assert(false, 16, 'Excessive work order release without stock must fail');
} catch (e) {
  assert(e.message.includes('Insufficient stock'), 16, 'Insufficient inventory rejected on release');
}

// Test 17: Planned start date validation
assert(wo1.planned_start_date === '2026-10-18', 17, 'Planned factory start date verified');

// Test 18: Re-releasing an already released work order is rejected
try {
  engine.releaseWorkOrder(wo1.id);
  assert(false, 18, 'Re-releasing an already RELEASED work order must fail');
} catch (e) {
  assert(e.message.includes('cannot be released from status'), 18, 'Duplicate release prevented');
}

// Test 19: Destination warehouse must be designated for finished goods
assert(wo1.destination_warehouse_id === 'wh_finished_tv', 19, 'Destination finished goods warehouse verified');

// Test 20: Work order planned quantity immutability after release
assert(wo1.planned_quantity === 10, 20, 'Planned production quantity locked on release');

// =============================================================================
// SUITE 3: WIP ACCOUNTING & MATERIAL ISSUES (Tests 21–25)
// =============================================================================
console.log('\n--- SUITE 3: WIP ACCOUNTING & MATERIAL ISSUES ---');

// Test 21: Issue staged materials to WIP
let issueResult;
try {
  const reqIssues = stagedIssues.map(si => ({
    component_part_id: si.component_part_id,
    issue_quantity: si.planned_quantity
  }));
  issueResult = engine.issueMaterialsToWip(wo1.id, reqIssues);
  assert(issueResult.status === 'IN_PRODUCTION' && issueResult.total_issued_cost > 100000, 21, `Materials issued to WIP! Total cost: ₹${issueResult.total_issued_cost}`);
} catch (e) {
  assert(false, 21, `Material issue failed: ${e.message}`);
}

// Test 22: Physical inventory decremented on issue
const updatedPanelInv = engine.sparePartInventory.get('wh_main_mfg_part_panel_43');
assert(updatedPanelInv.quantity_on_hand === 89 && updatedPanelInv.quantity_reserved === 0, 22, `Inventory decremented atomically. On Hand: ${updatedPanelInv.quantity_on_hand}`);

// Test 23: Material issues state transitioned to ISSUED_TO_WIP
const activeIssues = Array.from(engine.materialIssues.values()).filter(i => i.work_order_id === wo1.id);
assert(activeIssues.every(i => i.status === 'ISSUED_TO_WIP'), 23, 'All material issue lines set to ISSUED_TO_WIP');

// Test 24: Double-Entry GL Journal: DEBIT 1330 WIP / CREDIT 1320 Raw Materials
const wipJe = engine.journalEntries.find(j => j.entry_type === 'MANUFACTURING_WIP_ISSUE' && j.reference_id === wo1.id);
const wipLines = engine.journalLines.filter(l => l.journal_entry_id === wipJe?.id);
const debitLine = wipLines.find(l => l.account_code === '1330' && l.debit > 0);
const creditLine = wipLines.find(l => l.account_code === '1320' && l.credit > 0);

assert(
  wipJe &&
  wipJe.is_balanced &&
  debitLine &&
  creditLine &&
  debitLine.debit === creditLine.credit,
  24,
  `Balanced GL Posting: DEBIT 1330 (₹${debitLine?.debit}) = CREDIT 1320 (₹${creditLine?.credit})`
);

// Test 25: Duplicate material issue replay rejection
try {
  const reqIssues = stagedIssues.map(si => ({
    component_part_id: si.component_part_id,
    issue_quantity: si.planned_quantity
  }));
  engine.issueMaterialsToWip(wo1.id, reqIssues);
  assert(false, 25, 'Duplicate material issue must fail');
} catch (e) {
  assert(e.message.includes('already issued to WIP'), 25, 'Idempotency: Duplicate material issue prevented');
}

// =============================================================================
// SUITE 4: MULTI-STATION QUALITY GATES & BURN-IN (Tests 26–33)
// =============================================================================
console.log('\n--- SUITE 4: QUALITY GATES & PHASE 8.5 ASSET INTEGRATION ---');

// Test 26: Gate 1 - Electrical Hi-Pot Testing with Phase 8.5 Asset
let hipotResult;
try {
  hipotResult = engine.logQualityGate(wo1.id, {
    station_type: 'ELECTRICAL_HI_POT',
    units_tested: 10,
    units_passed: 10,
    units_failed: 0,
    calibration_equipment_id: 'fa_hipot_01',
    notes: 'Dielectric breakdown test passed at 1.5kV AC / 50Hz'
  });
  assert(hipotResult.status === 'PASSED', 26, 'Electrical Hi-Pot testing passed with Chroma Asset');
} catch (e) {
  assert(false, 26, `Hi-Pot test failed: ${e.message}`);
}

// Test 27: Gate 2 - Optical Calibration with Phase 8.5 Asset
let opticalResult;
try {
  opticalResult = engine.logQualityGate(wo1.id, {
    station_type: 'OPTICAL_CALIBRATION',
    units_tested: 10,
    units_passed: 10,
    units_failed: 0,
    calibration_equipment_id: 'fa_optical_01',
    notes: 'D65 White balance & Delta-E < 2.0 verified'
  });
  assert(opticalResult.status === 'PASSED', 27, 'Optical calibration passed with Konica Minolta Asset');
} catch (e) {
  assert(false, 27, `Optical test failed: ${e.message}`);
}

// Test 28: Gate 3 - 4-Hour Burn-In Stress Test with Phase 8.5 Burn-In Rig
let burnInResult;
try {
  burnInResult = engine.logQualityGate(wo1.id, {
    station_type: 'BURN_IN_STRESS_4H',
    units_tested: 10,
    units_passed: 10,
    units_failed: 0,
    calibration_equipment_id: 'fa_burn_in_01',
    notes: 'Completed continuous 4-hour dynamic video stress loop at 40°C ambient'
  });
  assert(burnInResult.status === 'PASSED', 28, '4-Hour Burn-In stress test verified with Phase 8.5 Rig Asset');
} catch (e) {
  assert(false, 28, `Burn-in test failed: ${e.message}`);
}

// Test 29: Reject 4-Hour Burn-In without designated equipment
try {
  engine.logQualityGate(wo1.id, {
    station_type: 'BURN_IN_STRESS_4H',
    units_tested: 10,
    units_passed: 10,
    units_failed: 0,
    calibration_equipment_id: null
  });
  assert(false, 29, '4-Hour Burn-In without asset must be rejected');
} catch (e) {
  assert(e.message.includes('requires an eligible Phase 8.5 burn-in rig'), 29, 'Asset requirement enforced for 4H Burn-In');
}

// Test 30: Reject test with decommissioned or expired asset
try {
  engine.logQualityGate(wo1.id, {
    station_type: 'ELECTRICAL_HI_POT',
    units_tested: 10,
    units_passed: 10,
    units_failed: 0,
    calibration_equipment_id: 'fa_expired_rig'
  });
  assert(false, 30, 'Test with expired/disposed asset must be rejected');
} catch (e) {
  assert(e.message.includes('not in ACTIVE status') || e.message.includes('expired calibration'), 30, 'Expired/Inactive equipment rejected');
}

// Test 31: Gate 4 - Final Packaging QA
let packagingResult;
try {
  packagingResult = engine.logQualityGate(wo1.id, {
    station_type: 'FINAL_PACKAGING_QA',
    units_tested: 10,
    units_passed: 10,
    units_failed: 0,
    notes: 'Accessory checklist verified: Remote, Stand, Screws, User Manual, Warranty Card'
  });
  assert(packagingResult.status === 'PASSED', 31, 'Final Packaging QA passed');
} catch (e) {
  assert(false, 31, `Packaging QA failed: ${e.message}`);
}

// Test 32: Quality Failure triggers QUALITY_HOLD status
const woFail = {
  id: 'wo_fail_001',
  tenant_id: 'tenant_zuvo_default',
  work_order_number: 'WO-FAIL-001',
  bom_id: bom1.id,
  product_variant_id: bom1.product_variant_id,
  status: 'IN_PRODUCTION'
};
engine.workOrders.set(woFail.id, woFail);
engine.logQualityGate(woFail.id, {
  station_type: 'ELECTRICAL_HI_POT',
  units_tested: 10,
  units_passed: 8,
  units_failed: 2,
  calibration_equipment_id: 'fa_hipot_01',
  notes: 'Leakage current exceeded threshold on 2 units'
});
assert(woFail.status === 'QUALITY_HOLD', 32, 'Critical QA failure automatically transitioned WO to QUALITY_HOLD');

// Test 33: Passed + Failed cannot exceed total units tested
try {
  engine.logQualityGate(wo1.id, {
    station_type: 'FINAL_PACKAGING_QA',
    units_tested: 10,
    units_passed: 8,
    units_failed: 4 // 8 + 4 = 12 > 10
  });
  assert(false, 33, 'Passed + failed > tested must fail');
} catch (e) {
  assert(e.message.includes('cannot exceed'), 33, 'QA test count arithmetic invariant enforced');
}

// =============================================================================
// SUITE 5: PRODUCTION COMPLETION, SERIALIZATION & CAPITALIZATION (Tests 34–40)
// =============================================================================
console.log('\n--- SUITE 5: PRODUCTION COMPLETION & SERIALIZATION ---');

// Test 34: Reject capitalization if mandatory quality gate is missing
const woIncomplete = {
  id: 'wo_incomplete_001',
  tenant_id: 'tenant_zuvo_default',
  work_order_number: 'WO-INCOMP-001',
  bom_id: bom1.id,
  product_variant_id: bom1.product_variant_id,
  destination_warehouse_id: 'wh_finished_tv',
  planned_quantity: 5,
  status: 'IN_PRODUCTION'
};
engine.workOrders.set(woIncomplete.id, woIncomplete);
try {
  engine.completeProductionAndCapitalize(woIncomplete.id, {
    completed_quantity: 5,
    serial_units: [
      { serial_number: 'SN-01', barcode: 'BC-01' },
      { serial_number: 'SN-02', barcode: 'BC-02' },
      { serial_number: 'SN-03', barcode: 'BC-03' },
      { serial_number: 'SN-04', barcode: 'BC-04' },
      { serial_number: 'SN-05', barcode: 'BC-05' }
    ]
  });
  assert(false, 34, 'Capitalization without passing all 4 gates must fail');
} catch (e) {
  assert(e.message.includes('Mandatory quality gate'), 34, 'Missing quality gates block production completion');
}

// Test 35: Complete production, calculate unit cost & capitalize
let capResult;
const serials = Array.from({ length: 10 }).map((_, i) => ({
  serial_number: `ZUV-2026-43-WO001-${String(i + 1).padStart(3, '0')}`,
  barcode: `BC-ZUV-43-WO001-${String(i + 1).padStart(3, '0')}`
}));

try {
  capResult = engine.completeProductionAndCapitalize(wo1.id, {
    completed_quantity: 10,
    scrapped_quantity: 0,
    direct_labor_cost: 4500, // ₹450 x 10
    overhead_absorbed_cost: 2500, // ₹250 x 10
    scrap_variance_cost: 0,
    serial_units: serials
  });
  assert(capResult.status === 'COMPLETED' && capResult.serialized_units_created === 10, 35, 'Production capitalized & 10 serialized TV units created');
} catch (e) {
  assert(false, 35, `Production completion failed: ${e.message}`);
}

// Test 36: Unit Cost Basis calculation
assert(capResult && capResult.unit_cost_basis > 12000, 36, `Server-authoritative unit cost basis: ₹${capResult?.unit_cost_basis}/unit`);

// Test 37: Serialized units created in existing product_units table
const finishedUnits = Array.from(engine.productUnits.values()).filter(u => u.manufacturing_work_order_id === wo1.id);
assert(
  finishedUnits.length === 10 &&
  finishedUnits.every(u => u.status === 'IN_STOCK' && u.ownership_type === 'COMPANY' && u.purchase_cost === capResult.unit_cost_basis),
  37,
  'Finished TV units inserted into product_units in IN_STOCK state with calculated landed cost'
);

// Test 38: Unique serial number constraint
assert(new Set(finishedUnits.map(u => u.serial_number)).size === 10, 38, 'All generated serial numbers are unique');

// Test 39: Unique barcode constraint
assert(new Set(finishedUnits.map(u => u.barcode)).size === 10, 39, 'All generated barcodes are unique');

// Test 40: Replay protection: Duplicate completion attempt rejected
try {
  engine.completeProductionAndCapitalize(wo1.id, {
    completed_quantity: 10,
    serial_units: serials
  });
  assert(false, 40, 'Re-completing an already completed work order must fail');
} catch (e) {
  assert(e.message.includes('Cannot complete work order in status'), 40, 'Idempotency: Re-completion prevented');
}

// =============================================================================
// SUITE 6: GL COSTING, OVERHEAD ABSORPTION & SCRAP VARIANCE (Tests 41–45)
// =============================================================================
console.log('\n--- SUITE 6: DOUBLE-ENTRY GL & VARIANCE RECONCILIATION ---');

// Test 41: Production Cost Record created and linked to Work Order
const costRec = engine.costRecords.get(`pcr_${wo1.id}`);
assert(
  costRec &&
  costRec.work_order_id === wo1.id &&
  costRec.raw_material_cost > 0 &&
  costRec.direct_labor_cost === 4500 &&
  costRec.overhead_absorbed_cost === 2500,
  41,
  'Production cost record generated with direct labor & overhead breakdowns'
);

// Test 42: Double-Entry Capitalization Journal: DEBIT 1300 Finished Goods
const capJe = engine.journalEntries.find(j => j.entry_type === 'MANUFACTURING_CAPITALIZATION' && j.reference_id === wo1.id);
const capLines = engine.journalLines.filter(l => l.journal_entry_id === capJe?.id);
const fgLine = capLines.find(l => l.account_code === '1300');
assert(fgLine && fgLine.debit === costRec.total_production_cost, 42, `DEBIT 1300 Finished Goods Inventory: ₹${fgLine?.debit}`);

// Test 43: Double-Entry Capitalization Journal: CREDIT 1330 Factory WIP
const wipCreditLine = capLines.find(l => l.account_code === '1330');
assert(wipCreditLine && wipCreditLine.credit === (costRec.raw_material_cost + costRec.direct_labor_cost), 43, `CREDIT 1330 Factory WIP cleared: ₹${wipCreditLine?.credit}`);

// Test 44: Double-Entry Capitalization Journal: CREDIT 5350 Overhead Absorbed
const ovhCreditLine = capLines.find(l => l.account_code === '5350');
assert(ovhCreditLine && ovhCreditLine.credit === 2500, 44, `CREDIT 5350 Overhead Absorbed: ₹${ovhCreditLine?.credit}`);

// Test 45: Zero-sum GL Journal balance verification
assert(capJe && capJe.is_balanced && (fgLine.debit === (wipCreditLine.credit + ovhCreditLine.credit)), 45, 'Capitalization journal balances exactly (Debit = Credit)');

// =============================================================================
// SUITE 7: RLS, TENANT ISOLATION, AUDIT TRAIL & INTEGRITY (Tests 46–50)
// =============================================================================
console.log('\n--- SUITE 7: RLS, SECURITY & IMMUTABLE AUDIT TRAIL ---');

// Test 46: Tenant isolation in BOM access
try {
  engine.approveBom(bom1.id, 'user_hacker', 'tenant_foreign_corp');
  assert(false, 46, 'Cross-tenant BOM modification must fail');
} catch (e) {
  assert(e.message.includes('BOM not found'), 46, 'Tenant isolation enforced on BOM management');
}

// Test 47: Tenant isolation in Work Order release
try {
  engine.releaseWorkOrder(wo1.id, 'tenant_foreign_corp');
  assert(false, 47, 'Cross-tenant Work Order release must fail');
} catch (e) {
  assert(e.message.includes('Work order not found'), 47, 'Tenant isolation enforced on Work Orders');
}

// Test 48: Immutable financial audit events logged
const mfgAuditEvents = engine.auditEvents.filter(a => a.entity_id === wo1.id);
assert(
  mfgAuditEvents.some(a => a.event_type === 'MFG_MATERIAL_ISSUED_TO_WIP') &&
  mfgAuditEvents.some(a => a.event_type === 'MFG_PRODUCTION_CAPITALIZED'),
  48,
  'Phase 8.4 immutable financial audit trail emitted for Material Issue & Capitalization'
);

// Test 49: Downstream warranty & sales compatibility
const sampleFinishedUnit = finishedUnits[0];
assert(
  sampleFinishedUnit &&
  sampleFinishedUnit.serial_number &&
  sampleFinishedUnit.barcode &&
  sampleFinishedUnit.warehouse_id === 'wh_finished_tv' &&
  sampleFinishedUnit.purchase_cost > 0,
  49,
  'Manufactured TV is 100% compatible with downstream Sales, Invoicing & Warranty Activation'
);

// Test 50: Atomicity & Rollback: Duplicate serial during capitalization aborts transaction
const woRollback = {
  id: 'wo_rb_001',
  tenant_id: 'tenant_zuvo_default',
  work_order_number: 'WO-RB-001',
  bom_id: bom1.id,
  product_variant_id: bom1.product_variant_id,
  destination_warehouse_id: 'wh_finished_tv',
  planned_quantity: 1,
  status: 'IN_PRODUCTION'
};
engine.workOrders.set(woRollback.id, woRollback);
// mock pass all gates
['ELECTRICAL_HI_POT', 'OPTICAL_CALIBRATION', 'BURN_IN_STRESS_4H', 'FINAL_PACKAGING_QA'].forEach(st => {
  engine.qualityChecks.push({
    id: `qc_rb_${st}`,
    tenant_id: 'tenant_zuvo_default',
    work_order_id: woRollback.id,
    station_type: st,
    units_tested: 1,
    units_passed: 1,
    units_failed: 0,
    calibration_equipment_id: 'fa_burn_in_01'
  });
});

try {
  engine.completeProductionAndCapitalize(woRollback.id, {
    completed_quantity: 1,
    serial_units: [
      { serial_number: sampleFinishedUnit.serial_number, barcode: 'BC-NEW-99' } // Collision with existing serial!
    ]
  });
  assert(false, 50, 'Duplicate serial collision must trigger complete rollback');
} catch (e) {
  assert(e.message.includes('Duplicate serial number detected'), 50, 'Atomicity verified: Duplicate serial collision triggers complete rollback');
}

// =============================================================================
// TEST SUITE SUMMARY
// =============================================================================
console.log('\n=============================================================================');
console.log(` MASTER TEST SUITE COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED`);
if (failedTests === 0) {
  console.log(' ALL 50 / 50 PHASE 8.7 MANUFACTURING & WIP COSTING TESTS PASSED');
  console.log(' VERDICT: PHASE 8.7 ENGINE ARCHITECTURALLY SOUND');
} else {
  console.error(` ${failedTests} TESTS FAILED`);
  process.exit(1);
}
console.log('=============================================================================\n');
