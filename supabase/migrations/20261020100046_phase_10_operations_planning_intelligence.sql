-- ====================================================================
-- PHASE 10: ENTERPRISE OPERATIONS, PLANNING & INTELLIGENCE
-- Consolidated Master Migration: Planning, Forecasting, Demand, Performance,
-- Profitability, Exception Center, Management Briefing & KPI Scorecards
-- Migration: 20261020100046_phase_10_operations_planning_intelligence.sql
-- ====================================================================

-- 1. WORKSTREAM A: ENTERPRISE PLANNING & TARGETS
CREATE TABLE IF NOT EXISTS public.enterprise_planning_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  fiscal_year VARCHAR(10) NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('ANNUAL', 'QUARTERLY', 'MONTHLY')),
  period_identifier VARCHAR(30) NOT NULL, -- e.g. FY2026-27, Q1, 2026-10
  department VARCHAR(50) NOT NULL CHECK (department IN ('SALES', 'PROCUREMENT', 'MANUFACTURING', 'SERVICE', 'FINANCE', 'DEALER_NETWORK')),
  territory_id VARCHAR(100),
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  target_units INTEGER NOT NULL DEFAULT 0 CHECK (target_units >= 0),
  target_revenue NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (target_revenue >= 0),
  target_margin NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (target_margin >= 0),
  target_collections NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (target_collections >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED')),
  owner_id UUID,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_targets_tenant_period ON public.enterprise_planning_targets(tenant_id, fiscal_year, period_identifier);
CREATE INDEX IF NOT EXISTS idx_plan_targets_dept_status ON public.enterprise_planning_targets(department, status);

ALTER TABLE public.enterprise_planning_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_targets_staff_read" ON public.enterprise_planning_targets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'sales', 'finance', 'inventory', 'service')
    )
  );

CREATE POLICY "plan_targets_admin_mutate" ON public.enterprise_planning_targets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'finance')
    )
  );

-- 2. WORKSTREAM B: SALES FORECASTING ENGINE
CREATE TABLE IF NOT EXISTS public.sales_forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  forecast_version VARCHAR(50) NOT NULL,
  forecast_period VARCHAR(30) NOT NULL, -- e.g. 2026-11
  methodology VARCHAR(50) NOT NULL DEFAULT 'WEIGHTED_MOVING_AVERAGE' CHECK (methodology IN ('WEIGHTED_MOVING_AVERAGE', 'HISTORICAL_AVERAGE', 'RECENT_PERIOD_TREND', 'SEASONAL_RUN_RATE')),
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 85.00 CHECK (confidence_score BETWEEN 0 AND 100),
  total_forecast_units INTEGER NOT NULL DEFAULT 0 CHECK (total_forecast_units >= 0),
  total_forecast_revenue NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (total_forecast_revenue >= 0),
  total_forecast_margin NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (total_forecast_margin >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_forecast_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_run_id UUID NOT NULL REFERENCES public.sales_forecast_runs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  territory VARCHAR(100),
  forecast_units INTEGER NOT NULL DEFAULT 0 CHECK (forecast_units >= 0),
  forecast_unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (forecast_unit_price >= 0),
  forecast_revenue NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (forecast_revenue >= 0),
  forecast_gross_margin NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (forecast_gross_margin >= 0),
  historical_baseline_units INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_tenant_period ON public.sales_forecast_runs(tenant_id, forecast_period);
CREATE INDEX IF NOT EXISTS idx_forecast_items_run ON public.sales_forecast_items(forecast_run_id);

ALTER TABLE public.sales_forecast_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_forecast_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecast_runs_read" ON public.sales_forecast_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "forecast_items_read" ON public.sales_forecast_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "forecast_admin_mutate" ON public.sales_forecast_runs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'finance'))
);
CREATE POLICY "forecast_items_admin_mutate" ON public.sales_forecast_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'finance'))
);

-- 3. WORKSTREAMS C & D: DEMAND, INVENTORY, PROCUREMENT & PRODUCTION PLANNING RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS public.operations_planning_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  recommendation_code VARCHAR(50) NOT NULL UNIQUE,
  recommendation_type VARCHAR(30) NOT NULL CHECK (recommendation_type IN ('PURCHASE', 'PRODUCE', 'TRANSFER', 'HOLD', 'DISCOUNT_LIQUIDATE')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('FINISHED_TV', 'RAW_MATERIAL', 'SPARE_PART')),
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  spare_part_id UUID,
  source_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  target_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  recommended_quantity INTEGER NOT NULL CHECK (recommended_quantity > 0),
  estimated_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  stock_coverage_days INTEGER NOT NULL DEFAULT 0,
  urgency VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  reason_code VARCHAR(100) NOT NULL,
  reason_description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'DISMISSED', 'CONVERTED_TO_ORDER')),
  converted_reference VARCHAR(100), -- e.g. PO-YYYYMM-XXXX or WO-YYYYMM-XXXX
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_recs_tenant_type ON public.operations_planning_recommendations(tenant_id, recommendation_type, status);

ALTER TABLE public.operations_planning_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_recs_staff_read" ON public.operations_planning_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_recs_admin_mutate" ON public.operations_planning_recommendations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'inventory', 'sales', 'finance'))
);

-- 4. WORKSTREAM H: ENTERPRISE EXCEPTION CENTER
CREATE TABLE IF NOT EXISTS public.enterprise_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  exception_code VARCHAR(50) NOT NULL UNIQUE,
  category VARCHAR(30) NOT NULL CHECK (category IN ('FINANCE', 'INVENTORY', 'SALES', 'SERVICE', 'OPERATIONS', 'HR')),
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('INFO', 'MEDIUM', 'HIGH', 'CRITICAL')),
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  entity_reference VARCHAR(100) NOT NULL,
  summary VARCHAR(255) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  recommended_action TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
  owner_role VARCHAR(50) NOT NULL DEFAULT 'admin',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  dismissal_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ent_exceptions_tenant_cat ON public.enterprise_exceptions(tenant_id, category, status);
CREATE INDEX IF NOT EXISTS idx_ent_exceptions_severity ON public.enterprise_exceptions(severity, detected_at);

ALTER TABLE public.enterprise_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exceptions_staff_read" ON public.enterprise_exceptions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance', 'service', 'sales', 'inventory'))
);
CREATE POLICY "exceptions_admin_mutate" ON public.enterprise_exceptions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance', 'service'))
);

-- 5. WORKSTREAM J: CONFIGURABLE KPI SCORECARDS
CREATE TABLE IF NOT EXISTS public.enterprise_kpi_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  kpi_code VARCHAR(50) NOT NULL UNIQUE,
  kpi_name VARCHAR(100) NOT NULL,
  kpi_group VARCHAR(30) NOT NULL CHECK (kpi_group IN ('SALES', 'FINANCE', 'OPERATIONS', 'SERVICE', 'DEALER', 'HR')),
  formula_description TEXT NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'PERCENT', -- PERCENT, CURRENCY, COUNT, DAYS, HOURS
  target_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  actual_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  variance_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  variance_pct NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ON_TRACK' CHECK (status IN ('EXCELLENT', 'ON_TRACK', 'NEEDS_ATTENTION', 'CRITICAL_RISK')),
  owner_role VARCHAR(50) NOT NULL DEFAULT 'admin',
  period_label VARCHAR(50) NOT NULL DEFAULT 'Current Month',
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_scorecards_tenant_group ON public.enterprise_kpi_scorecards(tenant_id, kpi_group);

ALTER TABLE public.enterprise_kpi_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_scorecards_read" ON public.enterprise_kpi_scorecards FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_scorecards_admin_mutate" ON public.enterprise_kpi_scorecards FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
);

-- 6. REPORTING & INTELLIGENCE VIEWS (SECURITY_INVOKER = TRUE)

-- A. Dealer 360 Performance Intelligence View
CREATE OR REPLACE VIEW public.vw_dealer_performance_intelligence WITH (security_invoker = true) AS
SELECT
  d.id AS dealer_id,
  d.dealer_name,
  d.dealer_code,
  d.city,
  d.state,
  d.credit_limit,
  d.outstanding_credit,
  CASE 
    WHEN d.credit_limit > 0 THEN ROUND((d.outstanding_credit / d.credit_limit) * 100, 2)
    ELSE 0.00 
  END AS credit_utilization_pct,
  COALESCE(sales_stat.total_units_sold, 0)::INT AS units_sold,
  COALESCE(sales_stat.total_sales_value, 0.00) AS total_sales_value,
  COALESCE(csg.total_consignment_units, 0)::INT AS consignment_stock_units,
  COALESCE(svc.total_service_tickets, 0)::INT AS service_tickets_raised,
  CASE
    WHEN COALESCE(sales_stat.total_units_sold, 0) > 100 AND d.outstanding_credit < (d.credit_limit * 0.8) THEN 'TIER_1_GROWTH'
    WHEN COALESCE(sales_stat.total_units_sold, 0) > 40 THEN 'TIER_2_STABLE'
    ELSE 'TIER_3_WATCHLIST'
  END AS dealer_performance_tier
FROM public.dealers d
LEFT JOIN (
  SELECT dealer_id, COUNT(*) AS total_units_sold, SUM(total_amount) AS total_sales_value
  FROM public.sales
  WHERE payment_status != 'void'
  GROUP BY dealer_id
) sales_stat ON sales_stat.dealer_id = d.id
LEFT JOIN (
  SELECT dealer_id, COUNT(*) AS total_consignment_units
  FROM public.dealer_consignment_inventory
  WHERE status IN ('active', 'in_stock')
  GROUP BY dealer_id
) csg ON csg.dealer_id = d.id
LEFT JOIN (
  SELECT dealer_id, COUNT(*) AS total_service_tickets
  FROM public.service_tickets
  GROUP BY dealer_id
) svc ON svc.dealer_id = d.id;

-- B. Customer Service & Warranty Intelligence View
CREATE OR REPLACE VIEW public.vw_service_warranty_intelligence WITH (security_invoker = true) AS
SELECT
  pv.id AS variant_id,
  p.name AS product_name,
  pv.screen_size,
  pv.model_name,
  COUNT(DISTINCT pu.id)::INT AS total_units_sold,
  COUNT(DISTINCT w.id)::INT AS active_warranties,
  COUNT(DISTINCT st.id)::INT AS service_tickets_count,
  CASE
    WHEN COUNT(DISTINCT pu.id) > 0 THEN 
      ROUND((COUNT(DISTINCT st.id)::NUMERIC / COUNT(DISTINCT pu.id)::NUMERIC) * 100, 2)
    ELSE 0.00
  END AS failure_rate_pct,
  COALESCE(SUM(stp.cost), 0.00) AS total_parts_cost_absorbed
FROM public.product_variants pv
JOIN public.products p ON p.id = pv.product_id
LEFT JOIN public.product_units pu ON pu.product_variant_id = pv.id AND pu.status = 'sold'
LEFT JOIN public.warranties w ON w.product_unit_id = pu.id AND w.status = 'active'
LEFT JOIN public.service_tickets st ON st.product_unit_id = pu.id
LEFT JOIN public.service_ticket_parts stp ON stp.service_ticket_id = st.id
GROUP BY pv.id, p.name, pv.screen_size, pv.model_name;

-- C. Management Executive KPI Intelligence Summary
CREATE OR REPLACE VIEW public.vw_management_executive_intelligence WITH (security_invoker = true) AS
SELECT
  (SELECT COUNT(*)::INT FROM public.product_units WHERE status = 'in_stock') AS current_in_stock_units,
  (SELECT COUNT(*)::INT FROM public.sales WHERE payment_status = 'completed') AS completed_orders_count,
  (SELECT COALESCE(SUM(total_amount), 0.00) FROM public.sales WHERE payment_status = 'completed') AS mtd_sales_revenue,
  (SELECT COUNT(*)::INT FROM public.service_tickets WHERE status IN ('open', 'assigned', 'in_progress')) AS active_service_cases,
  (SELECT COUNT(*)::INT FROM public.service_tickets WHERE status IN ('open', 'assigned', 'in_progress') AND sla_due_at < NOW()) AS breached_sla_cases,
  (SELECT COUNT(*)::INT FROM public.enterprise_exceptions WHERE status = 'OPEN') AS open_exceptions_count,
  (SELECT COUNT(*)::INT FROM public.operations_planning_recommendations WHERE status = 'PENDING_REVIEW') AS pending_recommendations_count,
  (SELECT COUNT(*)::INT FROM public.enterprise_planning_targets WHERE status = 'ACTIVE') AS active_plan_targets_count;

-- 7. SERVER-AUTHORITATIVE BUSINESS LOGIC & APIS (SECURITY DEFINER)

-- A. Approve Enterprise Planning Target
CREATE OR REPLACE FUNCTION public.fn_approve_planning_target(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role VARCHAR(50);
  v_target RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'admin', 'finance') THEN
    RAISE EXCEPTION 'Unauthorized: Only admin or finance can approve planning targets.';
  END IF;

  SELECT * INTO v_target FROM public.enterprise_planning_targets WHERE id = p_target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target not found.';
  END IF;

  IF v_target.created_by = v_caller_id AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Maker-checker violation: Target creator cannot approve their own target.';
  END IF;

  IF v_target.status NOT IN ('DRAFT', 'SUBMITTED') THEN
    RAISE EXCEPTION 'Invalid state: Target is already in % status.', v_target.status;
  END IF;

  UPDATE public.enterprise_planning_targets
  SET status = 'APPROVED',
      approved_by = v_caller_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_target_id;

  RETURN jsonb_build_object('success', true, 'target_id', p_target_id, 'status', 'APPROVED');
END;
$$;

-- B. Execute Phase 10 Intelligence & Exception Detection Sweep
CREATE OR REPLACE FUNCTION public.fn_execute_phase_10_intelligence_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role VARCHAR(50);
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_exceptions_created INT := 0;
  v_recs_created INT := 0;
  r_low_stock RECORD;
  r_overdue_ar RECORD;
  r_sla_risk RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role, tenant_id INTO v_caller_role, v_tenant_id FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('super_admin', 'admin', 'finance', 'inventory', 'service') THEN
      RAISE EXCEPTION 'Access denied. Insufficient permissions for intelligence sweep.';
    END IF;
  END IF;

  -- 1. Scan Low Stock (< 10 units) -> Create Exception & Production/Purchase Recommendation
  FOR r_low_stock IN (
    SELECT pv.id AS variant_id, pv.model_name, COUNT(pu.id) AS on_hand
    FROM public.product_variants pv
    LEFT JOIN public.product_units pu ON pu.product_variant_id = pv.id AND pu.status = 'in_stock'
    GROUP BY pv.id, pv.model_name
    HAVING COUNT(pu.id) < 10
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.enterprise_exceptions
      WHERE category = 'INVENTORY' AND entity_id = r_low_stock.variant_id::TEXT AND status = 'OPEN'
    ) THEN
      INSERT INTO public.enterprise_exceptions (
        tenant_id, exception_code, category, severity, entity_type, entity_id, entity_reference,
        summary, evidence, recommended_action, owner_role
      ) VALUES (
        v_tenant_id, 'EXC-INV-' || SUBSTRING(r_low_stock.variant_id::TEXT FROM 1 FOR 8) || '-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'INVENTORY', 'HIGH', 'PRODUCT_VARIANT', r_low_stock.variant_id::TEXT, r_low_stock.model_name,
        'Critical Low Stock Threshold Detected: ' || r_low_stock.model_name || ' (' || r_low_stock.on_hand || ' units on hand)',
        jsonb_build_object('on_hand', r_low_stock.on_hand, 'threshold', 10),
        'Issue factory work order or purchase order replenishment.', 'inventory'
      );
      v_exceptions_created := v_exceptions_created + 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.operations_planning_recommendations
      WHERE product_variant_id = r_low_stock.variant_id AND status = 'PENDING_REVIEW'
    ) THEN
      INSERT INTO public.operations_planning_recommendations (
        tenant_id, recommendation_code, recommendation_type, category, product_variant_id,
        recommended_quantity, estimated_cost, stock_coverage_days, urgency, reason_code, reason_description
      ) VALUES (
        v_tenant_id, 'REC-PROD-' || SUBSTRING(r_low_stock.variant_id::TEXT FROM 1 FOR 8) || '-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'PRODUCE', 'FINISHED_TV', r_low_stock.variant_id, 50, 50 * 18500.00, 7, 'HIGH',
        'STOCKOUT_RISK', 'Buffer stock depleted below safety threshold. Recommend 50-unit factory assembly run.'
      );
      v_recs_created := v_recs_created + 1;
    END IF;
  END LOOP;

  -- 2. Scan Overdue SLA Tickets -> Create Service Exception
  FOR r_sla_risk IN (
    SELECT id, ticket_number, priority, sla_due_at
    FROM public.service_tickets
    WHERE status IN ('open', 'assigned', 'in_progress') AND sla_due_at < NOW()
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.enterprise_exceptions
      WHERE category = 'SERVICE' AND entity_id = r_sla_risk.id::TEXT AND status = 'OPEN'
    ) THEN
      INSERT INTO public.enterprise_exceptions (
        tenant_id, exception_code, category, severity, entity_type, entity_id, entity_reference,
        summary, evidence, recommended_action, owner_role
      ) VALUES (
        v_tenant_id, 'EXC-SVC-' || SUBSTRING(r_sla_risk.id::TEXT FROM 1 FOR 8) || '-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'SERVICE', 'CRITICAL', 'SERVICE_TICKET', r_sla_risk.id::TEXT, r_sla_risk.ticket_number,
        'SLA Breach: Ticket ' || r_sla_risk.ticket_number || ' overdue for resolution',
        jsonb_build_object('sla_due_at', r_sla_risk.sla_due_at, 'priority', r_sla_risk.priority),
        'Reassign to senior field supervisor or expedite spare parts dispatch.', 'service'
      );
      v_exceptions_created := v_exceptions_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'exceptions_detected', v_exceptions_created,
    'recommendations_generated', v_recs_created,
    'timestamp', NOW()
  );
END;
$$;

-- Revoke and Grant execution
REVOKE ALL ON FUNCTION public.fn_approve_planning_target FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_execute_phase_10_intelligence_sweep FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_approve_planning_target TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_execute_phase_10_intelligence_sweep TO authenticated;
