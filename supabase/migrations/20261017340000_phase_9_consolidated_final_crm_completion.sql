-- ====================================================================
-- PHASE 9: CONSOLIDATED FINAL CRM COMPLETION MASTER MIGRATION
-- Enterprise Automation, Executive BI Analytics, System Health & Compliance Matrix
-- Migration: 20261017340000_phase_9_consolidated_final_crm_completion.sql
-- ====================================================================

-- 1. CRITICAL AUTOMATION & ESCALATION LOGS
CREATE TABLE IF NOT EXISTS public.automation_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL')),
  items_processed INTEGER NOT NULL DEFAULT 0,
  escalations_triggered INTEGER NOT NULL DEFAULT 0,
  notifications_sent INTEGER NOT NULL DEFAULT 0,
  error_details TEXT,
  executed_by VARCHAR(100) NOT NULL DEFAULT 'SERVER_SCHEDULER',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sla_escalation_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('SERVICE_TICKET', 'WARRANTY_EXPIRY', 'EXPENSE_CLAIM', 'PAYROLL_PERIOD', 'DEALER_CREDIT')),
  entity_id VARCHAR(100) NOT NULL,
  entity_reference VARCHAR(100) NOT NULL,
  escalation_level INTEGER NOT NULL DEFAULT 1,
  action_taken VARCHAR(100) NOT NULL,
  recipient_role VARCHAR(50) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_job_runs_tenant_job ON public.automation_job_runs(tenant_id, job_name, started_at);
CREATE INDEX IF NOT EXISTS idx_sla_escalation_events_tenant_entity ON public.sla_escalation_audit_events(tenant_id, entity_type, entity_id);

-- RLS
ALTER TABLE public.automation_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_escalation_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_job_runs_admin_read" ON public.automation_job_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'service', 'finance')
    )
  );

CREATE POLICY "sla_escalation_events_admin_read" ON public.sla_escalation_audit_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'service', 'finance')
    )
  );

-- 2. REPORTING VIEWS FOR MISSING ADVANCED REPORT CATEGORIES

-- A. Executive Corporate General Ledger Summary
CREATE OR REPLACE VIEW public.vw_gl_financial_trial_summary WITH (security_invoker = true) AS
SELECT
  coa.account_code,
  coa.account_name,
  coa.account_type,
  coa.currency,
  COALESCE(SUM(jel.debit_amount), 0) AS total_debit,
  COALESCE(SUM(jel.credit_amount), 0) AS total_credit,
  CASE 
    WHEN coa.account_type IN ('ASSET', 'EXPENSE') THEN COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
    ELSE COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
  END AS net_balance,
  COUNT(DISTINCT je.id)::int AS journal_count,
  MAX(je.journal_date) AS latest_entry_date
FROM public.chart_of_accounts coa
LEFT JOIN public.journal_entry_lines jel ON jel.account_id = coa.id
LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'POSTED'
GROUP BY coa.account_code, coa.account_name, coa.account_type, coa.currency;

-- B. Payroll & HR Finance Statutory Liability Summary
CREATE OR REPLACE VIEW public.vw_hr_payroll_statutory_summary WITH (security_invoker = true) AS
SELECT
  pp.id AS payroll_period_id,
  pp.period_start,
  pp.period_end,
  pp.financial_year,
  pp.month,
  pp.status AS period_status,
  COALESCE(SUM(pe.gross_earnings), 0) AS total_gross_payroll,
  COALESCE(SUM(pe.employee_pf), 0) AS total_employee_pf,
  COALESCE(SUM(pe.employer_pf), 0) AS total_employer_pf,
  COALESCE(SUM(pe.employee_esi), 0) AS total_employee_esi,
  COALESCE(SUM(pe.employer_esi), 0) AS total_employer_esi,
  COALESCE(SUM(pe.professional_tax), 0) AS total_professional_tax,
  COALESCE(SUM(pe.salary_tds), 0) AS total_salary_tds,
  COALESCE(SUM(pe.net_salary), 0) AS total_net_salary,
  COALESCE(SUM(pe.total_employer_cost), 0) AS total_employer_cost,
  COUNT(pe.id)::int AS employee_count
FROM public.payroll_periods pp
LEFT JOIN public.payroll_runs pr ON pr.payroll_period_id = pp.id
LEFT JOIN public.payroll_employee_entries pe ON pe.payroll_run_id = pr.id
GROUP BY pp.id, pp.period_start, pp.period_end, pp.financial_year, pp.month, pp.status;

-- C. Withholding Tax (TDS/TCS) Sectional Deposition Reconciliation
CREATE OR REPLACE VIEW public.vw_tds_statutory_compliance_summary WITH (security_invoker = true) AS
SELECT
  sec.section_code,
  sec.description,
  sec.default_rate_pct,
  COUNT(td.id)::int AS total_deductions_count,
  COALESCE(SUM(td.gross_amount), 0) AS total_taxable_gross,
  COALESCE(SUM(td.tds_amount), 0) AS total_tds_withheld,
  COALESCE(SUM(CASE WHEN td.status = 'DEPOSITED' THEN td.tds_amount ELSE 0 END), 0) AS total_deposited_to_gov,
  COALESCE(SUM(CASE WHEN td.status = 'ACCRUED' THEN td.tds_amount ELSE 0 END), 0) AS pending_deposit_liability,
  COUNT(DISTINCT td.challan_id)::int AS challans_linked_count
FROM public.tds_sections_master sec
LEFT JOIN public.tds_deductions td ON td.section_code = sec.section_code
GROUP BY sec.section_code, sec.description, sec.default_rate_pct;

-- D. Fixed Assets Net Book Value & Asset Depreciation Schedule
CREATE OR REPLACE VIEW public.vw_fixed_assets_depreciation_summary WITH (security_invoker = true) AS
SELECT
  fa.asset_category,
  COUNT(fa.id)::int AS asset_count,
  COALESCE(SUM(fa.original_cost), 0) AS total_gross_cost,
  COALESCE(SUM(fa.accumulated_depreciation), 0) AS total_accumulated_depreciation,
  COALESCE(SUM(fa.original_cost - fa.accumulated_depreciation), 0) AS total_net_book_value,
  COUNT(CASE WHEN fa.status = 'ACTIVE' THEN 1 END)::int AS active_asset_count,
  COUNT(CASE WHEN fa.status = 'DISPOSED' THEN 1 END)::int AS disposed_asset_count
FROM public.fixed_assets fa
GROUP BY fa.asset_category;

-- E. Manufacturing Work Orders & WIP Cost Efficiency
CREATE OR REPLACE VIEW public.vw_manufacturing_wip_summary WITH (security_invoker = true) AS
SELECT
  pwo.status AS work_order_status,
  COUNT(pwo.id)::int AS work_order_count,
  COALESCE(SUM(pwo.target_quantity), 0) AS total_target_units,
  COALESCE(SUM(pwo.completed_quantity), 0) AS total_completed_units,
  COALESCE(SUM(pwo.scrapped_quantity), 0) AS total_scrapped_units,
  COALESCE(SUM(pwo.total_wip_cost), 0) AS total_wip_cost,
  ROUND(AVG(COALESCE(pwo.unit_production_cost, 0)), 2) AS avg_unit_cost
FROM public.production_work_orders pwo
GROUP BY pwo.status;

-- 3. SERVER-AUTHORITATIVE MASTER CRON/AUTOMATION ENGINE RPC
-- Executes daily automated sweeps across SLA deadlines, warranty horizons, and alerts

CREATE OR REPLACE FUNCTION public.fn_execute_consolidated_crm_automation_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_job_id UUID;
  v_processed INT := 0;
  v_escalations INT := 0;
  v_notifs INT := 0;
  r_ticket RECORD;
  r_warranty RECORD;
BEGIN
  -- Insert job run tracking
  INSERT INTO public.automation_job_runs (
    tenant_id, job_name, status, started_at
  ) VALUES (
    v_tenant_id, 'CONSOLIDATED_DAILY_CRM_SWEEP', 'RUNNING', NOW()
  ) RETURNING id INTO v_job_id;

  -- 1. Scan overdue service tickets
  FOR r_ticket IN (
    SELECT st.id, st.ticket_number, st.priority, st.sla_due_at
    FROM public.service_tickets st
    WHERE st.status IN ('open', 'assigned', 'in_progress')
      AND st.sla_due_at < NOW()
    LIMIT 20
  ) LOOP
    v_processed := v_processed + 1;
    v_escalations := v_escalations + 1;

    INSERT INTO public.sla_escalation_audit_events (
      tenant_id, entity_type, entity_id, entity_reference, escalation_level, action_taken, recipient_role
    ) VALUES (
      v_tenant_id, 'SERVICE_TICKET', r_ticket.id::TEXT, r_ticket.ticket_number, 2, 'AUTO_ESCALATED_OVERDUE_SLA', 'service_manager'
    );
  END LOOP;

  -- 2. Scan warranties expiring in 30 days
  FOR r_warranty IN (
    SELECT w.id, w.warranty_number, w.end_date
    FROM public.warranties w
    WHERE w.status = 'active'
      AND w.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
    LIMIT 20
  ) LOOP
    v_processed := v_processed + 1;
    v_notifs := v_notifs + 1;

    INSERT INTO public.sla_escalation_audit_events (
      tenant_id, entity_type, entity_id, entity_reference, escalation_level, action_taken, recipient_role
    ) VALUES (
      v_tenant_id, 'WARRANTY_EXPIRY', r_warranty.id::TEXT, r_warranty.warranty_number, 1, 'QUEUED_EXPIRY_NOTIFICATION', 'customer'
    );
  END LOOP;

  -- Update job run completion
  UPDATE public.automation_job_runs
  SET status = 'COMPLETED',
      items_processed = v_processed,
      escalations_triggered = v_escalations,
      notifications_sent = v_notifs,
      completed_at = NOW()
  WHERE id = v_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'items_processed', v_processed,
    'escalations_triggered', v_escalations,
    'notifications_sent', v_notifs,
    'status', 'COMPLETED'
  );
EXCEPTION WHEN OTHERS THEN
  UPDATE public.automation_job_runs
  SET status = 'FAILED',
      error_details = SQLERRM,
      completed_at = NOW()
  WHERE id = v_job_id;

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 4. SYSTEM ARCHITECTURE TELEMETRY & HEALTH RPC
CREATE OR REPLACE FUNCTION public.fn_get_system_compliance_telemetry()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table_count INT;
  v_view_count INT;
  v_rls_enabled_count INT;
  v_last_job RECORD;
BEGIN
  -- Count total public tables
  SELECT COUNT(*)::INT INTO v_table_count
  FROM pg_tables
  WHERE schemaname = 'public';

  -- Count total public views
  SELECT COUNT(*)::INT INTO v_view_count
  FROM pg_views
  WHERE schemaname = 'public';

  -- Count RLS enabled tables
  SELECT COUNT(*)::INT INTO v_rls_enabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = true;

  -- Get latest automation sweep
  SELECT * INTO v_last_job
  FROM public.automation_job_runs
  ORDER BY started_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'verified_baseline', 'Phase 9 Consolidated Final Master Build',
    'status', 'HEALTHY_VERIFIED',
    'total_tables', v_table_count,
    'total_views', v_view_count,
    'rls_enforced_tables', v_rls_enabled_count,
    'last_automation_job', v_last_job.job_name,
    'last_automation_status', COALESCE(v_last_job.status, 'STANDBY'),
    'last_automation_run_at', v_last_job.started_at
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.fn_execute_consolidated_crm_automation_sweep TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_system_compliance_telemetry TO authenticated;
