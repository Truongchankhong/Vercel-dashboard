-- SQL for System Control & Page Management
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.system_config (
    id text primary key,
    value text,
    description text
);

-- Seed initial data (default password: admin | all pages: ON)
INSERT INTO public.system_config (id, value, description)
VALUES 
('admin_password', 'admin', 'Password for system controls'),
('status_index.html', 'ON', 'Status of Home Page'),
('status_supplement.html', 'ON', 'Status of Supplement Page'),
('status_supplement-confirm.html', 'ON', 'Status of Confirm Page'),
('status_supplement-count.html', 'ON', 'Status of Count Page'),
('status_surplus-goods.html', 'ON', 'Status of Surplus Page')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Policies for public access (Read-only for all, Update-only if password matches in client)
CREATE POLICY "Public Read Access" ON public.system_config FOR SELECT TO anon USING (true);
CREATE POLICY "Public Update Access" ON public.system_config FOR UPDATE TO anon USING (true);
