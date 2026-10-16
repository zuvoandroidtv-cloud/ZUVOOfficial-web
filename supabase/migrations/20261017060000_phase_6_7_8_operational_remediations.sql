-- =============================================================================
-- ZUVO TV CRM — PHASE 6.7.8 FORWARD-ONLY OPERATIONAL REMEDIATIONS
-- File: 20261017060000_phase_6_7_8_operational_remediations.sql
-- Description:
--   1. Fix fn_dealer_create_sale_order: Repair sale_items schema mismatch (use quantity=1, remove non-existent total_price)
--      and suppress duplicate automatic trigger inventory logging.
--   2. Fix register_customer_warranty: Support lookup by both barcode and serial_number.
--   3. Fix process_sales_return & record_inventory_status_change: Prevent duplicate inventory transaction logging on RMA returns.
--   4. Improve fn_receive_purchase_goods: Route notifications to active inventory/admin staff instead of arbitrary first user.
-- =============================================================================

-- 1. Update record_inventory_status_change to support transaction-scoped cooperative trigger suppression
CREATE OR REPLACE FUNCTION public.record_inventory_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Skip automatic logging if explicitly suppressed by an encompassing stored procedure (e.g. RMA return or dealer sale)
    IF current_setting('app.skip_inventory_trigger', true) = 'true' THEN
        RETURN NEW;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.inventory_transactions (
            product_unit_id,
            transaction_type,
            previous_status,
            new_status,
            reference_note,
            performed_by
        )
        VALUES (
            NEW.id,
            CASE NEW.status
                WHEN 'in_stock' THEN 'stock_adjustment'
                WHEN 'reserved' THEN 'reserved'
                WHEN 'sold' THEN 'sale'
                WHEN 'returned' THEN 'return'
                WHEN 'in_service' THEN 'service'
                WHEN 'damaged' THEN 'damaged'
                ELSE 'stock_adjustment'
            END,
            OLD.status,
            NEW.status,
            'Automatic inventory status change',
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Remediate process_sales_return to produce a single canonical inventory return entry
CREATE OR REPLACE FUNCTION public.process_sales_return(
  p_unit_id uuid,
  p_sale_id uuid,
  p_reason text,
  p_inspection_condition text DEFAULT 'good_condition'::text,
  p_outcome text DEFAULT 'in_stock'::text,
  p_refund_amount numeric DEFAULT 0,
  p_refund_method text DEFAULT 'original_payment'::text,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_unit RECORD;
  v_sale RECORD;
  v_sale_item RECORD;
  v_existing_return RECORD;
  v_return_number TEXT;
  v_user_id UUID;
  v_return_id UUID;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'sales', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only authorized staff can process sales returns.';
  END IF;

  v_user_id := auth.uid();

  SELECT * INTO v_unit FROM public.product_units WHERE id = p_unit_id FOR UPDATE;
  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Product unit not found.';
  END IF;

  IF v_unit.status != 'sold' THEN
    RAISE EXCEPTION 'Unit cannot be returned (current status: %). Only sold units can be returned.', v_unit.status;
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Original sale record not found.';
  END IF;

  SELECT * INTO v_sale_item 
  FROM public.sale_items 
  WHERE sale_id = p_sale_id AND product_unit_id = p_unit_id;

  IF v_sale_item.id IS NULL THEN
    RAISE EXCEPTION 'Product unit does not belong to the specified sale record.';
  END IF;

  SELECT * INTO v_existing_return 
  FROM public.sales_returns 
  WHERE product_unit_id = p_unit_id AND sale_id = p_sale_id;

  IF v_existing_return.id IS NOT NULL THEN
    RAISE EXCEPTION 'A return has already been processed for this unit under RMA %.', v_existing_return.return_number;
  END IF;

  v_return_number := 'RMA-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));

  INSERT INTO public.sales_returns (
    return_number,
    sale_id,
    product_unit_id,
    customer_id,
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
    p_unit_id,
    v_sale.customer_id,
    p_reason,
    p_inspection_condition,
    p_outcome,
    COALESCE(p_refund_amount, 0),
    'completed',
    COALESCE(p_refund_method, 'original_payment'),
    p_notes,
    v_user_id
  ) RETURNING id INTO v_return_id;

  -- Suppress automatic trigger logging so only the canonical return transaction is recorded
  PERFORM set_config('app.skip_inventory_trigger', 'true', true);

  UPDATE public.product_units
  SET status = p_outcome,
      updated_at = now()
  WHERE id = p_unit_id;

  UPDATE public.warranties
  SET status = 'cancelled',
      notes = COALESCE(notes || ' | ', '') || 'Cancelled due to Sales Return / RMA ' || v_return_number,
      updated_at = now()
  WHERE product_unit_id = p_unit_id AND status = 'active';

  UPDATE public.sales
  SET sale_status = 'returned',
      payment_status = CASE WHEN p_refund_amount >= v_sale.total_amount THEN 'refunded' ELSE payment_status END,
      updated_at = now()
  WHERE id = p_sale_id;

  -- Single canonical inventory transaction record for the return event
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
    p_unit_id,
    'return',
    'sold',
    p_outcome,
    v_unit.warehouse_id,
    v_unit.warehouse_id,
    p_reason,
    'RMA Return ' || v_return_number || ' processed. Condition: ' || p_inspection_condition,
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_number,
    'product_unit_id', p_unit_id,
    'new_unit_status', p_outcome,
    'refund_amount', p_refund_amount
  );
END;
$$;

-- 3. Remediate fn_dealer_create_sale_order to fix sale_items schema and ensure clean single transaction
CREATE OR REPLACE FUNCTION public.fn_dealer_create_sale_order(
  p_customer_id uuid,
  p_product_unit_id uuid,
  p_unit_price numeric DEFAULT NULL::numeric,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID;
  v_role TEXT;
  v_unit RECORD;
  v_cs RECORD;
  v_sale_id UUID;
  v_sale_number TEXT;
  v_total NUMERIC;
BEGIN
  v_role := get_current_user_role();
  v_dealer_id := get_current_user_dealer_id();

  IF v_role = 'dealer' AND v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No dealer associated with user profile';
  END IF;

  SELECT pu.*, pv.product_name INTO v_unit
  FROM public.product_units pu
  JOIN public.product_variants pv ON pv.id = pu.variant_id
  WHERE pu.id = p_product_unit_id FOR UPDATE;

  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Product unit not found';
  END IF;

  IF v_role = 'dealer' AND (v_unit.dealer_id IS NULL OR v_unit.dealer_id != v_dealer_id) THEN
    RAISE EXCEPTION 'Unauthorized: Product unit does not belong to your dealer inventory';
  END IF;

  SELECT * INTO v_cs
  FROM public.dealer_consignment_stock
  WHERE product_unit_id = p_product_unit_id FOR UPDATE;

  IF v_cs.id IS NOT NULL THEN
    IF v_cs.consignment_status IN ('disputed', 'recalled', 'lost', 'damaged') THEN
      RAISE EXCEPTION 'Product unit consignment status (%) prevents sale', v_cs.consignment_status;
    END IF;
  END IF;

  IF v_unit.status = 'sold' THEN
    RAISE EXCEPTION 'Product unit is already sold';
  END IF;

  v_total := COALESCE(p_unit_price, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'A valid sale unit price must be specified';
  END IF;

  v_sale_number := 'DSL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

  -- Suppress automatic trigger logging so only the canonical DEALER_SALE transaction is recorded
  PERFORM set_config('app.skip_inventory_trigger', 'true', true);

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
    COALESCE(v_dealer_id, v_unit.dealer_id),
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

  -- Fix: Match public.sale_items actual schema (quantity instead of non-existent total_price)
  INSERT INTO public.sale_items (
    sale_id,
    product_unit_id,
    unit_price,
    discount_amount,
    quantity
  ) VALUES (
    v_sale_id,
    p_product_unit_id,
    v_total,
    0,
    1
  );

  -- Suppress automatic trigger logging so only the canonical DEALER_SALE transaction is recorded
  PERFORM set_config('app.skip_inventory_trigger', 'true', true);

  UPDATE public.product_units
  SET status = 'sold',
      ownership_type = 'customer_owned',
      sold_at = NOW(),
      updated_at = NOW()
  WHERE id = p_product_unit_id;

  IF v_cs.id IS NOT NULL THEN
    UPDATE public.dealer_consignment_stock
    SET consignment_status = 'sold',
        ownership_type = 'customer_owned',
        sold_at = NOW(),
        settlement_status = 'pending',
        updated_at = NOW()
    WHERE id = v_cs.id;

    INSERT INTO public.dealer_consignment_movements (
      consignment_id,
      product_unit_id,
      dealer_id,
      movement_type,
      previous_consignment_status,
      new_consignment_status,
      previous_ownership_type,
      new_ownership_type,
      performed_by,
      reference_number,
      reason,
      notes
    ) VALUES (
      v_cs.id,
      p_product_unit_id,
      COALESCE(v_dealer_id, v_cs.dealer_id),
      'SALE',
      v_cs.consignment_status,
      'sold',
      v_cs.ownership_type,
      'customer_owned',
      auth.uid(),
      v_sale_number,
      'Consignment stock sold to customer',
      p_notes
    );
  END IF;

  -- Single canonical inventory transaction for the dealer sale event
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
    p_product_unit_id,
    'DEALER_SALE',
    v_unit.status,
    'sold',
    v_unit.warehouse_id,
    v_unit.warehouse_id,
    'Consignment unit sold via dealer portal',
    'Dealer sale: ' || v_sale_number,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'product_unit_id', p_product_unit_id,
    'dealer_id', COALESCE(v_dealer_id, v_unit.dealer_id)
  );
END;
$$;

-- 4. Remediate register_customer_warranty to support barcode or serial_number
CREATE OR REPLACE FUNCTION public.register_customer_warranty(
  p_barcode text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL::text,
  p_customer_address text DEFAULT NULL::text,
  p_registration_method text DEFAULT 'barcode_scan'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_code text;
    v_method text;
    v_unit record;
    v_variant record;
    v_existing_warranty record;
    v_sale record;
    v_customer_id uuid;
    v_warranty_number text;
    v_new_warranty record;
BEGIN
    v_clean_code := trim(p_barcode);
    v_method := CASE 
        WHEN p_registration_method IN ('barcode_scan', 'crm_registration', 'manual_registration') 
        THEN p_registration_method 
        ELSE 'barcode_scan' 
    END;

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Barcode or serial number cannot be empty.'
        );
    END IF;

    -- 1. Validate unit by either barcode or serial number
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE barcode = v_clean_code OR serial_number = v_clean_code
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Television unit with identifier "' || v_clean_code || '" not found in inventory registry.'
        );
    END IF;

    -- 2. Verify unit is sold
    IF v_unit.status != 'sold' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Television unit is recorded as ' || v_unit.status || '. Only dispatched/sold TVs can register warranty.'
        );
    END IF;

    -- 3. Check duplicate warranty
    SELECT * INTO v_existing_warranty
    FROM public.warranties
    WHERE product_unit_id = v_unit.id
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Warranty has already been registered for this unit under policy ' || v_existing_warranty.warranty_number
        );
    END IF;

    -- 4. Find retail sale record
    SELECT si.*, s.customer_id, s.dealer_id
    INTO v_sale
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.product_unit_id = v_unit.id
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No authorized sale transaction linked to this television unit.'
        );
    END IF;

    -- 5. Customer association
    IF v_sale.customer_id IS NOT NULL THEN
        v_customer_id := v_sale.customer_id;
        UPDATE public.customers
        SET full_name = COALESCE(NULLIF(trim(p_customer_name), ''), full_name),
            phone = COALESCE(NULLIF(trim(p_customer_phone), ''), phone),
            email = COALESCE(NULLIF(trim(p_customer_email), ''), email),
            address_line1 = COALESCE(NULLIF(trim(p_customer_address), ''), address_line1)
        WHERE id = v_customer_id;
    ELSE
        INSERT INTO public.customers (
            customer_code,
            full_name,
            phone,
            email,
            address_line1
        ) VALUES (
            'CUST-' || to_char(CURRENT_TIMESTAMP, 'YYMMDD') || lpad(floor(random() * 1000)::text, 3, '0'),
            trim(p_customer_name),
            trim(p_customer_phone),
            NULLIF(trim(p_customer_email), ''),
            NULLIF(trim(p_customer_address), '')
        ) RETURNING id INTO v_customer_id;
    END IF;

    -- 6. Generate warranty number
    v_warranty_number := 'WAR-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    -- 7. Insert warranty with start date = CURRENT_DATE, 12 months standard policy
    INSERT INTO public.warranties (
        warranty_number,
        product_unit_id,
        customer_id,
        sale_id,
        dealer_id,
        warranty_start_date,
        warranty_end_date,
        warranty_period_months,
        registration_method,
        status,
        registered_at
    ) VALUES (
        v_warranty_number,
        v_unit.id,
        v_customer_id,
        v_sale.sale_id,
        v_sale.dealer_id,
        CURRENT_DATE,
        (CURRENT_DATE + interval '12 months' - interval '1 day')::date,
        12,
        v_method,
        'active',
        CURRENT_TIMESTAMP
    ) RETURNING * INTO v_new_warranty;

    -- 8. Insert registration log
    INSERT INTO public.warranty_registration_logs (
        warranty_id,
        product_unit_id,
        barcode,
        registration_method,
        result,
        message
    ) VALUES (
        v_new_warranty.id,
        v_unit.id,
        v_unit.barcode,
        v_method,
        'success',
        'Warranty policy ' || v_warranty_number || ' registered successfully'
    );

    -- 9. Product details for response
    SELECT product_name INTO v_variant
    FROM public.product_variants
    WHERE id = v_unit.variant_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Congratulations! Your ZUVO Television warranty has been successfully registered.',
        'warranty', jsonb_build_object(
            'warranty_number', v_new_warranty.warranty_number,
            'product_name', v_variant.product_name,
            'barcode', v_unit.barcode,
            'serial_number', v_unit.serial_number,
            'customer_name', trim(p_customer_name),
            'warranty_start_date', v_new_warranty.warranty_start_date,
            'warranty_end_date', v_new_warranty.warranty_end_date,
            'duration_months', v_new_warranty.warranty_period_months,
            'status', v_new_warranty.status
        )
    );
END;
$$;

-- 5. Improve fn_receive_purchase_goods notification routing
CREATE OR REPLACE FUNCTION public.fn_receive_purchase_goods(
    p_po_id uuid,
    p_delivery_note_number text,
    p_vendor_invoice_reference text,
    p_received_items jsonb,
    p_serials_barcodes jsonb,
    p_notes text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_po RECORD;
    v_receipt_id UUID;
    v_receipt_number TEXT;
    v_item JSONB;
    v_po_item_id UUID;
    v_accepted_qty INT;
    v_rejected_qty INT;
    v_total_rec INT;
    v_po_item RECORD;
    v_new_unit_id UUID;
    v_serial TEXT;
    v_barcode TEXT;
    v_unit_elem JSONB;
    v_unit_idx INT;
    v_all_po_items RECORD;
    v_any_remaining BOOLEAN := false;
    v_all_received BOOLEAN := true;
    v_recipient_id UUID;
BEGIN
    v_actor_id := auth.uid();
    v_user_role := public.get_current_user_role();

    IF v_user_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: Insufficient permissions for goods receiving');
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Purchase Order not found');
    END IF;

    IF v_po.status NOT IN ('approved', 'partially_received') THEN
        RETURN json_build_object('success', false, 'message', 'Goods can only be received against APPROVED or PARTIALLY_RECEIVED purchase orders');
    END IF;

    IF p_received_items IS NULL OR jsonb_array_length(p_received_items) = 0 THEN
        RETURN json_build_object('success', false, 'message', 'No receiving items supplied');
    END IF;

    -- Generate Receipt Number: GRN-YYYYMMDD-XXXX
    v_receipt_number := 'GRN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    -- Create Purchase Receipt Header
    INSERT INTO public.purchase_receipts (
        receipt_number, purchase_order_id, vendor_id, warehouse_id,
        received_at, received_by, status, delivery_note_number, vendor_invoice_reference, notes
    ) VALUES (
        v_receipt_number, p_po_id, v_po.vendor_id, v_po.warehouse_id,
        now(), v_actor_id, 'completed', p_delivery_note_number, p_vendor_invoice_reference, p_notes
    ) RETURNING id INTO v_receipt_id;

    -- Process Each Item Receipt Line
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_received_items)
    LOOP
        v_po_item_id := (v_item->>'po_item_id')::UUID;
        v_accepted_qty := COALESCE((v_item->>'accepted_quantity')::INT, 0);
        v_rejected_qty := COALESCE((v_item->>'rejected_quantity')::INT, 0);
        v_total_rec := v_accepted_qty + v_rejected_qty;

        IF v_accepted_qty < 0 OR v_rejected_qty < 0 THEN
            RAISE EXCEPTION 'Received quantities cannot be negative';
        END IF;

        SELECT * INTO v_po_item FROM public.purchase_order_items WHERE id = v_po_item_id AND purchase_order_id = p_po_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'PO Line item % not found for this Purchase Order', v_po_item_id;
        END IF;

        IF (v_po_item.received_quantity + v_total_rec) > v_po_item.ordered_quantity THEN
            RAISE EXCEPTION 'Over-receipt error: Total received quantity (%) exceeds ordered quantity (%) for item %',
                (v_po_item.received_quantity + v_total_rec), v_po_item.ordered_quantity, v_po_item.product_variant_id;
        END IF;

        -- Record Purchase Receipt Item
        INSERT INTO public.purchase_receipt_items (
            purchase_receipt_id, purchase_order_item_id, product_variant_id,
            expected_quantity, received_quantity, accepted_quantity, rejected_quantity,
            rejection_reason, notes
        ) VALUES (
            v_receipt_id, v_po_item_id, v_po_item.product_variant_id,
            (v_po_item.ordered_quantity - v_po_item.received_quantity), v_total_rec,
            v_accepted_qty, v_rejected_qty, v_item->>'rejection_reason', v_item->>'notes'
        );

        -- Create Product Units for Accepted Items
        IF v_accepted_qty > 0 THEN
            FOR v_unit_idx IN 1..v_accepted_qty LOOP
                v_serial := NULL;
                v_barcode := NULL;

                -- Extract custom serial/barcode if provided
                IF p_serials_barcodes IS NOT NULL AND jsonb_array_length(p_serials_barcodes) >= v_unit_idx THEN
                    SELECT (elem->>'serial_number'), (elem->>'barcode') 
                    INTO v_serial, v_barcode
                    FROM jsonb_array_elements(p_serials_barcodes) elem
                    WHERE (elem->>'po_item_id')::UUID = v_po_item_id
                    LIMIT 1 OFFSET (v_unit_idx - 1);
                END IF;

                IF v_serial IS NULL OR trim(v_serial) = '' THEN
                    v_serial := 'SN-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 100000)::text, 5, '0');
                END IF;

                IF v_barcode IS NULL OR trim(v_barcode) = '' THEN
                    v_barcode := public.generate_product_unit_barcode();
                END IF;

                -- Check Duplicate Barcode/Serial
                IF EXISTS (SELECT 1 FROM public.product_units WHERE serial_number = v_serial OR barcode = v_barcode) THEN
                    v_serial := v_serial || '-' || floor(random() * 1000)::text;
                    v_barcode := public.generate_product_unit_barcode();
                END IF;

                -- Insert Accepted Unit into Inventory
                INSERT INTO public.product_units (
                    variant_id, serial_number, barcode, status, ownership_type,
                    purchase_cost, warehouse_id, received_at, notes
                ) VALUES (
                    v_po_item.product_variant_id, v_serial, v_barcode, 'in_stock', 'zuvo_owned',
                    v_po_item.unit_cost, v_po.warehouse_id, now(), 'Received via GRN ' || v_receipt_number
                ) RETURNING id INTO v_new_unit_id;

                -- Create Inventory Transaction
                INSERT INTO public.inventory_transactions (
                    product_unit_id, transaction_type, previous_status, new_status,
                    reference_note, performed_by, to_warehouse_id, movement_reason
                ) VALUES (
                    v_new_unit_id, 'GOODS_RECEIPT', 'unreceived', 'in_stock',
                    'GRN ' || v_receipt_number || ' | PO ' || v_po.po_number, v_actor_id, v_po.warehouse_id, 'PO Goods Receipt'
                );
            END LOOP;
        END IF;

        -- Update PO Line Item Received Qty
        UPDATE public.purchase_order_items
        SET received_quantity = received_quantity + v_total_rec,
            updated_at = now()
        WHERE id = v_po_item_id;
    END LOOP;

    -- Evaluate PO Status (Partially vs Fully Received)
    FOR v_all_po_items IN SELECT ordered_quantity, received_quantity FROM public.purchase_order_items WHERE purchase_order_id = p_po_id
    LOOP
        IF v_all_po_items.received_quantity < v_all_po_items.ordered_quantity THEN
            v_all_received := false;
            v_any_remaining := true;
        END IF;
    END LOOP;

    IF v_all_received THEN
        UPDATE public.purchase_orders SET status = 'fully_received', updated_at = now() WHERE id = p_po_id;
    ELSE
        UPDATE public.purchase_orders SET status = 'partially_received', updated_at = now() WHERE id = p_po_id;
    END IF;

    -- Notification targeted to active inventory / admin role holder
    SELECT p.id INTO v_recipient_id
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE r.name IN ('inventory', 'super_admin', 'admin') AND p.is_active = true
    ORDER BY CASE r.name WHEN 'inventory' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
    LIMIT 1;

    IF v_recipient_id IS NOT NULL THEN
        PERFORM public.create_notification(
            p_recipient_user_id := v_recipient_id,
            p_title := 'Goods Received',
            p_message := 'Goods Receipt ' || v_receipt_number || ' processed for PO ' || v_po.po_number,
            p_notification_type := 'GOODS_RECEIVED',
            p_severity := 'info',
            p_entity_type := 'purchase_receipt',
            p_entity_id := v_receipt_id,
            p_action_url := '/purchase-receipts'
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Goods received and inventory units created successfully',
        'receipt_id', v_receipt_id,
        'receipt_number', v_receipt_number,
        'po_status', CASE WHEN v_all_received THEN 'fully_received' ELSE 'partially_received' END
    );
END;
$$;

-- Enforce explicit execution privileges
GRANT EXECUTE ON FUNCTION public.fn_dealer_create_sale_order(uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_warranty(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_sales_return(uuid, uuid, text, text, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_receive_purchase_goods(uuid, text, text, jsonb, jsonb, text) TO authenticated;
