-- ============================================================
-- Booking requests — run once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- what was requested
  service          text        not null,
  session_type     text        not null,
  session_label    text        not null,
  price            numeric(10,2) not null default 0,
  duration_minutes integer,
  starts_at        timestamptz not null,
  time_zone        text        not null default 'Asia/Riyadh',

  -- who is asking
  name             text        not null,
  email            text        not null,
  whatsapp         text        not null,
  child            text,                      -- optional
  reason           text,
  language         text        not null default 'ar',

  -- workflow
  status           text        not null default 'pending'
                   check (status in ('pending','contacted','paid','cancelled')),
  cal_booking_uid  text,
  receipt_path     text,
  admin_note       text,
  paid_at          timestamptz
);

-- Added later; safe to re-run this whole file at any time.
alter table public.requests add column if not exists cal_status text;

create index if not exists requests_status_idx  on public.requests (status);
create index if not exists requests_created_idx on public.requests (created_at desc);
create index if not exists requests_starts_idx  on public.requests (starts_at);

-- The server refuses a request that overlaps a live one, but two forms
-- submitted in the same second can both pass that check. This makes the
-- database the last word on the common case — the same start time twice.
-- A cancelled request frees its slot, so it is excluded.
create unique index if not exists requests_slot_unique
  on public.requests (starts_at) where status <> 'cancelled';

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists requests_touch on public.requests;
create trigger requests_touch before update on public.requests
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ─────────────────────────────────────
-- RLS on with NO policies means the anon/public key can do
-- nothing at all. Every read and write goes through the server
-- using the service_role key, which bypasses RLS. Client-side
-- code never touches this table.
alter table public.requests enable row level security;

-- ── Storage ────────────────────────────────────────────────
-- Private bucket for payment screenshots. Served only through
-- short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
