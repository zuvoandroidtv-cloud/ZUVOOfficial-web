-- ============================================================================
-- PHASE 6.7.3 — DEALER CONSIGNMENT INVENTORY MIGRATION
-- ZUVO TV CRM
-- ============================================================================

-- 1. Update inventory transactions check constraint to include dealer consignment transaction types
ALTER TABLE public.inventory_transactions 
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE public.inventory_transactions 
  ADD CONSTRAINT inventory_transactions_transaction_type_check 
  CHECK (transaction_type IN (
    'stock_received', 'reserved', 'sale', 'return', 'service', 'service_completed', 
    'damaged', 'stock_adjustment', 'warehouse_transfer', 'DISPATCH_TO_DEALER', 
    'DEALER_SALE', 'DEALER_RECEIPT', 'DEALER_DISCREPANCY', 'CONSIGNMENT_RECALL', 
    'DEALER_TRANSFER', 'CONSIGNMENT_SETTLEMENT', 'RECONCILIATION'
  ));

-- 2. Add ownership_type column to product_units if not present
ALTER TABLE public.product_units 
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'zuvo_owned' 
  CHECK (ownership_type IN ('zuvo_owned', 'dealer_owned', 'customer_owned'));

-- 3. Create dealer_consignment_stock table
CREATE TABLE IF NOT EXISTS public.dealer_consignment_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE CASCADE,
    ownership_type TEXT NOT NULL DEFAULT 'zuvo_owned' CHECK (ownership_type IN ('zuvo_owned', 'dealer_owned', 'customer_owned')),
    consignment_status TEXT NOT NULL DEFAULT 'dispatched' CHECK (consignment_status IN ('dispatched', 'received', 'available', 'reserved', 'sold', 'disputed', 'recalled', 'returned', 'damaged', 'lost', 'reconciled', 'transferred')),
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    from_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sold_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    recalled_at TIMESTAMPTZ,
    discrepancy_reason TEXT CHECK (discrepancy_reason IS NULL OR discrepancy_reason IN ('missing_unit', 'damaged_unit', 'incorrect_unit', 'barcode_mismatch', 'quantity_mismatch', 'other')),
    discrepancy_notes TEXT,
    settlement_status TEXT NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'submitted', 'settled', 'disputed', 'cancelled')),
    settlement_reference TEXT,
    settlement_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT dealer_consignment_stock_product_unit_unique UNIQUE (product_unit_id)
);

-- 4. Create dealer_consignment_movements table (Immutable movement history)
CREATE TABLE IF NOT EXISTS public.dealer_consignment_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consignment_id UUID REFERENCES public.dealer_consignment_stock(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE CASCADE,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    previous_consignment_status TEXT,
    new_consignment_status TEXT,
    previous_ownership_type TEXT,
    new_ownership_type TEXT,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reference_number TEXT,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dealer_consignment_dealer_id ON public.dealer_consignment_stock(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_consignment_product_unit_id ON public.dealer_consignment_stock(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_dealer_consignment_status ON public.dealer_consignment_stock(consignment_status);
CREATE INDEX IF NOT EXISTS idx_dealer_consignment_settlement ON public.dealer_consignment_stock(settlement_status);
CREATE INDEX IF NOT EXISTS idx_dealer_consignment_movements_dealer_id ON public.dealer_consignment_movements(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_consignment_movements_unit_id ON public.dealer_consignment_movements(product_unit_id);

-- 6. Row Level Security
ALTER TABLE public.dealer_consignment_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_consignment_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage all consignment stock" ON public.dealer_consignment_stock;
DROP POLICY IF EXISTS "Dealers view own consignment stock" ON public.dealer_consignment_stock;

CREATE POLICY "Staff manage all consignment stock"
    ON public.dealer_consignment_stock FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'service', 'support'));

CREATE POLICY "Dealers view own consignment stock"
    ON public.dealer_consignment_stock FOR SELECT
    USING (get_current_user_role() = 'dealer' AND dealer_id = get_current_user_dealer_id());

DROP POLICY IF EXISTS "Staff manage all consignment movements" ON public.dealer_consignment_movements;
DROP POLICY IF EXISTS "Dealers view own consignment movements" ON public.dealer_consignment_movements;

CREATE POLICY "Staff manage all consignment movements"
    ON public.dealer_consignment_movements FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'service', 'support'));

CREATE POLICY "Dealers view own consignment movements"
    ON public.dealer_consignment_movements FOR SELECT
    USING (get_current_user_role() = 'dealer' AND dealer_id = get_current_user_dealer_id());

-- ============================================================================
-- RPC WORKFLOWS
-- ============================================================================

-- A. Dispatch Consignment Stock to Dealer
CREATE OR REPLACE FUNCTION public.fn_dispatch_consignment_to_dealer(
  p_dealer_id UUID,
  p_product_unit_ids UUID[],
  p_warehouse_id UUID,
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
  v_dispatched_count INT := 0;
  v_unit RECORD;
  v_consignment_id UUID;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'sales', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can dispatch consignment stock to dealers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = p_dealer_id AND is_active = true) THEN
    RAISE EXCEPTION 'Dealer does not exist or is inactive';
  END IF;

  FOREACH v_unit_id IN ARRAY p_product_unit_ids LOOP
    SELECT * INTO v_unit FROM public.product_units WHERE id = v_unit_id FOR UPDATE;
    
    IF v_unit.id IS NULL THEN
      RAISE EXCEPTION 'Product unit % not found', v_unit_id;
    END IF;

    IF v_unit.status = 'sold' THEN
      RAISE EXCEPTION 'Product unit % (Barcode: %) is already sold', v_unit.id, v_unit.barcode;
    END IF;

    IF v_unit.dealer_id IS NOT NULL AND v_unit.dealer_id != p_dealer_id THEN
      RAISE EXCEPTION 'Product unit % is assigned to another dealer', v_unit.barcode;
    END IF;

    UPDATE public.product_units
    SET dealer_id = p_dealer_id,
        status = 'in_transit',
        ownership_type = 'zuvo_owned',
        updated_at = NOW()
    WHERE id = v_unit_id;

    INSERT INTO public.dealer_consignment_stock (
      dealer_id,
      product_unit_id,
      ownership_type,
      consignment_status,
      dispatched_at,
      dispatched_by,
      from_warehouse_id,
      notes
    ) VALUES (
      p_dealer_id,
      v_unit_id,
      'zuvo_owned',
      'dispatched',
      NOW(),
      auth.uid(),
      COALESCE(p_warehouse_id, v_unit.warehouse_id),
      p_notes
    )
    ON CONFLICT (product_unit_id) DO UPDATE SET
      dealer_id = EXCLUDED.dealer_id,
      ownership_type = 'zuvo_owned',
      consignment_status = 'dispatched',
      dispatched_at = NOW(),
      dispatched_by = EXCLUDED.dispatched_by,
      from_warehouse_id = EXCLUDED.from_warehouse_id,
      received_at = NULL,
      received_by = NULL,
      discrepancy_reason = NULL,
      discrepancy_notes = NULL,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING id INTO v_consignment_id;

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
      v_consignment_id,
      v_unit_id,
      p_dealer_id,
      'DISPATCH',
      NULL,
      'dispatched',
      v_unit.ownership_type,
      'zuvo_owned',
      auth.uid(),
      'DISP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_unit_id::TEXT, 1, 6),
      'Dispatched to dealer consignment',
      p_notes
    );

    INSERT INTO public.inventory_transactions (
      product_unit_id,
      transaction_type,
      previous_status,
      new_status,
      reference_note,
      performed_by,
      from_warehouse_id
    ) VALUES (
      v_unit_id,
      'DISPATCH_TO_DEALER',
      v_unit.status,
      'in_transit',
      COALESCE(p_notes, 'Dispatched to dealer ' || p_dealer_id),
      auth.uid(),
      v_unit.warehouse_id
    );

    v_dispatched_count := v_dispatched_count + 1;
  END LOOP;

  BEGIN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      category,
      severity,
      entity_type,
      entity_id
    )
    SELECT 
      p.id,
      'New Consignment Shipment Dispatched',
      v_dispatched_count || ' unit(s) dispatched to your dealer account for consignment stock.',
      'inventory_alert',
      'inventory',
      'info',
      'dealer_consignment',
      p_dealer_id
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.dealer_id = p_dealer_id AND r.name = 'dealer';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'dispatched_count', v_dispatched_count,
    'dealer_id', p_dealer_id
  );
END;
$$;

-- B. Dealer Acknowledge Consignment Receipt
CREATE OR REPLACE FUNCTION public.fn_dealer_acknowledge_consignment_receipt(
  p_consignment_id UUID,
  p_action TEXT,
  p_discrepancy_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_dealer_id UUID;
  v_cs RECORD;
  v_unit RECORD;
  v_new_cs_status TEXT;
  v_new_pu_status TEXT;
BEGIN
  v_role := get_current_user_role();
  v_dealer_id := get_current_user_dealer_id();

  IF v_role = 'dealer' AND v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User profile is not linked to a dealer';
  END IF;

  SELECT * INTO v_cs
  FROM public.dealer_consignment_stock
  WHERE id = p_consignment_id FOR UPDATE;

  IF v_cs.id IS NULL THEN
    RAISE EXCEPTION 'Consignment record not found';
  END IF;

  IF v_role = 'dealer' AND v_cs.dealer_id != v_dealer_id THEN
    RAISE EXCEPTION 'Unauthorized: Consignment shipment does not belong to your dealer account';
  END IF;

  IF v_cs.consignment_status NOT IN ('dispatched', 'disputed') THEN
    RAISE EXCEPTION 'Consignment shipment is not in pending receipt status (Current status: %)', v_cs.consignment_status;
  END IF;

  SELECT * INTO v_unit
  FROM public.product_units
  WHERE id = v_cs.product_unit_id FOR UPDATE;

  IF p_action = 'accept' THEN
    v_new_cs_status := 'available';
    v_new_pu_status := 'in_stock';

    UPDATE public.dealer_consignment_stock
    SET consignment_status = v_new_cs_status,
        received_at = NOW(),
        received_by = auth.uid(),
        discrepancy_reason = NULL,
        discrepancy_notes = NULL,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_consignment_id;

    UPDATE public.product_units
    SET status = v_new_pu_status,
        updated_at = NOW()
    WHERE id = v_cs.product_unit_id;

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
      p_consignment_id,
      v_cs.product_unit_id,
      v_cs.dealer_id,
      'RECEIVE_ACCEPT',
      v_cs.consignment_status,
      v_new_cs_status,
      v_cs.ownership_type,
      v_cs.ownership_type,
      auth.uid(),
      'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(p_consignment_id::TEXT, 1, 6),
      'Dealer accepted consignment receipt',
      p_notes
    );

    INSERT INTO public.inventory_transactions (
      product_unit_id,
      transaction_type,
      previous_status,
      new_status,
      reference_note,
      performed_by
    ) VALUES (
      v_cs.product_unit_id,
      'DEALER_RECEIPT',
      v_unit.status,
      v_new_pu_status,
      'Dealer accepted consignment receipt',
      auth.uid()
    );

  ELSIF p_action = 'discrepancy' THEN
    IF p_discrepancy_reason IS NULL THEN
      RAISE EXCEPTION 'Discrepancy reason is required when reporting a receipt discrepancy';
    END IF;

    v_new_cs_status := 'disputed';
    v_new_pu_status := CASE WHEN p_discrepancy_reason = 'damaged_unit' THEN 'damaged' ELSE 'reserved' END;

    UPDATE public.dealer_consignment_stock
    SET consignment_status = v_new_cs_status,
        discrepancy_reason = p_discrepancy_reason,
        discrepancy_notes = p_notes,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_consignment_id;

    UPDATE public.product_units
    SET status = v_new_pu_status,
        updated_at = NOW()
    WHERE id = v_cs.product_unit_id;

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
      p_consignment_id,
      v_cs.product_unit_id,
      v_cs.dealer_id,
      'RECEIVE_DISCREPANCY',
      v_cs.consignment_status,
      v_new_cs_status,
      v_cs.ownership_type,
      v_cs.ownership_type,
      auth.uid(),
      'DISC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(p_consignment_id::TEXT, 1, 6),
      'Dealer reported receipt discrepancy: ' || p_discrepancy_reason,
      p_notes
    );

    INSERT INTO public.inventory_transactions (
      product_unit_id,
      transaction_type,
      previous_status,
      new_status,
      reference_note,
      performed_by
    ) VALUES (
      v_cs.product_unit_id,
      'DEALER_DISCREPANCY',
      v_unit.status,
      v_new_pu_status,
      'Dealer reported discrepancy: ' || p_discrepancy_reason,
      auth.uid()
    );

    BEGIN
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        category,
        severity,
        entity_type,
        entity_id
      )
      SELECT 
        p.id,
        'Dealer Receipt Discrepancy Reported',
        'Dealer reported discrepancy (' || p_discrepancy_reason || ') for Unit ' || v_unit.barcode,
        'inventory_alert',
        'inventory',
        'warning',
        'dealer_consignment',
        p_consignment_id
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE r.name IN ('super_admin', 'admin', 'inventory');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

  ELSE
    RAISE EXCEPTION 'Invalid action: Must be accept or discrepancy';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consignment_id', p_consignment_id,
    'action', p_action,
    'consignment_status', v_new_cs_status,
    'product_unit_status', v_new_pu_status
  );
END;
$$;

-- C. fn_dealer_create_sale_order
CREATE OR REPLACE FUNCTION public.fn_dealer_create_sale_order(
  p_customer_id UUID,
  p_product_unit_id UUID,
  p_unit_price NUMERIC DEFAULT NULL,
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
    v_unit.status,
    'sold',
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

-- D. Recall Consignment Stock (Admin to Warehouse)
CREATE OR REPLACE FUNCTION public.fn_recall_consignment_stock(
  p_product_unit_ids UUID[],
  p_to_warehouse_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_unit_id UUID;
  v_recalled_count INT := 0;
  v_unit RECORD;
  v_cs RECORD;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only admin or inventory managers can recall consignment stock';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_to_warehouse_id) THEN
    RAISE EXCEPTION 'Target warehouse does not exist';
  END IF;

  FOREACH v_unit_id IN ARRAY p_product_unit_ids LOOP
    SELECT * INTO v_unit FROM public.product_units WHERE id = v_unit_id FOR UPDATE;
    SELECT * INTO v_cs FROM public.dealer_consignment_stock WHERE product_unit_id = v_unit_id FOR UPDATE;

    IF v_unit.id IS NULL THEN
      RAISE EXCEPTION 'Product unit % not found', v_unit_id;
    END IF;

    IF v_unit.status = 'sold' THEN
      RAISE EXCEPTION 'Product unit % is sold and cannot be recalled', v_unit.barcode;
    END IF;

    UPDATE public.product_units
    SET dealer_id = NULL,
        warehouse_id = p_to_warehouse_id,
        status = 'in_stock',
        ownership_type = 'zuvo_owned',
        updated_at = NOW()
    WHERE id = v_unit_id;

    IF v_cs.id IS NOT NULL THEN
      UPDATE public.dealer_consignment_stock
      SET consignment_status = 'recalled',
          recalled_at = NOW(),
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
        reason,
        notes
      ) VALUES (
        v_cs.id,
        v_unit_id,
        v_cs.dealer_id,
        'RECALL_COMPLETE',
        v_cs.consignment_status,
        'recalled',
        v_cs.ownership_type,
        'zuvo_owned',
        auth.uid(),
        COALESCE(p_reason, 'Admin recalled consignment stock to warehouse'),
        'Recalled to warehouse ' || p_to_warehouse_id
      );

      BEGIN
        INSERT INTO public.notifications (
          user_id,
          title,
          message,
          type,
          category,
          severity,
          entity_type,
          entity_id
        )
        SELECT 
          p.id,
          'Consignment Stock Recalled',
          'Unit ' || v_unit.barcode || ' was recalled by ZUVO Admin.',
          'inventory_alert',
          'inventory',
          'info',
          'dealer_consignment',
          v_cs.dealer_id
        FROM public.profiles p
        WHERE p.dealer_id = v_cs.dealer_id AND p.role = 'dealer';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    INSERT INTO public.inventory_transactions (
      product_unit_id,
      transaction_type,
      previous_status,
      new_status,
      reference_note,
      performed_by,
      to_warehouse_id
    ) VALUES (
      v_unit_id,
      'CONSIGNMENT_RECALL',
      v_unit.status,
      'in_stock',
      COALESCE(p_reason, 'Consignment recalled to warehouse'),
      auth.uid(),
      p_to_warehouse_id
    );

    v_recalled_count := v_recalled_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'recalled_count', v_recalled_count,
    'warehouse_id', p_to_warehouse_id
  );
END;
$$;

-- E. Transfer Consignment Stock Between Dealers
CREATE OR REPLACE FUNCTION public.fn_transfer_dealer_consignment_stock(
  p_product_unit_ids UUID[],
  p_from_dealer_id UUID,
  p_to_dealer_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_unit_id UUID;
  v_transferred_count INT := 0;
  v_unit RECORD;
  v_cs RECORD;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can authorize inter-dealer transfers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = p_from_dealer_id) OR NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = p_to_dealer_id) THEN
    RAISE EXCEPTION 'Source or destination dealer does not exist';
  END IF;

  FOREACH v_unit_id IN ARRAY p_product_unit_ids LOOP
    SELECT * INTO v_unit FROM public.product_units WHERE id = v_unit_id FOR UPDATE;
    SELECT * INTO v_cs FROM public.dealer_consignment_stock WHERE product_unit_id = v_unit_id FOR UPDATE;

    IF v_unit.id IS NULL THEN
      RAISE EXCEPTION 'Product unit % not found', v_unit_id;
    END IF;

    IF v_unit.status = 'sold' THEN
      RAISE EXCEPTION 'Product unit % is sold and cannot be transferred', v_unit.barcode;
    END IF;

    IF v_unit.dealer_id != p_from_dealer_id THEN
      RAISE EXCEPTION 'Product unit % is not assigned to source dealer', v_unit.barcode;
    END IF;

    UPDATE public.product_units
    SET dealer_id = p_to_dealer_id,
        status = 'in_transit',
        updated_at = NOW()
    WHERE id = v_unit_id;

    IF v_cs.id IS NOT NULL THEN
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
        reason,
        notes
      ) VALUES (
        v_cs.id,
        v_unit_id,
        p_from_dealer_id,
        'TRANSFER',
        v_cs.consignment_status,
        'transferred',
        v_cs.ownership_type,
        v_cs.ownership_type,
        auth.uid(),
        COALESCE(p_reason, 'Inter-dealer transfer initiated'),
        'Transferred to dealer ' || p_to_dealer_id
      );

      UPDATE public.dealer_consignment_stock
      SET dealer_id = p_to_dealer_id,
          consignment_status = 'dispatched',
          dispatched_at = NOW(),
          dispatched_by = auth.uid(),
          received_at = NULL,
          received_by = NULL,
          notes = COALESCE(p_reason, notes),
          updated_at = NOW()
      WHERE id = v_cs.id;
    END IF;

    INSERT INTO public.inventory_transactions (
      product_unit_id,
      transaction_type,
      previous_status,
      new_status,
      reference_note,
      performed_by
    ) VALUES (
      v_unit_id,
      'DEALER_TRANSFER',
      v_unit.status,
      'in_transit',
      'Inter-dealer transfer from ' || p_from_dealer_id || ' to ' || p_to_dealer_id,
      auth.uid()
    );

    v_transferred_count := v_transferred_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'transferred_count', v_transferred_count,
    'from_dealer_id', p_from_dealer_id,
    'to_dealer_id', p_to_dealer_id
  );
END;
$$;

-- F. Consignment Reconciliation RPC
CREATE OR REPLACE FUNCTION public.fn_reconcile_dealer_consignment(
  p_dealer_id UUID,
  p_verified_unit_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_discrepant_unit_ids UUID[] DEFAULT ARRAY[]::UUID[],
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
  v_verified_count INT := 0;
  v_discrepant_count INT := 0;
  v_cs RECORD;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can reconcile dealer consignment stock';
  END IF;

  FOREACH v_unit_id IN ARRAY p_verified_unit_ids LOOP
    SELECT * INTO v_cs FROM public.dealer_consignment_stock WHERE product_unit_id = v_unit_id AND dealer_id = p_dealer_id FOR UPDATE;
    IF v_cs.id IS NOT NULL THEN
      UPDATE public.dealer_consignment_stock
      SET consignment_status = CASE WHEN consignment_status = 'dispatched' THEN 'available' ELSE consignment_status END,
          notes = COALESCE(p_notes, notes),
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
        reason,
        notes
      ) VALUES (
        v_cs.id,
        v_unit_id,
        p_dealer_id,
        'RECONCILIATION',
        v_cs.consignment_status,
        v_cs.consignment_status,
        v_cs.ownership_type,
        v_cs.ownership_type,
        auth.uid(),
        'Stock Reconciliation - Verified',
        p_notes
      );

      v_verified_count := v_verified_count + 1;
    END IF;
  END LOOP;

  FOREACH v_unit_id IN ARRAY p_discrepant_unit_ids LOOP
    SELECT * INTO v_cs FROM public.dealer_consignment_stock WHERE product_unit_id = v_unit_id AND dealer_id = p_dealer_id FOR UPDATE;
    IF v_cs.id IS NOT NULL THEN
      UPDATE public.dealer_consignment_stock
      SET consignment_status = 'disputed',
          discrepancy_reason = 'other',
          discrepancy_notes = COALESCE(p_notes, 'Discrepancy identified during physical reconciliation audit'),
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
        reason,
        notes
      ) VALUES (
        v_cs.id,
        v_unit_id,
        p_dealer_id,
        'RECONCILIATION',
        v_cs.consignment_status,
        'disputed',
        v_cs.ownership_type,
        v_cs.ownership_type,
        auth.uid(),
        'Stock Reconciliation - Discrepancy Found',
        p_notes
      );

      v_discrepant_count := v_discrepant_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'dealer_id', p_dealer_id,
    'verified_count', v_verified_count,
    'discrepant_count', v_discrepant_count
  );
END;
$$;

-- G. Update Consignment Settlement Status RPC
CREATE OR REPLACE FUNCTION public.fn_update_consignment_settlement(
  p_consignment_ids UUID[],
  p_settlement_status TEXT,
  p_settlement_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_cs_id UUID;
  v_updated_count INT := 0;
  v_cs RECORD;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'sales', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can update consignment settlement status';
  END IF;

  IF p_settlement_status NOT IN ('pending', 'submitted', 'settled', 'disputed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid settlement status';
  END IF;

  FOREACH v_cs_id IN ARRAY p_consignment_ids LOOP
    SELECT * INTO v_cs FROM public.dealer_consignment_stock WHERE id = v_cs_id FOR UPDATE;
    IF v_cs.id IS NOT NULL THEN
      UPDATE public.dealer_consignment_stock
      SET settlement_status = p_settlement_status,
          settlement_reference = COALESCE(p_settlement_reference, settlement_reference),
          settlement_date = CASE WHEN p_settlement_status = 'settled' THEN NOW() ELSE settlement_date END,
          notes = COALESCE(p_notes, notes),
          updated_at = NOW()
      WHERE id = v_cs_id;

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
        reason,
        notes
      ) VALUES (
        v_cs.id,
        v_cs.product_unit_id,
        v_cs.dealer_id,
        'SETTLEMENT_UPDATE',
        v_cs.consignment_status,
        v_cs.consignment_status,
        v_cs.ownership_type,
        v_cs.ownership_type,
        auth.uid(),
        'Settlement status updated to ' || p_settlement_status,
        COALESCE(p_notes, 'Ref: ' || COALESCE(p_settlement_reference, 'N/A'))
      );

      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'settlement_status', p_settlement_status
  );
END;
$$;

-- View 1: Dealer Consignment Summary
CREATE OR REPLACE VIEW public.vw_dealer_consignment_summary
WITH (security_invoker = true)
AS
SELECT 
  d.id AS dealer_id,
  d.dealer_code,
  d.dealer_name,
  d.dealer_type,
  d.city,
  d.state,
  COUNT(cs.id) AS total_consignment_units,
  COUNT(CASE WHEN cs.consignment_status = 'dispatched' THEN 1 END) AS dispatched_units,
  COUNT(CASE WHEN cs.consignment_status IN ('received', 'available') THEN 1 END) AS available_units,
  COUNT(CASE WHEN cs.consignment_status = 'sold' THEN 1 END) AS sold_units,
  COUNT(CASE WHEN cs.consignment_status = 'disputed' THEN 1 END) AS disputed_units,
  COUNT(CASE WHEN cs.consignment_status = 'recalled' THEN 1 END) AS recalled_units,
  COUNT(CASE WHEN cs.consignment_status = 'returned' THEN 1 END) AS returned_units,
  COUNT(CASE WHEN cs.settlement_status = 'settled' THEN 1 END) AS settled_units,
  COUNT(CASE WHEN cs.settlement_status = 'pending' AND cs.consignment_status = 'sold' THEN 1 END) AS pending_settlement_units,
  COALESCE(SUM(pu.purchase_cost), 0) AS total_cost_value,
  COALESCE(SUM(CASE WHEN cs.consignment_status IN ('received', 'available') THEN pu.purchase_cost ELSE 0 END), 0) AS available_cost_value
FROM public.dealers d
LEFT JOIN public.dealer_consignment_stock cs ON cs.dealer_id = d.id
LEFT JOIN public.product_units pu ON pu.id = cs.product_unit_id
WHERE d.is_active = true
GROUP BY d.id, d.dealer_code, d.dealer_name, d.dealer_type, d.city, d.state;

-- View 2: Detailed Dealer Consignment Inventory
CREATE OR REPLACE VIEW public.vw_dealer_consignment_inventory
WITH (security_invoker = true)
AS
SELECT 
  cs.id AS consignment_id,
  cs.dealer_id,
  d.dealer_code,
  d.dealer_name,
  cs.product_unit_id,
  pu.barcode,
  pu.serial_number,
  pv.id AS variant_id,
  pv.product_code,
  pv.product_name AS model_name,
  pv.screen_size,
  pv.tv_type,
  pu.purchase_cost,
  cs.ownership_type,
  cs.consignment_status,
  pu.status AS product_unit_status,
  cs.dispatched_at,
  cs.received_at,
  cs.sold_at,
  cs.recalled_at,
  cs.discrepancy_reason,
  cs.discrepancy_notes,
  cs.settlement_status,
  cs.settlement_reference,
  cs.settlement_date,
  GREATEST(0, EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at)))::INTEGER) AS days_at_dealer,
  w.warehouse_name AS from_warehouse_name
FROM public.dealer_consignment_stock cs
JOIN public.dealers d ON d.id = cs.dealer_id
JOIN public.product_units pu ON pu.id = cs.product_unit_id
JOIN public.product_variants pv ON pv.id = pu.variant_id
LEFT JOIN public.warehouses w ON w.id = cs.from_warehouse_id;

-- View 3: Consignment Aging Report
CREATE OR REPLACE VIEW public.vw_dealer_consignment_aging
WITH (security_invoker = true)
AS
SELECT 
  cs.dealer_id,
  d.dealer_code,
  d.dealer_name,
  cs.id AS consignment_id,
  cs.product_unit_id,
  pu.barcode,
  pu.serial_number,
  pv.product_name AS model_name,
  cs.consignment_status,
  cs.dispatched_at,
  cs.received_at,
  GREATEST(0, EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at)))::INTEGER) AS days_at_dealer,
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) <= 30 THEN '0-30 days'
    WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) <= 60 THEN '31-60 days'
    WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) <= 90 THEN '61-90 days'
    WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) <= 180 THEN '91-180 days'
    WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) <= 365 THEN '181-365 days'
    ELSE '365+ days'
  END AS aging_bracket
FROM public.dealer_consignment_stock cs
JOIN public.dealers d ON d.id = cs.dealer_id
JOIN public.product_units pu ON pu.id = cs.product_unit_id
JOIN public.product_variants pv ON pv.id = pu.variant_id
WHERE cs.consignment_status IN ('dispatched', 'received', 'available', 'reserved', 'disputed');

-- View 4: Consignment Movement Logs
CREATE OR REPLACE VIEW public.vw_dealer_consignment_movements
WITH (security_invoker = true)
AS
SELECT 
  cm.id AS movement_id,
  cm.consignment_id,
  cm.product_unit_id,
  pu.barcode,
  pu.serial_number,
  pv.product_name AS model_name,
  cm.dealer_id,
  d.dealer_code,
  d.dealer_name,
  cm.movement_type,
  cm.previous_consignment_status,
  cm.new_consignment_status,
  cm.previous_ownership_type,
  cm.new_ownership_type,
  cm.reference_number,
  cm.reason,
  cm.notes,
  cm.created_at,
  p.full_name AS performed_by_name,
  r.name AS performed_by_role
FROM public.dealer_consignment_movements cm
JOIN public.dealers d ON d.id = cm.dealer_id
JOIN public.product_units pu ON pu.id = cm.product_unit_id
JOIN public.product_variants pv ON pv.id = pu.variant_id
LEFT JOIN public.profiles p ON p.id = cm.performed_by
LEFT JOIN public.roles r ON r.id = p.role_id;

-- View 5: Consignment Reconciliation & Discrepancy View
CREATE OR REPLACE VIEW public.vw_dealer_consignment_reconciliation
WITH (security_invoker = true)
AS
SELECT 
  cs.id AS consignment_id,
  cs.dealer_id,
  d.dealer_code,
  d.dealer_name,
  cs.product_unit_id,
  pu.barcode,
  pu.serial_number,
  pv.product_name AS model_name,
  cs.consignment_status,
  cs.discrepancy_reason,
  cs.discrepancy_notes,
  cs.dispatched_at,
  cs.received_at,
  EXTRACT(DAY FROM (NOW() - cs.dispatched_at))::INTEGER AS days_since_dispatch,
  CASE 
    WHEN cs.consignment_status = 'disputed' THEN 'Active Discrepancy'
    WHEN cs.consignment_status = 'dispatched' AND EXTRACT(DAY FROM (NOW() - cs.dispatched_at)) > 7 THEN 'Pending Receipt > 7 Days'
    WHEN cs.consignment_status = 'lost' THEN 'Lost Stock'
    ELSE 'Standard'
  END AS reconciliation_category
FROM public.dealer_consignment_stock cs
JOIN public.dealers d ON d.id = cs.dealer_id
JOIN public.product_units pu ON pu.id = cs.product_unit_id
JOIN public.product_variants pv ON pv.id = pu.variant_id
WHERE cs.consignment_status IN ('disputed', 'lost')
   OR (cs.consignment_status = 'dispatched' AND EXTRACT(DAY FROM (NOW() - cs.dispatched_at)) > 7);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_consignment_stock TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_consignment_movements TO authenticated;
GRANT SELECT ON public.vw_dealer_consignment_summary TO authenticated;
GRANT SELECT ON public.vw_dealer_consignment_inventory TO authenticated;
GRANT SELECT ON public.vw_dealer_consignment_aging TO authenticated;
GRANT SELECT ON public.vw_dealer_consignment_movements TO authenticated;
GRANT SELECT ON public.vw_dealer_consignment_reconciliation TO authenticated;
