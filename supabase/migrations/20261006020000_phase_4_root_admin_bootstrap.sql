-- =====================================================================
-- ZUVO TV CRM — PHASE 4.1: ROOT ADMIN BOOTSTRAP FUNCTION
-- Migration: 20261006020000_phase_4_root_admin_bootstrap.sql
-- Project: axpryvuknepqeflymzlv (ZUVO Android TV)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(target_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id uuid;
    v_super_admin_role_id uuid;
    v_has_super_admin boolean;
    v_calling_role text;
BEGIN
    -- Check if a super_admin already exists
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        WHERE r.name = 'super_admin'
    ) INTO v_has_super_admin;

    -- If a super_admin already exists, only an authenticated super_admin can call this
    IF v_has_super_admin THEN
        v_calling_role := public.get_current_user_role();
        IF v_calling_role IS NULL OR v_calling_role <> 'super_admin' THEN
            RAISE EXCEPTION 'Access denied: only an existing super_admin can promote users.';
        END IF;
    END IF;

    -- Locate user in auth.users by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = LOWER(TRIM(target_email))
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email "%" was not found in auth.users. Please sign up or invite the user first.', target_email;
    END IF;

    -- Resolve super_admin role ID
    SELECT id INTO v_super_admin_role_id
    FROM public.roles
    WHERE name = 'super_admin';

    IF v_super_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'Role "super_admin" does not exist in public.roles.';
    END IF;

    -- Update or ensure profile has super_admin role
    INSERT INTO public.profiles (
        id,
        role_id,
        full_name,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        v_super_admin_role_id,
        'Root Administrator',
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        role_id = v_super_admin_role_id,
        is_active = true,
        updated_at = now();

    -- Also update auth.users raw_app_meta_data so JWT claims match
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'super_admin')
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', target_email,
        'role', 'super_admin',
        'message', 'User successfully provisioned as super_admin.'
    );
END;
$$;

-- Revoke public execution, grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.bootstrap_super_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin(text) TO authenticated, service_role;

COMMIT;
