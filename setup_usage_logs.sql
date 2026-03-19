-- SQL to create the usage_logs table for egress monitoring
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.usage_logs (
    id bigint primary key generated always as identity,
    timestamp timestamptz default now(),
    page_path text,
    table_name text,
    action text,
    size_bytes bigint,
    record_count int
);

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Policies for public access (so client can log usage)
CREATE POLICY "Public Read Access" ON public.usage_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Public Insert Access" ON public.usage_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public Delete Access" ON public.usage_logs FOR DELETE TO anon USING (true); -- Optional: for cleanup

-- Add index for performance in monitoring dashboard
CREATE INDEX IF NOT EXISTS idx_usage_page_path ON public.usage_logs(page_path);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON public.usage_logs(timestamp);
