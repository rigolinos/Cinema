-- O que já existia no banco de produção e faltava no repositório (criado à mão pelo SQL editor).
-- Idempotente: no banco de produção não muda nada; num banco novo, deixa igual à produção.
-- Ainda não usado pelo app (cenários do modo produção).

create table if not exists public.sets (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    location_id uuid references public.locations(id) on delete set null,
    name text not null,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    unique (project_id, name)
);

alter table public.sets enable row level security;

drop policy if exists "Members can view sets" on public.sets;
create policy "Members can view sets" on public.sets
    for select using (public.is_member_of_project(project_id));

drop policy if exists "Members can manage sets" on public.sets;
create policy "Members can manage sets" on public.sets
    for all using (public.is_member_of_project(project_id))
    with check (public.is_member_of_project(project_id));

alter table public.scenes add column if not exists set_id uuid references public.sets(id) on delete set null;
alter table public.projects add column if not exists production_type text not null default 'feature';
alter table public.project_settings add column if not exists default_setup_time_mins integer not null default 30;
