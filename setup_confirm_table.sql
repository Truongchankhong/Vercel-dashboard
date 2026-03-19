-- SQL to create the supplement_confirm table in Supabase
-- Please run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.supplement_confirm (
    rpro text PRIMARY KEY,
    so text,
    customers text,
    gender text,
    mold text,
    pu text,
    fb text,
    fabric text,
    bom text,
    total numeric DEFAULT 0,
    remark text,
    remark2 text,
    confirm text,
    available_supplement numeric,
    id bigint,
    updated_at timestamp with time zone,
    size_1 numeric DEFAULT 0, size_1_5 numeric DEFAULT 0, size_2 numeric DEFAULT 0, size_2_5 numeric DEFAULT 0,
    size_3 numeric DEFAULT 0, size_3_5 numeric DEFAULT 0, size_4 numeric DEFAULT 0, size_4_5 numeric DEFAULT 0, size_5 numeric DEFAULT 0,
    size_5_5 numeric DEFAULT 0, size_6 numeric DEFAULT 0, size_6_5 numeric DEFAULT 0, size_7 numeric DEFAULT 0, size_7_5 numeric DEFAULT 0,
    size_8 numeric DEFAULT 0, size_8_5 numeric DEFAULT 0, size_9 numeric DEFAULT 0, size_9_5 numeric DEFAULT 0, size_10 numeric DEFAULT 0,
    size_10_5 numeric DEFAULT 0, size_11 numeric DEFAULT 0, size_11_5 numeric DEFAULT 0, size_12 numeric DEFAULT 0, size_12_5 numeric DEFAULT 0,
    size_13 numeric DEFAULT 0, size_13_5 numeric DEFAULT 0, size_14 numeric DEFAULT 0, size_14_5 numeric DEFAULT 0, size_15 numeric DEFAULT 0,
    size_15_5 numeric DEFAULT 0, size_16 numeric DEFAULT 0, size_16_5 numeric DEFAULT 0, size_17 numeric DEFAULT 0, size_17_5 numeric DEFAULT 0,
    size_18 numeric DEFAULT 0, size_18_5 numeric DEFAULT 0, size_19 numeric DEFAULT 0, size_19_5 numeric DEFAULT 0, size_20 numeric DEFAULT 0,
    size_20_5 numeric DEFAULT 0, size_21 numeric DEFAULT 0, size_21_5 numeric DEFAULT 0, size_22 numeric DEFAULT 0, size_22_5 numeric DEFAULT 0,
    size_23 numeric DEFAULT 0, size_23_5 numeric DEFAULT 0, size_24 numeric DEFAULT 0, size_24_5 numeric DEFAULT 0, size_25 numeric DEFAULT 0,
    size_25_5 numeric DEFAULT 0, size_26 numeric DEFAULT 0, size_26_5 numeric DEFAULT 0, size_27 numeric DEFAULT 0, size_27_5 numeric DEFAULT 0,
    size_28 numeric DEFAULT 0, size_28_5 numeric DEFAULT 0, size_29 numeric DEFAULT 0, size_29_5 numeric DEFAULT 0, size_30 numeric DEFAULT 0,
    size_30_5 numeric DEFAULT 0, size_31 numeric DEFAULT 0, size_31_5 numeric DEFAULT 0, size_32 numeric DEFAULT 0, size_32_5 numeric DEFAULT 0,
    size_33 numeric DEFAULT 0, size_33_5 numeric DEFAULT 0, size_34 numeric DEFAULT 0, size_34_5 numeric DEFAULT 0, size_35 numeric DEFAULT 0,
    size_35_5 numeric DEFAULT 0, size_36 numeric DEFAULT 0, size_36_5 numeric DEFAULT 0, size_37 numeric DEFAULT 0, size_37_5 numeric DEFAULT 0,
    size_38 numeric DEFAULT 0, size_38_5 numeric DEFAULT 0, size_39 numeric DEFAULT 0, size_39_5 numeric DEFAULT 0, size_40 numeric DEFAULT 0,
    size_40_5 numeric DEFAULT 0, size_41 numeric DEFAULT 0, size_41_5 numeric DEFAULT 0, size_42 numeric DEFAULT 0, size_42_5 numeric DEFAULT 0,
    size_43 numeric DEFAULT 0, size_43_5 numeric DEFAULT 0, size_44 numeric DEFAULT 0, size_44_5 numeric DEFAULT 0, size_45 numeric DEFAULT 0,
    size_45_5 numeric DEFAULT 0, size_46 numeric DEFAULT 0, size_46_5 numeric DEFAULT 0, size_47 numeric DEFAULT 0, size_47_5 numeric DEFAULT 0,
    size_48 numeric DEFAULT 0, size_48_5 numeric DEFAULT 0, size_49 numeric DEFAULT 0, size_49_5 numeric DEFAULT 0, size_50 numeric DEFAULT 0,
    "size_134.9mm*355mm" numeric DEFAULT 0,
    "size_134.9mm*390mm" numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.supplement_confirm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON public.supplement_confirm FOR SELECT TO anon USING (true);
CREATE POLICY "Public Insert Access" ON public.supplement_confirm FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public Update Access" ON public.supplement_confirm FOR UPDATE TO anon USING (true);
CREATE POLICY "Public Delete Access" ON public.supplement_confirm FOR DELETE TO anon USING (true);
