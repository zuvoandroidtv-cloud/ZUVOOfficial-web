import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  RefreshCw,
  Table,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Database,
  Download,
  TrendingUp,
  DollarSign,
  Package,
  Wrench,
  ShieldCheck,
  ShoppingBag,
  Store,
  Star,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  SlidersHorizontal,
  Lock
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { DateRangePicker } from '../components/common/DateRangePicker';

export type ReportCategory =
  | 'overview'
  | 'sales'
  | 'inventory'
  | 'procurement'
  | 'warranty'
  | 'service'
  | 'dealers'
  | 'csat'
  | 'audit'
  | 'corporate'
  | 'statutory';

interface ReportViewConfig {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
  dateColumn?: string;
  dealerColumn?: string;
  warehouseColumn?: string;
  defaultSortColumn?: string;
  secondarySortColumn?: string;
  searchColumns?: string[];
}

const ALL_REPORT_VIEWS: ReportViewConfig[] = [
  // 1. Overview
  { id: 'crm_overview', name: 'Executive Overview', category: 'overview', description: 'Consolidated CRM performance KPIs across inventory, sales, warranties, and RMA operations' },

  // 2. Sales & Finance
  { id: 'vw_sales_financial_analytics', name: 'Sales & Financial Analytics (Reconciled)', category: 'sales', description: 'Reconciled gross sales, discounts, net sales, taxes, invoiced totals, cash collections, and refunds', dateColumn: 'period_date', dealerColumn: 'dealer_id', secondarySortColumn: 'dealer_id', searchColumns: ['dealer_name'] },
  { id: 'sales_summary_by_date', name: 'Daily Sales Volume & Revenue', category: 'sales', description: 'Historical revenue timeline tracking daily order counts and gross/net volume', dateColumn: 'sale_date', searchColumns: ['sale_date'] },
  { id: 'sales_by_product_variant', name: 'Sales Revenue by Product Variant', category: 'sales', description: 'Gross sales revenue, sold unit counts, and discounts grouped by TV screen size and model', defaultSortColumn: 'gross_sales', secondarySortColumn: 'variant_id', searchColumns: ['product_name', 'model_name', 'product_code'] },
  { id: 'dealer_sales_summary', name: 'Dealer Channel Sales Performance', category: 'sales', description: 'Sales volume, invoiced amount, payment collections, and warranty registrations per dealer', dealerColumn: 'dealer_id', defaultSortColumn: 'total_sales_value', secondarySortColumn: 'dealer_id', searchColumns: ['dealer_name', 'dealer_code', 'city', 'state'] },

  // 3. Inventory & Barcode Lifecycle
  { id: 'vw_inventory_valuation_aging', name: 'Inventory Valuation & Aging (Cost Basis)', category: 'inventory', description: 'Valuation by purchase cost, 0-30/31-60/61-90/90+ day aging brackets, and ownership breakdown', warehouseColumn: 'warehouse_id', dealerColumn: 'dealer_id', defaultSortColumn: 'total_valuation', secondarySortColumn: 'variant_id', searchColumns: ['variant_name', 'model_name', 'warehouse_name', 'dealer_name'] },
  { id: 'inventory_summary', name: 'Inventory by Stock Status', category: 'inventory', description: 'Aggregate inventory units categorized by physical stock status (in_stock, in_transit, sold)', defaultSortColumn: 'unit_count', secondarySortColumn: 'status', searchColumns: ['status'] },
  { id: 'inventory_by_product_variant', name: 'Inventory by Product Variant', category: 'inventory', description: 'Real-time stock breakdown mapped across all TV screen sizes and variants', defaultSortColumn: 'unit_count', secondarySortColumn: 'variant_id', searchColumns: ['product_name', 'model_name', 'product_code', 'status'] },
  { id: 'stock_by_warehouse', name: 'Stock by Warehouse Location', category: 'inventory', description: 'Multi-warehouse storage distribution across central, regional, and transit depots', warehouseColumn: 'warehouse_id', defaultSortColumn: 'total_units', secondarySortColumn: 'warehouse_id', searchColumns: ['warehouse_name', 'warehouse_code', 'city', 'state'] },
  { id: 'spare_parts_stock_summary', name: 'Spare Parts Stock Health & Buffers', category: 'inventory', description: 'Buffer levels, reorder alerts, and available inventory for replacement components', defaultSortColumn: 'total_quantity_on_hand', secondarySortColumn: 'spare_part_id', searchColumns: ['part_name', 'part_code', 'category', 'stock_health_status'] },

  // 4. Procurement & Vendors (Staff Only)
  { id: 'vw_vendor_purchase_summary', name: 'Vendor Purchasing Summary', category: 'procurement', description: 'Aggregated PO totals, approved expenditures, and active vendor fulfillment rates', defaultSortColumn: 'total_purchase_value', secondarySortColumn: 'vendor_id', searchColumns: ['vendor_name', 'vendor_code'] },
  { id: 'vw_vendor_purchase_history', name: 'Purchase Order History & Status', category: 'procurement', description: 'Detailed timeline of procurement orders, ordered amounts, and approvals', dateColumn: 'po_date', secondarySortColumn: 'purchase_order_id', searchColumns: ['po_number', 'vendor_name', 'product_name', 'product_code'] },
  { id: 'vw_vendor_receiving_performance', name: 'Goods Receiving & Lead Times', category: 'procurement', description: 'Delivery fulfillment, partial receipt tracking, and vendor turnaround performance', defaultSortColumn: 'total_receipts', secondarySortColumn: 'vendor_id', searchColumns: ['vendor_name', 'vendor_code'] },
  { id: 'vw_vendor_discrepancy_summary', name: 'Procurement Discrepancies & Returns', category: 'procurement', description: 'Over-receipt, damaged item, and return-to-vendor reconciliation records', defaultSortColumn: 'total_rejected', secondarySortColumn: 'vendor_id', searchColumns: ['vendor_name', 'product_name', 'product_code', 'rejection_reasons'] },

  // 5. Warranty & Customers
  { id: 'warranty_summary', name: 'Warranty Status Summary', category: 'warranty', description: 'Total policy distribution across active, expired, and void statuses', defaultSortColumn: 'warranty_count', secondarySortColumn: 'status', searchColumns: ['status'] },
  { id: 'warranty_expiration_report', name: 'Warranty Expiration Watchlist', category: 'warranty', description: 'Units reaching warranty end-dates within 30-day horizons for extended service marketing', dateColumn: 'warranty_end_date', secondarySortColumn: 'warranty_id', searchColumns: ['warranty_number', 'serial_number', 'customer_name', 'customer_phone', 'barcode'] },
  { id: 'warranty_registration_summary', name: 'Warranty Registrations by Channel', category: 'warranty', description: 'Registration volume split between portal, dealer, QR scan, and support', defaultSortColumn: 'registration_count', secondarySortColumn: 'registration_method', searchColumns: ['registration_method'] },
  { id: 'vw_warranty_extensions_summary', name: 'Warranty Extensions Performance', category: 'warranty', description: 'Policy extensions, additional coverage months, and warranty revenue', defaultSortColumn: 'requested_at', secondarySortColumn: 'extension_id', searchColumns: ['extension_number', 'warranty_number', 'customer_name', 'serial_number', 'barcode'] },
  { id: 'vw_warranty_transfers_summary', name: 'Warranty Ownership Transfers', category: 'warranty', description: 'Unit transfer history between previous and current customers', defaultSortColumn: 'requested_at', secondarySortColumn: 'transfer_id', searchColumns: ['transfer_number', 'warranty_number', 'from_customer_name', 'to_customer_name', 'serial_number'] },

  // 6. Service Operations & SLA
  { id: 'vw_service_sla_performance', name: 'Service SLA & Technician Performance', category: 'service', description: 'Resolution speed (hours), SLA compliance, first-visit resolution (FVR%), and parts cost', dealerColumn: 'dealer_id', defaultSortColumn: 'total_tickets', secondarySortColumn: 'technician_id', searchColumns: ['service_center_name', 'technician_name', 'dealer_name'] },
  { id: 'service_ticket_summary', name: 'Service Tickets by Status', category: 'service', description: 'Active ticket counts across open, in-progress, resolved, and closed workflows', defaultSortColumn: 'ticket_count', secondarySortColumn: 'status', searchColumns: ['status'] },
  { id: 'service_ticket_priority_summary', name: 'Service Tickets by SLA Priority', category: 'service', description: 'Urgent (24h), high (48h), normal (72h), and low SLA workload categorization', defaultSortColumn: 'ticket_count', secondarySortColumn: 'priority', searchColumns: ['priority'] },
  { id: 'service_cost_summary', name: 'Service Repair Cost Aggregate', category: 'service', description: 'Total parts, labor, transport, and warranty-absorbed repair expenditure', defaultSortColumn: 'total_cost', secondarySortColumn: 'cost_type', searchColumns: ['cost_type'] },
  { id: 'service_parts_summary', name: 'Service Parts Replacement Frequency', category: 'service', description: 'Most frequently utilized hardware replacement parts in RMA tickets', defaultSortColumn: 'usage_count', secondarySortColumn: 'part_code', searchColumns: ['part_name', 'part_code'] },
  { id: 'service_center_workload', name: 'Authorized Service Center Workload', category: 'service', description: 'Current active ticket load per regional authorized service partner', defaultSortColumn: 'total_tickets', secondarySortColumn: 'service_center_id', searchColumns: ['center_name', 'center_code', 'city', 'state'] },

  // 7. Dealer & Consignment
  { id: 'vw_dealer_consignment_summary', name: 'Consignment Stock Summary', category: 'dealers', description: 'Dispatched, received, available, sold, disputed, and settled consignment balances', dealerColumn: 'dealer_id', defaultSortColumn: 'total_consignment_units', secondarySortColumn: 'dealer_id', searchColumns: ['dealer_name', 'dealer_code', 'city', 'state'] },
  { id: 'vw_dealer_consignment_inventory', name: 'Dealer Serialized Consignment Stock', category: 'dealers', description: 'Live serialized unit-by-unit consignment tracking by dealer and model', dealerColumn: 'dealer_id', defaultSortColumn: 'dispatched_at', secondarySortColumn: 'consignment_id', searchColumns: ['serial_number', 'barcode', 'model_name', 'dealer_name', 'product_code'] },
  { id: 'vw_dealer_consignment_aging', name: 'Dealer Consignment Aging Brackets', category: 'dealers', description: 'Consignment stock age distribution (0-30, 31-60, 61-90, 90+ days) per dealer', dealerColumn: 'dealer_id', defaultSortColumn: 'dispatched_at', secondarySortColumn: 'consignment_id', searchColumns: ['serial_number', 'barcode', 'model_name', 'dealer_name'] },
  { id: 'vw_dealer_consignment_reconciliation', name: 'Consignment Discrepancy Reconciliation', category: 'dealers', description: 'Physical vs ledger reconciliation records, audit variances, and adjustments', dealerColumn: 'dealer_id', defaultSortColumn: 'dispatched_at', secondarySortColumn: 'consignment_id', searchColumns: ['serial_number', 'barcode', 'model_name', 'dealer_name'] },
  { id: 'vw_dealer_sales_performance', name: 'Dealer Channel Performance Metrics', category: 'dealers', description: 'Dealer sales targets, achieved volumes, collection efficiency, and revenue', dealerColumn: 'dealer_id', defaultSortColumn: 'total_sales_amount', secondarySortColumn: 'dealer_id', searchColumns: ['dealer_name', 'dealer_code'] },

  // 8. CSAT & Follow-ups
  { id: 'vw_csat_summary', name: 'Customer Satisfaction (CSAT) Overview', category: 'csat', description: 'Average rating (1-5), response rate, and rating distribution from verified surveys', defaultSortColumn: 'total_responses' },
  { id: 'vw_csat_rating_distribution', name: 'CSAT Rating Breakdown (5★ to 1★)', category: 'csat', description: 'Rating distribution percentages and counts across service categories', defaultSortColumn: 'rating', searchColumns: ['rating'] },
  { id: 'vw_csat_service_center_summary', name: 'CSAT by Authorized Service Center', category: 'csat', description: 'Service center satisfaction ratings, feedback volume, and resolution scores', defaultSortColumn: 'surveys_sent', secondarySortColumn: 'service_center_id', searchColumns: ['center_name', 'center_code'] },
  { id: 'vw_csat_technician_summary', name: 'CSAT by Technician', category: 'csat', description: 'Field technician ratings, total service feedback responses, and satisfaction averages', defaultSortColumn: 'surveys_assigned', secondarySortColumn: 'technician_id', searchColumns: ['technician_name', 'technician_code'] },
  { id: 'vw_csat_followup_summary', name: 'CSAT Follow-ups & Remediation', category: 'csat', description: 'Low-rating grievance management, follow-up status, and contact resolution', defaultSortColumn: 'total_count', secondarySortColumn: 'status', searchColumns: ['status', 'priority'] },

  // 9. Operational Audit & Data Quality
  { id: 'vw_operational_audit_discrepancies', name: 'Data Quality & Ledger Discrepancies', category: 'audit', description: 'Discrepancy detector flagging unassigned units, missing sale items, PO over-receipts, and data variances', defaultSortColumn: 'detected_at', secondarySortColumn: 'entity_id', searchColumns: ['issue_description', 'audit_category', 'entity_id'] },

  // 10. Corporate Finance & General Ledger
  { id: 'vw_gl_financial_trial_summary', name: 'General Ledger Trial Summary', category: 'corporate', description: 'Consolidated chart of accounts debits, credits, and net balances from double-entry journals', defaultSortColumn: 'total_debit', secondarySortColumn: 'account_code', searchColumns: ['account_name', 'account_code', 'account_type'] },
  { id: 'vw_fixed_assets_depreciation_summary', name: 'Fixed Assets & Net Book Value', category: 'corporate', description: 'Capital equipment, gross original cost, accumulated depreciation, and net book value schedule', defaultSortColumn: 'total_gross_cost', secondarySortColumn: 'asset_category', searchColumns: ['asset_category'] },
  { id: 'vw_manufacturing_wip_summary', name: 'Manufacturing & WIP Cost Efficiency', category: 'corporate', description: 'Factory production work orders, target vs completed output, scrap units, and WIP costs', defaultSortColumn: 'total_wip_cost', secondarySortColumn: 'work_order_status', searchColumns: ['work_order_status'] },

  // 11. Statutory Compliance & HR Finance
  { id: 'vw_hr_payroll_statutory_summary', name: 'Payroll & Statutory HR Liability Summary', category: 'statutory', description: 'Monthly payroll runs, employee/employer EPF, ESIC, Professional Tax, Section 192 TDS, and net pay', defaultSortColumn: 'period_start', secondarySortColumn: 'payroll_period_id', searchColumns: ['financial_year', 'period_status'] },
  { id: 'vw_tds_statutory_compliance_summary', name: 'Withholding Tax (TDS/TCS) Reconciliation', category: 'statutory', description: 'Sectional withholding liability, deposits to Central Government, and Form 26Q challan linkage', defaultSortColumn: 'total_tds_withheld', secondarySortColumn: 'section_code', searchColumns: ['section_code', 'description'] }
];

interface KPIPayload {
  sales: {
    gross_sales: number;
    discounts: number;
    net_sales: number;
    tax: number;
    invoiced_total: number;
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    aov: number;
    payments_collected: number;
    outstanding_receivables: number;
    returns_count: number;
    refunds_value: number;
    net_revenue: number;
  };
  inventory: {
    total_units: number;
    warehouse_available_units: number;
    dealer_stock_units: number;
    in_transit_units: number;
    sold_units: number;
    total_valuation: number;
    low_stock_variants_count: number;
  };
  procurement: {
    total_pos: number;
    total_po_value: number;
    ordered_quantity: number;
    received_quantity: number;
    pending_quantity: number;
  };
  service: {
    total_tickets: number;
    open_tickets: number;
    overdue_tickets: number;
    resolved_tickets: number;
    avg_resolution_hours: number;
    fvr_rate_pct: number;
    completed_visits: number;
    total_service_cost: number;
  };
  warranty: {
    total_registered: number;
    active_warranties: number;
    expired_warranties: number;
  };
  consignment: {
    active_stock_units: number;
    pending_acknowledgment: number;
    settled_units: number;
  };
  csat: {
    average_rating: number;
    total_responses: number;
    response_rate_pct: number;
    pending_followups: number;
  };
}

export const ReportsPage: React.FC = () => {
  const { currentRole, profile } = useAuth();
  const isDealer = currentRole === 'dealer';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<ReportCategory>('overview');
  const [selectedReportId, setSelectedReportId] = useState<string>('crm_overview');

  // Multi-dimensional filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedDealer, setSelectedDealer] = useState('');

  // Dropdown reference lists
  const [warehouses, setWarehouses] = useState<{ id: string; warehouse_name: string }[]>([]);
  const [dealers, setDealers] = useState<{ id: string; dealer_name: string }[]>([]);

  // KPI summary state
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpis, setKpis] = useState<KPIPayload | null>(null);

  // Tabular data state
  const [reportData, setReportData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination & Count State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // Quick Search & Debounce State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter available reports based on role (hide procurement and company-wide views for dealers)
  const availableReports = useMemo(() => {
    return ALL_REPORT_VIEWS.filter((r) => {
      if (isDealer) {
        if (r.category === 'procurement') return false;
        if (r.id === 'crm_overview') return false;
      }
      return true;
    });
  }, [isDealer]);

  const activeReportsForTab = useMemo(() => {
    return availableReports.filter((r) => r.category === activeTab);
  }, [availableReports, activeTab]);

  const activeConfig = useMemo(() => {
    return (
      availableReports.find((r) => r.id === selectedReportId) ||
      activeReportsForTab[0] ||
      availableReports[0]
    );
  }, [availableReports, selectedReportId, activeReportsForTab]);

  // Load reference lists on mount
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [wRes, dRes] = await Promise.all([
          supabase.from('warehouses').select('id, warehouse_name').order('warehouse_name'),
          !isDealer
            ? supabase.from('dealers').select('id, dealer_name').order('dealer_name')
            : Promise.resolve({ data: [] })
        ]);
        if (wRes.data) setWarehouses(wRes.data);
        if (dRes.data) setDealers(dRes.data);
      } catch (e) {
        console.error('Failed to load filter dropdowns', e);
      }
    };
    fetchDropdowns();
  }, [isDealer]);

  // Load executive KPIs
  const fetchKPIs = async () => {
    setKpiLoading(true);
    try {
      const dealerParam = isDealer ? profile?.dealer_id : selectedDealer || null;
      const { data, error } = await (supabase.rpc as any)('fn_get_advanced_analytics_kpis', {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_dealer_id: dealerParam || null
      });
      if (error) throw error;
      setKpis(data as unknown as KPIPayload);
    } catch (e: any) {
      console.error('Failed to load analytics KPIs', e);
    } finally {
      setKpiLoading(false);
    }
  };

  // Load report data for active view using server-side pagination, deterministic ordering, and server search
  const fetchReportData = async (
    viewName: string,
    targetPage: number = 1,
    currentSize: number = pageSize,
    currentSearch: string = debouncedSearch
  ) => {
    setReportLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase.from(viewName as any).select('*', { count: 'exact' });

      // Date filtering
      if (activeConfig.dateColumn) {
        if (startDate) query = query.gte(activeConfig.dateColumn, startDate);
        if (endDate) query = query.lte(activeConfig.dateColumn, endDate);
      }

      // Warehouse filtering
      if (selectedWarehouse && activeConfig.warehouseColumn) {
        query = query.eq(activeConfig.warehouseColumn, selectedWarehouse);
      }

      // Dealer filtering (strictly enforce dealer ID if user is dealer)
      if (isDealer && profile?.dealer_id && activeConfig.dealerColumn) {
        query = query.eq(activeConfig.dealerColumn, profile.dealer_id);
      } else if (!isDealer && selectedDealer && activeConfig.dealerColumn) {
        query = query.eq(activeConfig.dealerColumn, selectedDealer);
      }

      // Server-side search across entire dataset if view has defined searchColumns
      if (currentSearch.trim() && activeConfig.searchColumns && activeConfig.searchColumns.length > 0) {
        const cleanQ = currentSearch.trim().replace(/[,()]/g, ' ');
        const orClause = activeConfig.searchColumns
          .map((col) => `${col}.ilike.%${cleanQ}%`)
          .join(',');
        query = query.or(orClause);
      }

      // Reliable deterministic multi-column ordering
      const sortCol = activeConfig.dateColumn || activeConfig.defaultSortColumn;
      if (sortCol) {
        query = query.order(sortCol, { ascending: false });
        if (activeConfig.secondarySortColumn && activeConfig.secondarySortColumn !== sortCol) {
          query = query.order(activeConfig.secondarySortColumn, { ascending: false });
        }
      } else if (activeConfig.secondarySortColumn) {
        query = query.order(activeConfig.secondarySortColumn, { ascending: false });
      }

      // Server-side range pagination: (targetPage - 1) * currentSize to targetPage * currentSize - 1
      const from = (targetPage - 1) * currentSize;
      const to = from + currentSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      const rows = data || [];
      setReportData(rows);
      setTotalCount(count ?? rows.length);
      setPage(targetPage);

      if (rows.length > 0) {
        // Exclude internal ids and sensitive token columns
        const keys = Object.keys(rows[0]).filter(
          (k) =>
            !['token', 'token_hash', 'otp', 'customer_confirmation_otp', 'password', 'secret'].includes(
              k.toLowerCase()
            )
        );
        setColumns(keys);
      } else if (columns.length === 0) {
        setColumns([]);
      }
    } catch (err: any) {
      console.error(`Error querying view ${viewName}:`, err);
      setErrorMsg(err.message || `Failed to fetch report from ${viewName}`);
      setReportData([]);
      setTotalCount(0);
      setColumns([]);
    } finally {
      setReportLoading(false);
    }
  };

  // Trigger data refreshes on filter, report change or debounced search
  useEffect(() => {
    fetchKPIs();
  }, [startDate, endDate, selectedDealer, isDealer, profile?.dealer_id]);

  useEffect(() => {
    if (activeTab !== 'overview' && activeConfig) {
      fetchReportData(activeConfig.id, 1, pageSize, debouncedSearch);
    }
  }, [activeConfig?.id, startDate, endDate, selectedWarehouse, selectedDealer, pageSize, debouncedSearch]);

  // Handle Tab Switch
  const handleTabSwitch = (category: ReportCategory) => {
    setActiveTab(category);
    const firstReportInTab = availableReports.find((r) => r.category === category);
    if (firstReportInTab) {
      setSelectedReportId(firstReportInTab.id);
    }
  };

  // In-page fallback search only if the view has no server searchColumns defined
  const displayedRows = useMemo(() => {
    if (!searchQuery.trim() || (activeConfig.searchColumns && activeConfig.searchColumns.length > 0)) {
      return reportData;
    }
    const q = searchQuery.toLowerCase();
    return reportData.filter((row) =>
      Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(q))
    );
  }, [reportData, searchQuery, activeConfig.searchColumns]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Full-dataset export handler: retrieves all matching records across all pages
  const handleExport = async (format: 'csv' | 'xml') => {
    if (totalCount === 0) {
      alert('No data available in current view to export');
      return;
    }
    setExporting(true);
    setExportProgress('Fetching full dataset...');
    try {
      let allExportRows: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let expQuery = supabase.from(activeConfig.id as any).select('*');

        if (activeConfig.dateColumn) {
          if (startDate) expQuery = expQuery.gte(activeConfig.dateColumn, startDate);
          if (endDate) expQuery = expQuery.lte(activeConfig.dateColumn, endDate);
        }

        if (selectedWarehouse && activeConfig.warehouseColumn) {
          expQuery = expQuery.eq(activeConfig.warehouseColumn, selectedWarehouse);
        }

        if (isDealer && profile?.dealer_id && activeConfig.dealerColumn) {
          expQuery = expQuery.eq(activeConfig.dealerColumn, profile.dealer_id);
        } else if (!isDealer && selectedDealer && activeConfig.dealerColumn) {
          expQuery = expQuery.eq(activeConfig.dealerColumn, selectedDealer);
        }

        // Apply server search if configured
        if (debouncedSearch.trim() && activeConfig.searchColumns && activeConfig.searchColumns.length > 0) {
          const cleanQ = debouncedSearch.trim().replace(/[,()]/g, ' ');
          const orClause = activeConfig.searchColumns
            .map((c) => `${c}.ilike.%${cleanQ}%`)
            .join(',');
          expQuery = expQuery.or(orClause);
        }

        // Apply deterministic multi-column ordering
        const sortCol = activeConfig.dateColumn || activeConfig.defaultSortColumn;
        if (sortCol) {
          expQuery = expQuery.order(sortCol, { ascending: false });
          if (activeConfig.secondarySortColumn && activeConfig.secondarySortColumn !== sortCol) {
            expQuery = expQuery.order(activeConfig.secondarySortColumn, { ascending: false });
          }
        } else if (activeConfig.secondarySortColumn) {
          expQuery = expQuery.order(activeConfig.secondarySortColumn, { ascending: false });
        }

        expQuery = expQuery.range(offset, offset + batchSize - 1);
        const { data, error } = await expQuery;
        if (error) throw error;

        const batch = data || [];
        allExportRows.push(...batch);

        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
          setExportProgress(`Fetched ${allExportRows.length} of ${totalCount}...`);
        }
      }

      // If view has no searchColumns and user typed search, apply in-memory filter to complete export
      if (searchQuery.trim() && (!activeConfig.searchColumns || activeConfig.searchColumns.length === 0)) {
        const q = searchQuery.toLowerCase();
        allExportRows = allExportRows.filter((row) =>
          Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
        );
      }

      if (allExportRows.length === 0) {
        alert('No matching records found to export');
        return;
      }

      // Prepare headers excluding sensitive keys
      const sampleRow = allExportRows[0] || {};
      const safeKeys = Object.keys(sampleRow).filter(
        (k) =>
          !['token', 'token_hash', 'otp', 'customer_confirmation_otp', 'password', 'secret'].includes(
            k.toLowerCase()
          )
      );

      const headers = safeKeys.map((col) => ({
        key: col,
        label: col.replace(/_/g, ' ').toUpperCase()
      }));

      const filename = `zuvo_${activeConfig.id}_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        exportToCSV(allExportRows, headers, filename);
      } else {
        await exportToExcel(allExportRows, headers, filename, activeConfig.name.slice(0, 30));
      }
    } catch (err: any) {
      console.error('Export error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedWarehouse('');
    if (!isDealer) setSelectedDealer('');
    setSearchQuery('');
    setDebouncedSearch('');
  };

  const hasActiveFilters = Boolean(
    startDate || endDate || selectedWarehouse || (selectedDealer && !isDealer) || searchQuery
  );

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="module-container" style={{ paddingBottom: '3rem' }}>
      {/* 1. Header Toolbar */}
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: 0 }}>
            <BarChart3 style={{ color: 'var(--brand-primary)', width: 26, height: 26 }} />
            Advanced Reports & Analytics
            {isDealer && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Lock size={12} /> Dealer Portal View
              </span>
            )}
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Audited financial calculations, inventory valuation, SLA metrics, and secure data exports
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              fetchKPIs();
              if (activeTab !== 'overview') fetchReportData(activeConfig.id);
            }}
            disabled={reportLoading || kpiLoading}
            title="Refresh analytics and report datasets"
          >
            <RefreshCw size={15} className={reportLoading || kpiLoading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => window.print()}
            title="Print current report view"
          >
            <Printer size={15} /> Print
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={exporting || reportLoading || totalCount === 0}
            title="Secure CSV Export with Formula Injection Protection"
          >
            <Download size={15} /> {exporting && exportProgress ? exportProgress : 'Export CSV'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleExport('xml')}
            disabled={exporting || reportLoading || totalCount === 0}
            title="Export Microsoft Excel SpreadsheetML (.xml) - native Excel XML format"
          >
            <FileSpreadsheet size={15} /> Export Excel (XML)
          </button>
        </div>
      </div>

      {/* 2. Global Multi-Dimensional Filter Bar */}
      <div
        className="card"
        style={{
          padding: '0.875rem 1.25rem',
          marginBottom: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SlidersHorizontal size={16} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filters:</span>
          </div>

          {/* Date Range Picker */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClearDateRange={() => {
              setStartDate('');
              setEndDate('');
            }}
          />

          {/* Warehouse Dropdown */}
          <select
            className="form-select"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            style={{ minWidth: 170, fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.warehouse_name}
              </option>
            ))}
          </select>

          {/* Dealer Dropdown (Hidden for dealers to ensure tenant isolation) */}
          {!isDealer && (
            <select
              className="form-select"
              value={selectedDealer}
              onChange={(e) => setSelectedDealer(e.target.value)}
              style={{ minWidth: 170, fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
            >
              <option value="">All Dealers</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dealer_name}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              className="btn btn-ghost"
              onClick={handleClearFilters}
              style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', color: 'var(--text-danger)' }}
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>

        {/* Live Filter Telemetry */}
        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
          {isDealer ? (
            <span style={{ color: 'var(--text-accent)' }}>Restricted to Dealer {profile?.dealer_id?.slice(0, 8)}...</span>
          ) : (
            <span>Global Corporate Scope</span>
          )}
        </div>
      </div>

      {/* 3. Executive KPI Dashboard Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        {/* KPI 1: Gross & Net Revenue */}
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              Reconciled Net Revenue
            </span>
            <DollarSign size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.35rem', color: '#10b981' }}>
            {formatCurrency(kpis?.sales.net_revenue ?? kpis?.sales.net_sales)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Gross: {formatCurrency(kpis?.sales.gross_sales)} • Deduplicated Refunds: {formatCurrency(kpis?.sales.refunds_value)}
          </div>
        </div>

        {/* KPI 2: Collections vs Outstanding */}
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              Cash Collections
            </span>
            <TrendingUp size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {formatCurrency(kpis?.sales.payments_collected)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Outstanding: {formatCurrency(kpis?.sales.outstanding_receivables)} • Orders: {kpis?.sales.total_orders ?? 0}
          </div>
        </div>

        {/* KPI 3: Stock Units & Valuation */}
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              Available Stock Units
            </span>
            <Package size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {isDealer
              ? `${kpis?.inventory.dealer_stock_units ?? 0} Units`
              : `${kpis?.inventory.warehouse_available_units ?? 0} Warehouse`}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {!isDealer && `Valuation: ${formatCurrency(kpis?.inventory.total_valuation)} • `}
            Low Stock: {kpis?.inventory.low_stock_variants_count ?? 0} Models
          </div>
        </div>

        {/* KPI 4: Service SLA & Resolution */}
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              Service SLA & Tickets
            </span>
            <Wrench size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {kpis?.service.open_tickets ?? 0} Open
            {kpis?.service.overdue_tickets ? (
              <span style={{ color: 'var(--text-danger)', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
                ({kpis.service.overdue_tickets} Overdue)
              </span>
            ) : null}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Avg Resolution: {kpis?.service.avg_resolution_hours ?? 0}h • FVR: {kpis?.service.fvr_rate_pct ?? 0}%
          </div>
        </div>

        {/* KPI 5: CSAT & Follow-ups */}
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #ec4899' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              CSAT Score & Follow-ups
            </span>
            <Star size={18} style={{ color: '#ec4899' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{kpis?.csat.average_rating ? `${kpis.csat.average_rating} / 5.0` : 'No Data'}</span>
            <Star size={16} fill="#ec4899" color="#ec4899" />
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Responses: {kpis?.csat.total_responses ?? 0} ({kpis?.csat.response_rate_pct ?? 0}%) • Pending: {kpis?.csat.pending_followups ?? 0}
          </div>
        </div>
      </div>

      {/* 4. Report Categories Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem'
        }}
      >
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('overview')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'overview' ? 600 : 400,
            color: activeTab === 'overview' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <BarChart3 size={16} /> Overview & Visual Trends
        </button>

        <button
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('sales')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'sales' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'sales' ? 600 : 400,
            color: activeTab === 'sales' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <DollarSign size={16} /> Sales & Finance
        </button>

        <button
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('inventory')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'inventory' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'inventory' ? 600 : 400,
            color: activeTab === 'inventory' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <Package size={16} /> Inventory & Valuation
        </button>

        {!isDealer && (
          <button
            className={`tab-btn ${activeTab === 'procurement' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('procurement')}
            style={{
              padding: '0.625rem 1rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'procurement' ? '3px solid var(--brand-primary)' : '3px solid transparent',
              fontWeight: activeTab === 'procurement' ? 600 : 400,
              color: activeTab === 'procurement' ? 'var(--brand-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            <ShoppingBag size={16} /> Procurement & Receiving
          </button>
        )}

        <button
          className={`tab-btn ${activeTab === 'service' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('service')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'service' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'service' ? 600 : 400,
            color: activeTab === 'service' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <Wrench size={16} /> Service Operations & SLA
        </button>

        <button
          className={`tab-btn ${activeTab === 'warranty' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('warranty')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'warranty' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'warranty' ? 600 : 400,
            color: activeTab === 'warranty' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <ShieldCheck size={16} /> Warranties & Registrations
        </button>

        <button
          className={`tab-btn ${activeTab === 'dealers' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('dealers')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'dealers' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'dealers' ? 600 : 400,
            color: activeTab === 'dealers' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <Store size={16} /> Dealer & Consignment
        </button>

        <button
          className={`tab-btn ${activeTab === 'csat' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('csat')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'csat' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'csat' ? 600 : 400,
            color: activeTab === 'csat' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <Star size={16} /> CSAT Feedback
        </button>

        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('audit')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'audit' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            fontWeight: activeTab === 'audit' ? 600 : 400,
            color: activeTab === 'audit' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <AlertTriangle size={16} /> Operational Audit
        </button>

        {!isDealer && (
          <button
            className={`tab-btn ${activeTab === 'corporate' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('corporate')}
            style={{
              padding: '0.625rem 1rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'corporate' ? '3px solid var(--brand-primary)' : '3px solid transparent',
              fontWeight: activeTab === 'corporate' ? 600 : 400,
              color: activeTab === 'corporate' ? 'var(--brand-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            <Database size={16} /> Corporate & General Ledger
          </button>
        )}

        {!isDealer && (
          <button
            className={`tab-btn ${activeTab === 'statutory' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('statutory')}
            style={{
              padding: '0.625rem 1rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'statutory' ? '3px solid var(--brand-primary)' : '3px solid transparent',
              fontWeight: activeTab === 'statutory' ? 600 : 400,
              color: activeTab === 'statutory' ? 'var(--brand-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            <ShieldCheck size={16} /> Statutory & HR Compliance
          </button>
        )}
      </div>

      {/* 5. TAB CONTENT */}
      {activeTab === 'overview' ? (
        /* Visual Overview Tab with Charts */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Chart Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {/* Chart 1: Revenue & Collections Bar */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={16} style={{ color: '#10b981' }} /> Financial Performance Breakdown
                </h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Reconciled Net Volume</span>
              </div>
              <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: '1.5rem', padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
                {/* Gross Sales Bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {formatCurrency(kpis?.sales.gross_sales)}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 45,
                      height: '85%',
                      background: 'linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.5) 100%)',
                      borderRadius: '4px 4px 0 0'
                    }}
                  />
                  <span className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Gross Sales</span>
                </div>

                {/* Net Sales Bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {formatCurrency(kpis?.sales.net_sales)}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 45,
                      height: '80%',
                      background: 'linear-gradient(180deg, #3b82f6 0%, rgba(59, 130, 246, 0.5) 100%)',
                      borderRadius: '4px 4px 0 0'
                    }}
                  />
                  <span className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Net Sales</span>
                </div>

                {/* Cash Collections Bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {formatCurrency(kpis?.sales.payments_collected)}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 45,
                      height: '80%',
                      background: 'linear-gradient(180deg, #8b5cf6 0%, rgba(139, 92, 246, 0.5) 100%)',
                      borderRadius: '4px 4px 0 0'
                    }}
                  />
                  <span className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Collected</span>
                </div>

                {/* Refunds Bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {formatCurrency(kpis?.sales.refunds_value)}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 45,
                      height: kpis?.sales.refunds_value ? '20%' : '4px',
                      background: '#ef4444',
                      borderRadius: '4px 4px 0 0'
                    }}
                  />
                  <span className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Refunds</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Completed Orders: {kpis?.sales.completed_orders ?? 0}</span>
                <span>Outstanding Receivables: {formatCurrency(kpis?.sales.outstanding_receivables)}</span>
              </div>
            </div>

            {/* Chart 2: Inventory Status Distribution */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package size={16} style={{ color: '#8b5cf6' }} /> Inventory Status Distribution
                </h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Total: {kpis?.inventory.total_units ?? 0} Units</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 180, justifyContent: 'center' }}>
                {/* Progress bar stack */}
                <div style={{ height: 24, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'var(--bg-secondary)' }}>
                  <div
                    style={{
                      width: `${kpis?.inventory.total_units ? ((kpis.inventory.warehouse_available_units / kpis.inventory.total_units) * 100) : 50}%`,
                      background: '#10b981'
                    }}
                    title={`Available Warehouse: ${kpis?.inventory.warehouse_available_units ?? 0}`}
                  />
                  <div
                    style={{
                      width: `${kpis?.inventory.total_units ? ((kpis.inventory.dealer_stock_units / kpis.inventory.total_units) * 100) : 20}%`,
                      background: '#3b82f6'
                    }}
                    title={`Dealer Stock: ${kpis?.inventory.dealer_stock_units ?? 0}`}
                  />
                  <div
                    style={{
                      width: `${kpis?.inventory.total_units ? ((kpis.inventory.sold_units / kpis.inventory.total_units) * 100) : 30}%`,
                      background: '#6b7280'
                    }}
                    title={`Sold: ${kpis?.inventory.sold_units ?? 0}`}
                  />
                </div>

                {/* Legend */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                    <span>Warehouse Stock: <b>{kpis?.inventory.warehouse_available_units ?? 0}</b></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
                    <span>Dealer Consignment: <b>{kpis?.inventory.dealer_stock_units ?? 0}</b></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                    <span>In-Transit: <b>{kpis?.inventory.in_transit_units ?? 0}</b></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b7280' }} />
                    <span>Sold Units: <b>{kpis?.inventory.sold_units ?? 0}</b></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 3: Service SLA & Turnaround */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wrench size={16} style={{ color: '#f59e0b' }} /> Service SLA Resolution Health
                </h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Active Tickets</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 180 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                    {kpis?.service.resolved_tickets ?? 0}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Resolved Tickets</div>
                </div>
                <div style={{ width: 1, height: 80, background: 'var(--border-color)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: kpis?.service.overdue_tickets ? '#ef4444' : '#3b82f6' }}>
                    {kpis?.service.open_tickets ?? 0}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Open ({kpis?.service.overdue_tickets ?? 0} Overdue)
                  </div>
                </div>
                <div style={{ width: 1, height: 80, background: 'var(--border-color)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#8b5cf6' }}>
                    {kpis?.service.fvr_rate_pct ?? 0}%
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>First Visit Resolution</div>
                </div>
              </div>
            </div>

            {/* Chart 4: CSAT Rating Distribution */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Star size={16} style={{ color: '#ec4899' }} /> Customer Satisfaction Index
                </h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Score: <b>{kpis?.csat.average_rating ? `${kpis.csat.average_rating}★` : 'N/A'}</b>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: 180, justifyContent: 'center' }}>
                {[5, 4, 3, 2, 1].map((stars) => (
                  <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ width: 30, display: 'flex', alignItems: 'center', gap: 2 }}>
                      {stars} <Star size={10} fill="#f59e0b" color="#f59e0b" />
                    </span>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: stars === 5 ? '80%' : stars === 4 ? '15%' : '5%',
                          height: '100%',
                          background: stars >= 4 ? '#10b981' : stars === 3 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                    <span className="text-muted" style={{ width: 45, textAlign: 'right' }}>
                      {stars === 5 ? (kpis?.csat.total_responses ?? 0) : 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick jump to detailed categories */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Explore In-Depth Audited Reports
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              <div
                className="card-clickable"
                onClick={() => {
                  handleTabSwitch('sales');
                  setSelectedReportId('vw_sales_financial_analytics');
                }}
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <DollarSign size={20} style={{ color: '#10b981' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Sales & Financial Analytics</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Gross, discounts, net sales, taxes, cash collections</div>
                </div>
              </div>

              <div
                className="card-clickable"
                onClick={() => {
                  handleTabSwitch('inventory');
                  setSelectedReportId('vw_inventory_valuation_aging');
                }}
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <Package size={20} style={{ color: '#8b5cf6' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Inventory Valuation & Aging</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Purchase cost valuation & 0-90+ day aging brackets</div>
                </div>
              </div>

              <div
                className="card-clickable"
                onClick={() => {
                  handleTabSwitch('service');
                  setSelectedReportId('vw_service_sla_performance');
                }}
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <Wrench size={20} style={{ color: '#f59e0b' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Service SLA & Resolution Time</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Resolution hours, overdue tickets & parts costs</div>
                </div>
              </div>

              <div
                className="card-clickable"
                onClick={() => {
                  handleTabSwitch('audit');
                  setSelectedReportId('vw_operational_audit_discrepancies');
                }}
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Operational Audit & Quality</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Data discrepancy detection and sanity audits</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Tabular Report Section with Selector, Search, Table & Pagination */
        <div>
          {/* Sub-selector for reports within current tab */}
          <div
            className="card"
            style={{
              padding: '0.875rem 1.25rem',
              marginBottom: '1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Select Report View:
              </label>
              <select
                className="form-select"
                value={selectedReportId}
                onChange={(e) => setSelectedReportId(e.target.value)}
                style={{ minWidth: 260, fontSize: '0.875rem', padding: '0.4rem 0.75rem' }}
              >
                {activeReportsForTab.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>
              <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
                {activeConfig.description}
              </span>
            </div>

            {/* Quick in-table Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 280 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.35rem 0.65rem',
                  width: '100%'
                }}
              >
                <Search size={14} className="text-muted" />
                <input
                  type="text"
                  placeholder={
                    activeConfig.searchColumns?.length
                      ? `Search ${activeConfig.name}...`
                      : 'Filter current page only...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    width: '100%',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearch('');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  padding: '0.2rem 0.45rem',
                  borderRadius: 4,
                  background: activeConfig.searchColumns?.length
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(107, 114, 128, 0.12)',
                  color: activeConfig.searchColumns?.length ? '#10b981' : 'var(--text-muted)'
                }}
                title={
                  activeConfig.searchColumns?.length
                    ? `Server search across all records using columns: ${activeConfig.searchColumns.join(', ')}`
                    : 'This summary view filters loaded records on current page only'
                }
              >
                {activeConfig.searchColumns?.length ? 'Server Search' : 'Page Filter'}
              </span>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div
              style={{
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem'
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => fetchReportData(activeConfig.id)}
              >
                Retry Query
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {reportLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={28} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--brand-primary)' }} />
                <div>Executing server-side query across {activeConfig.id}...</div>
              </div>
            ) : displayedRows.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <Database size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                <h4 style={{ margin: '0 0 0.5rem 0' }}>No Records Found</h4>
                <p className="text-muted" style={{ fontSize: '0.875rem', maxWidth: 400, margin: '0 auto' }}>
                  {hasActiveFilters
                    ? 'No records match the applied date, warehouse, or dealer filters. Try clearing or expanding your filter criteria.'
                    : 'The underlying reporting view returned zero records for the current tenant scope.'}
                </p>
                {hasActiveFilters && (
                  <button className="btn btn-secondary" onClick={handleClearFilters} style={{ marginTop: '1rem' }}>
                    Clear Active Filters
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      {columns.map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: '0.75rem 1rem',
                            textAlign: 'left',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {columns.map((col) => {
                          const val = row[col];
                          const isAmount =
                            col.includes('sales') ||
                            col.includes('amount') ||
                            col.includes('revenue') ||
                            col.includes('valuation') ||
                            col.includes('cost') ||
                            col.includes('refund') ||
                            col.includes('balance') ||
                            col.includes('total') ||
                            col.includes('aov');
                          const isStatus = col.includes('status') || col.includes('level');

                          return (
                            <td
                              key={col}
                              style={{
                                padding: '0.75rem 1rem',
                                fontSize: '0.8125rem',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {val === null || val === undefined ? (
                                <span className="text-muted">—</span>
                              ) : isStatus ? (
                                <span
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: 4,
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background:
                                      val === 'completed' || val === 'active' || val === 'in_stock' || val === 'resolved'
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : val === 'critical' || val === 'cancelled' || val === 'expired' || val === 'overdue'
                                        ? 'rgba(239, 68, 68, 0.15)'
                                        : 'rgba(59, 130, 246, 0.15)',
                                    color:
                                      val === 'completed' || val === 'active' || val === 'in_stock' || val === 'resolved'
                                        ? '#10b981'
                                        : val === 'critical' || val === 'cancelled' || val === 'expired' || val === 'overdue'
                                        ? '#ef4444'
                                        : '#3b82f6'
                                  }}
                                >
                                  {String(val)}
                                </span>
                              ) : isAmount && typeof val === 'number' ? (
                                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                  {formatCurrency(val)}
                                </span>
                              ) : typeof val === 'boolean' ? (
                                val ? (
                                  <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                                ) : (
                                  <X size={15} style={{ color: 'var(--text-muted)' }} />
                                )
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalCount > 0 && (
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                    Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
                    {Math.min(page * pageSize, totalCount)} of {totalCount} matching rows
                    {searchQuery.trim() && (
                      <span style={{ marginLeft: '0.4rem', color: 'var(--brand-primary)', fontWeight: 500 }}>
                        {activeConfig.searchColumns?.length
                          ? `(server search: "${searchQuery.trim()}")`
                          : `(page filter: ${displayedRows.length} shown)`}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Rows per page:</span>
                    <select
                      className="form-select"
                      value={pageSize}
                      onChange={(e) => {
                        const newSize = Number(e.target.value);
                        setPageSize(newSize);
                        fetchReportData(activeConfig.id, 1, newSize);
                      }}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', width: 'auto' }}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => fetchReportData(activeConfig.id, 1, pageSize)}
                    disabled={page <= 1 || reportLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                    title="First page"
                  >
                    « First
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => fetchReportData(activeConfig.id, Math.max(1, page - 1), pageSize)}
                    disabled={page <= 1 || reportLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span style={{ fontSize: '0.8125rem', padding: '0 0.25rem' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost"
                    onClick={() => fetchReportData(activeConfig.id, Math.min(totalPages, page + 1), pageSize)}
                    disabled={page >= totalPages || reportLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => fetchReportData(activeConfig.id, totalPages, pageSize)}
                    disabled={page >= totalPages || reportLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                    title="Last page"
                  >
                    Last »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default ReportsPage;
