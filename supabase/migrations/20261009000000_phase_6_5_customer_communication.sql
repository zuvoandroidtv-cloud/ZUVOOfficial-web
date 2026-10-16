-- ============================================================================
-- PHASE 6.5 MIGRATION: Customer Communication, Messaging & Delivery Foundation
-- File: supabase/migrations/20261009000000_phase_6_5_customer_communication.sql
-- ============================================================================

-- 1. COMMUNICATION TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL,
    template_name TEXT NOT NULL,
    channel TEXT NOT NULL,
    event_type TEXT NOT NULL,
    subject TEXT,
    message_body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_comm_template_channel CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp')),
    CONSTRAINT uq_comm_template_key_channel UNIQUE (template_key, channel)
);

-- 2. CUSTOMER COMMUNICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.customer_communication_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID UNIQUE NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    sms_enabled BOOLEAN NOT NULL DEFAULT true,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    service_updates_enabled BOOLEAN NOT NULL DEFAULT true,
    warranty_updates_enabled BOOLEAN NOT NULL DEFAULT true,
    invoice_updates_enabled BOOLEAN NOT NULL DEFAULT true,
    rma_updates_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. COMMUNICATION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    product_unit_id UUID REFERENCES public.product_units(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    warranty_id UUID REFERENCES public.warranties(id) ON DELETE SET NULL,
    service_ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE SET NULL,
    sales_return_id UUID REFERENCES public.sales_returns(id) ON DELETE SET NULL,
    channel TEXT NOT NULL,
    message_type TEXT NOT NULL,
    template_id UUID REFERENCES public.communication_templates(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    message_body TEXT NOT NULL,
    provider_name TEXT DEFAULT NULL,
    provider_message_id TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    failure_reason TEXT DEFAULT NULL,
    sent_at TIMESTAMPTZ DEFAULT NULL,
    delivered_at TIMESTAMPTZ DEFAULT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_comm_log_channel CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp')),
    CONSTRAINT chk_comm_log_status CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled', 'not_configured'))
);

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_comm_logs_customer ON public.communication_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_channel ON public.communication_logs(channel);
CREATE INDEX IF NOT EXISTS idx_comm_logs_status ON public.communication_logs(status);
CREATE INDEX IF NOT EXISTS idx_comm_logs_created_at ON public.communication_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_logs_unit ON public.communication_logs(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_sale ON public.communication_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_warranty ON public.communication_logs(warranty_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_service ON public.communication_logs(service_ticket_id);
CREATE INDEX IF NOT EXISTS idx_comm_templates_key_channel ON public.communication_templates(template_key, channel);
CREATE INDEX IF NOT EXISTS idx_cust_comm_pref_customer ON public.customer_communication_preferences(customer_id);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- Templates RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view communication templates" ON public.communication_templates;
CREATE POLICY "Authenticated users can view communication templates"
    ON public.communication_templates FOR SELECT
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert or update communication templates" ON public.communication_templates;
CREATE POLICY "Admins can insert or update communication templates"
    ON public.communication_templates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- Customer Preferences RLS Policies
DROP POLICY IF EXISTS "Authenticated staff can view customer preferences" ON public.customer_communication_preferences;
CREATE POLICY "Authenticated staff can view customer preferences"
    ON public.customer_communication_preferences FOR SELECT
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated staff can manage customer preferences" ON public.customer_communication_preferences;
CREATE POLICY "Authenticated staff can manage customer preferences"
    ON public.customer_communication_preferences FOR ALL
    USING (auth.uid() IS NOT NULL);

-- Communication Logs RLS Policies
DROP POLICY IF EXISTS "Authorized CRM roles can view communication logs" ON public.communication_logs;
CREATE POLICY "Authorized CRM roles can view communication logs"
    ON public.communication_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales', 'service', 'support')
        )
    );

DROP POLICY IF EXISTS "Authorized CRM roles can insert communication logs" ON public.communication_logs;
CREATE POLICY "Authorized CRM roles can insert communication logs"
    ON public.communication_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales', 'service', 'support')
        )
    );

DROP POLICY IF EXISTS "Authorized CRM roles can update communication logs" ON public.communication_logs;
CREATE POLICY "Authorized CRM roles can update communication logs"
    ON public.communication_logs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales', 'service', 'support')
        )
    );

-- 6. SECURE RPC & DEFINER FUNCTIONS

-- Function to get or create customer communication preferences
CREATE OR REPLACE FUNCTION public.get_or_create_customer_comm_preferences(p_customer_id UUID)
RETURNS public.customer_communication_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pref public.customer_communication_preferences;
BEGIN
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID required';
    END IF;

    SELECT * INTO v_pref FROM public.customer_communication_preferences WHERE customer_id = p_customer_id;
    IF NOT FOUND THEN
        INSERT INTO public.customer_communication_preferences (customer_id)
        VALUES (p_customer_id)
        ON CONFLICT (customer_id) DO NOTHING
        RETURNING * INTO v_pref;

        IF v_pref.id IS NULL THEN
            SELECT * INTO v_pref FROM public.customer_communication_preferences WHERE customer_id = p_customer_id;
        END IF;
    END IF;

    RETURN v_pref;
END;
$$;

-- Function to perform safe variable substitution on template body
CREATE OR REPLACE FUNCTION public.render_communication_template(
    p_template_body TEXT,
    p_context JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result TEXT := p_template_body;
BEGIN
    IF p_template_body IS NULL THEN
        RETURN '';
    END IF;

    v_result := replace(v_result, '{{customer_name}}', COALESCE(p_context->>'customer_name', 'Customer'));
    v_result := replace(v_result, '{{customer_phone}}', COALESCE(p_context->>'customer_phone', ''));
    v_result := replace(v_result, '{{customer_email}}', COALESCE(p_context->>'customer_email', ''));
    v_result := replace(v_result, '{{tv_model}}', COALESCE(p_context->>'tv_model', 'ZUVO TV'));
    v_result := replace(v_result, '{{tv_variant}}', COALESCE(p_context->>'tv_variant', 'Standard'));
    v_result := replace(v_result, '{{screen_size}}', COALESCE(p_context->>'screen_size', ''));
    v_result := replace(v_result, '{{serial_number}}', COALESCE(p_context->>'serial_number', 'N/A'));
    v_result := replace(v_result, '{{barcode}}', COALESCE(p_context->>'barcode', 'N/A'));
    v_result := replace(v_result, '{{invoice_number}}', COALESCE(p_context->>'invoice_number', 'N/A'));
    v_result := replace(v_result, '{{sale_date}}', COALESCE(p_context->>'sale_date', 'N/A'));
    v_result := replace(v_result, '{{warranty_start_date}}', COALESCE(p_context->>'warranty_start_date', 'N/A'));
    v_result := replace(v_result, '{{warranty_end_date}}', COALESCE(p_context->>'warranty_end_date', 'N/A'));
    v_result := replace(v_result, '{{service_ticket_number}}', COALESCE(p_context->>'service_ticket_number', 'N/A'));
    v_result := replace(v_result, '{{service_status}}', COALESCE(p_context->>'service_status', 'N/A'));
    v_result := replace(v_result, '{{rma_number}}', COALESCE(p_context->>'rma_number', 'N/A'));
    v_result := replace(v_result, '{{company_name}}', COALESCE(p_context->>'company_name', 'ZUVO TV'));

    RETURN v_result;
END;
$$;

-- 7. SEEDED COMMUNICATION TEMPLATES
INSERT INTO public.communication_templates (template_key, template_name, channel, event_type, subject, message_body)
VALUES
  -- Warranty Registered Templates
  ('WARRANTY_REGISTERED', 'Warranty Registration Confirmation (WhatsApp)', 'whatsapp', 'warranty_registered', NULL,
   'Dear {{customer_name}}, your warranty for ZUVO TV (Serial: {{serial_number}}) has been successfully registered. Valid until {{warranty_end_date}}. Thank you for choosing {{company_name}}!'),
  ('WARRANTY_REGISTERED', 'Warranty Registration Confirmation (SMS)', 'sms', 'warranty_registered', NULL,
   'ZUVO TV: Dear {{customer_name}}, warranty registered for S/N: {{serial_number}}. Valid till {{warranty_end_date}}. Helpline: 1800-ZUVO-TV.'),
  ('WARRANTY_REGISTERED', 'Warranty Registration Certificate (Email)', 'email', 'warranty_registered', 'Official ZUVO TV Warranty Registration Certificate',
   'Dear {{customer_name}},\n\nCongratulations! Your official warranty for your ZUVO Television (Model: {{tv_model}}, Serial Number: {{serial_number}}) is now registered and active.\n\nWarranty Details:\n- Start Date: {{warranty_start_date}}\n- End Date: {{warranty_end_date}}\n- Barcode: {{barcode}}\n\nThank you for choosing {{company_name}}. For service requests, please call 1800-ZUVO-TV.'),

  -- Service Ticket Created Templates
  ('SERVICE_CREATED', 'Service Request Received (WhatsApp)', 'whatsapp', 'service_created', NULL,
   'Hello {{customer_name}}, your service request #{{service_ticket_number}} for ZUVO TV ({{tv_model}}) has been logged. Our technician will contact you shortly.'),
  ('SERVICE_CREATED', 'Service Request Received (SMS)', 'sms', 'service_created', NULL,
   'ZUVO TV: Service ticket #{{service_ticket_number}} created for {{customer_name}}. Status: Received. Helpline: 1800-ZUVO-TV.'),
  ('SERVICE_CREATED', 'Service Ticket Confirmation (Email)', 'email', 'service_created', 'ZUVO TV Service Ticket #{{service_ticket_number}} Confirmation',
   'Dear {{customer_name}},\n\nWe have received your service request for your ZUVO Television (Serial: {{serial_number}}).\n\nTicket Number: {{service_ticket_number}}\nStatus: {{service_status}}\n\nOur service center team will reach out within 24 hours to schedule an inspection.'),

  -- Service Ticket Completed Templates
  ('SERVICE_COMPLETED', 'Service Ticket Completed (WhatsApp)', 'whatsapp', 'service_completed', NULL,
   'Dear {{customer_name}}, service ticket #{{service_ticket_number}} for your ZUVO TV has been resolved and closed. Thank you for your patience!'),
  ('SERVICE_COMPLETED', 'Service Ticket Completed (SMS)', 'sms', 'service_completed', NULL,
   'ZUVO TV: Ticket #{{service_ticket_number}} completed & closed. Contact 1800-ZUVO-TV for assistance.'),

  -- Sale Completed / Invoice Ready Templates
  ('SALE_COMPLETED', 'Sale Order Confirmation (WhatsApp)', 'whatsapp', 'sale_completed', NULL,
   'Dear {{customer_name}}, thank you for purchasing ZUVO TV! Invoice #{{invoice_number}} generated on {{sale_date}}.'),
  ('SALE_COMPLETED', 'Tax Invoice Notification (Email)', 'email', 'sale_completed', 'Tax Invoice #{{invoice_number}} - ZUVO Television',
   'Dear {{customer_name}},\n\nThank you for purchasing your ZUVO Television. Your tax invoice #{{invoice_number}} dated {{sale_date}} has been generated.\n\nUnit Details: {{tv_model}} (Serial: {{serial_number}}).\n\nBest regards,\n{{company_name}} Team'),

  -- RMA Return Templates
  ('RMA_CREATED', 'RMA Return Initiated (WhatsApp)', 'whatsapp', 'rma_created', NULL,
   'Dear {{customer_name}}, return request #{{rma_number}} for ZUVO TV has been initiated. Our team will verify the unit condition shortly.')
ON CONFLICT (template_key, channel) DO UPDATE
SET template_name = EXCLUDED.template_name,
    subject = EXCLUDED.subject,
    message_body = EXCLUDED.message_body,
    updated_at = now();
