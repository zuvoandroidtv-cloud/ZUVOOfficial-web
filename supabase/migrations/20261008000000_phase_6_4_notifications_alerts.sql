-- ============================================================================
-- PHASE 6.4 MIGRATION: Notifications, Alerts & Communication Foundation
-- File: supabase/migrations/20261008000000_phase_6_4_notifications_alerts.sql
-- ============================================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    entity_type TEXT,
    entity_id UUID,
    action_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_notifications_severity CHECK (severity IN ('info', 'success', 'warning', 'critical')),
    CONSTRAINT chk_notifications_type CHECK (notification_type IN (
        'sale_created', 'sale_completed', 'payment_received',
        'inventory_low', 'inventory_transfer',
        'warranty_registered', 'warranty_expiring',
        'service_created', 'service_updated', 'service_completed',
        'spare_part_low_stock', 'rma_created', 'system_alert'
    ))
);

-- 2. NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    sms_enabled BOOLEAN NOT NULL DEFAULT false,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    sales_enabled BOOLEAN NOT NULL DEFAULT true,
    inventory_enabled BOOLEAN NOT NULL DEFAULT true,
    warranty_enabled BOOLEAN NOT NULL DEFAULT true,
    service_enabled BOOLEAN NOT NULL DEFAULT true,
    spare_parts_enabled BOOLEAN NOT NULL DEFAULT true,
    rma_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications RLS Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (
        recipient_user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.profiles p 
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can update read status of their own notifications" ON public.notifications;
CREATE POLICY "Users can update read status of their own notifications"
    ON public.notifications FOR UPDATE
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());

-- Preferences RLS Policies
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own notification preferences"
    ON public.notification_preferences FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own notification preferences"
    ON public.notification_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own notification preferences"
    ON public.notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 5. SECURE RPC & DEFINER FUNCTIONS

-- Function to safely create a notification checking recipient preferences
CREATE OR REPLACE FUNCTION public.create_notification(
    p_recipient_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_notification_type TEXT,
    p_severity TEXT DEFAULT 'info',
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pref RECORD;
    v_allowed BOOLEAN := true;
    v_notification_id UUID;
BEGIN
    SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_recipient_user_id;
    IF FOUND THEN
        IF v_pref.in_app_enabled = false THEN
            RETURN NULL;
        END IF;
        
        IF p_notification_type IN ('sale_created', 'sale_completed', 'payment_received') AND v_pref.sales_enabled = false THEN
            v_allowed := false;
        ELSIF p_notification_type IN ('inventory_low', 'inventory_transfer') AND v_pref.inventory_enabled = false THEN
            v_allowed := false;
        ELSIF p_notification_type IN ('warranty_registered', 'warranty_expiring') AND v_pref.warranty_enabled = false THEN
            v_allowed := false;
        ELSIF p_notification_type IN ('service_created', 'service_updated', 'service_completed') AND v_pref.service_enabled = false THEN
            v_allowed := false;
        ELSIF p_notification_type = 'spare_part_low_stock' AND v_pref.spare_parts_enabled = false THEN
            v_allowed := false;
        ELSIF p_notification_type = 'rma_created' AND v_pref.rma_enabled = false THEN
            v_allowed := false;
        END IF;
    END IF;

    IF NOT v_allowed THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.notifications (
        recipient_user_id, title, message, notification_type, severity,
        entity_type, entity_id, action_url
    ) VALUES (
        p_recipient_user_id, p_title, p_message, p_notification_type, p_severity,
        p_entity_type, p_entity_id, p_action_url
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

-- Function to dispatch notification to users by CRM roles
CREATE OR REPLACE FUNCTION public.create_role_notifications(
    p_roles TEXT[],
    p_title TEXT,
    p_message TEXT,
    p_notification_type TEXT,
    p_severity TEXT DEFAULT 'info',
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_user RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR r_user IN 
        SELECT DISTINCT p.id AS user_id
        FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE r.name = ANY(p_roles)
          AND p.is_active = true
    LOOP
        PERFORM public.create_notification(
            r_user.user_id,
            p_title,
            p_message,
            p_notification_type,
            p_severity,
            p_entity_type,
            p_entity_id,
            p_action_url
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- RPC to mark single notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true, read_at = now()
    WHERE id = p_notification_id AND recipient_user_id = auth.uid();
    RETURN FOUND;
END;
$$;

-- RPC to mark all notifications for current user as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    WITH updated AS (
        UPDATE public.notifications
        SET is_read = true, read_at = now()
        WHERE recipient_user_id = auth.uid() AND is_read = false
        RETURNING id
    )
    SELECT count(*)::int INTO v_updated_count FROM updated;
    RETURN v_updated_count;
END;
$$;

-- RPC to get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*)::int INTO v_count
    FROM public.notifications
    WHERE recipient_user_id = auth.uid() AND is_read = false;
    RETURN v_count;
END;
$$;

-- Function to fetch or initialize notification preferences
CREATE OR REPLACE FUNCTION public.get_or_create_notification_preferences(p_user_id UUID DEFAULT auth.uid())
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result public.notification_preferences;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID required';
    END IF;

    SELECT * INTO v_result FROM public.notification_preferences WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        INSERT INTO public.notification_preferences (user_id)
        VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING * INTO v_result;
        
        IF v_result.id IS NULL THEN
            SELECT * INTO v_result FROM public.notification_preferences WHERE user_id = p_user_id;
        END IF;
    END IF;

    RETURN v_result;
END;
$$;

-- 6. EVENT TRIGGERS FOR AUTOMATIC NOTIFICATION GENERATION

-- Trigger 1: Sales Created
CREATE OR REPLACE FUNCTION public.trg_notify_sale_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.create_role_notifications(
        ARRAY['sales', 'admin', 'super_admin'],
        'New Sale Order Created',
        'Sale order #' || COALESCE(NEW.sale_number, substring(NEW.id::text, 1, 8)) || ' has been placed.',
        'sale_created', 'info', 'sale', NEW.id, '/sales'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_created_notify ON public.sales;
CREATE TRIGGER trg_sale_created_notify
    AFTER INSERT ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_sale_created();

-- Trigger 2: Payment Received
CREATE OR REPLACE FUNCTION public.trg_notify_payment_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.create_role_notifications(
        ARRAY['sales', 'admin', 'super_admin'],
        'Payment Received',
        'Payment of ₹' || NEW.amount::text || ' received via ' || NEW.payment_method || '.',
        'payment_received', 'success', 'payment', NEW.id, '/sales'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_received_notify ON public.payments;
CREATE TRIGGER trg_payment_received_notify
    AFTER INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_payment_received();

-- Trigger 3: Inventory Transaction Recorded
CREATE OR REPLACE FUNCTION public.trg_notify_inventory_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.transaction_type IN ('transfer_in', 'transfer_out', 'transfer') THEN
        PERFORM public.create_role_notifications(
            ARRAY['inventory', 'admin', 'super_admin'],
            'Warehouse Transfer Recorded',
            'Stock transaction (' || NEW.transaction_type || ') recorded for unit ID ' || substring(NEW.product_unit_id::text, 1, 8) || '.',
            'inventory_transfer', 'info', 'inventory_transaction', NEW.id, '/inventory'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_transaction_notify ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_transaction_notify
    AFTER INSERT ON public.inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_inventory_transaction();

-- Trigger 4: Warranty Registered
CREATE OR REPLACE FUNCTION public.trg_notify_warranty_registered()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.create_role_notifications(
        ARRAY['support', 'service', 'admin', 'super_admin'],
        'New Warranty Registered',
        'Warranty registered for unit ID ' || substring(NEW.product_unit_id::text, 1, 8) || '.',
        'warranty_registered', 'success', 'warranty', NEW.id, '/warranty'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warranty_registered_notify ON public.warranties;
CREATE TRIGGER trg_warranty_registered_notify
    AFTER INSERT ON public.warranties
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_warranty_registered();

-- Trigger 5: Service Ticket Created
CREATE OR REPLACE FUNCTION public.trg_notify_service_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.create_role_notifications(
        ARRAY['service', 'support', 'admin', 'super_admin'],
        'New Service Ticket Created',
        'Ticket #' || COALESCE(NEW.ticket_number, substring(NEW.id::text, 1, 8)) || ' created with priority ' || UPPER(COALESCE(NEW.priority, 'medium')) || '.',
        'service_created',
        CASE WHEN NEW.priority = 'critical' THEN 'critical' ELSE 'info' END,
        'service_ticket', NEW.id, '/service'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_created_notify ON public.service_tickets;
CREATE TRIGGER trg_service_created_notify
    AFTER INSERT ON public.service_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_service_created();

-- Trigger 6: RMA Return Created
CREATE OR REPLACE FUNCTION public.trg_notify_rma_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.create_role_notifications(
        ARRAY['sales', 'inventory', 'support', 'admin', 'super_admin'],
        'RMA Return Initiated',
        'Return #' || COALESCE(NEW.return_number, substring(NEW.id::text, 1, 8)) || ' filed.',
        'rma_created', 'warning', 'sales_return', NEW.id, '/sales'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rma_created_notify ON public.sales_returns;
CREATE TRIGGER trg_rma_created_notify
    AFTER INSERT ON public.sales_returns
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_rma_created();

-- 7. AUTOMATED PERIODIC/SUMMARY ALERTS GENERATOR (Low Stock & Expiring Warranty with Deduplication)
CREATE OR REPLACE FUNCTION public.generate_automated_alerts()
RETURNS TABLE (
    low_spare_parts_alerts INTEGER,
    expiring_warranties_alerts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_spare RECORD;
    r_warranty RECORD;
    v_spare_count INTEGER := 0;
    v_warranty_count INTEGER := 0;
    v_exists BOOLEAN;
BEGIN
    -- 1. Check Spare Parts Low Stock
    FOR r_spare IN
        SELECT spi.id, sp.part_name, spi.quantity_on_hand, COALESCE(spi.reorder_level, sp.reorder_level, 5) AS reorder_level
        FROM public.spare_part_inventory spi
        JOIN public.spare_parts sp ON spi.spare_part_id = sp.id
        WHERE spi.quantity_on_hand <= COALESCE(spi.reorder_level, sp.reorder_level, 5)
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE entity_type = 'spare_part_inventory'
              AND entity_id = r_spare.id
              AND notification_type = 'spare_part_low_stock'
              AND created_at > (now() - interval '24 hours')
        ) INTO v_exists;

        IF NOT v_exists THEN
            PERFORM public.create_role_notifications(
                ARRAY['inventory', 'admin', 'super_admin'],
                'Low Stock Alert: ' || r_spare.part_name,
                'Spare part "' || r_spare.part_name || '" stock is ' || r_spare.quantity_on_hand::text || ' (Reorder level: ' || r_spare.reorder_level::text || ').',
                'spare_part_low_stock',
                'warning',
                'spare_part_inventory',
                r_spare.id,
                '/spare-parts'
            );
            v_spare_count := v_spare_count + 1;
        END IF;
    END LOOP;

    -- 2. Check Warranties Expiring within 30 Days
    FOR r_warranty IN
        SELECT w.id, w.warranty_end_date, w.status
        FROM public.warranties w
        WHERE w.status = 'active'
          AND w.warranty_end_date BETWEEN now() AND (now() + interval '30 days')
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE entity_type = 'warranty'
              AND entity_id = r_warranty.id
              AND notification_type = 'warranty_expiring'
              AND created_at > (now() - interval '7 days')
        ) INTO v_exists;

        IF NOT v_exists THEN
            PERFORM public.create_role_notifications(
                ARRAY['support', 'service', 'admin', 'super_admin'],
                'Warranty Expiring Soon',
                'Warranty #' || substring(r_warranty.id::text, 1, 8) || ' will expire on ' || to_char(r_warranty.warranty_end_date, 'YYYY-MM-DD') || '.',
                'warranty_expiring',
                'warning',
                'warranty',
                r_warranty.id,
                '/warranty'
            );
            v_warranty_count := v_warranty_count + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_spare_count, v_warranty_count;
END;
$$;
