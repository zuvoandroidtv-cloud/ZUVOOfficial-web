-- ====================================================================
-- PHASE 11: ENTERPRISE CUSTOMER, DEALER & PARTNER GROWTH ENGINE
-- Consolidated Master Migration: Leads, Opportunities, Quotations,
-- Sales Activities, Dealer KYC/Onboarding, Campaigns, Loyalty, Referrals & Growth Intelligence
-- Migration: 20261020104445_phase_11_customer_dealer_partner_growth.sql
-- ====================================================================

-- 1. EXTEND CUSTOMERS WITH LIFECYCLE & GROWTH METRICS
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(30) DEFAULT 'CUSTOMER' CHECK (lifecycle_stage IN ('LEAD', 'PROSPECT', 'QUALIFIED', 'CUSTOMER', 'REPEAT_CUSTOMER', 'LOYAL_CUSTOMER', 'DORMANT', 'REACTIVATION', 'LOST')),
  ADD COLUMN IF NOT EXISTS customer_segment VARCHAR(30) DEFAULT 'RETAIL' CHECK (customer_segment IN ('RETAIL', 'B2B_COMMERCIAL', 'INSTITUTIONAL', 'VIP', 'EMPLOYEE_FAMILY')),
  ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(50) DEFAULT 'DEALER_STORE',
  ADD COLUMN IF NOT EXISTS health_score NUMERIC(5,2) DEFAULT 80.00 CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lifetime_revenue NUMERIC(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS loyalty_points_balance INTEGER DEFAULT 0 CHECK (loyalty_points_balance >= 0);

-- 2. CRM LEADS
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  lead_number VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(100),
  territory VARCHAR(100),
  lead_source VARCHAR(50) NOT NULL DEFAULT 'WEBSITE_INQUIRY' CHECK (lead_source IN ('WEBSITE_INQUIRY', 'DEALER_REFERRAL', 'CAMPAIGN', 'CUSTOMER_REFERRAL', 'EXHIBITION', 'COLD_CALL', 'INBOUND_CALL')),
  status VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'NURTURE', 'CONVERTED', 'LOST')),
  interested_model VARCHAR(100),
  interested_screen_size VARCHAR(20),
  estimated_units INTEGER NOT NULL DEFAULT 1 CHECK (estimated_units > 0),
  estimated_value NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (estimated_value >= 0),
  qualification_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (qualification_score BETWEEN 0 AND 100),
  assigned_sales_rep_id UUID,
  converted_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  converted_opportunity_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_status ON public.crm_leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON public.crm_leads(assigned_sales_rep_id);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_leads_staff_read" ON public.crm_leads FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'support', 'finance'))
);

CREATE POLICY "crm_leads_staff_mutate" ON public.crm_leads FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales'))
);

-- 3. CRM OPPORTUNITIES
CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  opportunity_number VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  sales_rep_id UUID,
  territory VARCHAR(100),
  stage VARCHAR(30) NOT NULL DEFAULT 'DISCOVERY' CHECK (stage IN ('DISCOVERY', 'QUALIFICATION', 'REQUIREMENT_CONFIRMED', 'QUOTATION', 'NEGOTIATION', 'COMMIT', 'WON', 'LOST')),
  probability_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00 CHECK (probability_pct BETWEEN 0 AND 100),
  expected_revenue NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (expected_revenue >= 0),
  weighted_revenue NUMERIC(15,2) GENERATED ALWAYS AS (ROUND(expected_revenue * (probability_pct / 100.0), 2)) STORED,
  expected_units INTEGER NOT NULL DEFAULT 1 CHECK (expected_units > 0),
  expected_close_date DATE NOT NULL,
  actual_close_date DATE,
  loss_reason VARCHAR(100),
  competitor_name VARCHAR(100),
  converted_sales_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_opps_tenant_stage ON public.crm_opportunities(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_opps_sales_rep ON public.crm_opportunities(sales_rep_id);

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_opps_staff_read" ON public.crm_opportunities FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'finance'))
);

CREATE POLICY "crm_opps_staff_mutate" ON public.crm_opportunities FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales'))
);

-- 4. CRM QUOTATIONS
CREATE TABLE IF NOT EXISTS public.crm_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  quotation_number VARCHAR(50) NOT NULL UNIQUE,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  sales_rep_id UUID,
  valid_until DATE NOT NULL,
  subtotal_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (subtotal_amount >= 0),
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  converted_sales_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.crm_quotations(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  description VARCHAR(200) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (discount_pct BETWEEN 0 AND 100),
  line_subtotal NUMERIC(15,2) NOT NULL CHECK (line_subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_crm_quotes_tenant_status ON public.crm_quotations(tenant_id, status);

ALTER TABLE public.crm_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_quotes_read" ON public.crm_quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_quotes_mutate" ON public.crm_quotations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'finance'))
);
CREATE POLICY "crm_quote_items_read" ON public.crm_quotation_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_quote_items_mutate" ON public.crm_quotation_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'finance'))
);

-- 5. CRM SALES ACTIVITIES & INTERACTIONS
CREATE TABLE IF NOT EXISTS public.crm_sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN ('CALL', 'VISIT', 'MEETING', 'EMAIL', 'WHATSAPP', 'DEMO', 'FOLLOW_UP', 'PAYMENT_FOLLOW_UP')),
  subject VARCHAR(200) NOT NULL,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  employee_id UUID,
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  outcome VARCHAR(50),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant_sched ON public.crm_sales_activities(tenant_id, scheduled_at, status);

ALTER TABLE public.crm_sales_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_activities_read" ON public.crm_sales_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_activities_mutate" ON public.crm_sales_activities FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'service', 'support'))
);

-- 6. DEALER ONBOARDING & KYC GOVERNANCE
CREATE TABLE IF NOT EXISTS public.dealer_onboarding_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  application_number VARCHAR(50) NOT NULL UNIQUE,
  trade_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(100) NOT NULL,
  gstin VARCHAR(20) NOT NULL,
  pan VARCHAR(15) NOT NULL,
  bank_account_masked VARCHAR(50) NOT NULL,
  ifsc_code VARCHAR(20) NOT NULL,
  territory VARCHAR(100) NOT NULL,
  requested_credit_limit NUMERIC(15,2) NOT NULL DEFAULT 500000.00 CHECK (requested_credit_limit >= 0),
  kyc_document_refs JSONB NOT NULL DEFAULT '[]'::JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'APPLICATION' CHECK (status IN ('APPLICATION', 'DOCUMENT_PENDING', 'KYC_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED')),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  activated_dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealer_onboard_status ON public.dealer_onboarding_applications(status);

ALTER TABLE public.dealer_onboarding_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealer_onboard_staff_read" ON public.dealer_onboarding_applications FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'finance'))
);
CREATE POLICY "dealer_onboard_staff_mutate" ON public.dealer_onboarding_applications FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'finance'))
);

-- 7. COMMERCIAL CAMPAIGNS & PARTICIPATION
CREATE TABLE IF NOT EXISTS public.crm_commercial_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  campaign_code VARCHAR(50) NOT NULL UNIQUE,
  campaign_name VARCHAR(150) NOT NULL,
  campaign_type VARCHAR(40) NOT NULL CHECK (campaign_type IN ('PRODUCT_LAUNCH', 'SEASONAL', 'DEALER_GROWTH', 'CUSTOMER_RETENTION', 'REACTIVATION', 'REFERRAL', 'PROMOTIONAL')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (budget >= 0),
  target_revenue NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (target_revenue >= 0),
  actual_revenue NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (actual_revenue >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_campaign_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.crm_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  referral_code VARCHAR(50) NOT NULL UNIQUE,
  referrer_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  referrer_dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  prospect_name VARCHAR(150) NOT NULL,
  prospect_phone VARCHAR(30) NOT NULL,
  prospect_city VARCHAR(100),
  campaign_id UUID REFERENCES public.crm_commercial_campaigns(id) ON DELETE SET NULL,
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 500.00 CHECK (reward_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'EXPIRED')),
  converted_sale_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_commercial_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_read" ON public.crm_commercial_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaigns_mutate" ON public.crm_commercial_campaigns FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales'))
);
CREATE POLICY "referrals_read" ON public.crm_referrals FOR SELECT TO authenticated USING (true);
CREATE POLICY "referrals_mutate" ON public.crm_referrals FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'sales', 'dealer'))
);

-- 8. CUSTOMER LOYALTY & REWARDS LEDGER
CREATE TABLE IF NOT EXISTS public.customer_loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('EARNED_PURCHASE', 'EARNED_REFERRAL', 'EARNED_CAMPAIGN', 'REDEMPTION_DISCOUNT', 'EXPIRATION', 'MANUAL_ADJUSTMENT')),
  points_change INTEGER NOT NULL,
  running_balance INTEGER NOT NULL CHECK (running_balance >= 0),
  source_reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_cust ON public.customer_loyalty_ledger(customer_id, created_at);

ALTER TABLE public.customer_loyalty_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_read" ON public.customer_loyalty_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "loyalty_admin_mutate" ON public.customer_loyalty_ledger FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance'))
);

-- 9. REPORTING & PIPELINE INTELLIGENCE VIEWS (SECURITY_INVOKER = TRUE)

-- A. Commercial Sales Pipeline Funnel Summary
CREATE OR REPLACE VIEW public.vw_crm_pipeline_funnel_summary WITH (security_invoker = true) AS
SELECT
  o.stage,
  COUNT(o.id)::INT AS opportunity_count,
  COALESCE(SUM(o.expected_revenue), 0.00) AS total_expected_revenue,
  COALESCE(SUM(o.weighted_revenue), 0.00) AS total_weighted_revenue,
  COALESCE(AVG(o.probability_pct), 0.00) AS avg_probability_pct,
  COALESCE(SUM(o.expected_units), 0)::INT AS total_expected_units
FROM public.crm_opportunities o
GROUP BY o.stage;

-- B. Customer Retention, LTV & Dormancy Risk Summary
CREATE OR REPLACE VIEW public.vw_customer_retention_intelligence WITH (security_invoker = true) AS
SELECT
  c.id AS customer_id,
  c.full_name,
  c.phone,
  c.city,
  c.lifecycle_stage,
  c.customer_segment,
  c.health_score,
  c.loyalty_points_balance,
  COUNT(DISTINCT s.id)::INT AS total_orders_count,
  COALESCE(SUM(s.total_amount), 0.00) AS total_lifetime_spend,
  MAX(s.created_at) AS latest_purchase_date,
  CASE
    WHEN MAX(s.created_at) IS NULL THEN 'NO_PURCHASE'
    WHEN MAX(s.created_at) < (NOW() - INTERVAL '180 days') THEN 'DORMANT_HIGH_RISK'
    WHEN MAX(s.created_at) < (NOW() - INTERVAL '90 days') THEN 'RETENTION_WATCHLIST'
    ELSE 'ACTIVE_HEALTHY'
  END AS churn_risk_classification
FROM public.customers c
LEFT JOIN public.sales s ON s.customer_id = c.id AND s.payment_status != 'void'
GROUP BY c.id, c.full_name, c.phone, c.city, c.lifecycle_stage, c.customer_segment, c.health_score, c.loyalty_points_balance;

-- 10. SERVER-AUTHORITATIVE PRIVILEGED BUSINESS LOGIC (SECURITY DEFINER)

-- A. Convert Lead to Opportunity
CREATE OR REPLACE FUNCTION public.fn_convert_lead_to_opportunity(
  p_lead_id UUID,
  p_title VARCHAR(200),
  p_expected_close_date DATE,
  p_probability NUMERIC(5,2) DEFAULT 30.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role VARCHAR(50);
  v_lead RECORD;
  v_opp_id UUID;
  v_opp_number VARCHAR(50);
  v_customer_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('super_admin', 'admin', 'sales') THEN
      RAISE EXCEPTION 'Access denied. Only sales or administrators can convert leads.';
    END IF;
  END IF;

  SELECT * INTO v_lead FROM public.crm_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead record not found.';
  END IF;

  IF v_lead.status = 'CONVERTED' THEN
    RAISE EXCEPTION 'Lead is already converted.';
  END IF;

  -- Auto-match or create customer record
  SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_lead.phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (full_name, phone, email, city, state, lifecycle_stage, acquisition_source)
    VALUES (v_lead.full_name, v_lead.phone, v_lead.email, v_lead.city, v_lead.state, 'PROSPECT', v_lead.lead_source)
    RETURNING id INTO v_customer_id;
  END IF;

  v_opp_number := 'OPP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');

  INSERT INTO public.crm_opportunities (
    tenant_id, opportunity_number, title, lead_id, customer_id, sales_rep_id,
    territory, stage, probability_pct, expected_revenue, expected_units, expected_close_date
  ) VALUES (
    v_lead.tenant_id, v_opp_number, p_title, v_lead.id, v_customer_id, v_lead.assigned_sales_rep_id,
    v_lead.territory, 'QUALIFICATION', p_probability, v_lead.estimated_value, v_lead.estimated_units, p_expected_close_date
  ) RETURNING id INTO v_opp_id;

  UPDATE public.crm_leads
  SET status = 'CONVERTED',
      converted_customer_id = v_customer_id,
      converted_opportunity_id = v_opp_id,
      updated_at = NOW()
  WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'success', true,
    'opportunity_id', v_opp_id,
    'opportunity_number', v_opp_number,
    'customer_id', v_customer_id
  );
END;
$$;

-- B. Approve Dealer Onboarding Application (Maker-Checker Enforced)
CREATE OR REPLACE FUNCTION public.fn_approve_dealer_onboarding(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role VARCHAR(50);
  v_app RECORD;
  v_dealer_id UUID;
  v_dealer_code VARCHAR(50);
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('super_admin', 'admin', 'finance') THEN
      RAISE EXCEPTION 'Access denied. Only finance or administrators can approve dealer onboarding.';
    END IF;
  END IF;

  SELECT * INTO v_app FROM public.dealer_onboarding_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer application not found.';
  END IF;

  -- Maker-checker guard
  IF v_app.created_by = v_caller_id AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Maker-checker violation: Applicant reviewer cannot approve their own onboarding submission.';
  END IF;

  IF v_app.status != 'KYC_REVIEW' AND v_app.status != 'APPLICATION' THEN
    RAISE EXCEPTION 'Invalid state: Application is in % status.', v_app.status;
  END IF;

  v_dealer_code := 'DLR-' || SUBSTRING(v_app.territory FROM 1 FOR 3) || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

  INSERT INTO public.dealers (
    dealer_name, dealer_code, contact_person, phone, email,
    city, state, credit_limit, outstanding_credit
  ) VALUES (
    v_app.trade_name, v_dealer_code, v_app.contact_person, v_app.phone, v_app.email,
    v_app.territory, v_app.territory, v_app.requested_credit_limit, 0.00
  ) RETURNING id INTO v_dealer_id;

  UPDATE public.dealer_onboarding_applications
  SET status = 'APPROVED',
      approved_by = v_caller_id,
      approved_at = NOW(),
      activated_dealer_id = v_dealer_id,
      updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'dealer_id', v_dealer_id,
    'dealer_code', v_dealer_code,
    'status', 'APPROVED'
  );
END;
$$;

-- Revoke and Grant execution
REVOKE ALL ON FUNCTION public.fn_convert_lead_to_opportunity FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_approve_dealer_onboarding FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_convert_lead_to_opportunity TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_dealer_onboarding TO authenticated;
