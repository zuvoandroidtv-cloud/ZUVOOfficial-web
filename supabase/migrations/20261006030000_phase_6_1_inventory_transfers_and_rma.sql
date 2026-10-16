-- PHASE 6.1 MIGRATION: INTER-WAREHOUSE TRANSFERS & SALES RETURN (RMA)
-- Date: 2026-10-06

-- 1. Update product_units status check constraint to include 'in_transit'
ALTER TABLE public.product_units DROP CONSTRAINT IF EXISTS product_units_status_check;
ALTER TABLE public.product_units ADD CONSTRAINT product_units_status_check 
  CHECK (status = ANY (ARRAY['in_stock'::text, 'reserved'::text, 'in_transit'::text, 'sold'::text, 'returned'::text, 'in_service'::text, 'damaged'::text]));

-- 2. Create sales_returns (RMA) Table
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT UNIQUE NOT NULL,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    return_reason TEXT NOT NULL,
    inspection_condition TEXT NOT NULL DEFAULT 'uninspected' 
      CHECK (inspection_condition = ANY (ARRAY['uninspected'::text, 'good_condition'::text, 'minor_damage'::text, 'defective_damaged'::text, 'scrap'::text])),
    outcome TEXT NOT NULL DEFAULT 'restocked' 
      CHECK (outcome = ANY (ARRAY['in_stock'::text, 'damaged'::text, 'in_service'::text])),
    refund_amount NUMERIC NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    refund_status TEXT NOT NULL DEFAULT 'completed' 
      CHECK (refund_status = ANY (ARRAY['pending'::text, 'completed'::text, 'rejected'::text])),
    refund_method TEXT NOT NULL DEFAULT 'original_payment',
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale_id ON public.sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_product_unit_id ON public.sales_returns(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON public.sales_returns(customer_id);

-- Enable RLS
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_returns
DROP POLICY IF EXISTS sales_returns_select ON public.sales_returns;
CREATE POLICY sales_returns_select ON public.sales_returns
  FOR SELECT TO authenticated
  USING (get_current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS sales_returns_insert ON public.sales_returns;
CREATE POLICY sales_returns_insert ON public.sales_returns
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'sales'::text, 'inventory'::text]));

DROP POLICY IF EXISTS sales_returns_update ON public.sales_returns;
CREATE POLICY sales_returns_update ON public.sales_returns
  FOR UPDATE TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]));

DROP POLICY IF EXISTS sales_returns_delete ON public.sales_returns;
CREATE POLICY sales_returns_delete ON public.sales_returns
  FOR DELETE TO authenticated
  USING (get_current_user_role() = 'super_admin'::text);


-- 3. RPC: initiate_warehouse_transfer
CREATE OR REPLACE FUNCTION public.initiate_warehouse_transfer(
  p_unit_id UUID,
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
  v_unit RECORD;
  v_from_warehouse_id UUID;
  v_user_id UUID;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only Inventory managers and Admins can transfer stock.';
  END IF;

  v_user_id := auth.uid();

  -- Get product unit
  SELECT * INTO v_unit FROM public.product_units WHERE id = p_unit_id FOR UPDATE;
  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Product unit not found.';
  END IF;

  IF v_unit.status != 'in_stock' THEN
    RAISE EXCEPTION 'Unit is not eligible for transfer (current status: %). Only in_stock units can be transferred.', v_unit.status;
  END IF;

  v_from_warehouse_id := v_unit.warehouse_id;

  IF v_from_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Product unit is not assigned to a source warehouse.';
  END IF;

  IF v_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'Destination warehouse must be different from source warehouse.';
  END IF;

  -- Update unit status to in_transit
  UPDATE public.product_units
  SET status = 'in_transit',
      updated_at = now()
  WHERE id = p_unit_id;

  -- Record inventory transaction
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
    'warehouse_transfer',
    'in_stock',
    'in_transit',
    v_from_warehouse_id,
    p_to_warehouse_id,
    COALESCE(p_reason, 'Inter-warehouse stock transfer initiated'),
    'Transfer pending receiving at destination facility',
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_unit_id', p_unit_id,
    'from_warehouse_id', v_from_warehouse_id,
    'to_warehouse_id', p_to_warehouse_id,
    'status', 'in_transit'
  );
END;
$$;


-- 4. RPC: receive_warehouse_transfer
CREATE OR REPLACE FUNCTION public.receive_warehouse_transfer(
  p_unit_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_unit RECORD;
  v_last_tx RECORD;
  v_user_id UUID;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only Inventory managers and Admins can receive stock transfers.';
  END IF;

  v_user_id := auth.uid();

  -- Get product unit
  SELECT * INTO v_unit FROM public.product_units WHERE id = p_unit_id FOR UPDATE;
  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Product unit not found.';
  END IF;

  IF v_unit.status != 'in_transit' THEN
    RAISE EXCEPTION 'Unit is not pending transfer (current status: %). Only in_transit units can be received.', v_unit.status;
  END IF;

  -- Find corresponding transfer transaction
  SELECT * INTO v_last_tx 
  FROM public.inventory_transactions 
  WHERE product_unit_id = p_unit_id 
    AND transaction_type = 'warehouse_transfer' 
    AND new_status = 'in_transit'
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_last_tx.id IS NULL OR v_last_tx.to_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Valid incoming transfer record not found for this unit.';
  END IF;

  -- Update unit to destination warehouse and in_stock
  UPDATE public.product_units
  SET warehouse_id = v_last_tx.to_warehouse_id,
      status = 'in_stock',
      updated_at = now()
  WHERE id = p_unit_id;

  -- Log stock_received transaction
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
    'stock_received',
    'in_transit',
    'in_stock',
    v_last_tx.from_warehouse_id,
    v_last_tx.to_warehouse_id,
    'Transfer completed & stock received at destination hub',
    COALESCE(p_notes, 'Received and verified at destination facility'),
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_unit_id', p_unit_id,
    'warehouse_id', v_last_tx.to_warehouse_id,
    'status', 'in_stock'
  );
END;
$$;


-- 5. RPC: process_sales_return (RMA)
CREATE OR REPLACE FUNCTION public.process_sales_return(
  p_unit_id UUID,
  p_sale_id UUID,
  p_reason TEXT,
  p_inspection_condition TEXT DEFAULT 'good_condition',
  p_outcome TEXT DEFAULT 'in_stock',
  p_refund_amount NUMERIC DEFAULT 0,
  p_refund_method TEXT DEFAULT 'original_payment',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
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

  -- 1. Validate Product Unit
  SELECT * INTO v_unit FROM public.product_units WHERE id = p_unit_id FOR UPDATE;
  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Product unit not found.';
  END IF;

  IF v_unit.status != 'sold' THEN
    RAISE EXCEPTION 'Unit cannot be returned (current status: %). Only sold units can be returned.', v_unit.status;
  END IF;

  -- 2. Validate Sale
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Original sale record not found.';
  END IF;

  -- 3. Validate Sale Item matches Unit
  SELECT * INTO v_sale_item 
  FROM public.sale_items 
  WHERE sale_id = p_sale_id AND product_unit_id = p_unit_id;

  IF v_sale_item.id IS NULL THEN
    RAISE EXCEPTION 'Product unit does not belong to the specified sale record.';
  END IF;

  -- 4. Check for existing return
  SELECT * INTO v_existing_return 
  FROM public.sales_returns 
  WHERE product_unit_id = p_unit_id AND sale_id = p_sale_id;

  IF v_existing_return.id IS NOT NULL THEN
    RAISE EXCEPTION 'A return has already been processed for this unit under RMA %.', v_existing_return.return_number;
  END IF;

  -- Generate RMA Return Number: RMA-YYYYMMDD-XXXX
  v_return_number := 'RMA-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));

  -- 5. Insert Sales Return Record
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

  -- 6. Update Product Unit Status
  UPDATE public.product_units
  SET status = p_outcome,
      updated_at = now()
  WHERE id = p_unit_id;

  -- 7. Update Warranty if exists
  UPDATE public.warranties
  SET status = 'cancelled',
      notes = COALESCE(notes || ' | ', '') || 'Cancelled due to Sales Return / RMA ' || v_return_number,
      updated_at = now()
  WHERE product_unit_id = p_unit_id AND status = 'active';

  -- 8. Update Sale Status
  UPDATE public.sales
  SET sale_status = 'returned',
      payment_status = CASE WHEN p_refund_amount >= v_sale.total_amount THEN 'refunded' ELSE payment_status END,
      updated_at = now()
  WHERE id = p_sale_id;

  -- 9. Log Inventory Transaction
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
