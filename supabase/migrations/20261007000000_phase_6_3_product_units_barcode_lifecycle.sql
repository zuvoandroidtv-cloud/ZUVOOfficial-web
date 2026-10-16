-- Phase 6.3 Migration: Product Unit & Complete Barcode Lifecycle
-- Migration file: supabase/migrations/20261007000000_phase_6_3_product_units_barcode_lifecycle.sql

-- 1. Create Barcode Sequence for Atomic, Database-Side Unique Barcode Generation
CREATE SEQUENCE IF NOT EXISTS public.product_unit_barcode_seq START WITH 1;

-- 2. Database-Side Server Function: generate_product_unit_barcode()
-- Format: ZUV-XXXXXXXXXXXX (12 digits, zero-padded, unique, concurrent-safe)
CREATE OR REPLACE FUNCTION public.generate_product_unit_barcode()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_barcode text;
  v_exists boolean;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['super_admin', 'admin', 'inventory'])) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to generate barcode.';
  END IF;

  LOOP
    v_barcode := 'ZUV-' || lpad(nextval('public.product_unit_barcode_seq')::text, 12, '0');
    SELECT EXISTS(SELECT 1 FROM public.product_units WHERE barcode = v_barcode) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_barcode;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_product_unit_barcode() TO authenticated;

-- 3. Database RPC: create_product_unit(...)
-- Atomic creation of physical TV unit with optional or auto-generated barcode and transaction log
CREATE OR REPLACE FUNCTION public.create_product_unit(
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_serial_number text,
  p_barcode text DEFAULT NULL,
  p_purchase_cost numeric DEFAULT 0,
  p_status text DEFAULT 'in_stock',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_clean_serial text;
  v_clean_barcode text;
  v_variant_exists boolean;
  v_warehouse_exists boolean;
  v_serial_exists boolean;
  v_barcode_exists boolean;
  v_unit_id uuid;
  v_status text;
BEGIN
  v_user_id := auth.uid();
  v_role := public.get_current_user_role();

  -- 1. Security & Role Authorization Check
  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['super_admin', 'admin', 'inventory'])) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to receive or create product units.';
  END IF;

  -- 2. Validate Inputs
  v_clean_serial := trim(p_serial_number);
  IF v_clean_serial IS NULL OR v_clean_serial = '' THEN
    RAISE EXCEPTION 'Serial number cannot be empty.';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.product_variants WHERE id = p_variant_id) INTO v_variant_exists;
  IF NOT v_variant_exists THEN
    RAISE EXCEPTION 'Selected product variant does not exist.';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.warehouses WHERE id = p_warehouse_id) INTO v_warehouse_exists;
  IF NOT v_warehouse_exists THEN
    RAISE EXCEPTION 'Selected warehouse does not exist.';
  END IF;

  -- Check Serial Uniqueness
  SELECT EXISTS(SELECT 1 FROM public.product_units WHERE lower(serial_number) = lower(v_clean_serial)) INTO v_serial_exists;
  IF v_serial_exists THEN
    RAISE EXCEPTION 'Serial number "%" is already registered to another TV unit.', v_clean_serial;
  END IF;

  -- 3. Barcode Assignment & Validation
  v_clean_barcode := trim(p_barcode);
  IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
    v_clean_barcode := public.generate_product_unit_barcode();
  ELSE
    SELECT EXISTS(SELECT 1 FROM public.product_units WHERE lower(barcode) = lower(v_clean_barcode)) INTO v_barcode_exists;
    IF v_barcode_exists THEN
      RAISE EXCEPTION 'Barcode "%" is already assigned to another TV unit.', v_clean_barcode;
    END IF;
  END IF;

  v_status := COALESCE(NULLIF(trim(p_status), ''), 'in_stock');

  -- 4. Insert Product Unit
  INSERT INTO public.product_units (
    variant_id,
    warehouse_id,
    serial_number,
    barcode,
    purchase_cost,
    status,
    received_at,
    notes
  ) VALUES (
    p_variant_id,
    p_warehouse_id,
    v_clean_serial,
    v_clean_barcode,
    COALESCE(p_purchase_cost, 0),
    v_status,
    now(),
    p_notes
  ) RETURNING id INTO v_unit_id;

  -- 5. Record Initial Inventory Transaction
  INSERT INTO public.inventory_transactions (
    product_unit_id,
    transaction_type,
    previous_status,
    new_status,
    from_warehouse_id,
    to_warehouse_id,
    movement_reason,
    reference_note,
    performed_by
  ) VALUES (
    v_unit_id,
    'stock_received',
    NULL,
    v_status,
    NULL,
    p_warehouse_id,
    'Stock Intake / Physical Unit Received',
    'Initial unit creation with barcode ' || v_clean_barcode,
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'unit_id', v_unit_id,
    'serial_number', v_clean_serial,
    'barcode', v_clean_barcode,
    'status', v_status,
    'message', 'Product unit created successfully with barcode ' || v_clean_barcode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_product_unit(uuid, uuid, text, text, numeric, text, text) TO authenticated;

-- 4. Database RPC: get_product_unit_detail(p_identifier text)
-- Resolves TV unit by ID, barcode, or serial number with full relation hydration
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
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['super_admin', 'admin', 'inventory', 'sales', 'service', 'support'])) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to view product unit details.';
  END IF;

  v_clean := trim(p_identifier);
  IF v_clean IS NULL OR v_clean = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identifier cannot be empty.');
  END IF;

  -- 1. Find Unit
  IF v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_unit FROM public.product_units WHERE id = v_clean::uuid;
  ELSE
    SELECT * INTO v_unit FROM public.product_units WHERE barcode = v_clean OR serial_number = v_clean;
  END IF;

  IF v_unit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No TV unit found matching "' || v_clean || '".');
  END IF;

  -- 2. Variant & Model Details
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

  -- 3. Warehouse Details
  SELECT * INTO v_warehouse FROM public.warehouses WHERE id = v_unit.warehouse_id;

  -- 4. Sale Details (if sold)
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
      'total_amount', v_sale.total_amount,
      'payment_status', v_sale.payment_status,
      'customer', CASE WHEN v_customer.id IS NOT NULL THEN jsonb_build_object(
        'id', v_customer.id,
        'customer_code', v_customer.customer_code,
        'full_name', v_customer.full_name,
        'phone', v_customer.phone,
        'email', v_customer.email
      ) ELSE NULL END
    );
  END IF;

  -- 5. Warranty Details
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

  -- 6. Service Tickets
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

  -- 7. RMA / Sales Returns
  SELECT * INTO v_rma FROM public.sales_returns WHERE product_unit_id = v_unit.id ORDER BY created_at DESC LIMIT 1;
  IF v_rma.id IS NOT NULL THEN
    v_rma_json := jsonb_build_object(
      'id', v_rma.id,
      'return_number', v_rma.return_number,
      'return_reason', v_rma.return_reason,
      'inspection_condition', v_rma.inspection_condition,
      'outcome', v_rma.outcome,
      'refund_amount', v_rma.refund_amount,
      'refund_status', v_rma.refund_status,
      'created_at', v_rma.created_at
    );
  END IF;

  -- 8. Unit History Timeline
  SELECT public.get_product_unit_history(v_unit.id) INTO v_history;

  RETURN jsonb_build_object(
    'success', true,
    'unit', jsonb_build_object(
      'id', v_unit.id,
      'serial_number', v_unit.serial_number,
      'barcode', v_unit.barcode,
      'status', v_unit.status,
      'purchase_cost', v_unit.purchase_cost,
      'received_at', v_unit.received_at,
      'sold_at', v_unit.sold_at,
      'notes', v_unit.notes,
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

GRANT EXECUTE ON FUNCTION public.get_product_unit_detail(text) TO authenticated;

-- 5. Database RPC: get_product_unit_history(p_unit_id uuid)
-- Aggregates full lifecycle timeline events for a given physical TV unit
CREATE OR REPLACE FUNCTION public.get_product_unit_history(p_unit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_events jsonb[];
  v_rec record;
BEGIN
  v_events := ARRAY[]::jsonb[];

  -- A. Inventory Movement Transactions
  FOR v_rec IN
    SELECT
      it.id,
      it.transaction_type,
      it.previous_status,
      it.new_status,
      it.movement_reason,
      it.reference_note,
      it.created_at,
      fwh.warehouse_name AS from_wh_name,
      twh.warehouse_name AS to_wh_name
    FROM public.inventory_transactions it
    LEFT JOIN public.warehouses fwh ON fwh.id = it.from_warehouse_id
    LEFT JOIN public.warehouses twh ON twh.id = it.to_warehouse_id
    WHERE it.product_unit_id = p_unit_id
    ORDER BY it.created_at ASC
  LOOP
    v_events := array_append(v_events, jsonb_build_object(
      'event_type', CASE
        WHEN v_rec.transaction_type = 'stock_received' THEN 'RECEIVED'
        WHEN v_rec.transaction_type = 'warehouse_transfer' THEN 'WAREHOUSE_TRANSFER'
        WHEN v_rec.transaction_type = 'sale' THEN 'SOLD'
        WHEN v_rec.transaction_type = 'return' THEN 'RMA_RETURN'
        ELSE upper(v_rec.transaction_type)
      END,
      'title', CASE
        WHEN v_rec.transaction_type = 'stock_received' THEN 'Physical Unit Received'
        WHEN v_rec.transaction_type = 'warehouse_transfer' THEN 'Inter-Warehouse Transfer (' || COALESCE(v_rec.from_wh_name, 'Source') || ' ➔ ' || COALESCE(v_rec.to_wh_name, 'Destination') || ')'
        WHEN v_rec.transaction_type = 'sale' THEN 'Unit Sold'
        WHEN v_rec.transaction_type = 'return' THEN 'RMA Return Processed'
        ELSE v_rec.transaction_type
      END,
      'details', COALESCE(v_rec.reference_note, v_rec.movement_reason),
      'status_change', CASE WHEN v_rec.previous_status IS NOT NULL THEN v_rec.previous_status || ' ➔ ' || v_rec.new_status ELSE v_rec.new_status END,
      'timestamp', v_rec.created_at
    ));
  END LOOP;

  -- B. Sales Orders
  FOR v_rec IN
    SELECT s.id, s.sale_number, s.sale_date, c.full_name AS customer_name
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    LEFT JOIN public.customers c ON c.id = s.customer_id
    WHERE si.product_unit_id = p_unit_id
    ORDER BY s.created_at ASC
  LOOP
    v_events := array_append(v_events, jsonb_build_object(
      'event_type', 'SALE_COMPLETED',
      'title', 'Sale Completed (' || v_rec.sale_number || ')',
      'details', 'Sold to ' || COALESCE(v_rec.customer_name, 'Customer'),
      'status_change', 'in_stock ➔ sold',
      'timestamp', v_rec.sale_date
    ));
  END LOOP;

  -- C. Warranty Registration
  FOR v_rec IN
    SELECT w.id, w.warranty_number, w.registration_method, w.warranty_start_date, w.warranty_end_date, w.registered_at, c.full_name AS customer_name
    FROM public.warranties w
    LEFT JOIN public.customers c ON c.id = w.customer_id
    WHERE w.product_unit_id = p_unit_id
    ORDER BY w.created_at ASC
  LOOP
    v_events := array_append(v_events, jsonb_build_object(
      'event_type', 'WARRANTY_REGISTERED',
      'title', 'Warranty Registered (' || v_rec.warranty_number || ')',
      'details', 'Registered via ' || v_rec.registration_method || ' for ' || COALESCE(v_rec.customer_name, 'Customer') || ' (Valid: ' || v_rec.warranty_start_date || ' to ' || v_rec.warranty_end_date || ')',
      'status_change', 'Warranty Active',
      'timestamp', v_rec.registered_at
    ));
  END LOOP;

  -- D. Service Tickets
  FOR v_rec IN
    SELECT st.id, st.ticket_number, st.service_type, st.issue_category, st.issue_description, st.status, st.opened_at, st.closed_at
    FROM public.service_tickets st
    WHERE st.product_unit_id = p_unit_id
    ORDER BY st.opened_at ASC
  LOOP
    v_events := array_append(v_events, jsonb_build_object(
      'event_type', 'SERVICE_TICKET',
      'title', 'Service Ticket Opened (' || v_rec.ticket_number || ')',
      'details', 'Category: ' || COALESCE(v_rec.issue_category, 'General') || ' | ' || v_rec.issue_description,
      'status_change', 'Service Status: ' || v_rec.status,
      'timestamp', v_rec.opened_at
    ));

    IF v_rec.closed_at IS NOT NULL THEN
      v_events := array_append(v_events, jsonb_build_object(
        'event_type', 'SERVICE_CLOSED',
        'title', 'Service Ticket Closed (' || v_rec.ticket_number || ')',
        'details', 'Resolved and closed service ticket',
        'status_change', 'Service Completed',
        'timestamp', v_rec.closed_at
      ));
    END IF;
  END LOOP;

  -- E. RMA Returns
  FOR v_rec IN
    SELECT sr.id, sr.return_number, sr.return_reason, sr.inspection_condition, sr.outcome, sr.created_at
    FROM public.sales_returns sr
    WHERE sr.product_unit_id = p_unit_id
    ORDER BY sr.created_at ASC
  LOOP
    v_events := array_append(v_events, jsonb_build_object(
      'event_type', 'RMA_RETURN',
      'title', 'RMA Return Processed (' || v_rec.return_number || ')',
      'details', 'Reason: ' || v_rec.return_reason || ' | Condition: ' || v_rec.inspection_condition,
      'status_change', 'sold ➔ ' || v_rec.outcome,
      'timestamp', v_rec.created_at
    ));
  END LOOP;

  RETURN jsonb_agg(elem ORDER BY (elem->>'timestamp') ASC)
  FROM unnest(v_events) AS elem;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_unit_history(uuid) TO authenticated;

-- 6. Enhance verify_tv_barcode_for_warranty
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
    v_sale_item record;
    v_sale record;
    v_customer record;
    v_variant record;
BEGIN
    v_clean_barcode := trim(p_barcode);

    IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'empty_barcode',
            'message', 'Barcode cannot be empty.'
        );
    END IF;

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
            'reason', 'not_found',
            'message', 'Television barcode or serial number was not found in the verified ZUVO inventory registry.'
        );
    END IF;

    SELECT * INTO v_variant
    FROM public.product_variants
    WHERE id = v_unit.variant_id;

    SELECT * INTO v_warranty
    FROM public.warranties
    WHERE product_unit_id = v_unit.id
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'valid', true,
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

    SELECT si.*, s.sale_number, s.customer_id, s.dealer_id, s.sale_date
    INTO v_sale
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.product_unit_id = v_unit.id
    ORDER BY s.sale_date DESC
    LIMIT 1;

    IF v_sale.customer_id IS NOT NULL THEN
        SELECT full_name, phone INTO v_customer
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
            'customer_name', COALESCE(v_customer.full_name, ''),
            'customer_phone', COALESCE(v_customer.phone, '')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_tv_barcode_for_warranty(text) TO authenticated, anon;
