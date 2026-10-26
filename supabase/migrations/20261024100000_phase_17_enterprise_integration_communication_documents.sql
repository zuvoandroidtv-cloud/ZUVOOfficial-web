-- =============================================================================
-- ZUVO TV ENTERPRISE CRM — PHASE 17 MASTER DATABASE MIGRATION
-- Enterprise Integration, API Governance, Communication & Document Automation
-- Filename: 20261024100000_phase_17_enterprise_integration_communication_documents.sql
-- Baseline: Phase 19 (a052043) — FORWARD-ONLY, NON-DESTRUCTIVE
-- =============================================================================

SET search_path = public, pg_temp;

-- 0. MULTI-TENANT FOUNDATION
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenants_read ON public.tenants;
CREATE POLICY p_tenants_read ON public.tenants FOR SELECT TO authenticated USING (true);

INSERT INTO public.tenants (id, code, name, is_active)
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'DEFAULT', 'ZUVO TV Enterprise', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- A. ENTERPRISE INTEGRATION REGISTRY
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_integrations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    integration_code    TEXT NOT NULL,
    integration_name    TEXT NOT NULL,
    category            TEXT NOT NULL CHECK (category IN (
                            'PAYMENT','ACCOUNTING','GST','TAX','SMS','EMAIL',
                            'WHATSAPP','SHIPPING','LOGISTICS','BANKING','ERP',
                            'MARKETPLACE','WEBSITE','ANALYTICS','DOCUMENT','OTHER'
                        )),
    provider            TEXT NOT NULL,
    environment         TEXT NOT NULL DEFAULT 'PRODUCTION' CHECK (environment IN ('PRODUCTION','STAGING','UAT','DEVELOPMENT')),
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED','DEPRECATED','CONFIGURATION_REQUIRED')),
    owner_department    TEXT NULL,
    auth_method         TEXT NOT NULL DEFAULT 'API_KEY' CHECK (auth_method IN ('API_KEY','OAUTH2','BASIC','HMAC','JWT','MTLS','NONE')),
    base_url_masked     TEXT NULL,
    supports_webhooks   BOOLEAN NOT NULL DEFAULT FALSE,
    health_status       TEXT NOT NULL DEFAULT 'HEALTHY' CHECK (health_status IN ('HEALTHY','DEGRADED','AT_RISK','DOWN','CONFIGURATION_ERROR','UNKNOWN')),
    last_success_at     TIMESTAMPTZ NULL,
    last_failure_at     TIMESTAMPTZ NULL,
    failure_count       INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    notes               TEXT NULL,
    created_by          UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by          UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, integration_code)
);

ALTER TABLE public.enterprise_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_tenant_isolation" ON public.enterprise_integrations;
CREATE POLICY "integration_tenant_isolation" ON public.enterprise_integrations
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_ei_tenant_status ON public.enterprise_integrations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ei_category ON public.enterprise_integrations(category);
CREATE INDEX IF NOT EXISTS idx_ei_health ON public.enterprise_integrations(health_status);

-- =============================================================================
-- B. CREDENTIAL GOVERNANCE (METADATA ONLY — NO SECRETS IN PLAIN TEXT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_integration_credentials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id      UUID NOT NULL REFERENCES public.enterprise_integrations(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    credential_type     TEXT NOT NULL CHECK (credential_type IN ('API_KEY','OAUTH_TOKEN','WEBHOOK_SECRET','CLIENT_CERT','SERVICE_ACCOUNT','BASIC_AUTH','OTHER')),
    key_reference       TEXT NOT NULL,  -- vault/secret-manager reference — never the secret itself
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRING','EXPIRED','REVOKED','ROTATION_REQUIRED')),
    expires_at          TIMESTAMPTZ NULL,
    rotation_due_at     TIMESTAMPTZ NULL,
    last_validated_at   TIMESTAMPTZ NULL,
    failure_count       INTEGER NOT NULL DEFAULT 0,
    owner_profile_id    UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes               TEXT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enterprise_integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credential_tenant_isolation" ON public.enterprise_integration_credentials;
CREATE POLICY "credential_tenant_isolation" ON public.enterprise_integration_credentials
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Revoke ALL direct access; only SECURITY DEFINER RPCs may touch this table
REVOKE ALL ON public.enterprise_integration_credentials FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_eic_integration ON public.enterprise_integration_credentials(integration_id);
CREATE INDEX IF NOT EXISTS idx_eic_status ON public.enterprise_integration_credentials(status);
CREATE INDEX IF NOT EXISTS idx_eic_expiry ON public.enterprise_integration_credentials(expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- C. WEBHOOK GOVERNANCE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_webhooks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id      UUID NOT NULL REFERENCES public.enterprise_integrations(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    direction           TEXT NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
    event_type          TEXT NOT NULL,
    endpoint_masked     TEXT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    signing_algo        TEXT NULL CHECK (signing_algo IN ('HMAC_SHA256','HMAC_SHA512','RSA','NONE') OR signing_algo IS NULL),
    secret_ref          TEXT NULL,  -- vault reference only
    retry_max           INTEGER NOT NULL DEFAULT 3 CHECK (retry_max >= 0 AND retry_max <= 10),
    retry_backoff_secs  INTEGER NOT NULL DEFAULT 30,
    last_delivery_at    TIMESTAMPTZ NULL,
    last_response_code  INTEGER NULL,
    failure_count       INTEGER NOT NULL DEFAULT 0,
    notes               TEXT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enterprise_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_tenant_isolation" ON public.enterprise_webhooks;
CREATE POLICY "webhook_tenant_isolation" ON public.enterprise_webhooks
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_ewh_integration ON public.enterprise_webhooks(integration_id);
CREATE INDEX IF NOT EXISTS idx_ewh_direction ON public.enterprise_webhooks(direction, is_active);

-- =============================================================================
-- D. INBOUND INTEGRATION EVENT LEDGER (INBOX)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_integration_inbox (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    integration_id      UUID NOT NULL REFERENCES public.enterprise_integrations(id) ON DELETE RESTRICT,
    provider_event_id   TEXT NOT NULL,
    event_type          TEXT NOT NULL,
    payload_hash        TEXT NOT NULL,
    raw_payload         JSONB NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','VALIDATED','PROCESSING','PROCESSED','FAILED','DEAD_LETTER')),
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    processed_at        TIMESTAMPTZ NULL,
    failure_reason      TEXT NULL,
    correlation_id      UUID NULL DEFAULT gen_random_uuid(),
    causation_id        UUID NULL,
    idempotency_key     TEXT NOT NULL,
    aggregate_type      TEXT NULL,
    aggregate_id        UUID NULL,
    UNIQUE (integration_id, idempotency_key)
);

ALTER TABLE public.enterprise_integration_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbox_tenant_isolation" ON public.enterprise_integration_inbox;
CREATE POLICY "inbox_tenant_isolation" ON public.enterprise_integration_inbox
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_eiinbox_tenant_status ON public.enterprise_integration_inbox(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_eiinbox_correlation ON public.enterprise_integration_inbox(correlation_id);
CREATE INDEX IF NOT EXISTS idx_eiinbox_provider_event ON public.enterprise_integration_inbox(integration_id, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_eiinbox_received_at ON public.enterprise_integration_inbox(received_at DESC);

-- =============================================================================
-- E. OUTBOUND INTEGRATION EVENT LEDGER (OUTBOX)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_integration_outbox (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    integration_id      UUID NULL REFERENCES public.enterprise_integrations(id) ON DELETE SET NULL,
    event_type          TEXT NOT NULL,
    aggregate_type      TEXT NOT NULL,
    aggregate_id        UUID NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED','RETRYING','DEAD_LETTER')),
    retry_count         INTEGER NOT NULL DEFAULT 0,
    max_retries         INTEGER NOT NULL DEFAULT 5,
    next_retry_at       TIMESTAMPTZ NULL,
    sent_at             TIMESTAMPTZ NULL,
    failure_details     TEXT NULL,
    correlation_id      UUID NULL DEFAULT gen_random_uuid(),
    causation_id        UUID NULL,
    idempotency_key     TEXT NOT NULL UNIQUE,
    created_by          UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enterprise_integration_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outbox_tenant_isolation" ON public.enterprise_integration_outbox;
CREATE POLICY "outbox_tenant_isolation" ON public.enterprise_integration_outbox
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_eioutbox_tenant_status ON public.enterprise_integration_outbox(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_eioutbox_retry ON public.enterprise_integration_outbox(next_retry_at) WHERE status IN ('PENDING','RETRYING');
CREATE INDEX IF NOT EXISTS idx_eioutbox_correlation ON public.enterprise_integration_outbox(correlation_id);
CREATE INDEX IF NOT EXISTS idx_eioutbox_aggregate ON public.enterprise_integration_outbox(aggregate_type, aggregate_id);

-- =============================================================================
-- F/G. DEAD LETTER QUEUE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_integration_dead_letters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    integration_id      UUID NULL REFERENCES public.enterprise_integrations(id) ON DELETE SET NULL,
    source_table        TEXT NOT NULL CHECK (source_table IN ('inbox','outbox')),
    source_event_id     UUID NOT NULL,
    event_type          TEXT NOT NULL,
    payload_snapshot    JSONB NULL,
    failure_category    TEXT NOT NULL CHECK (failure_category IN ('TIMEOUT','VALIDATION_ERROR','AUTH_FAILURE','PROVIDER_ERROR','BUSINESS_RULE_VIOLATION','NETWORK_ERROR','SIGNATURE_FAILURE','REPLAY_ATTACK','UNKNOWN')),
    failure_reason      TEXT NULL,
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    first_failure_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    final_failure_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolution_status   TEXT NOT NULL DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN','REPLAY_REQUESTED','REPLAYED','DISMISSED')),
    resolved_by         UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMPTZ NULL,
    resolution_note     TEXT NULL,
    correlation_id      UUID NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enterprise_integration_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dlq_tenant_isolation" ON public.enterprise_integration_dead_letters;
CREATE POLICY "dlq_tenant_isolation" ON public.enterprise_integration_dead_letters
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_eidlq_tenant_status ON public.enterprise_integration_dead_letters(tenant_id, resolution_status);
CREATE INDEX IF NOT EXISTS idx_eidlq_correlation ON public.enterprise_integration_dead_letters(correlation_id);

-- =============================================================================
-- H. COMMUNICATION ORCHESTRATION LEDGER
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_communications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    channel             TEXT NOT NULL CHECK (channel IN ('EMAIL','SMS','WHATSAPP','IN_APP','PUSH')),
    message_type        TEXT NOT NULL,
    recipient_identifier TEXT NOT NULL,
    customer_id         UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    dealer_id           UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL,
    template_id         UUID NULL,
    provider            TEXT NULL,
    provider_message_id TEXT NULL,
    subject             TEXT NULL,
    body_preview        TEXT NULL,
    status              TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENDING','SENT','DELIVERED','FAILED','CANCELLED')),
    queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at             TIMESTAMPTZ NULL,
    delivered_at        TIMESTAMPTZ NULL,
    failure_reason      TEXT NULL,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    correlation_id      UUID NULL DEFAULT gen_random_uuid(),
    causation_id        UUID NULL,
    idempotency_key     TEXT NOT NULL UNIQUE,
    sent_by             UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enterprise_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comms_tenant_isolation" ON public.enterprise_communications;
CREATE POLICY "comms_tenant_isolation" ON public.enterprise_communications
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_ec_tenant_status ON public.enterprise_communications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ec_channel ON public.enterprise_communications(channel);
CREATE INDEX IF NOT EXISTS idx_ec_customer ON public.enterprise_communications(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ec_correlation ON public.enterprise_communications(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ec_queued_at ON public.enterprise_communications(queued_at DESC);

-- =============================================================================
-- I. MESSAGE TEMPLATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_message_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    template_code   TEXT NOT NULL,
    template_name   TEXT NOT NULL,
    channel         TEXT NOT NULL CHECK (channel IN ('EMAIL','SMS','WHATSAPP','IN_APP','PUSH','MULTI')),
    message_type    TEXT NOT NULL,
    subject_template TEXT NULL,
    body_template   TEXT NOT NULL,
    variables       JSONB NOT NULL DEFAULT '[]',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    version         INTEGER NOT NULL DEFAULT 1,
    approved_by     UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ NULL,
    created_by      UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, template_code, version)
);

ALTER TABLE public.enterprise_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template_tenant_isolation" ON public.enterprise_message_templates;
CREATE POLICY "template_tenant_isolation" ON public.enterprise_message_templates
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_emt_tenant_active ON public.enterprise_message_templates(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_emt_code ON public.enterprise_message_templates(template_code);

-- =============================================================================
-- J. DOCUMENT AUTOMATION LEDGER
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    document_type       TEXT NOT NULL CHECK (document_type IN (
                            'QUOTATION','SALES_ORDER','INVOICE','WARRANTY_CERTIFICATE',
                            'SERVICE_REPORT','DELIVERY_DOCUMENT','DEALER_AGREEMENT',
                            'CREDIT_NOTE','DEBIT_NOTE','PURCHASE_DOCUMENT','COMPLIANCE_EVIDENCE','OTHER'
                        )),
    entity_type         TEXT NOT NULL,
    entity_id           UUID NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,
    document_number     TEXT NULL,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by        UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    storage_reference   TEXT NULL,
    checksum            TEXT NULL,
    status              TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('DRAFT','GENERATED','ISSUED','SUPERSEDED','CANCELLED','ARCHIVED')),
    superseded_by       UUID NULL REFERENCES public.enterprise_documents(id) ON DELETE SET NULL,
    correlation_id      UUID NULL DEFAULT gen_random_uuid(),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enterprise_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_tenant_isolation" ON public.enterprise_documents;
CREATE POLICY "docs_tenant_isolation" ON public.enterprise_documents
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_ed_tenant_type ON public.enterprise_documents(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_ed_entity ON public.enterprise_documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ed_status ON public.enterprise_documents(status);
CREATE INDEX IF NOT EXISTS idx_ed_correlation ON public.enterprise_documents(correlation_id);

-- =============================================================================
-- K. DOCUMENT DELIVERY LEDGER
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_document_deliveries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID NOT NULL REFERENCES public.enterprise_documents(id) ON DELETE RESTRICT,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    channel             TEXT NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP','SMS','PORTAL','DOWNLOAD','PRINT','OTHER')),
    recipient_identifier TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','DELIVERED','FAILED','CANCELLED')),
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    first_attempt_at    TIMESTAMPTZ NULL,
    last_attempt_at     TIMESTAMPTZ NULL,
    delivered_at        TIMESTAMPTZ NULL,
    failure_reason      TEXT NULL,
    idempotency_key     TEXT NOT NULL UNIQUE,
    delivered_by        UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enterprise_document_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_delivery_tenant_isolation" ON public.enterprise_document_deliveries;
CREATE POLICY "doc_delivery_tenant_isolation" ON public.enterprise_document_deliveries
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_edd_document ON public.enterprise_document_deliveries(document_id);
CREATE INDEX IF NOT EXISTS idx_edd_status ON public.enterprise_document_deliveries(status);

-- =============================================================================
-- L. INTEGRATION HEALTH METRICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_integration_health (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id      UUID NOT NULL REFERENCES public.enterprise_integrations(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    measured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    health_status       TEXT NOT NULL CHECK (health_status IN ('HEALTHY','DEGRADED','AT_RISK','DOWN','CONFIGURATION_ERROR')),
    success_count       INTEGER NOT NULL DEFAULT 0,
    failure_count       INTEGER NOT NULL DEFAULT 0,
    success_rate_pct    NUMERIC(5,2) NULL,
    avg_latency_ms      NUMERIC(10,2) NULL,
    queue_depth         INTEGER NOT NULL DEFAULT 0,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    dead_letter_count   INTEGER NOT NULL DEFAULT 0,
    last_success_at     TIMESTAMPTZ NULL,
    last_failure_at     TIMESTAMPTZ NULL,
    credential_expiry   TIMESTAMPTZ NULL,
    alerts_generated    INTEGER NOT NULL DEFAULT 0,
    notes               TEXT NULL
);

ALTER TABLE public.enterprise_integration_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_tenant_isolation" ON public.enterprise_integration_health;
CREATE POLICY "health_tenant_isolation" ON public.enterprise_integration_health
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_eih_integration ON public.enterprise_integration_health(integration_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_eih_status ON public.enterprise_integration_health(health_status);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Integration Summary View
CREATE OR REPLACE VIEW public.v_integration_summary AS
SELECT
    ei.id,
    ei.tenant_id,
    ei.integration_code,
    ei.integration_name,
    ei.category,
    ei.provider,
    ei.environment,
    ei.status,
    ei.health_status,
    ei.last_success_at,
    ei.last_failure_at,
    ei.failure_count,
    (SELECT COUNT(*) FROM public.enterprise_integration_inbox WHERE integration_id = ei.id AND status = 'PENDING') AS inbox_pending,
    (SELECT COUNT(*) FROM public.enterprise_integration_outbox WHERE integration_id = ei.id AND status IN ('PENDING','RETRYING')) AS outbox_pending,
    (SELECT COUNT(*) FROM public.enterprise_integration_dead_letters WHERE integration_id = ei.id AND resolution_status = 'OPEN') AS dlq_open,
    (SELECT COUNT(*) FROM public.enterprise_integration_credentials WHERE integration_id = ei.id AND status IN ('EXPIRING','EXPIRED','ROTATION_REQUIRED')) AS credential_alerts,
    ei.created_at,
    ei.updated_at
FROM public.enterprise_integrations ei;

-- Communication Queue View
CREATE OR REPLACE VIEW public.v_communication_queue AS
SELECT
    ec.id,
    ec.tenant_id,
    ec.channel,
    ec.message_type,
    ec.recipient_identifier,
    ec.customer_id,
    c.full_name AS customer_name,
    ec.status,
    ec.queued_at,
    ec.sent_at,
    ec.delivered_at,
    ec.retry_count,
    ec.failure_reason,
    ec.correlation_id
FROM public.enterprise_communications ec
LEFT JOIN public.customers c ON c.id = ec.customer_id;

-- Document Lifecycle View
CREATE OR REPLACE VIEW public.v_document_lifecycle AS
SELECT
    ed.id,
    ed.tenant_id,
    ed.document_type,
    ed.entity_type,
    ed.entity_id,
    ed.document_number,
    ed.version,
    ed.status,
    ed.generated_at,
    p.full_name AS generated_by_name,
    COUNT(edd.id) AS delivery_attempts,
    SUM(CASE WHEN edd.status = 'DELIVERED' THEN 1 ELSE 0 END) AS successful_deliveries
FROM public.enterprise_documents ed
LEFT JOIN public.profiles p ON p.id = ed.generated_by
LEFT JOIN public.enterprise_document_deliveries edd ON edd.document_id = ed.id
GROUP BY ed.id, ed.tenant_id, ed.document_type, ed.entity_type, ed.entity_id,
         ed.document_number, ed.version, ed.status, ed.generated_at, p.full_name;

-- =============================================================================
-- O. SERVER-AUTHORITATIVE RPCs
-- =============================================================================

-- O1. Register Integration
CREATE OR REPLACE FUNCTION public.fn_register_enterprise_integration(
    p_integration_code  TEXT,
    p_integration_name  TEXT,
    p_category          TEXT,
    p_provider          TEXT,
    p_environment       TEXT DEFAULT 'PRODUCTION',
    p_auth_method       TEXT DEFAULT 'API_KEY',
    p_base_url_masked   TEXT DEFAULT NULL,
    p_supports_webhooks BOOLEAN DEFAULT FALSE,
    p_owner_department  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_role   TEXT;
    v_result        UUID;
BEGIN
    -- Authenticate
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('super_admin','admin') THEN
        RAISE EXCEPTION 'Insufficient privileges: admin or super_admin required' USING ERRCODE = '42501';
    END IF;

    -- Upsert
    INSERT INTO public.enterprise_integrations (
        tenant_id, integration_code, integration_name, category, provider,
        environment, auth_method, base_url_masked, supports_webhooks,
        owner_department, created_by, updated_by
    )
    VALUES (
        v_tenant_id, p_integration_code, p_integration_name, p_category, p_provider,
        p_environment, p_auth_method, p_base_url_masked, p_supports_webhooks,
        p_owner_department, auth.uid(), auth.uid()
    )
    ON CONFLICT (tenant_id, integration_code)
    DO UPDATE SET
        integration_name    = EXCLUDED.integration_name,
        category            = EXCLUDED.category,
        provider            = EXCLUDED.provider,
        environment         = EXCLUDED.environment,
        auth_method         = EXCLUDED.auth_method,
        base_url_masked     = EXCLUDED.base_url_masked,
        supports_webhooks   = EXCLUDED.supports_webhooks,
        owner_department    = EXCLUDED.owner_department,
        updated_by          = auth.uid(),
        updated_at          = NOW()
    RETURNING id INTO v_result;

    RETURN jsonb_build_object('success', true, 'integration_id', v_result);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_register_enterprise_integration FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_enterprise_integration TO authenticated;

-- O2. Create Inbound Integration Event (idempotent)
CREATE OR REPLACE FUNCTION public.fn_create_integration_event(
    p_integration_id    UUID,
    p_provider_event_id TEXT,
    p_event_type        TEXT,
    p_payload           JSONB DEFAULT NULL,
    p_payload_hash      TEXT DEFAULT NULL,
    p_idempotency_key   TEXT DEFAULT NULL,
    p_correlation_id    UUID DEFAULT NULL,
    p_aggregate_type    TEXT DEFAULT NULL,
    p_aggregate_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_ikey          TEXT;
    v_existing_id   UUID;
    v_result_id     UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- Default idempotency key
    v_ikey := COALESCE(p_idempotency_key, p_integration_id::TEXT || ':' || p_provider_event_id);

    -- Duplicate-event prevention
    SELECT id INTO v_existing_id
    FROM public.enterprise_integration_inbox
    WHERE integration_id = p_integration_id AND idempotency_key = v_ikey;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'event_id', v_existing_id, 'duplicate', true);
    END IF;

    INSERT INTO public.enterprise_integration_inbox (
        tenant_id, integration_id, provider_event_id, event_type,
        payload_hash, raw_payload, idempotency_key, correlation_id,
        aggregate_type, aggregate_id
    )
    VALUES (
        v_tenant_id, p_integration_id, p_provider_event_id, p_event_type,
        COALESCE(p_payload_hash, md5(p_payload::TEXT)), p_payload, v_ikey,
        COALESCE(p_correlation_id, gen_random_uuid()), p_aggregate_type, p_aggregate_id
    )
    RETURNING id INTO v_result_id;

    RETURN jsonb_build_object('success', true, 'event_id', v_result_id, 'duplicate', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_create_integration_event FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_integration_event TO authenticated;

-- O3. Retry Integration Event (bounded exponential backoff)
CREATE OR REPLACE FUNCTION public.fn_retry_integration_event(
    p_event_id  UUID,
    p_source    TEXT DEFAULT 'outbox'  -- 'inbox' or 'outbox'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_role   TEXT;
    v_retry_count   INTEGER;
    v_max_retries   INTEGER;
    v_backoff_secs  INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('super_admin','admin') THEN
        RAISE EXCEPTION 'Insufficient privileges' USING ERRCODE = '42501';
    END IF;

    IF p_source = 'outbox' THEN
        SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
        FROM public.enterprise_integration_outbox
        WHERE id = p_event_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
        END IF;

        IF v_retry_count >= v_max_retries THEN
            -- Move to dead letter
            INSERT INTO public.enterprise_integration_dead_letters (
                tenant_id, integration_id, source_table, source_event_id, event_type,
                failure_category, failure_reason, attempt_count, correlation_id
            )
            SELECT
                tenant_id, integration_id, 'outbox', id, event_type,
                'PROVIDER_ERROR', failure_details, retry_count, correlation_id
            FROM public.enterprise_integration_outbox
            WHERE id = p_event_id;

            UPDATE public.enterprise_integration_outbox
            SET status = 'DEAD_LETTER', updated_at = NOW()
            WHERE id = p_event_id;

            RETURN jsonb_build_object('success', true, 'action', 'moved_to_dead_letter');
        END IF;

        -- Bounded exponential backoff: 2^n * 30s, cap at 3600s
        v_backoff_secs := LEAST(POWER(2, v_retry_count)::INTEGER * 30, 3600);

        UPDATE public.enterprise_integration_outbox
        SET status = 'RETRYING',
            retry_count = retry_count + 1,
            next_retry_at = NOW() + (v_backoff_secs || ' seconds')::INTERVAL,
            updated_at = NOW()
        WHERE id = p_event_id;

        RETURN jsonb_build_object('success', true, 'action', 'scheduled_retry', 'backoff_secs', v_backoff_secs);
    ELSE
        RAISE EXCEPTION 'Unsupported source type: use outbox or inbox' USING ERRCODE = '22023';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_retry_integration_event FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_retry_integration_event TO authenticated;

-- O4. Replay Dead Letter (controlled, audited, idempotent)
CREATE OR REPLACE FUNCTION public.fn_replay_dead_letter(
    p_dead_letter_id    UUID,
    p_resolution_note   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_role   TEXT;
    v_dl            RECORD;
    v_new_event_id  UUID;
    v_ikey          TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('super_admin','admin') THEN
        RAISE EXCEPTION 'Insufficient privileges: admin or super_admin required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_dl
    FROM public.enterprise_integration_dead_letters
    WHERE id = p_dead_letter_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dead letter not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_dl.resolution_status NOT IN ('OPEN','REPLAY_REQUESTED') THEN
        RAISE EXCEPTION 'Dead letter is already resolved or dismissed' USING ERRCODE = '22023';
    END IF;

    -- Mark as replay requested
    UPDATE public.enterprise_integration_dead_letters
    SET resolution_status = 'REPLAY_REQUESTED', updated_at = NOW()
    WHERE id = p_dead_letter_id;

    -- Re-queue in outbox with new idempotency key
    v_ikey := 'replay:' || p_dead_letter_id::TEXT || ':' || extract(epoch FROM NOW())::TEXT;

    INSERT INTO public.enterprise_integration_outbox (
        tenant_id, integration_id, event_type, aggregate_type, aggregate_id,
        payload, idempotency_key, correlation_id, causation_id, created_by
    )
    VALUES (
        v_tenant_id,
        v_dl.integration_id,
        v_dl.event_type,
        COALESCE((v_dl.payload_snapshot->>'aggregate_type')::TEXT, 'REPLAY'),
        COALESCE((v_dl.payload_snapshot->>'aggregate_id')::UUID, gen_random_uuid()),
        COALESCE(v_dl.payload_snapshot, '{}'),
        v_ikey,
        v_dl.correlation_id,
        v_dl.source_event_id,
        auth.uid()
    )
    RETURNING id INTO v_new_event_id;

    -- Mark dead letter resolved
    UPDATE public.enterprise_integration_dead_letters
    SET resolution_status = 'REPLAYED',
        resolved_by = auth.uid(),
        resolved_at = NOW(),
        resolution_note = COALESCE(p_resolution_note, 'Replayed by ' || auth.uid()::TEXT)
    WHERE id = p_dead_letter_id;

    RETURN jsonb_build_object('success', true, 'new_event_id', v_new_event_id, 'dead_letter_id', p_dead_letter_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_replay_dead_letter FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_replay_dead_letter TO authenticated;

-- O5. Queue Communication (provider-neutral, idempotent)
CREATE OR REPLACE FUNCTION public.fn_queue_communication(
    p_channel               TEXT,
    p_message_type          TEXT,
    p_recipient_identifier  TEXT,
    p_customer_id           UUID DEFAULT NULL,
    p_dealer_id             UUID DEFAULT NULL,
    p_template_id           UUID DEFAULT NULL,
    p_subject               TEXT DEFAULT NULL,
    p_body_preview          TEXT DEFAULT NULL,
    p_idempotency_key       TEXT DEFAULT NULL,
    p_correlation_id        UUID DEFAULT NULL,
    p_causation_id          UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_role   TEXT;
    v_ikey          TEXT;
    v_existing_id   UUID;
    v_result_id     UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('super_admin','admin','sales','service','support') THEN
        RAISE EXCEPTION 'Insufficient privileges' USING ERRCODE = '42501';
    END IF;

    v_ikey := COALESCE(p_idempotency_key,
        p_channel || ':' || p_message_type || ':' || p_recipient_identifier || ':' ||
        extract(epoch FROM date_trunc('hour', NOW()))::TEXT);

    -- Idempotency check
    SELECT id INTO v_existing_id
    FROM public.enterprise_communications
    WHERE idempotency_key = v_ikey AND tenant_id = v_tenant_id;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'communication_id', v_existing_id, 'duplicate', true);
    END IF;

    INSERT INTO public.enterprise_communications (
        tenant_id, channel, message_type, recipient_identifier,
        customer_id, dealer_id, template_id, subject, body_preview,
        idempotency_key, correlation_id, causation_id, sent_by
    )
    VALUES (
        v_tenant_id, p_channel, p_message_type, p_recipient_identifier,
        p_customer_id, p_dealer_id, p_template_id, p_subject, p_body_preview,
        v_ikey, COALESCE(p_correlation_id, gen_random_uuid()), p_causation_id, auth.uid()
    )
    RETURNING id INTO v_result_id;

    RETURN jsonb_build_object('success', true, 'communication_id', v_result_id, 'duplicate', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_queue_communication FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_queue_communication TO authenticated;

-- O6. Record Communication Delivery
CREATE OR REPLACE FUNCTION public.fn_record_communication_delivery(
    p_communication_id  UUID,
    p_status            TEXT,
    p_provider_msg_id   TEXT DEFAULT NULL,
    p_failure_reason    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    UPDATE public.enterprise_communications
    SET status              = p_status,
        provider_message_id = COALESCE(p_provider_msg_id, provider_message_id),
        sent_at             = CASE WHEN p_status = 'SENT' THEN NOW() ELSE sent_at END,
        delivered_at        = CASE WHEN p_status = 'DELIVERED' THEN NOW() ELSE delivered_at END,
        failure_reason      = COALESCE(p_failure_reason, failure_reason),
        updated_at          = NOW()
    WHERE id = p_communication_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Communication not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_record_communication_delivery FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_communication_delivery TO authenticated;

-- O7. Generate Document Record (versioned, immutable-issued)
CREATE OR REPLACE FUNCTION public.fn_generate_document_record(
    p_document_type     TEXT,
    p_entity_type       TEXT,
    p_entity_id         UUID,
    p_document_number   TEXT DEFAULT NULL,
    p_storage_reference TEXT DEFAULT NULL,
    p_checksum          TEXT DEFAULT NULL,
    p_correlation_id    UUID DEFAULT NULL,
    p_metadata          JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_role   TEXT;
    v_next_version  INTEGER;
    v_result_id     UUID;
    v_old_id        UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.profiles WHERE id = auth.uid();

    -- Determine next version
    SELECT COALESCE(MAX(version), 0) + 1, id INTO v_next_version, v_old_id
    FROM public.enterprise_documents
    WHERE tenant_id = v_tenant_id
      AND entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND document_type = p_document_type
      AND status = 'ISSUED'
    GROUP BY id ORDER BY version DESC LIMIT 1;

    v_next_version := COALESCE(v_next_version, 1);

    -- Mark previous issued document as superseded
    IF v_old_id IS NOT NULL THEN
        UPDATE public.enterprise_documents
        SET status = 'SUPERSEDED', updated_at = NOW()
        WHERE id = v_old_id;
    END IF;

    INSERT INTO public.enterprise_documents (
        tenant_id, document_type, entity_type, entity_id, version,
        document_number, storage_reference, checksum,
        status, generated_by, correlation_id, metadata
    )
    VALUES (
        v_tenant_id, p_document_type, p_entity_type, p_entity_id, v_next_version,
        p_document_number, p_storage_reference, p_checksum,
        'GENERATED', auth.uid(), COALESCE(p_correlation_id, gen_random_uuid()), COALESCE(p_metadata, '{}')
    )
    RETURNING id INTO v_result_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_result_id, 'version', v_next_version);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_generate_document_record FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_document_record TO authenticated;

-- O8. Record Document Delivery (independent, auditable)
CREATE OR REPLACE FUNCTION public.fn_record_document_delivery(
    p_document_id           UUID,
    p_channel               TEXT,
    p_recipient_identifier  TEXT,
    p_idempotency_key       TEXT DEFAULT NULL,
    p_status                TEXT DEFAULT 'PENDING'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_ikey          TEXT;
    v_existing_id   UUID;
    v_result_id     UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    v_ikey := COALESCE(p_idempotency_key,
        p_document_id::TEXT || ':' || p_channel || ':' || p_recipient_identifier);

    SELECT id INTO v_existing_id
    FROM public.enterprise_document_deliveries
    WHERE idempotency_key = v_ikey;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'delivery_id', v_existing_id, 'duplicate', true);
    END IF;

    INSERT INTO public.enterprise_document_deliveries (
        document_id, tenant_id, channel, recipient_identifier,
        status, idempotency_key, delivered_by, first_attempt_at, last_attempt_at
    )
    VALUES (
        p_document_id, v_tenant_id, p_channel, p_recipient_identifier,
        p_status, v_ikey, auth.uid(),
        CASE WHEN p_status != 'PENDING' THEN NOW() ELSE NULL END,
        CASE WHEN p_status != 'PENDING' THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_result_id;

    RETURN jsonb_build_object('success', true, 'delivery_id', v_result_id, 'duplicate', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_record_document_delivery FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_document_delivery TO authenticated;

-- O9. Integration Health Sweep (idempotent, automated)
CREATE OR REPLACE FUNCTION public.fn_run_integration_health_sweep(p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_role   TEXT;
    v_integration   RECORD;
    v_health        TEXT;
    v_success_rate  NUMERIC;
    v_dlq_count     INTEGER;
    v_queue_depth   INTEGER;
    v_cred_expiry   TIMESTAMPTZ;
    v_swept         INTEGER := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('super_admin','admin') THEN
        RAISE EXCEPTION 'Insufficient privileges' USING ERRCODE = '42501';
    END IF;

    FOR v_integration IN
        SELECT id, tenant_id, failure_count, last_failure_at
        FROM public.enterprise_integrations
        WHERE tenant_id = COALESCE(p_tenant_id, v_tenant_id)
          AND status = 'ACTIVE'
    LOOP
        -- Compute metrics
        SELECT COALESCE(MAX(expires_at), NULL) INTO v_cred_expiry
        FROM public.enterprise_integration_credentials
        WHERE integration_id = v_integration.id AND status = 'ACTIVE';

        SELECT COUNT(*) INTO v_dlq_count
        FROM public.enterprise_integration_dead_letters
        WHERE integration_id = v_integration.id AND resolution_status = 'OPEN';

        SELECT COUNT(*) INTO v_queue_depth
        FROM public.enterprise_integration_outbox
        WHERE integration_id = v_integration.id AND status IN ('PENDING','RETRYING');

        -- Determine health
        IF v_integration.failure_count > 50 OR v_dlq_count > 20 THEN
            v_health := 'DOWN';
        ELSIF v_integration.failure_count > 20 OR v_dlq_count > 10 THEN
            v_health := 'AT_RISK';
        ELSIF v_integration.failure_count > 5 OR v_dlq_count > 3 OR v_queue_depth > 100 THEN
            v_health := 'DEGRADED';
        ELSIF v_cred_expiry IS NOT NULL AND v_cred_expiry < NOW() + INTERVAL '7 days' THEN
            v_health := 'AT_RISK';
        ELSE
            v_health := 'HEALTHY';
        END IF;

        -- Write health record
        INSERT INTO public.enterprise_integration_health (
            integration_id, tenant_id, health_status,
            failure_count, dead_letter_count, queue_depth,
            credential_expiry
        )
        VALUES (
            v_integration.id, v_integration.tenant_id, v_health,
            v_integration.failure_count, v_dlq_count, v_queue_depth,
            v_cred_expiry
        );

        -- Update master health status
        UPDATE public.enterprise_integrations
        SET health_status = v_health, updated_at = NOW()
        WHERE id = v_integration.id;

        v_swept := v_swept + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'integrations_swept', v_swept);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_run_integration_health_sweep FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_run_integration_health_sweep TO authenticated;

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_p17_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'enterprise_integrations',
        'enterprise_integration_credentials',
        'enterprise_webhooks',
        'enterprise_integration_outbox',
        'enterprise_communications',
        'enterprise_message_templates',
        'enterprise_documents',
        'enterprise_document_deliveries'
    ] LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;
            CREATE TRIGGER trg_%s_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.fn_p17_set_updated_at();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- =============================================================================
-- GRANT SELECT ON VIEWS TO authenticated
-- =============================================================================

GRANT SELECT ON public.v_integration_summary TO authenticated;
GRANT SELECT ON public.v_communication_queue TO authenticated;
GRANT SELECT ON public.v_document_lifecycle TO authenticated;

GRANT SELECT ON public.enterprise_integrations TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_integrations TO authenticated;
GRANT SELECT ON public.enterprise_webhooks TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_webhooks TO authenticated;
GRANT SELECT ON public.enterprise_integration_inbox TO authenticated;
GRANT INSERT ON public.enterprise_integration_inbox TO authenticated;
GRANT UPDATE ON public.enterprise_integration_inbox TO authenticated;
GRANT SELECT ON public.enterprise_integration_outbox TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_integration_outbox TO authenticated;
GRANT SELECT ON public.enterprise_integration_dead_letters TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_integration_dead_letters TO authenticated;
GRANT SELECT ON public.enterprise_communications TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_communications TO authenticated;
GRANT SELECT ON public.enterprise_message_templates TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_message_templates TO authenticated;
GRANT SELECT ON public.enterprise_documents TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_documents TO authenticated;
GRANT SELECT ON public.enterprise_document_deliveries TO authenticated;
GRANT INSERT, UPDATE ON public.enterprise_document_deliveries TO authenticated;
GRANT SELECT ON public.enterprise_integration_health TO authenticated;
GRANT INSERT ON public.enterprise_integration_health TO authenticated;

-- =============================================================================
-- PHASE 17 COMPLETE
-- =============================================================================
