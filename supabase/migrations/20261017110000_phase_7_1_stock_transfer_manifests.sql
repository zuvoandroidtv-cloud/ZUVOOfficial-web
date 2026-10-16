-- =============================================================================
-- ZUVO TV CRM — PHASE 7.1
-- MULTI-WAREHOUSE STOCK TRANSFER MANIFESTS, INTER-DEPOT TRANSIT & AUDITING
-- File: 20261017110000_phase_7_1_stock_transfer_manifests.sql
-- =============================================================================

-- 1. Table: stock_transfers (Transfer Header)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT UNIQUE NOT NULL,
    source_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    destination_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (
        status IN (
            'draft',
            'prepared',
            'dispatched',
            'in_transit',
            'received',
            'partially_received',
            'reconciled',
            'cancelled',
            'rejected',
            'discrepancy'
        )
    ),
    carrier_name TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    vehicle_number TEXT,
    dispatch_notes TEXT,
    receiving_notes TEXT,
    discrepancy_notes TEXT,
    expected_unit_count INT NOT NULL DEFAULT 0 CHECK (expected_unit_count >= 0),
    dispatched_unit_count INT NOT NULL DEFAULT 0 CHECK (dispatched_unit_count >= 0),
    received_unit_count INT NOT NULL DEFAULT 0 CHECK (received_unit_count >= 0),
    missing_unit_count INT NOT NULL DEFAULT 0 CHECK (missing_unit_count >= 0),
    unexpected_unit_count INT NOT NULL DEFAULT 0 CHECK (unexpected_unit_count >= 0),
    damaged_unit_count INT NOT NULL DEFAULT 0 CHECK (damaged_unit_count >= 0),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    prepared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    dispatched_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reconciled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    dispatched_at TIMESTAMPTZ,
    expected_arrival_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_diff_warehouses CHECK (source_warehouse_id <> destination_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_source ON public.stock_transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dest ON public.stock_transfers(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_number ON public.stock_transfers(transfer_number);

-- 2. Table: stock_transfer_items (Transfer Manifest Line Items)
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    barcode TEXT NOT NULL,
    serial_number TEXT,
    item_status TEXT NOT NULL DEFAULT 'expected' CHECK (
        item_status IN (
            'expected',
            'dispatched',
            'in_transit',
            'received',
            'missing',
            'damaged',
            'rejected',
            'unexpected'
        )
    ),
    dispatched_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    condition_notes TEXT,
    is_damaged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_transfer_product_unit UNIQUE (transfer_id, product_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_unit ON public.stock_transfer_items(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_barcode ON public.stock_transfer_items(barcode);
CREATE INDEX IF NOT EXISTS idx_transfer_items_status ON public.stock_transfer_items(item_status);

-- 3. Table: stock_transfer_audit_logs (Immutable Custody Audit Trail)
CREATE TABLE IF NOT EXISTS public.stock_transfer_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_unit_id UUID REFERENCES public.product_units(id) ON DELETE SET NULL,
    barcode TEXT,
    action_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    from_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    to_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_audit_transfer ON public.stock_transfer_audit_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_unit ON public.stock_transfer_audit_logs(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_created ON public.stock_transfer_audit_logs(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Staff roles can view & manage transfers; Dealers are denied
DROP POLICY IF EXISTS "Staff manage stock transfers" ON public.stock_transfers;
CREATE POLICY "Staff manage stock transfers"
    ON public.stock_transfers FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "Staff manage transfer items" ON public.stock_transfer_items;
CREATE POLICY "Staff manage transfer items"
    ON public.stock_transfer_items FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "Staff view transfer audit logs" ON public.stock_transfer_audit_logs;
CREATE POLICY "Staff view transfer audit logs"
    ON public.stock_transfer_audit_logs FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

REVOKE ALL ON TABLE public.stock_transfers FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.stock_transfer_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.stock_transfer_audit_logs FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.stock_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stock_transfer_items TO authenticated;
GRANT SELECT, INSERT ON TABLE public.stock_transfer_audit_logs TO authenticated;

-- 6. RPC: fn_create_stock_transfer
CREATE OR REPLACE FUNCTION public.fn_create_stock_transfer(
    p_source_warehouse_id UUID,
    p_destination_warehouse_id UUID,
    p_carrier_name TEXT DEFAULT NULL,
    p_vehicle_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_driver_phone TEXT DEFAULT NULL,
    p_dispatch_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_transfer_num TEXT;
    v_transfer_id UUID;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory staff and administrators can create stock transfers.';
    END IF;

    IF p_source_warehouse_id IS NULL OR p_destination_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'Source and destination warehouses are required.';
    END IF;

    IF p_source_warehouse_id = p_destination_warehouse_id THEN
        RAISE EXCEPTION 'Destination warehouse must be different from source warehouse.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_source_warehouse_id) THEN
        RAISE EXCEPTION 'Source warehouse does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_destination_warehouse_id) THEN
        RAISE EXCEPTION 'Destination warehouse does not exist.';
    END IF;

    v_transfer_num := 'TRF-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

    INSERT INTO public.stock_transfers (
        transfer_number,
        source_warehouse_id,
        destination_warehouse_id,
        status,
        carrier_name,
        vehicle_number,
        driver_name,
        driver_phone,
        dispatch_notes,
        created_by
    ) VALUES (
        v_transfer_num,
        p_source_warehouse_id,
        p_destination_warehouse_id,
        'draft',
        p_carrier_name,
        p_vehicle_number,
        p_driver_name,
        p_driver_phone,
        p_dispatch_notes,
        auth.uid()
    )
    RETURNING id INTO v_transfer_id;

    -- Audit log
    INSERT INTO public.stock_transfer_audit_logs (
        transfer_id, action_type, from_status, to_status, from_warehouse_id, to_warehouse_id, performed_by, notes
    ) VALUES (
        v_transfer_id, 'TRANSFER_CREATED', NULL, 'draft', p_source_warehouse_id, p_destination_warehouse_id, auth.uid(), 'Stock transfer draft created'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', v_transfer_id,
        'transfer_number', v_transfer_num,
        'status', 'draft'
    );
END;
$$;

-- 7. RPC: fn_scan_barcode_for_dispatch
CREATE OR REPLACE FUNCTION public.fn_scan_barcode_for_dispatch(
    p_transfer_id UUID,
    p_barcode_or_serial TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_trf public.stock_transfers%ROWTYPE;
    v_unit public.product_units%ROWTYPE;
    v_clean_code TEXT;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory staff can scan units for dispatch.';
    END IF;

    v_clean_code := trim(p_barcode_or_serial);
    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RAISE EXCEPTION 'Barcode or serial number cannot be empty.';
    END IF;

    -- Lock transfer header
    SELECT * INTO v_trf FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found.', p_transfer_id;
    END IF;

    IF v_trf.status NOT IN ('draft', 'prepared') THEN
        RAISE EXCEPTION 'Cannot add units to transfer with status % (must be draft or prepared).', v_trf.status;
    END IF;

    -- Find and lock product unit
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE barcode = v_clean_code OR serial_number = v_clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product unit with barcode/serial % not found.', v_clean_code;
    END IF;

    -- Verify source warehouse ownership
    IF v_unit.warehouse_id IS NULL OR v_unit.warehouse_id <> v_trf.source_warehouse_id THEN
        RAISE EXCEPTION 'Unit % does not belong to source warehouse (currently assigned to %)', v_clean_code, COALESCE(v_unit.warehouse_id::text, 'no warehouse');
    END IF;

    -- Verify unit is in_stock
    IF v_unit.status <> 'in_stock' THEN
        RAISE EXCEPTION 'Unit % is not in_stock (current status: %). Only in_stock units can be transferred.', v_clean_code, v_unit.status;
    END IF;

    -- Prevent duplicate scan in manifest
    IF EXISTS (SELECT 1 FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id AND product_unit_id = v_unit.id) THEN
        RAISE EXCEPTION 'Unit % is already scanned on this transfer manifest.', v_clean_code;
    END IF;

    -- Insert into manifest
    INSERT INTO public.stock_transfer_items (
        transfer_id,
        product_unit_id,
        barcode,
        serial_number,
        item_status,
        dispatched_at
    ) VALUES (
        p_transfer_id,
        v_unit.id,
        v_unit.barcode,
        v_unit.serial_number,
        'expected',
        now()
    );

    -- Update transfer header count
    UPDATE public.stock_transfers
    SET expected_unit_count = expected_unit_count + 1,
        status = 'prepared',
        prepared_by = COALESCE(prepared_by, auth.uid()),
        updated_at = now()
    WHERE id = p_transfer_id;

    -- Audit log
    INSERT INTO public.stock_transfer_audit_logs (
        transfer_id, product_unit_id, barcode, action_type, from_status, to_status, from_warehouse_id, to_warehouse_id, performed_by, notes
    ) VALUES (
        p_transfer_id, v_unit.id, v_unit.barcode, 'ITEM_DISPATCH_SCANNED', v_unit.status, 'prepared', v_trf.source_warehouse_id, v_trf.destination_warehouse_id, auth.uid(), 'Unit verified and added to manifest'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', p_transfer_id,
        'product_unit_id', v_unit.id,
        'barcode', v_unit.barcode,
        'serial_number', v_unit.serial_number,
        'expected_unit_count', v_trf.expected_unit_count + 1
    );
END;
$$;

-- 8. RPC: fn_dispatch_stock_transfer
CREATE OR REPLACE FUNCTION public.fn_dispatch_stock_transfer(
    p_transfer_id UUID,
    p_carrier_name TEXT DEFAULT NULL,
    p_vehicle_number TEXT DEFAULT NULL,
    p_dispatch_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_trf public.stock_transfers%ROWTYPE;
    v_item RECORD;
    v_count INT := 0;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory staff can authorize stock transfer dispatch.';
    END IF;

    SELECT * INTO v_trf FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found.', p_transfer_id;
    END IF;

    IF v_trf.status NOT IN ('draft', 'prepared') THEN
        RAISE EXCEPTION 'Cannot dispatch transfer in status %.', v_trf.status;
    END IF;

    -- Check items exist
    SELECT count(*) INTO v_count FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'Cannot dispatch transfer without any scanned items on manifest.';
    END IF;

    -- Transition all product units to in_transit
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id FOR UPDATE LOOP
        UPDATE public.product_units
        SET status = 'in_transit',
            updated_at = now()
        WHERE id = v_item.product_unit_id;

        UPDATE public.stock_transfer_items
        SET item_status = 'in_transit',
            dispatched_at = now(),
            updated_at = now()
        WHERE id = v_item.id;

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
            v_item.product_unit_id,
            'warehouse_transfer',
            'in_stock',
            'in_transit',
            v_trf.source_warehouse_id,
            v_trf.destination_warehouse_id,
            'Inter-depot transfer manifest dispatch (' || v_trf.transfer_number || ')',
            COALESCE(p_dispatch_notes, 'Dispatched via carrier ' || COALESCE(p_carrier_name, v_trf.carrier_name, 'ZUVO Fleet')),
            auth.uid()
        );
    END LOOP;

    -- Update header to in_transit
    UPDATE public.stock_transfers
    SET status = 'in_transit',
        dispatched_unit_count = v_count,
        carrier_name = COALESCE(p_carrier_name, carrier_name),
        vehicle_number = COALESCE(p_vehicle_number, vehicle_number),
        dispatch_notes = COALESCE(p_dispatch_notes, dispatch_notes),
        dispatched_by = auth.uid(),
        dispatched_at = now(),
        updated_at = now()
    WHERE id = p_transfer_id;

    -- Audit log
    INSERT INTO public.stock_transfer_audit_logs (
        transfer_id, action_type, from_status, to_status, from_warehouse_id, to_warehouse_id, performed_by, notes
    ) VALUES (
        p_transfer_id, 'TRANSFER_DISPATCHED', v_trf.status, 'in_transit', v_trf.source_warehouse_id, v_trf.destination_warehouse_id, auth.uid(), 'Manifest dispatched with ' || v_count || ' TV unit(s)'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', p_transfer_id,
        'status', 'in_transit',
        'dispatched_count', v_count
    );
END;
$$;

-- 9. RPC: fn_scan_barcode_for_receiving
CREATE OR REPLACE FUNCTION public.fn_scan_barcode_for_receiving(
    p_transfer_id UUID,
    p_barcode_or_serial TEXT,
    p_is_damaged BOOLEAN DEFAULT false,
    p_condition_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_trf public.stock_transfers%ROWTYPE;
    v_unit public.product_units%ROWTYPE;
    v_item public.stock_transfer_items%ROWTYPE;
    v_clean_code TEXT;
    v_is_unexpected BOOLEAN := false;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory', 'service') THEN
        RAISE EXCEPTION 'Unauthorized: Only authorized inventory staff can receive transfers.';
    END IF;

    v_clean_code := trim(p_barcode_or_serial);
    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RAISE EXCEPTION 'Barcode or serial number cannot be empty.';
    END IF;

    SELECT * INTO v_trf FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found.', p_transfer_id;
    END IF;

    IF v_trf.status NOT IN ('in_transit', 'partially_received') THEN
        RAISE EXCEPTION 'Cannot receive units for transfer with status % (must be in_transit).', v_trf.status;
    END IF;

    -- Find product unit
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE barcode = v_clean_code OR serial_number = v_clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product unit with barcode/serial % not found.', v_clean_code;
    END IF;

    -- Check if item is on the manifest
    SELECT * INTO v_item
    FROM public.stock_transfer_items
    WHERE transfer_id = p_transfer_id AND product_unit_id = v_unit.id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Unexpected unit scanned! Record as unexpected discrepancy item
        v_is_unexpected := true;
        INSERT INTO public.stock_transfer_items (
            transfer_id,
            product_unit_id,
            barcode,
            serial_number,
            item_status,
            received_at,
            is_damaged,
            condition_notes
        ) VALUES (
            p_transfer_id,
            v_unit.id,
            v_unit.barcode,
            v_unit.serial_number,
            'unexpected',
            now(),
            p_is_damaged,
            COALESCE(p_condition_notes, 'Unexpected unit scanned at receiving dock')
        );

        UPDATE public.stock_transfers
        SET unexpected_unit_count = unexpected_unit_count + 1,
            status = 'partially_received',
            updated_at = now()
        WHERE id = p_transfer_id;
    ELSE
        -- Prevent duplicate receiving scan
        IF v_item.item_status IN ('received', 'damaged') THEN
            RAISE EXCEPTION 'Unit % has already been received on this transfer.', v_clean_code;
        END IF;

        -- Update item status
        UPDATE public.stock_transfer_items
        SET item_status = CASE WHEN p_is_damaged THEN 'damaged' ELSE 'received' END,
            received_at = now(),
            is_damaged = p_is_damaged,
            condition_notes = p_condition_notes,
            updated_at = now()
        WHERE id = v_item.id;

        -- Update unit location & status
        UPDATE public.product_units
        SET warehouse_id = v_trf.destination_warehouse_id,
            status = CASE WHEN p_is_damaged THEN 'damaged' ELSE 'in_stock' END,
            updated_at = now()
        WHERE id = v_unit.id;

        -- Inventory transaction
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
            v_unit.id,
            'stock_received',
            v_unit.status,
            CASE WHEN p_is_damaged THEN 'damaged' ELSE 'in_stock' END,
            v_trf.source_warehouse_id,
            v_trf.destination_warehouse_id,
            'Received at destination hub (' || v_trf.transfer_number || ')',
            COALESCE(p_condition_notes, CASE WHEN p_is_damaged THEN 'Damaged during transit' ELSE 'Intake verified' END),
            auth.uid()
        );

        -- Update transfer header received counts
        UPDATE public.stock_transfers
        SET received_unit_count = received_unit_count + 1,
            damaged_unit_count = CASE WHEN p_is_damaged THEN damaged_unit_count + 1 ELSE damaged_unit_count END,
            status = 'partially_received',
            received_by = COALESCE(received_by, auth.uid()),
            received_at = COALESCE(received_at, now()),
            updated_at = now()
        WHERE id = p_transfer_id;
    END IF;

    -- Audit log
    INSERT INTO public.stock_transfer_audit_logs (
        transfer_id, product_unit_id, barcode, action_type, from_status, to_status, from_warehouse_id, to_warehouse_id, performed_by, notes
    ) VALUES (
        p_transfer_id, v_unit.id, v_unit.barcode,
        CASE WHEN v_is_unexpected THEN 'UNEXPECTED_ITEM_SCANNED' ELSE 'ITEM_RECEIVED' END,
        v_unit.status,
        CASE WHEN p_is_damaged THEN 'damaged' ELSE 'in_stock' END,
        v_trf.source_warehouse_id, v_trf.destination_warehouse_id, auth.uid(),
        COALESCE(p_condition_notes, 'Unit received at destination facility')
    );

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', p_transfer_id,
        'barcode', v_unit.barcode,
        'is_unexpected', v_is_unexpected,
        'is_damaged', p_is_damaged
    );
END;
$$;

-- 10. RPC: fn_reconcile_stock_transfer
CREATE OR REPLACE FUNCTION public.fn_reconcile_stock_transfer(
    p_transfer_id UUID,
    p_reconciliation_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_trf public.stock_transfers%ROWTYPE;
    v_total_expected INT := 0;
    v_total_received INT := 0;
    v_total_missing INT := 0;
    v_total_unexpected INT := 0;
    v_total_damaged INT := 0;
    v_final_status TEXT;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory staff and administrators can reconcile transfers.';
    END IF;

    SELECT * INTO v_trf FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found.', p_transfer_id;
    END IF;

    IF v_trf.status NOT IN ('in_transit', 'partially_received', 'received') THEN
        RAISE EXCEPTION 'Cannot reconcile transfer in status %.', v_trf.status;
    END IF;

    -- Mark any remaining in_transit/expected items on manifest as missing
    UPDATE public.stock_transfer_items
    SET item_status = 'missing',
        updated_at = now()
    WHERE transfer_id = p_transfer_id AND item_status IN ('expected', 'in_transit');

    -- Calculate final reconciliation totals
    SELECT
        COUNT(*) FILTER (WHERE item_status != 'unexpected'),
        COUNT(*) FILTER (WHERE item_status IN ('received', 'damaged')),
        COUNT(*) FILTER (WHERE item_status = 'missing'),
        COUNT(*) FILTER (WHERE item_status = 'unexpected'),
        COUNT(*) FILTER (WHERE is_damaged = true)
    INTO
        v_total_expected,
        v_total_received,
        v_total_missing,
        v_total_unexpected,
        v_total_damaged
    FROM public.stock_transfer_items
    WHERE transfer_id = p_transfer_id;

    IF v_total_missing > 0 OR v_total_unexpected > 0 OR v_total_damaged > 0 THEN
        v_final_status := 'discrepancy';
    ELSE
        v_final_status := 'reconciled';
    END IF;

    UPDATE public.stock_transfers
    SET status = v_final_status,
        expected_unit_count = v_total_expected,
        received_unit_count = v_total_received,
        missing_unit_count = v_total_missing,
        unexpected_unit_count = v_total_unexpected,
        damaged_unit_count = v_total_damaged,
        discrepancy_notes = CASE WHEN v_final_status = 'discrepancy' THEN COALESCE(p_reconciliation_notes, 'Reconciliation finished with discrepancies') ELSE discrepancy_notes END,
        reconciled_by = auth.uid(),
        reconciled_at = now(),
        updated_at = now()
    WHERE id = p_transfer_id;

    -- Audit log
    INSERT INTO public.stock_transfer_audit_logs (
        transfer_id, action_type, from_status, to_status, from_warehouse_id, to_warehouse_id, performed_by, notes
    ) VALUES (
        p_transfer_id, 'TRANSFER_RECONCILED', v_trf.status, v_final_status, v_trf.source_warehouse_id, v_trf.destination_warehouse_id, auth.uid(),
        'Reconciled: Exp=' || v_total_expected || ', Rec=' || v_total_received || ', Miss=' || v_total_missing || ', Unexp=' || v_total_unexpected || ', Dam=' || v_total_damaged
    );

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', p_transfer_id,
        'final_status', v_final_status,
        'expected', v_total_expected,
        'received', v_total_received,
        'missing', v_total_missing,
        'unexpected', v_total_unexpected,
        'damaged', v_total_damaged
    );
END;
$$;

-- 11. Revoke and Grant Permissions on RPCs
REVOKE EXECUTE ON FUNCTION public.fn_create_stock_transfer FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_scan_barcode_for_dispatch FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_dispatch_stock_transfer FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_scan_barcode_for_receiving FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_reconcile_stock_transfer FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_create_stock_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_scan_barcode_for_dispatch TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_stock_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_scan_barcode_for_receiving TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_stock_transfer TO authenticated;
