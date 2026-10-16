-- Migration: 20261006040000_phase_6_2_sale_order_save_fix.sql
-- Description: Implement atomic, transactional RPC for creating Sale Orders with RBAC, unit validation, payment logging, and status mapping

CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_customer_id uuid,
  p_product_unit_id uuid,
  p_unit_price numeric,
  p_discount_amount numeric DEFAULT 0,
  p_dealer_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'paid',
  p_payment_ref text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_sale_number text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_customer_exists boolean;
  v_dealer_exists boolean;
  v_unit_status text;
  v_sale_number text;
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_total numeric;
  v_sale_id uuid;
  v_user_id uuid;
  v_sales_pay_status text;
  v_pmt_rec_status text;
BEGIN
  -- 1. Validate user authentication & role authorization
  v_user_id := auth.uid();
  v_role := public.get_current_user_role();

  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['super_admin', 'admin', 'sales', 'inventory'])) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to create sale orders for role %', COALESCE(v_role, 'none');
  END IF;

  -- 2. Validate Customer
  SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = p_customer_id) INTO v_customer_exists;
  IF NOT v_customer_exists THEN
    RAISE EXCEPTION 'Selected customer does not exist.';
  END IF;

  -- 3. Validate Dealer if supplied
  IF p_dealer_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.dealers WHERE id = p_dealer_id) INTO v_dealer_exists;
    IF NOT v_dealer_exists THEN
      RAISE EXCEPTION 'Selected dealer does not exist.';
    END IF;
  END IF;

  -- 4. Validate Product Unit
  SELECT status INTO v_unit_status
  FROM public.product_units
  WHERE id = p_product_unit_id;

  IF v_unit_status IS NULL THEN
    RAISE EXCEPTION 'Selected TV unit does not exist.';
  END IF;

  IF v_unit_status = 'sold' THEN
    RAISE EXCEPTION 'Selected TV has already been sold.';
  END IF;

  IF v_unit_status NOT IN ('available', 'in_stock') THEN
    RAISE EXCEPTION 'Selected TV is not available for sale (Current status: %).', v_unit_status;
  END IF;

  -- 5. Calculate Financial Totals
  v_subtotal := COALESCE(p_unit_price, 0);
  v_discount := COALESCE(p_discount_amount, 0);
  v_tax := ROUND((v_subtotal - v_discount) * 0.18, 2);
  v_total := v_subtotal - v_discount + v_tax;

  -- 6. Map Status Values for Sales Header vs Payment Record Constraints
  -- sales.payment_status check constraint: ('pending', 'partial', 'paid', 'refunded')
  -- payments.payment_status check constraint: ('pending', 'completed', 'failed', 'refunded')
  v_sales_pay_status := CASE 
    WHEN p_payment_status IN ('paid', 'completed') THEN 'paid'
    WHEN p_payment_status = 'refunded' THEN 'refunded'
    WHEN p_payment_status = 'partial' THEN 'partial'
    ELSE 'pending'
  END;

  v_pmt_rec_status := CASE 
    WHEN p_payment_status IN ('paid', 'completed') THEN 'completed'
    WHEN p_payment_status = 'refunded' THEN 'refunded'
    WHEN p_payment_status = 'failed' THEN 'failed'
    ELSE 'pending'
  END;

  -- 7. Generate Sale Number if not provided
  IF p_sale_number IS NULL OR TRIM(p_sale_number) = '' THEN
    v_sale_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 100000)::text, 5, '0');
  ELSE
    v_sale_number := TRIM(p_sale_number);
  END IF;

  -- 8. Insert Sales Header
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
    p_dealer_id,
    NOW(),
    v_subtotal,
    v_discount,
    v_tax,
    v_total,
    v_sales_pay_status,
    'completed',
    v_user_id,
    p_notes
  )
  RETURNING id INTO v_sale_id;

  -- 9. Insert Sale Item
  INSERT INTO public.sale_items (
    sale_id,
    product_unit_id,
    unit_price,
    discount_amount,
    quantity
  ) VALUES (
    v_sale_id,
    p_product_unit_id,
    v_subtotal,
    v_discount,
    1
  );

  -- 10. Update Product Unit Status to 'sold'
  UPDATE public.product_units
  SET
    status = 'sold',
    sold_at = NOW(),
    updated_at = NOW()
  WHERE id = p_product_unit_id;

  -- 11. Record Payment
  INSERT INTO public.payments (
    sale_id,
    amount,
    payment_method,
    payment_status,
    payment_reference,
    paid_at
  ) VALUES (
    v_sale_id,
    v_total,
    COALESCE(p_payment_method, 'card'),
    v_pmt_rec_status,
    p_payment_ref,
    CASE WHEN v_pmt_rec_status = 'completed' THEN NOW() ELSE NULL END
  );

  -- 12. Return Response JSON
  RETURN json_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'total_amount', v_total,
    'payment_status', v_sales_pay_status,
    'message', 'Sale order ' || v_sale_number || ' created successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sales_order(uuid, uuid, numeric, numeric, uuid, text, text, text, text, text) TO authenticated;
