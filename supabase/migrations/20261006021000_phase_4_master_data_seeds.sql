-- =====================================================================
-- ZUVO TV CRM — PHASE 4.2: LEGITIMATE STRUCTURAL MASTER DATA SEED
-- Migration: 20261006021000_phase_4_master_data_seeds.sql
-- Project: axpryvuknepqeflymzlv (ZUVO Android TV)
-- =====================================================================

BEGIN;

-- 1. Initial Central Warehouse
INSERT INTO public.warehouses (
    warehouse_code,
    warehouse_name,
    warehouse_type,
    city,
    state,
    is_active,
    notes
)
VALUES (
    'WH-CENTRAL',
    'ZUVO Central Logistics & Distribution Hub',
    'central_warehouse',
    'Bangalore',
    'Karnataka',
    true,
    'Primary central warehouse for direct factory intake and distribution'
)
ON CONFLICT (warehouse_code) DO NOTHING;

-- 2. Initial Primary Service Center
INSERT INTO public.service_centers (
    center_code,
    center_name,
    center_type,
    city,
    state,
    is_active,
    notes
)
VALUES (
    'SC-HEADQUARTERS',
    'ZUVO National Service & Repair Center',
    'company_owned',
    'Bangalore',
    'Karnataka',
    true,
    'National primary authorized repair and technical diagnostics center'
)
ON CONFLICT (center_code) DO NOTHING;

-- 3. Standard Spare Parts Catalog Master Records
INSERT INTO public.spare_parts (
    part_code,
    part_name,
    category,
    unit_of_measure,
    standard_cost,
    selling_price,
    reorder_level,
    description
)
VALUES
    ('PART-RC-VOICE', 'ZUVO Bluetooth Smart Voice Remote', 'remote', 'piece', 350.00, 750.00, 50, 'Original replacement voice remote with Google Assistant support'),
    ('PART-RC-STD', 'ZUVO Standard IR Remote Controller', 'remote', 'piece', 150.00, 350.00, 30, 'Standard infrared remote control for normal models'),
    ('PART-PANEL-32HD', '32" HD Ready A+ Grade LED Panel', 'panel', 'piece', 3200.00, 5000.00, 15, 'Replacement open-cell display panel for 32 inch models'),
    ('PART-PANEL-43FHD', '43" FHD A+ Grade LED Panel', 'panel', 'piece', 5800.00, 8500.00, 10, 'Replacement display panel for 43 inch models'),
    ('PART-PANEL-55UHD', '55" 4K UHD Quantum Display Panel', 'panel', 'piece', 11500.00, 16000.00, 8, 'Replacement 4K IPS display panel for 55 inch models'),
    ('PART-MB-32SMART', '32" Android 11.0 TV Mainboard Module', 'main_board', 'piece', 2100.00, 3200.00, 20, 'Integrated SoC mainboard with WiFi & Bluetooth'),
    ('PART-MB-43SMART', '43" 4K Android 11.0 TV Mainboard Module', 'main_board', 'piece', 2800.00, 4200.00, 15, 'Integrated 4K SoC mainboard with WiFi & Bluetooth'),
    ('PART-PSU-UNI75', 'Universal 75W LED TV Power Supply Unit', 'power_board', 'piece', 850.00, 1400.00, 25, 'High-efficiency surge-protected SMPS power board'),
    ('PART-SPK-20W', '20W Box Stereo Speaker Module Set', 'speaker', 'pair', 450.00, 850.00, 20, 'Internal dual stereo speaker modules with Dolby tuning')
ON CONFLICT (part_code) DO NOTHING;

-- 4. Map Compatibility between Spare Parts and TV Variants
DO $$
DECLARE
    v_part_id uuid;
    v_variant_id uuid;
BEGIN
    -- Map Voice Remote to Smart+Voice variants
    SELECT id INTO v_part_id FROM public.spare_parts WHERE part_code = 'PART-RC-VOICE';
    IF v_part_id IS NOT NULL THEN
        FOR v_variant_id IN 
            SELECT id FROM public.product_variants WHERE voice_remote = true
        LOOP
            INSERT INTO public.spare_part_compatibility (spare_part_id, variant_id, notes)
            VALUES (v_part_id, v_variant_id, 'OEM Factory Voice Remote')
            ON CONFLICT (spare_part_id, variant_id) DO NOTHING;
        END LOOP;
    END IF;

    -- Map Standard Remote to Normal variants
    SELECT id INTO v_part_id FROM public.spare_parts WHERE part_code = 'PART-RC-STD';
    IF v_part_id IS NOT NULL THEN
        FOR v_variant_id IN 
            SELECT id FROM public.product_variants WHERE voice_remote = false
        LOOP
            INSERT INTO public.spare_part_compatibility (spare_part_id, variant_id, notes)
            VALUES (v_part_id, v_variant_id, 'Standard IR Remote')
            ON CONFLICT (spare_part_id, variant_id) DO NOTHING;
        END LOOP;
    END IF;

    -- Map 32 Panel to 32" variants
    SELECT id INTO v_part_id FROM public.spare_parts WHERE part_code = 'PART-PANEL-32HD';
    IF v_part_id IS NOT NULL THEN
        FOR v_variant_id IN 
            SELECT id FROM public.product_variants WHERE screen_size = 32
        LOOP
            INSERT INTO public.spare_part_compatibility (spare_part_id, variant_id, notes)
            VALUES (v_part_id, v_variant_id, 'OEM 32 Inch Display Panel')
            ON CONFLICT (spare_part_id, variant_id) DO NOTHING;
        END LOOP;
    END IF;

    -- Map 43 Panel to 43" variants
    SELECT id INTO v_part_id FROM public.spare_parts WHERE part_code = 'PART-PANEL-43FHD';
    IF v_part_id IS NOT NULL THEN
        FOR v_variant_id IN 
            SELECT id FROM public.product_variants WHERE screen_size = 43
        LOOP
            INSERT INTO public.spare_part_compatibility (spare_part_id, variant_id, notes)
            VALUES (v_part_id, v_variant_id, 'OEM 43 Inch Display Panel')
            ON CONFLICT (spare_part_id, variant_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;

COMMIT;
