-- =============================================================================
-- ZUVO TV CRM — PHASE 6.7.7 FORWARD-ONLY DEFECT REMEDIATIONS
-- File: 20261017050000_phase_6_7_7_defect_remediations.sql
-- Description:
--   1. Fix Bug 1: Prevent PostgreSQL error 55000 in verify_tv_barcode_for_warranty
--      when a sold unit lacks a sale_items / sale record or customer association.
--      Safely returns controlled { valid: false, eligible: false, reason: 'missing_sale_record' }.
--      Uses concrete typed variables (v_customer_name, v_customer_phone) to eliminate unassigned record access.
--   2. Fix Bug 2: Authorize 'technician' role in get_product_unit_detail with least-privilege scoping:
--      - Redacts commercial purchase costs, sale amounts, and refund figures for technicians.
--      - Restricts customer contact details and broader inventory ledger history for units unassigned to the technician.
--      - Preserves strict access denial for anonymous and unauthorized roles.
-- =============================================================================

-- 1. Remediate verify_tv_barcode_for_warranty
CREATE OR REPLACE FUNCTION public.verify_tv_barcode_for_warranty(p_barcode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_barcode text;
    v_unit record;
    v_warranty record;
    v_sale record;
    v_variant record;
    v_customer_name text := '';
    v_customer_phone text := '';
BEGIN
    v_clean_barcode := trim(p_barcode);

    IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'eligible', false,
            'reason', 'empty_barcode',
            'message', 'Barcode cannot be empty.'
        );
    END IF;

    -- Lookup unit by barcode or serial number
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE barcode = v_clean_barcode OR serial_number = v_clean_barcode
    LIMIT 1;

    IF NOT FOUND THEN
        INSERT INTO public.warranty_registration_logs (
            barcode,
            registration_method,
            result,
            message
        ) VALUES (
            v_clean_barcode,
            'barcode_scan',
            'invalid_barcode',
            'Barcode or serial number not found in ZUVO database'
        );

        RETURN jsonb_build_object(
            'valid', false,
            'eligible', false,
            'reason', 'not_found',
            'message', 'Television barcode or serial number was not found in the verified ZUVO inventory registry.'
        );
    END IF;

    SELECT * INTO v_variant
    FROM public.product_variants
    WHERE id = v_unit.variant_id;

    -- Check if warranty is already registered
    SELECT * INTO v_warranty
    FROM public.warranties
    WHERE product_unit_id = v_unit.id
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'valid', true,
            'eligible', false,
            'already_registered', true,
            'message', 'Television warranty is already registered and active.',
            'product', jsonb_build_object(
                'unit_id', v_unit.id,
                'product_name', v_variant.product_name,
                'screen_size', v_variant.screen_size,
                'barcode', v_unit.barcode,
                'serial_number', v_unit.serial_number
            ),
            'warranty', jsonb_build_object(
                'warranty_number', v_warranty.warranty_number,
                'status', v_warranty.status,
                'warranty_start_date', v_warranty.warranty_start_date,
                'warranty_end_date', v_warranty.warranty_end_date,
                'period_months', v_warranty.warranty_period_months,
                'registered_at', v_warranty.registered_at
            )
        );
    END IF;

    -- Verify unit is marked as sold
    IF v_unit.status != 'sold' THEN
        INSERT INTO public.warranty_registration_logs (
            barcode,
            product_unit_id,
            registration_method,
            result,
            message
        ) VALUES (
            v_clean_barcode,
            v_unit.id,
            'barcode_scan',
            'not_sold',
            'Unit status is ' || v_unit.status || ' (not marked as sold)'
        );

        RETURN jsonb_build_object(
            'valid', false,
            'eligible', false,
            'reason', 'unsold',
            'message', 'This television unit is currently recorded as ' || v_unit.status || '. Only dispatched/sold TVs can register warranty.',
            'product', jsonb_build_object(
                'unit_id', v_unit.id,
                'product_name', v_variant.product_name,
                'barcode', v_unit.barcode,
                'serial_number', v_unit.serial_number,
                'status', v_unit.status
            )
        );
    END IF;

    -- Find associated retail sale record
    SELECT si.*, s.sale_number, s.customer_id, s.dealer_id, s.sale_date
    INTO v_sale
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.product_unit_id = v_unit.id
    ORDER BY s.sale_date DESC
    LIMIT 1;

    -- Safe handling for missing sale records (Bug 1 fix)
    IF NOT FOUND OR v_sale.sale_id IS NULL THEN
        INSERT INTO public.warranty_registration_logs (
            barcode,
            product_unit_id,
            registration_method,
            result,
            message
        ) VALUES (
            v_clean_barcode,
            v_unit.id,
            'barcode_scan',
            'failed',
            'Unit is marked sold but no valid retail sales invoice was found'
        );

        RETURN jsonb_build_object(
            'valid', false,
            'eligible', false,
            'reason', 'missing_sale_record',
            'message', 'Television is recorded as sold, but no linked sales transaction was found. A registered sale is required to activate warranty.',
            'product', jsonb_build_object(
                'unit_id', v_unit.id,
                'product_name', v_variant.product_name,
                'screen_size', v_variant.screen_size,
                'barcode', v_unit.barcode,
                'serial_number', v_unit.serial_number,
                'status', v_unit.status
            )
        );
    END IF;

    -- Retrieve customer details safely if customer_id exists
    IF v_sale.customer_id IS NOT NULL THEN
        SELECT COALESCE(full_name, ''), COALESCE(phone, '')
        INTO v_customer_name, v_customer_phone
        FROM public.customers
        WHERE id = v_sale.customer_id;
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'already_registered', false,
        'eligible', true,
        'message', 'Television is verified and eligible for official warranty registration.',
        'product', jsonb_build_object(
            'unit_id', v_unit.id,
            'product_name', v_variant.product_name,
            'screen_size', v_variant.screen_size,
            'barcode', v_unit.barcode,
            'serial_number', v_unit.serial_number
        ),
        'sale', jsonb_build_object(
            'sale_id', v_sale.sale_id,
            'sale_number', v_sale.sale_number,
            'customer_name', v_customer_name,
            'customer_phone', v_customer_phone
        )
    );
END;
$$;

-- 2. Remediate get_product_unit_detail for technician authorization & least-privilege scoping
CREATE OR REPLACE FUNCTION public.get_product_unit_detail(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_clean text;
  v_unit record;
  v_variant record;
  v_warehouse record;
  v_sale record;
  v_customer record;
  v_warranty record;
  v_service_tickets jsonb;
  v_rma record;
  v_history jsonb;
  v_sale_json jsonb := NULL;
  v_warranty_json jsonb := NULL;
  v_rma_json jsonb := NULL;
  v_is_assigned_to_tech boolean := false;
BEGIN
  v_role := public.get_current_user_role();
  -- Bug 2 fix: Add 'technician' to role authorization whitelist
  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['super_admin', 'admin', 'inventory', 'sales', 'service', 'support', 'technician'])) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to view product unit details.';
  END IF;

  v_clean := trim(p_identifier);
  IF v_clean IS NULL OR v_clean = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identifier cannot be empty.');
  END IF;

  IF v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_unit FROM public.product_units WHERE id = v_clean::uuid;
  ELSE
    SELECT * INTO v_unit FROM public.product_units WHERE barcode = v_clean OR serial_number = v_clean;
  END IF;

  IF v_unit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No TV unit found matching "' || v_clean || '".');
  END IF;

  -- Verify whether technician is assigned to this unit via ticket or visit
  IF v_role = 'technician' THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.service_tickets st
      LEFT JOIN public.service_visits sv ON sv.service_ticket_id = st.id
      WHERE st.product_unit_id = v_unit.id
        AND (sv.technician_id = auth.uid() OR st.assigned_to = auth.uid())
    ) INTO v_is_assigned_to_tech;
  ELSE
    v_is_assigned_to_tech := true;
  END IF;

  SELECT
    pv.*,
    pm.model_code,
    pm.model_name,
    b.name AS brand_name
  INTO v_variant
  FROM public.product_variants pv
  JOIN public.product_models pm ON pm.id = pv.model_id
  JOIN public.brands b ON b.id = pm.brand_id
  WHERE pv.id = v_unit.variant_id;

  SELECT * INTO v_warehouse FROM public.warehouses WHERE id = v_unit.warehouse_id;

  SELECT si.*, s.sale_number, s.customer_id, s.dealer_id, s.sale_date, s.total_amount, s.payment_status, s.sale_status
  INTO v_sale
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.product_unit_id = v_unit.id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sale.sale_id IS NOT NULL THEN
    IF v_sale.customer_id IS NOT NULL THEN
      SELECT * INTO v_customer FROM public.customers WHERE id = v_sale.customer_id;
    END IF;

    v_sale_json := jsonb_build_object(
      'sale_id', v_sale.sale_id,
      'sale_number', v_sale.sale_number,
      'sale_date', v_sale.sale_date,
      -- Redact commercial financial figures from technician
      'total_amount', CASE WHEN v_role = 'technician' THEN NULL ELSE v_sale.total_amount END,
      'payment_status', CASE WHEN v_role = 'technician' THEN NULL ELSE v_sale.payment_status END,
      'customer', CASE 
        WHEN v_customer.id IS NOT NULL AND (v_role != 'technician' OR v_is_assigned_to_tech) THEN jsonb_build_object(
          'id', v_customer.id,
          'customer_code', v_customer.customer_code,
          'full_name', v_customer.full_name,
          'phone', v_customer.phone,
          'email', CASE WHEN v_role = 'technician' THEN NULL ELSE v_customer.email END
        )
        WHEN v_customer.id IS NOT NULL AND v_role = 'technician' AND NOT v_is_assigned_to_tech THEN jsonb_build_object(
          'id', v_customer.id,
          'customer_code', v_customer.customer_code,
          'full_name', 'Customer on File (Unassigned Unit)',
          'phone', NULL,
          'email', NULL
        )
        ELSE NULL 
      END
    );
  END IF;

  SELECT * INTO v_warranty FROM public.warranties WHERE product_unit_id = v_unit.id ORDER BY created_at DESC LIMIT 1;
  IF v_warranty.id IS NOT NULL THEN
    v_warranty_json := jsonb_build_object(
      'id', v_warranty.id,
      'warranty_number', v_warranty.warranty_number,
      'status', v_warranty.status,
      'registration_method', v_warranty.registration_method,
      'warranty_start_date', v_warranty.warranty_start_date,
      'warranty_end_date', v_warranty.warranty_end_date,
      'period_months', v_warranty.warranty_period_months,
      'registered_at', v_warranty.registered_at
    );
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'ticket_number', st.ticket_number,
      'service_type', st.service_type,
      'issue_category', st.issue_category,
      'issue_description', st.issue_description,
      'priority', st.priority,
      'status', st.status,
      'opened_at', st.opened_at,
      'closed_at', st.closed_at
    ) ORDER BY st.opened_at DESC
  ), '[]'::jsonb) INTO v_service_tickets
  FROM public.service_tickets st
  WHERE st.product_unit_id = v_unit.id;

  SELECT * INTO v_rma FROM public.sales_returns WHERE product_unit_id = v_unit.id ORDER BY created_at DESC LIMIT 1;
  IF v_rma.id IS NOT NULL THEN
    v_rma_json := jsonb_build_object(
      'id', v_rma.id,
      'return_number', v_rma.return_number,
      'return_reason', v_rma.return_reason,
      'inspection_condition', v_rma.inspection_condition,
      'outcome', v_rma.outcome,
      -- Redact RMA refund financial amounts from technician
      'refund_amount', CASE WHEN v_role = 'technician' THEN NULL ELSE v_rma.refund_amount END,
      'refund_status', CASE WHEN v_role = 'technician' THEN NULL ELSE v_rma.refund_status END,
      'created_at', v_rma.created_at
    );
  END IF;

  -- Redact broad inventory movement history from technician unless unit is assigned
  IF v_role = 'technician' AND NOT v_is_assigned_to_tech THEN
    v_history := '[]'::jsonb;
  ELSE
    SELECT public.get_product_unit_history(v_unit.id) INTO v_history;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'unit', jsonb_build_object(
      'id', v_unit.id,
      'serial_number', v_unit.serial_number,
      'barcode', v_unit.barcode,
      'status', v_unit.status,
      -- Redact purchase cost from technician
      'purchase_cost', CASE WHEN v_role = 'technician' THEN NULL ELSE v_unit.purchase_cost END,
      'received_at', v_unit.received_at,
      'sold_at', v_unit.sold_at,
      'notes', CASE WHEN v_role = 'technician' AND NOT v_is_assigned_to_tech THEN NULL ELSE v_unit.notes END,
      'created_at', v_unit.created_at,
      'variant', jsonb_build_object(
        'id', v_variant.id,
        'product_code', v_variant.product_code,
        'product_name', v_variant.product_name,
        'screen_size', v_variant.screen_size,
        'tv_type', v_variant.tv_type,
        'bluetooth', v_variant.bluetooth,
        'voice_remote', v_variant.voice_remote,
        'model_name', v_variant.model_name,
        'brand_name', v_variant.brand_name
      ),
      'warehouse', jsonb_build_object(
        'id', v_warehouse.id,
        'warehouse_code', v_warehouse.warehouse_code,
        'warehouse_name', v_warehouse.warehouse_name,
        'warehouse_type', v_warehouse.warehouse_type
      )
    ),
    'sale', v_sale_json,
    'warranty', v_warranty_json,
    'service_tickets', v_service_tickets,
    'rma', v_rma_json,
    'history', v_history
  );
END;
$$;

-- Explicitly enforce execute permissions
-- verify_tv_barcode_for_warranty is callable by public customer warranty portal
GRANT EXECUTE ON FUNCTION public.verify_tv_barcode_for_warranty(text) TO anon, authenticated;

-- get_product_unit_detail is strictly staff-only
REVOKE EXECUTE ON FUNCTION public.get_product_unit_detail(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_unit_detail(text) TO authenticated;

