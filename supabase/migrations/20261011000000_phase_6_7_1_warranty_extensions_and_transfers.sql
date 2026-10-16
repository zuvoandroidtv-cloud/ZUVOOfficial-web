-- Migration: Phase 6.7.1 Warranty Extensions & Warranty Transfers
-- Created: 2026-10-11

-- 1. Create public.warranty_extensions table
CREATE TABLE IF NOT EXISTS public.warranty_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_number TEXT UNIQUE NOT NULL,
  warranty_id UUID NOT NULL REFERENCES public.warranties(id) ON DELETE CASCADE,
  previous_end_date DATE NOT NULL,
  extension_days INTEGER NOT NULL CHECK (extension_days > 0),
  new_end_date DATE NOT NULL,
  extension_reason TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    approval_status IN ('pending', 'approved', 'rejected', 'cancelled')
  ),
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_end_date_order CHECK (new_end_date > previous_end_date)
);

-- 2. Create public.warranty_transfers table
CREATE TABLE IF NOT EXISTS public.warranty_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT UNIQUE NOT NULL,
  warranty_id UUID NOT NULL REFERENCES public.warranties(id) ON DELETE CASCADE,
  product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
  from_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  to_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  transfer_reason TEXT NOT NULL,
  transfer_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    transfer_status IN ('pending', 'approved', 'rejected', 'cancelled')
  ),
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_diff_customer CHECK (from_customer_id <> to_customer_id)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_warranty_ext_warranty_id ON public.warranty_extensions(warranty_id);
CREATE INDEX IF NOT EXISTS idx_warranty_ext_status ON public.warranty_extensions(approval_status);
CREATE INDEX IF NOT EXISTS idx_warranty_trf_warranty_id ON public.warranty_transfers(warranty_id);
CREATE INDEX IF NOT EXISTS idx_warranty_trf_unit_id ON public.warranty_transfers(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_warranty_trf_from_cust ON public.warranty_transfers(from_customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_trf_to_cust ON public.warranty_transfers(to_customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_trf_status ON public.warranty_transfers(transfer_status);

-- 4. Enable RLS
ALTER TABLE public.warranty_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_transfers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Staff can view all warranty extensions" ON public.warranty_extensions;
DROP POLICY IF EXISTS "Staff can insert warranty extensions" ON public.warranty_extensions;
DROP POLICY IF EXISTS "Admins can update warranty extensions" ON public.warranty_extensions;

DROP POLICY IF EXISTS "Staff can view all warranty transfers" ON public.warranty_transfers;
DROP POLICY IF EXISTS "Staff can insert warranty transfers" ON public.warranty_transfers;
DROP POLICY IF EXISTS "Admins can update warranty transfers" ON public.warranty_transfers;

-- RLS Policies for warranty_extensions
CREATE POLICY "Staff can view all warranty extensions"
ON public.warranty_extensions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can insert warranty extensions"
ON public.warranty_extensions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update warranty extensions"
ON public.warranty_extensions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service')
  )
);

-- RLS Policies for warranty_transfers
CREATE POLICY "Staff can view all warranty transfers"
ON public.warranty_transfers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can insert warranty transfers"
ON public.warranty_transfers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update warranty transfers"
ON public.warranty_transfers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'sales', 'support')
  )
);

-- 5. Reporting Views (using security_invoker = true)
CREATE OR REPLACE VIEW public.vw_warranty_extensions_summary
WITH (security_invoker = true) AS
SELECT 
  we.id AS extension_id,
  we.extension_number,
  we.warranty_id,
  w.warranty_number,
  w.product_unit_id,
  pu.barcode,
  pu.serial_number,
  w.customer_id,
  c.full_name AS customer_name,
  c.phone AS customer_phone,
  we.previous_end_date,
  we.extension_days,
  we.new_end_date,
  we.extension_reason,
  we.approval_status,
  we.requested_at,
  we.approved_at,
  req_p.full_name AS requested_by_name,
  app_p.full_name AS approved_by_name
FROM public.warranty_extensions we
JOIN public.warranties w ON we.warranty_id = w.id
JOIN public.customers c ON w.customer_id = c.id
JOIN public.product_units pu ON w.product_unit_id = pu.id
LEFT JOIN public.profiles req_p ON we.requested_by = req_p.id
LEFT JOIN public.profiles app_p ON we.approved_by = app_p.id;

CREATE OR REPLACE VIEW public.vw_warranty_transfers_summary
WITH (security_invoker = true) AS
SELECT 
  wt.id AS transfer_id,
  wt.transfer_number,
  wt.warranty_id,
  w.warranty_number,
  wt.product_unit_id,
  pu.barcode,
  pu.serial_number,
  wt.from_customer_id,
  fc.full_name AS from_customer_name,
  fc.phone AS from_customer_phone,
  wt.to_customer_id,
  tc.full_name AS to_customer_name,
  tc.phone AS to_customer_phone,
  wt.transfer_reason,
  wt.transfer_status,
  wt.requested_at,
  wt.approved_at,
  wt.completed_at,
  req_p.full_name AS requested_by_name,
  app_p.full_name AS approved_by_name
FROM public.warranty_transfers wt
JOIN public.warranties w ON wt.warranty_id = w.id
JOIN public.product_units pu ON wt.product_unit_id = pu.id
JOIN public.customers fc ON wt.from_customer_id = fc.id
JOIN public.customers tc ON wt.to_customer_id = tc.id
LEFT JOIN public.profiles req_p ON wt.requested_by = req_p.id
LEFT JOIN public.profiles app_p ON wt.approved_by = app_p.id;

-- 6. RPC Functions (All SECURITY DEFINER functions use SET search_path = public)

-- RPC: Request Warranty Extension
CREATE OR REPLACE FUNCTION public.fn_request_warranty_extension(
  p_warranty_id UUID,
  p_extension_days INT,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_requested_by UUID DEFAULT NULL
)
RETURNS public.warranty_extensions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warranty public.warranties%ROWTYPE;
  v_ext public.warranty_extensions%ROWTYPE;
  v_ext_num TEXT;
  v_prev_end DATE;
  v_new_end DATE;
  v_req_role TEXT;
  v_is_auto_approve BOOLEAN := FALSE;
BEGIN
  -- Validate warranty
  SELECT * INTO v_warranty FROM public.warranties WHERE id = p_warranty_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty record not found.';
  END IF;

  IF v_warranty.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled warranties cannot be extended.';
  END IF;

  IF p_extension_days <= 0 THEN
    RAISE EXCEPTION 'Extension days must be greater than zero.';
  END IF;

  v_prev_end := v_warranty.warranty_end_date;
  v_new_end := v_prev_end + (p_extension_days || ' days')::INTERVAL;
  v_ext_num := 'EXT-' || to_char(now(), 'YYYYMM') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

  -- Check requester role for auto-approval if super_admin or admin
  IF p_requested_by IS NOT NULL THEN
    SELECT r.name INTO v_req_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = p_requested_by;

    IF v_req_role IN ('super_admin', 'admin') THEN
      v_is_auto_approve := TRUE;
    END IF;
  END IF;

  INSERT INTO public.warranty_extensions (
    extension_number,
    warranty_id,
    previous_end_date,
    extension_days,
    new_end_date,
    extension_reason,
    approval_status,
    requested_by,
    approved_by,
    requested_at,
    approved_at,
    notes
  ) VALUES (
    v_ext_num,
    p_warranty_id,
    v_prev_end,
    p_extension_days,
    v_new_end,
    p_reason,
    CASE WHEN v_is_auto_approve THEN 'approved' ELSE 'pending' END,
    p_requested_by,
    CASE WHEN v_is_auto_approve THEN p_requested_by ELSE NULL END,
    now(),
    CASE WHEN v_is_auto_approve THEN now() ELSE NULL END,
    p_notes
  ) RETURNING * INTO v_ext;

  -- If auto-approved, update warranty end date immediately
  IF v_is_auto_approve THEN
    UPDATE public.warranties
    SET 
      warranty_end_date = v_new_end,
      status = 'active',
      updated_at = now()
    WHERE id = p_warranty_id;
  END IF;

  -- Create Notification
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    INSERT INTO public.notifications (
      recipient_user_id,
      title,
      message,
      notification_type,
      entity_type,
      entity_id,
      severity
    ) VALUES (
      COALESCE(p_requested_by, (SELECT id FROM public.profiles LIMIT 1)),
      'Warranty Extension Requested',
      'Warranty extension ' || v_ext_num || ' for ' || p_extension_days || ' days submitted.',
      'warranty_alert',
      'warranty_extension',
      v_ext.id,
      'medium'
    );
  END IF;

  RETURN v_ext;
END;
$$;

-- RPC: Approve Warranty Extension
CREATE OR REPLACE FUNCTION public.fn_approve_warranty_extension(
  p_extension_id UUID,
  p_approved_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.warranty_extensions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext public.warranty_extensions%ROWTYPE;
  v_app_role TEXT;
BEGIN
  SELECT * INTO v_ext FROM public.warranty_extensions WHERE id = p_extension_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty extension request not found.';
  END IF;

  IF v_ext.approval_status != 'pending' THEN
    RAISE EXCEPTION 'Extension request is already %', v_ext.approval_status;
  END IF;

  -- Authorize role
  SELECT r.name INTO v_app_role
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = p_approved_by;

  IF v_app_role NOT IN ('super_admin', 'admin', 'service') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or service managers can approve warranty extensions.';
  END IF;

  -- Update extension status
  UPDATE public.warranty_extensions
  SET
    approval_status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_extension_id
  RETURNING * INTO v_ext;

  -- Update active warranty end date
  UPDATE public.warranties
  SET
    warranty_end_date = v_ext.new_end_date,
    status = 'active',
    updated_at = now()
  WHERE id = v_ext.warranty_id;

  -- Log Communication
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
    INSERT INTO public.communication_logs (
      recipient,
      channel,
      message_type,
      message_body,
      status,
      warranty_id
    ) VALUES (
      'CUSTOMER_MOBILE',
      'SMS',
      'WARRANTY_EXTENSION_APPROVED',
      'Your ZUVO TV warranty extension of ' || v_ext.extension_days || ' days is APPROVED. New end date: ' || v_ext.new_end_date,
      'SENT',
      v_ext.warranty_id
    );
  END IF;

  RETURN v_ext;
END;
$$;

-- RPC: Reject Warranty Extension
CREATE OR REPLACE FUNCTION public.fn_reject_warranty_extension(
  p_extension_id UUID,
  p_rejected_by UUID,
  p_reason TEXT
)
RETURNS public.warranty_extensions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext public.warranty_extensions%ROWTYPE;
BEGIN
  SELECT * INTO v_ext FROM public.warranty_extensions WHERE id = p_extension_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty extension request not found.';
  END IF;

  IF v_ext.approval_status != 'pending' THEN
    RAISE EXCEPTION 'Extension request is already %', v_ext.approval_status;
  END IF;

  UPDATE public.warranty_extensions
  SET
    approval_status = 'rejected',
    approved_by = p_rejected_by,
    approved_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_extension_id
  RETURNING * INTO v_ext;

  RETURN v_ext;
END;
$$;

-- RPC: Request Warranty Transfer
CREATE OR REPLACE FUNCTION public.fn_request_warranty_transfer(
  p_warranty_id UUID,
  p_to_customer_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_requested_by UUID DEFAULT NULL
)
RETURNS public.warranty_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warranty public.warranties%ROWTYPE;
  v_unit public.product_units%ROWTYPE;
  v_trf public.warranty_transfers%ROWTYPE;
  v_trf_num TEXT;
  v_req_role TEXT;
  v_is_auto_approve BOOLEAN := FALSE;
  v_pending_count INT;
BEGIN
  SELECT * INTO v_warranty FROM public.warranties WHERE id = p_warranty_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty not found.';
  END IF;

  IF v_warranty.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled warranties cannot be transferred.';
  END IF;

  IF v_warranty.customer_id = p_to_customer_id THEN
    RAISE EXCEPTION 'Source and destination customer must be different.';
  END IF;

  -- Check target customer exists
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_to_customer_id) THEN
    RAISE EXCEPTION 'Target customer not found.';
  END IF;

  -- Check product unit
  SELECT * INTO v_unit FROM public.product_units WHERE id = v_warranty.product_unit_id;
  IF v_unit.status != 'sold' THEN
    RAISE EXCEPTION 'Product unit must be sold to transfer warranty.';
  END IF;

  -- Check duplicate pending transfer
  SELECT COUNT(*) INTO v_pending_count
  FROM public.warranty_transfers
  WHERE warranty_id = p_warranty_id AND transfer_status = 'pending';

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'An active transfer request is already pending for this warranty.';
  END IF;

  v_trf_num := 'TRF-' || to_char(now(), 'YYYYMM') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

  -- Check auto approval for super_admin / admin
  IF p_requested_by IS NOT NULL THEN
    SELECT r.name INTO v_req_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = p_requested_by;

    IF v_req_role IN ('super_admin', 'admin') THEN
      v_is_auto_approve := TRUE;
    END IF;
  END IF;

  INSERT INTO public.warranty_transfers (
    transfer_number,
    warranty_id,
    product_unit_id,
    from_customer_id,
    to_customer_id,
    transfer_reason,
    transfer_status,
    requested_by,
    approved_by,
    requested_at,
    approved_at,
    completed_at,
    notes
  ) VALUES (
    v_trf_num,
    p_warranty_id,
    v_warranty.product_unit_id,
    v_warranty.customer_id,
    p_to_customer_id,
    p_reason,
    CASE WHEN v_is_auto_approve THEN 'approved' ELSE 'pending' END,
    p_requested_by,
    CASE WHEN v_is_auto_approve THEN p_requested_by ELSE NULL END,
    now(),
    CASE WHEN v_is_auto_approve THEN now() ELSE NULL END,
    CASE WHEN v_is_auto_approve THEN now() ELSE NULL END,
    p_notes
  ) RETURNING * INTO v_trf;

  -- If auto approved, execute transfer immediately
  IF v_is_auto_approve THEN
    UPDATE public.warranties
    SET 
      customer_id = p_to_customer_id,
      updated_at = now()
    WHERE id = p_warranty_id;
  END IF;

  RETURN v_trf;
END;
$$;

-- RPC: Approve Warranty Transfer
CREATE OR REPLACE FUNCTION public.fn_approve_warranty_transfer(
  p_transfer_id UUID,
  p_approved_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.warranty_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trf public.warranty_transfers%ROWTYPE;
  v_app_role TEXT;
BEGIN
  SELECT * INTO v_trf FROM public.warranty_transfers WHERE id = p_transfer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty transfer request not found.';
  END IF;

  IF v_trf.transfer_status != 'pending' THEN
    RAISE EXCEPTION 'Transfer request is already %', v_trf.transfer_status;
  END IF;

  -- Authorize role
  SELECT r.name INTO v_app_role
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = p_approved_by;

  IF v_app_role NOT IN ('super_admin', 'admin', 'sales', 'support') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or authorized managers can approve warranty transfers.';
  END IF;

  -- Update transfer status
  UPDATE public.warranty_transfers
  SET
    transfer_status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    completed_at = now(),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_transfer_id
  RETURNING * INTO v_trf;

  -- Perform ownership transfer on warranty (preserves start date, end date, sale_id)
  UPDATE public.warranties
  SET
    customer_id = v_trf.to_customer_id,
    updated_at = now()
  WHERE id = v_trf.warranty_id;

  -- Log Communication
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
    INSERT INTO public.communication_logs (
      recipient,
      channel,
      message_type,
      message_body,
      status,
      warranty_id
    ) VALUES (
      'CUSTOMER_MOBILE',
      'SMS',
      'WARRANTY_TRANSFER_APPROVED',
      'Warranty ownership transfer APPROVED. Unit is now registered under new owner.',
      'SENT',
      v_trf.warranty_id
    );
  END IF;

  RETURN v_trf;
END;
$$;

-- RPC: Reject Warranty Transfer
CREATE OR REPLACE FUNCTION public.fn_reject_warranty_transfer(
  p_transfer_id UUID,
  p_rejected_by UUID,
  p_reason TEXT
)
RETURNS public.warranty_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trf public.warranty_transfers%ROWTYPE;
BEGIN
  SELECT * INTO v_trf FROM public.warranty_transfers WHERE id = p_transfer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty transfer request not found.';
  END IF;

  IF v_trf.transfer_status != 'pending' THEN
    RAISE EXCEPTION 'Transfer request is already %', v_trf.transfer_status;
  END IF;

  UPDATE public.warranty_transfers
  SET
    transfer_status = 'rejected',
    approved_by = p_rejected_by,
    approved_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_transfer_id
  RETURNING * INTO v_trf;

  RETURN v_trf;
END;
$$;
