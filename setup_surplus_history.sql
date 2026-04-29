CREATE TABLE IF NOT EXISTS public.surplusgoods_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surplus_id UUID,
    rpro TEXT,
    section TEXT,
    old_total FLOAT8 DEFAULT 0,
    new_total FLOAT8 DEFAULT 0,
    change_amount FLOAT8 DEFAULT 0,
    action_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.surplusgoods_history ENABLE ROW LEVEL SECURITY;

-- Policies for public access
CREATE POLICY "Public Read Access" ON public.surplusgoods_history FOR SELECT TO anon USING (true);
CREATE POLICY "Public Insert Access" ON public.surplusgoods_history FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public Delete Access" ON public.surplusgoods_history FOR DELETE TO anon USING (true);
CREATE POLICY "Public Update Access" ON public.surplusgoods_history FOR UPDATE TO anon USING (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_surplus_history_rpro ON public.surplusgoods_history(rpro);
CREATE INDEX IF NOT EXISTS idx_surplus_history_surplus_id ON public.surplusgoods_history(surplus_id);
