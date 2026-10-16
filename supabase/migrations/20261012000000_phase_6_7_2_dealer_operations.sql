-- Migration: 20261012000000_phase_6_7_2_dealer_operations.sql
-- Description: Implement Dealer Operations, Dealer Self-Service Portal, RLS isolation, RPC workflows, and reporting views.

-- 1. ADD 'dealer' ROLE TO ROLES TABLE
INSERT INTO public.roles (name, description)
VALUES ('dealer', 'Authorized ZUVO TV Dealer Self-Service Portal')
ON CONFLICT (name) DO NOTHING;

-- 2. ADD dealer_id TO PROFILES, PRODUCT_UNITS, SERVICE_TICKETS, SALES_RETURNS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_dealer_id ON public.profiles(dealer_id);

ALTER TABLE public.product_units
  ADD COLUMN IF NOT EXISTS dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_product_units_dealer_id ON public.product_units(dealer_id);

ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_tickets_dealer_id ON public.service_tickets(dealer_id);

ALTER TABLE public.sales_returns
  ADD COLUMN IF NOT EXISTS dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_returns_dealer_id ON public.sales_returns(dealer_id);

-- 3. HELPER FUNCTION: get_current_user_dealer_id
CREATE OR REPLACE FUNCTION public.get_current_user_dealer_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.dealer_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- 4. UPDATE RLS POLICIES FOR DEALER DATA ISOLATION

-- Dealers policy: dealers can view their own record; admin/staff view all
DROP POLICY IF EXISTS dealers_select ON public.dealers;
CREATE POLICY dealers_select ON public.dealers
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'inventory'::text, 'service'::text, 'support'::text])
    OR id = get_current_user_dealer_id()
  );

-- Profiles policy for dealers: dealers can view their own profile and profiles of users in their dealer
DROP POLICY IF EXISTS crm_profiles_select_dealer ON public.profiles;
CREATE POLICY crm_profiles_select_dealer ON public.profiles
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text])
    OR id = auth.uid()
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

-- Product Units policy: dealers view only units assigned to them
DROP POLICY IF EXISTS crm_product_units_select ON public.product_units;
CREATE POLICY crm_product_units_select ON public.product_units
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'inventory'::text, 'sales'::text, 'service'::text, 'support'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

-- Sales policy: dealers select their own sales
DROP POLICY IF EXISTS crm_sales_select ON public.sales;
CREATE POLICY crm_sales_select ON public.sales
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'service'::text, 'support'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

DROP POLICY IF EXISTS crm_sales_insert ON public.sales;
CREATE POLICY crm_sales_insert ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

-- Sale Items policy: dealers view sale items for their sales
DROP POLICY IF EXISTS crm_sale_items_select ON public.sale_items;
CREATE POLICY crm_sale_items_select ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'service'::text, 'support'::text])
    OR (get_current_user_role() = 'dealer'::text AND EXISTS (
        SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.dealer_id = get_current_user_dealer_id()
    ))
  );

-- Warranties policy: dealers view warranties for their sales/products
DROP POLICY IF EXISTS crm_warranties_select ON public.warranties;
CREATE POLICY crm_warranties_select ON public.warranties
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'service'::text, 'support'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

-- Service Tickets policy: dealers view & insert service tickets for their dealer
DROP POLICY IF EXISTS crm_service_tickets_select ON public.service_tickets;
CREATE POLICY crm_service_tickets_select ON public.service_tickets
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'service'::text, 'support'::text, 'technician'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

DROP POLICY IF EXISTS crm_service_tickets_insert ON public.service_tickets;
CREATE POLICY crm_service_tickets_insert ON public.service_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'service'::text, 'support'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

-- Sales Returns (RMA) policy: dealers view & insert returns for their dealer
DROP POLICY IF EXISTS sales_returns_select ON public.sales_returns;
CREATE POLICY sales_returns_select ON public.sales_returns
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'inventory'::text, 'service'::text, 'support'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

DROP POLICY IF EXISTS sales_returns_insert ON public.sales_returns;
CREATE POLICY sales_returns_insert ON public.sales_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'inventory'::text])
    OR (get_current_user_role() = 'dealer'::text AND dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id())
  );

-- Customers policy: dealers view customers associated with their sales/created by them
DROP POLICY IF EXISTS crm_customers_select ON public.customers;
CREATE POLICY crm_customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'service'::text, 'support'::text])
    OR (get_current_user_role() = 'dealer'::text AND (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.sales s WHERE s.customer_id = customers.id AND s.dealer_id = get_current_user_dealer_id())
    ))
  );

-- 5. RPC WORKFLOWS FOR DEALER OPERATIONS

-- RPC 1: fn_assign_product_units_to_dealer
CREATE OR REPLACE FUNCTION public.fn_assign_product_units_to_dealer(
  p_dealer_id UUID,
  p_product_unit_ids UUID[],
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_unit_id UUID;
  v_assigned_count INT := 0;
  v_unit RECORD;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'sales', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can assign product units to dealers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = p_dealer_id) THEN
    RAISE EXCEPTION 'Dealer does not exist';
  END IF;

  FOREACH v_unit_id IN ARRAY p_product_unit_ids LOOP
    SELECT * INTO v_unit FROM public.product_units WHERE id = v_unit_id FOR UPDATE;
    IF v_unit.id IS NOT NULL THEN
      UPDATE public.product_units
      SET dealer_id = p_dealer_id,
          updated_at = NOW()
      WHERE id = v_unit_id;

      INSERT INTO public.inventory_transactions (
        product_unit_id,
        transaction_type,
        previous_status,
        new_status,
        reference_note,
        performed_by
      ) VALUES (
        v_unit_id,
        'DISPATCH_TO_DEALER',
        v_unit.status,
        v_unit.status,
        COALESCE(p_notes, 'Assigned to dealer ' || p_dealer_id),
        auth.uid()
      );

      v_assigned_count := v_assigned_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'assigned_count', v_assigned_count,
    'dealer_id', p_dealer_id
  );
END;
$$;

-- RPC 2: fn_admin_manage_dealer_user
CREATE OR REPLACE FUNCTION public.fn_admin_manage_dealer_user(
  p_profile_id UUID,
  p_dealer_id UUID,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_dealer_role_id UUID;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admin can manage dealer users';
  END IF;

  SELECT id INTO v_dealer_role_id FROM public.roles WHERE name = 'dealer';
  IF v_dealer_role_id IS NULL THEN
    RAISE EXCEPTION 'Dealer role not found in system';
  END IF;

  IF p_dealer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = p_dealer_id) THEN
    RAISE EXCEPTION 'Dealer does not exist';
  END IF;

  UPDATE public.profiles
  SET role_id = v_dealer_role_id,
      dealer_id = p_dealer_id,
      is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'dealer_id', p_dealer_id,
    'is_active', p_is_active
  );
END;
$$;

-- RPC 3: fn_dealer_create_sale_order
CREATE OR REPLACE FUNCTION public.fn_dealer_create_sale_order(
  p_customer_id UUID,
  p_product_unit_id UUID,
  p_unit_price NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID;
  v_role TEXT;
  v_unit RECORD;
  v_sale_id UUID;
  v_sale_number TEXT;
  v_total NUMERIC;
BEGIN
  v_role := get_current_user_role();
  v_dealer_id := get_current_user_dealer_id();

  IF v_role = 'dealer' AND v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No dealer associated with user profile';
  END IF;

  -- Select product unit
  SELECT pu.*, pv.selling_price INTO v_unit
  FROM public.product_units pu
  JOIN public.product_variants pv ON pv.id = pu.variant_id
  WHERE pu.id = p_product_unit_id FOR UPDATE;

  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Product unit not found';
  END IF;

  IF v_role = 'dealer' AND (v_unit.dealer_id IS NULL OR v_unit.dealer_id != v_dealer_id) THEN
    RAISE EXCEPTION 'Unauthorized: Product unit does not belong to your dealer inventory';
  END IF;

  IF v_unit.status != 'in_stock' THEN
    RAISE EXCEPTION 'Product unit is not available for sale (Status: %)', v_unit.status;
  END IF;

  v_sale_number := 'DSL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
  v_total := COALESCE(p_unit_price, v_unit.selling_price, 0);

  INSERT INTO public.sales (
    sale_number,
    customer_id,
    dealer_id,
    sale_date,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    payment_status,
    sale_status,
    sold_by,
    notes
  ) VALUES (
    v_sale_number,
    p_customer_id,
    v_dealer_id,
    NOW(),
    v_total,
    0,
    0,
    v_total,
    'paid',
    'completed',
    auth.uid(),
    p_notes
  ) RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_items (
    sale_id,
    product_unit_id,
    unit_price,
    discount_amount,
    total_price
  ) VALUES (
    v_sale_id,
    p_product_unit_id,
    v_total,
    0,
    v_total
  );

  UPDATE public.product_units
  SET status = 'sold',
      sold_at = NOW(),
      updated_at = NOW()
  WHERE id = p_product_unit_id;

  INSERT INTO public.inventory_transactions (
    product_unit_id,
    transaction_type,
    previous_status,
    new_status,
    reference_note,
    performed_by
  ) VALUES (
    p_product_unit_id,
    'DEALER_SALE',
    'in_stock',
    'sold',
    'Dealer sale: ' || v_sale_number,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'product_unit_id', p_product_unit_id,
    'dealer_id', v_dealer_id
  );
END;
$$;

-- RPC 4: fn_dealer_create_service_ticket
CREATE OR REPLACE FUNCTION public.fn_dealer_create_service_ticket(
  p_product_unit_id UUID,
  p_customer_id UUID,
  p_issue_description TEXT,
  p_issue_category TEXT DEFAULT 'general',
  p_priority TEXT DEFAULT 'medium'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID;
  v_role TEXT;
  v_unit RECORD;
  v_warranty RECORD;
  v_ticket_id UUID;
  v_ticket_number TEXT;
BEGIN
  v_role := get_current_user_role();
  v_dealer_id := get_current_user_dealer_id();

  IF v_role = 'dealer' AND v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not linked to a dealer';
  END IF;

  SELECT * INTO v_unit FROM public.product_units WHERE id = p_product_unit_id;
  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Product unit not found';
  END IF;

  IF v_role = 'dealer' AND (v_unit.dealer_id IS NULL OR v_unit.dealer_id != v_dealer_id) THEN
    -- Check if sold by dealer
    IF NOT EXISTS (
      SELECT 1 FROM public.sales s
      JOIN public.sale_items si ON si.sale_id = s.id
      WHERE si.product_unit_id = p_product_unit_id AND s.dealer_id = v_dealer_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Product unit was not sold by or assigned to your dealer';
    END IF;
  END IF;

  -- Active warranty check
  SELECT * INTO v_warranty FROM public.warranties
  WHERE product_unit_id = p_product_unit_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  v_ticket_number := 'DTK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

  INSERT INTO public.service_tickets (
    ticket_number,
    customer_id,
    product_unit_id,
    warranty_id,
    dealer_id,
    service_type,
    issue_category,
    issue_description,
    priority,
    status,
    opened_at,
    notes
  ) VALUES (
    v_ticket_number,
    p_customer_id,
    p_product_unit_id,
    v_warranty.id,
    v_dealer_id,
    'repair',
    p_issue_category,
    p_issue_description,
    p_priority,
    'open',
    NOW(),
    'Submitted via Dealer Self-Service Portal'
  ) RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'dealer_id', v_dealer_id
  );
END;
$$;

-- RPC 5: fn_dealer_create_rma_request
CREATE OR REPLACE FUNCTION public.fn_dealer_create_rma_request(
  p_sale_id UUID,
  p_product_unit_id UUID,
  p_customer_id UUID,
  p_return_reason TEXT,
  p_inspection_condition TEXT DEFAULT 'unopened'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID;
  v_role TEXT;
  v_return_id UUID;
  v_return_number TEXT;
BEGIN
  v_role := get_current_user_role();
  v_dealer_id := get_current_user_dealer_id();

  IF v_role = 'dealer' AND v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not linked to a dealer';
  END IF;

  IF v_role = 'dealer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE id = p_sale_id AND dealer_id = v_dealer_id) THEN
      RAISE EXCEPTION 'Unauthorized: Sale does not belong to your dealer';
    END IF;
  END IF;

  v_return_number := 'DRMA-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

  INSERT INTO public.sales_returns (
    return_number,
    sale_id,
    product_unit_id,
    customer_id,
    dealer_id,
    return_reason,
    inspection_condition,
    outcome,
    refund_amount,
    refund_status,
    refund_method,
    notes,
    created_by
  ) VALUES (
    v_return_number,
    p_sale_id,
    p_product_unit_id,
    p_customer_id,
    v_dealer_id,
    p_return_reason,
    p_inspection_condition,
    'pending_inspection',
    0,
    'pending_approval',
    'store_credit',
    'Dealer RMA request submitted',
    auth.uid()
  ) RETURNING id INTO v_return_id;

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_number,
    'dealer_id', v_dealer_id
  );
END;
$$;

-- 6. REPORTING VIEWS WITH SECURITY_INVOKER = TRUE

CREATE OR REPLACE VIEW public.vw_dealer_sales_performance
WITH (security_invoker = true)
AS
SELECT
  d.id AS dealer_id,
  d.dealer_code,
  d.dealer_name,
  d.dealer_type,
  COUNT(s.id) AS total_sales_count,
  COALESCE(SUM(s.total_amount), 0) AS total_sales_amount,
  COUNT(DISTINCT si.product_unit_id) AS total_units_sold,
  MAX(s.created_at) AS last_sale_at
FROM public.dealers d
LEFT JOIN public.sales s ON s.dealer_id = d.id AND s.sale_status = 'completed'
LEFT JOIN public.sale_items si ON si.sale_id = s.id
GROUP BY d.id, d.dealer_code, d.dealer_name, d.dealer_type;

CREATE OR REPLACE VIEW public.vw_dealer_inventory_summary
WITH (security_invoker = true)
AS
SELECT
  d.id AS dealer_id,
  d.dealer_code,
  d.dealer_name,
  COUNT(pu.id) AS total_assigned_units,
  COUNT(pu.id) FILTER (WHERE pu.status = 'in_stock') AS in_stock_count,
  COUNT(pu.id) FILTER (WHERE pu.status = 'sold') AS sold_count,
  COUNT(pu.id) FILTER (WHERE pu.status = 'reserved') AS reserved_count,
  COUNT(pu.id) FILTER (WHERE pu.status = 'in_service') AS in_service_count,
  COUNT(pu.id) FILTER (WHERE pu.status = 'returned') AS returned_count,
  COUNT(pu.id) FILTER (WHERE pu.status = 'damaged') AS damaged_count
FROM public.dealers d
LEFT JOIN public.product_units pu ON pu.dealer_id = d.id
GROUP BY d.id, d.dealer_code, d.dealer_name;

CREATE OR REPLACE VIEW public.vw_dealer_warranty_summary
WITH (security_invoker = true)
AS
SELECT
  d.id AS dealer_id,
  d.dealer_code,
  d.dealer_name,
  COUNT(w.id) AS total_warranties,
  COUNT(w.id) FILTER (WHERE w.status = 'active') AS active_warranties,
  COUNT(w.id) FILTER (WHERE w.status = 'expired') AS expired_warranties,
  COUNT(w.id) FILTER (WHERE w.status = 'void') AS void_warranties
FROM public.dealers d
LEFT JOIN public.warranties w ON w.dealer_id = d.id
GROUP BY d.id, d.dealer_code, d.dealer_name;

CREATE OR REPLACE VIEW public.vw_dealer_service_summary
WITH (security_invoker = true)
AS
SELECT
  d.id AS dealer_id,
  d.dealer_code,
  d.dealer_name,
  COUNT(st.id) AS total_tickets,
  COUNT(st.id) FILTER (WHERE st.status = 'open') AS open_tickets,
  COUNT(st.id) FILTER (WHERE st.status = 'in_progress') AS in_progress_tickets,
  COUNT(st.id) FILTER (WHERE st.status = 'resolved') AS resolved_tickets,
  COUNT(st.id) FILTER (WHERE st.status = 'closed') AS closed_tickets
FROM public.dealers d
LEFT JOIN public.service_tickets st ON st.dealer_id = d.id
GROUP BY d.id, d.dealer_code, d.dealer_name;

CREATE OR REPLACE VIEW public.vw_dealer_rma_summary
WITH (security_invoker = true)
AS
SELECT
  d.id AS dealer_id,
  d.dealer_code,
  d.dealer_name,
  COUNT(sr.id) AS total_returns,
  COUNT(sr.id) FILTER (WHERE sr.refund_status = 'pending_approval') AS pending_returns,
  COUNT(sr.id) FILTER (WHERE sr.refund_status = 'approved') AS approved_returns,
  COUNT(sr.id) FILTER (WHERE sr.refund_status = 'rejected') AS rejected_returns
FROM public.dealers d
LEFT JOIN public.sales_returns sr ON sr.dealer_id = d.id
GROUP BY d.id, d.dealer_code, d.dealer_name;
