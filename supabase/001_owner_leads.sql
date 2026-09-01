create extension if not exists pgcrypto;

create table if not exists public.owner_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  company text not null default '',
  email text,
  phone text,
  source text not null default 'manual',
  source_url text,
  source_note text,
  consent_at timestamptz,
  status text not null default 'novo' check (status in ('novo','contatado','qualificado','proposta','convertido','descartado')),
  score integer not null default 0 check (score between 0 and 100),
  tags text[] not null default '{}',
  notes text not null default '',
  owner text,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
);

create unique index if not exists owner_leads_email_uq on public.owner_leads(lower(email)) where email is not null;

create index if not exists owner_leads_status_idx on public.owner_leads(status);
create index if not exists owner_leads_score_idx on public.owner_leads(score desc);
create index if not exists owner_leads_source_idx on public.owner_leads(source);
create index if not exists owner_leads_created_idx on public.owner_leads(created_at desc);

alter table public.owner_leads enable row level security;
-- A API usa a service role no servidor. Não conceda service_role ao navegador.
-- Se quiser acesso direto pelo Supabase client futuramente, crie políticas RLS específicas por usuário/tenant.
