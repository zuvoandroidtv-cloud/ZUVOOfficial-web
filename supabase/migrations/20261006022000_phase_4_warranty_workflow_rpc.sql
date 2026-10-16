-- ============================================================================
-- Migration: 20261006022000_phase_4_warranty_workflow_rpc.sql
-- Description: Phase 4.6 Customer Warranty Flow - Verification & Registration RPCs
-- Security: SECURITY DEFINER with pinned search_path = public
-- ============================================================================

-- Function 1: Verify barcode status for customer or agent warranty flow
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

    -- 1. Locate product unit
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE barcode = v_clean_barcode
    LIMIT 1;

    IF NOT FOUND THEN
        -- Log attempt
        INSERT INTO public.warranty_registration_logs (
            barcode,
            registration_method,
            result,
            message
        ) VALUES (
            v_clean_barcode,
            'barcode_scan',
            'invalid_barcode',
            'Barcode not found in ZUVO database'
        );

        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'not_found',
            'message', 'Television barcode was not found in the verified ZUVO inventory registry.'
        );
    END IF;

    -- 2. Fetch variant information
    SELECT * INTO v_variant
    FROM public.product_variants
    WHERE id = v_unit.variant_id;

    -- 3. Check if warranty already registered
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

    -- 4. Verify sold status
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
                'product_name', v_variant.product_name,
                'barcode', v_unit.barcode,
                'status', v_unit.status
            )
        );
    END IF;

    -- 5. Find related sale
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
            'customer_name', v_customer.full_name,
            'customer_phone', v_customer.phone
        )
    );
END;
$$;

-- Function 2: Complete customer warranty registration
CREATE OR REPLACE FUNCTION public.register_customer_warranty(
    p_barcode text,
    p_customer_name text,
    p_customer_phone text,
    p_customer_email text DEFAULT NULL,
    p_customer_address text DEFAULT NULL,
    p_registration_method text DEFAULT 'barcode_scan'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_barcode text;
    v_unit record;
    v_variant record;
    v_existing_warranty record;
    v_sale record;
    v_customer_id uuid;
    v_warranty_number text;
    v_new_warranty record;
BEGIN
    v_clean_barcode := trim(p_barcode);

    -- 1. Validate barcode
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE barcode = v_clean_barcode
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Television unit with barcode ' || v_clean_barcode || ' not found.'
        );
    END IF;

    -- 2. Verify sold
    IF v_unit.status != 'sold' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Television unit has not been marked as sold. Cannot activate warranty.'
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

    -- 4. Find sale
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
        -- Update contact details if provided
        UPDATE public.customers
        SET full_name = COALESCE(NULLIF(trim(p_customer_name), ''), full_name),
            phone = COALESCE(NULLIF(trim(p_customer_phone), ''), phone),
            email = COALESCE(NULLIF(trim(p_customer_email), ''), email),
            address_line1 = COALESCE(NULLIF(trim(p_customer_address), ''), address_line1)
        WHERE id = v_customer_id;
    ELSE
        -- Create customer record
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

    -- 7. Insert warranty with start date = CURRENT_DATE, 12 months period
    -- Trigger trg_warranty_calculate_end_date will automatically calculate warranty_end_date!
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
        CURRENT_DATE + interval '12 months' - interval '1 day',
        12,
        COALESCE(p_registration_method, 'barcode_scan'),
        'active',
        CURRENT_TIMESTAMP
    ) RETURNING * INTO v_new_warranty;

    -- 8. Insert log
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
        v_clean_barcode,
        COALESCE(p_registration_method, 'barcode_scan'),
        'success',
        'Warranty policy ' || v_warranty_number || ' registered successfully'
    );

    -- 9. Fetch product name for response
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

-- Grant permissions to public anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.verify_tv_barcode_for_warranty(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_warranty(text, text, text, text, text, text) TO anon, authenticated;
