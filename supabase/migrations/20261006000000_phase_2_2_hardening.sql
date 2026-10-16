-- ====================================================================
-- ZUVO CRM — Phase 2.2 Database Hardening Migration
-- Project: axpryvuknepqeflymzlv (ZUVO Android TV)
-- Generated: 2026-10-06
-- ====================================================================

-- --------------------------------------------------------------------
-- TASK 1: AUTH USER -> PROFILE PROVISIONING TRIGGER
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role_id uuid;
    assigned_role_name text;
    assigned_role_id uuid;
    user_full_name text;
    user_phone text;
BEGIN
    -- Safest default role is 'support' (least privileged CRM role)
    SELECT id INTO default_role_id
    FROM public.roles
    WHERE name = 'support'
    LIMIT 1;

    -- Check for administrative / trusted role assignment in app_metadata
    -- (Never trust user_metadata for elevated privileges)
    assigned_role_name := NULLIF(TRIM(NEW.raw_app_meta_data->>'role'), '');
    
    -- If no app_metadata role is specified, check if explicitly passed in user_metadata
    -- ONLY allow non-administrative / safest roles if coming from client metadata
    IF assigned_role_name IS NULL THEN
        assigned_role_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), '');
        -- Prevent unauthenticated users from self-selecting privileged roles
        IF assigned_role_name IN ('super_admin', 'admin', 'inventory', 'service', 'sales') THEN
            assigned_role_name := 'support';
        END IF;
    END IF;

    -- Resolve the assigned role ID if valid, otherwise fallback to default
    IF assigned_role_name IS NOT NULL THEN
        SELECT id INTO assigned_role_id
        FROM public.roles
        WHERE name = assigned_role_name;
    END IF;

    IF assigned_role_id IS NULL THEN
        assigned_role_id := default_role_id;
    END IF;

    -- Extract name and phone safely
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    user_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');

    -- Insert into profiles (idempotent, prevents duplicates)
    INSERT INTO public.profiles (
        id,
        role_id,
        full_name,
        phone,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        assigned_role_id,
        user_full_name,
        user_phone,
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------
-- TASK 2: PROFILE updated_at TRIGGER
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- TASK 3: FUNCTION SEARCH PATH HARDENING
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.name
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_warranty_end_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.warranty_start_date IS NOT NULL
       AND NEW.warranty_period_months IS NOT NULL THEN
        NEW.warranty_end_date = (
            NEW.warranty_start_date
            + make_interval(months => NEW.warranty_period_months)
            - interval '1 day'
        )::date;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_warranty_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.warranty_start_date IS NOT NULL
       AND NEW.warranty_end_date IS NOT NULL
       AND NEW.warranty_end_date < NEW.warranty_start_date THEN
        RAISE EXCEPTION 'Warranty end date cannot be before warranty start date';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_inventory_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.record_service_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.service_updates (
            service_ticket_id,
            previous_status,
            new_status,
            update_type,
            description,
            created_by
        )
        VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            'status_change',
            'Automatic service ticket status change',
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_unit_from_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_sale_status text;
BEGIN
    SELECT sale_status INTO current_sale_status
    FROM public.sales
    WHERE id = NEW.sale_id;

    IF current_sale_status = 'completed' THEN
        UPDATE public.product_units
        SET
            status = 'sold',
            sold_at = COALESCE(sold_at, now())
        WHERE id = NEW.product_unit_id
          AND status <> 'sold';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_units_from_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.sale_status = 'completed'
       AND OLD.sale_status IS DISTINCT FROM NEW.sale_status THEN
        UPDATE public.product_units pu
        SET
            status = 'sold',
            sold_at = COALESCE(pu.sold_at, now())
        WHERE pu.id IN (
            SELECT si.product_unit_id
            FROM public.sale_items si
            WHERE si.sale_id = NEW.id
        )
        AND pu.status <> 'sold';
    END IF;

    IF NEW.sale_status = 'returned'
       AND OLD.sale_status IS DISTINCT FROM NEW.sale_status THEN
        UPDATE public.product_units pu
        SET status = 'returned'
        WHERE pu.id IN (
            SELECT si.product_unit_id
            FROM public.sale_items si
            WHERE si.sale_id = NEW.id
        )
        AND pu.status <> 'returned';
    END IF;

    IF NEW.sale_status = 'cancelled'
       AND OLD.sale_status IS DISTINCT FROM NEW.sale_status THEN
        UPDATE public.product_units pu
        SET
            status = 'in_stock',
            sold_at = NULL
        WHERE pu.id IN (
            SELECT si.product_unit_id
            FROM public.sale_items si
            WHERE si.sale_id = NEW.id
        )
        AND pu.status <> 'in_stock';
    END IF;

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- TASK 4: RECREATE REPORTING VIEWS WITH (security_invoker = true)
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW public.crm_overview WITH (security_invoker = true) AS
SELECT
    (SELECT count(*) FROM public.product_units) AS total_product_units,
    (SELECT count(*) FROM public.product_units WHERE status = 'in_stock') AS products_in_stock,
    (SELECT count(*) FROM public.product_units WHERE status = 'reserved') AS products_reserved,
    (SELECT count(*) FROM public.product_units WHERE status = 'sold') AS products_sold,
    (SELECT count(*) FROM public.product_units WHERE status = 'returned') AS products_returned,
    (SELECT count(*) FROM public.product_units WHERE status = 'in_service') AS products_in_service,
    (SELECT count(*) FROM public.product_units WHERE status = 'damaged') AS products_damaged,
    (SELECT count(*) FROM public.customers) AS total_customers,
    (SELECT count(*) FROM public.sales) AS total_sales,
    (SELECT count(*) FROM public.sales WHERE sale_status = 'completed') AS completed_sales,
    (SELECT COALESCE(sum(total_amount), 0::numeric) FROM public.sales WHERE sale_status = 'completed') AS completed_sales_amount,
    (SELECT count(*) FROM public.warranties) AS total_warranties,
    (SELECT count(*) FROM public.warranties WHERE status = 'active') AS active_warranties,
    (SELECT count(*) FROM public.service_tickets) AS total_service_tickets,
    (SELECT count(*) FROM public.service_tickets WHERE status <> ALL (ARRAY['closed'::text, 'cancelled'::text])) AS open_service_tickets;

CREATE OR REPLACE VIEW public.inventory_summary WITH (security_invoker = true) AS
SELECT status, count(*) AS unit_count
FROM public.product_units
GROUP BY status
ORDER BY status;

CREATE OR REPLACE VIEW public.inventory_by_product_variant WITH (security_invoker = true) AS
SELECT
    pv.id AS variant_id,
    b.name AS brand_name,
    pm.model_name,
    pv.product_name,
    pv.screen_size,
    pv.tv_type,
    pv.bluetooth,
    pv.voice_remote,
    pv.product_code,
    pu.status,
    count(*) AS unit_count
FROM public.product_units pu
JOIN public.product_variants pv ON pv.id = pu.variant_id
JOIN public.product_models pm ON pm.id = pv.model_id
JOIN public.brands b ON b.id = pm.brand_id
GROUP BY pv.id, b.name, pm.model_name, pv.product_name, pv.screen_size, pv.tv_type, pv.bluetooth, pv.voice_remote, pv.product_code, pu.status
ORDER BY pv.product_name, pu.status;

CREATE OR REPLACE VIEW public.sales_by_product_variant WITH (security_invoker = true) AS
SELECT
    pv.id AS variant_id,
    b.name AS brand_name,
    pm.model_name,
    pv.product_name,
    pv.screen_size,
    pv.tv_type,
    pv.bluetooth,
    pv.voice_remote,
    pv.product_code,
    count(si.id) AS units_sold,
    COALESCE(sum(si.unit_price), 0::numeric) AS gross_sales,
    COALESCE(sum(si.discount_amount), 0::numeric) AS total_discount,
    COALESCE(sum(si.unit_price - si.discount_amount), 0::numeric) AS net_sales
FROM public.sale_items si
JOIN public.product_units pu ON pu.id = si.product_unit_id
JOIN public.product_variants pv ON pv.id = pu.variant_id
JOIN public.product_models pm ON pm.id = pv.model_id
JOIN public.brands b ON b.id = pm.brand_id
JOIN public.sales s ON s.id = si.sale_id
WHERE s.sale_status = 'completed'
GROUP BY pv.id, b.name, pm.model_name, pv.product_name, pv.screen_size, pv.tv_type, pv.bluetooth, pv.voice_remote, pv.product_code
ORDER BY count(si.id) DESC;

CREATE OR REPLACE VIEW public.sales_summary_by_date WITH (security_invoker = true) AS
SELECT
    date(s.sale_date) AS sale_date,
    count(DISTINCT s.id) AS sales_count,
    count(si.id) AS units_sold,
    COALESCE(sum(si.unit_price), 0::numeric) AS gross_sales,
    COALESCE(sum(si.discount_amount), 0::numeric) AS total_discount,
    COALESCE(sum(si.unit_price - si.discount_amount), 0::numeric) AS net_sales
FROM public.sales s
LEFT JOIN public.sale_items si ON si.sale_id = s.id
WHERE s.sale_status = 'completed'
GROUP BY date(s.sale_date)
ORDER BY date(s.sale_date) DESC;

CREATE OR REPLACE VIEW public.warranty_summary WITH (security_invoker = true) AS
SELECT status, count(*) AS warranty_count
FROM public.warranties
GROUP BY status
ORDER BY status;

CREATE OR REPLACE VIEW public.warranty_expiration_report WITH (security_invoker = true) AS
SELECT
    w.id AS warranty_id,
    w.warranty_number,
    w.product_unit_id,
    pu.serial_number,
    pu.barcode,
    w.customer_id,
    c.customer_code,
    c.full_name AS customer_name,
    c.phone AS customer_phone,
    w.sale_id,
    w.registration_method,
    w.warranty_start_date,
    w.warranty_period_months,
    w.warranty_end_date,
    w.status,
    CASE
        WHEN w.warranty_end_date < CURRENT_DATE THEN 'expired'
        WHEN w.warranty_end_date <= (CURRENT_DATE + 30) THEN 'expires_within_30_days'
        WHEN w.warranty_end_date <= (CURRENT_DATE + 90) THEN 'expires_within_90_days'
        ELSE 'active'
    END AS expiration_category
FROM public.warranties w
LEFT JOIN public.product_units pu ON pu.id = w.product_unit_id
LEFT JOIN public.customers c ON c.id = w.customer_id
ORDER BY w.warranty_end_date;

CREATE OR REPLACE VIEW public.warranty_registration_summary WITH (security_invoker = true) AS
SELECT registration_method, count(*) AS registration_count
FROM public.warranties
GROUP BY registration_method
ORDER BY count(*) DESC;

CREATE OR REPLACE VIEW public.service_ticket_summary WITH (security_invoker = true) AS
SELECT status, count(*) AS ticket_count
FROM public.service_tickets
GROUP BY status
ORDER BY status;

CREATE OR REPLACE VIEW public.service_ticket_priority_summary WITH (security_invoker = true) AS
SELECT priority, count(*) AS ticket_count
FROM public.service_tickets
GROUP BY priority
ORDER BY (
    CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
    END
);

CREATE OR REPLACE VIEW public.service_ticket_type_summary WITH (security_invoker = true) AS
SELECT service_type, count(*) AS ticket_count
FROM public.service_tickets
GROUP BY service_type
ORDER BY count(*) DESC;

CREATE OR REPLACE VIEW public.service_cost_summary WITH (security_invoker = true) AS
SELECT
    cost_type,
    count(*) AS cost_entry_count,
    COALESCE(sum(amount), 0::numeric) AS total_cost,
    COALESCE(sum(CASE WHEN warranty_covered = true THEN amount ELSE 0::numeric END), 0::numeric) AS warranty_covered_cost,
    COALESCE(sum(CASE WHEN warranty_covered = false THEN amount ELSE 0::numeric END), 0::numeric) AS customer_payable_cost
FROM public.service_costs
GROUP BY cost_type
ORDER BY COALESCE(sum(amount), 0::numeric) DESC;

CREATE OR REPLACE VIEW public.service_parts_summary WITH (security_invoker = true) AS
SELECT
    part_code,
    part_name,
    count(*) AS usage_count,
    COALESCE(sum(quantity), 0::bigint) AS total_quantity,
    COALESCE(sum(quantity::numeric * unit_cost), 0::numeric) AS total_part_cost,
    COALESCE(sum(CASE WHEN warranty_covered = true THEN quantity::numeric * unit_cost ELSE 0::numeric END), 0::numeric) AS warranty_covered_part_cost
FROM public.service_parts
GROUP BY part_code, part_name
ORDER BY COALESCE(sum(quantity), 0::bigint) DESC;

CREATE OR REPLACE VIEW public.service_ticket_cost_detail WITH (security_invoker = true) AS
SELECT
    st.id AS service_ticket_id,
    st.ticket_number,
    st.customer_id,
    c.customer_code,
    c.full_name AS customer_name,
    st.product_unit_id,
    pu.serial_number,
    pu.barcode,
    st.service_type,
    st.priority,
    st.status,
    COALESCE(sum(sc.amount), 0::numeric) AS total_service_cost,
    COALESCE(sum(CASE WHEN sc.warranty_covered = true THEN sc.amount ELSE 0::numeric END), 0::numeric) AS warranty_covered_cost,
    COALESCE(sum(CASE WHEN sc.warranty_covered = false THEN sc.amount ELSE 0::numeric END), 0::numeric) AS customer_payable_cost
FROM public.service_tickets st
LEFT JOIN public.customers c ON c.id = st.customer_id
LEFT JOIN public.product_units pu ON pu.id = st.product_unit_id
LEFT JOIN public.service_costs sc ON sc.service_ticket_id = st.id
GROUP BY st.id, st.ticket_number, st.customer_id, c.customer_code, c.full_name, st.product_unit_id, pu.serial_number, pu.barcode, st.service_type, st.priority, st.status
ORDER BY st.created_at DESC;

-- --------------------------------------------------------------------
-- TASK 5: FOREIGN KEY INDEXES (CREATE IF NOT EXISTS)
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_product_models_brand_id ON public.product_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_model_id ON public.product_variants(model_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_by ON public.sales(sold_by);
CREATE INDEX IF NOT EXISTS idx_warranties_registered_by ON public.warranties(registered_by);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_performed_by ON public.inventory_transactions(performed_by);
CREATE INDEX IF NOT EXISTS idx_service_diagnosis_diagnosed_by ON public.service_diagnosis(diagnosed_by);
CREATE INDEX IF NOT EXISTS idx_service_updates_created_by ON public.service_updates(created_by);

-- --------------------------------------------------------------------
-- TASK 6: REMOVE DUPLICATE DEAD FUNCTION
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.mark_product_unit_sold_from_sale();

-- --------------------------------------------------------------------
-- TASK 8: SECURITY DEFINER EXECUTE PRIVILEGES RESTRICTION
-- --------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.record_inventory_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_service_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_unit_from_sale_item() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_units_from_sale() FROM PUBLIC, anon, authenticated;

-- Ensure get_current_user_role() remains executable for authenticated users (required for RLS)
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
