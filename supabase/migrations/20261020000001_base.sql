-- Base: o banco como foi montado à mão pelo SQL editor (schema.sql + enable_rls.sql + fix_policies.sql).
-- No banco de produção esta migration já está aplicada: marcar com
--   npx supabase migration repair --status applied 20261020000001

-- SCHEMA PARA O ASSISTENTE DE DIRETOR (CINEBOARD)
-- Executar no SQL Editor do Supabase

-- Habilitar a extensão UUID se não estiver habilitada
create extension if not exists "uuid-ossp";

-- 1. Tabela de Organizações (Produtoras)
create table public.organizations (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    slug text not null unique,
    plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.organizations enable row level security;

-- 2. Tabela de Membros de Organizações
create table public.organization_members (
    id uuid default gen_random_uuid() primary key,
    org_id uuid references public.organizations(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    role text not null default 'member' check (role in ('owner', 'admin', 'member')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (org_id, user_id)
);

-- Habilitar RLS
alter table public.organization_members enable row level security;

-- 3. Tabela de Projetos
create table public.projects (
    id uuid default gen_random_uuid() primary key,
    org_id uuid references public.organizations(id) on delete cascade not null,
    title text not null,
    description text,
    status text not null default 'draft' check (status in ('draft', 'planning', 'scheduled', 'in_production', 'wrapped')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.projects enable row level security;

-- 4. Tabela de Cenas
create table public.scenes (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    number text not null,
    int_ext text not null check (int_ext in ('INT', 'EXT', 'INT/EXT')),
    location_name text not null,
    time_of_day text not null check (time_of_day in ('DIA', 'NOITE', 'AMANHECER', 'ENTARDECER')),
    synopsis text not null,
    pages integer not null, -- Em oitavos (ex: 2 = 2/8)
    estimated_hours numeric not null default 0,
    dependencies jsonb default '[]'::jsonb not null,
    weather_requirement text not null default 'any' check (weather_requirement in ('any', 'sun', 'cloudy', 'rain', 'snow', 'wind', 'fog')),
    notes text,
    order_index integer not null default 0,
    unique (project_id, number)
);

-- Habilitar RLS
alter table public.scenes enable row level security;

-- 5. Tabela de Personagens
create table public.characters (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    name text not null,
    scene_ids jsonb default '[]'::jsonb not null,
    size text not null default 'small' check (size in ('protagonist', 'supporting', 'small')),
    total_scenes integer not null default 0,
    unique (project_id, name)
);

-- Habilitar RLS
alter table public.characters enable row level security;

-- 6. Tabela de Atores Reais
create table public.actors (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    full_name text not null,
    cost_per_day numeric not null default 0,
    blocked_dates jsonb default '[]'::jsonb not null, -- Array de datas ISO bloqueadas
    max_consecutive_days integer not null default 6,
    availability_start date,
    availability_end date,
    notes text
);

-- Habilitar RLS
alter table public.actors enable row level security;

-- 7. Tabela de Casting (Vínculo Personagem -> Ator)
create table public.castings (
    id uuid default gen_random_uuid() primary key,
    character_id uuid references public.characters(id) on delete cascade not null,
    actor_id uuid references public.actors(id) on delete cascade not null,
    confirmed boolean not null default false,
    unique (character_id, actor_id)
);

-- Habilitar RLS
alter table public.castings enable row level security;

-- 8. Tabela de Locações
create table public.locations (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    name text not null,
    address text,
    lat numeric,
    lng numeric,
    cost_per_day numeric not null default 0,
    availability jsonb default '[]'::jsonb not null,
    setup_time_hours numeric not null default 0,
    is_covered boolean not null default true,
    weather_risk text not null default 'low' check (weather_risk in ('low', 'medium', 'high')),
    notes text
);

-- Habilitar RLS
alter table public.locations enable row level security;

-- 9. Tabela de Shooting Days (Dias de Gravação)
create table public.shooting_days (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    day_number integer not null,
    date date not null,
    location_id uuid references public.locations(id) on delete set null,
    scene_ids jsonb default '[]'::jsonb not null,
    actor_ids jsonb default '[]'::jsonb not null,
    estimated_hours numeric not null default 0,
    cost_estimate numeric not null default 0,
    notes text,
    unique (project_id, day_number)
);

-- Habilitar RLS
alter table public.shooting_days enable row level security;

-- 10. Configurações de Projeto
create table public.project_settings (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null unique,
    production_start date not null,
    production_end date not null,
    max_hours_per_day numeric not null default 12,
    num_crews integer not null default 1
);

-- Habilitar RLS
alter table public.project_settings enable row level security;


-- ========================================================
-- DEFINIÇÃO DAS POLÍTICAS DE SEGURANÇA (RLS)
-- ========================================================

-- Auxiliar: Verifica se o usuário logado é membro de uma organização
create or replace function public.is_member_of_org(org_id uuid)
returns boolean security definer as $$
begin
    return exists (
        select 1 from public.organization_members
        where organization_members.org_id = is_member_of_org.org_id
        and organization_members.user_id = auth.uid()
    );
end;
$$ language plpgsql;

-- Auxiliar: Verifica se o usuário é membro do projeto
create or replace function public.is_member_of_project(project_id uuid)
returns boolean security definer as $$
declare
    v_org_id uuid;
begin
    select org_id into v_org_id from public.projects where id = project_id;
    if v_org_id is null then
        return false;
    end if;
    return public.is_member_of_org(v_org_id);
end;
$$ language plpgsql;

-- 1. Políticas para Organizations
create policy "Users can view their own organizations"
    on public.organizations for select
    using ( public.is_member_of_org(id) );

create policy "Owners can update their organization"
    on public.organizations for update
    using (
        exists (
            select 1 from public.organization_members
            where org_id = organizations.id
            and user_id = auth.uid()
            and role = 'owner'
        )
    );

-- 2. Políticas para Organization Members
create policy "Members can view other members of same org"
    on public.organization_members for select
    using ( public.is_member_of_org(org_id) );

-- 3. Políticas para Projects
create policy "Members can view projects of their org"
    on public.projects for select
    using ( public.is_member_of_org(org_id) );

create policy "Members can insert projects in their org"
    on public.projects for insert
    with check ( public.is_member_of_org(org_id) );

create policy "Members can update projects of their org"
    on public.projects for update
    using ( public.is_member_of_org(org_id) );

create policy "Admins/Owners can delete projects of their org"
    on public.projects for delete
    using (
        exists (
            select 1 from public.organization_members
            where org_id = projects.org_id
            and user_id = auth.uid()
            and role in ('owner', 'admin')
        )
    );

-- 4. Políticas para Scenes
create policy "Members can view project scenes"
    on public.scenes for select
    using ( public.is_member_of_project(project_id) );

create policy "Members can manage project scenes"
    on public.scenes for all
    using ( public.is_member_of_project(project_id) )
    with check ( public.is_member_of_project(project_id) );

-- 5. Políticas para Characters
create policy "Members can view characters"
    on public.characters for select
    using ( public.is_member_of_project(project_id) );

create policy "Members can manage characters"
    on public.characters for all
    using ( public.is_member_of_project(project_id) )
    with check ( public.is_member_of_project(project_id) );

-- 6. Políticas para Actors
create policy "Members can view actors"
    on public.actors for select
    using ( public.is_member_of_project(project_id) );

create policy "Members can manage actors"
    on public.actors for all
    using ( public.is_member_of_project(project_id) )
    with check ( public.is_member_of_project(project_id) );

-- 7. Políticas para Castings
create policy "Members can view castings"
    on public.castings for select
    using (
        exists (
            select 1 from public.characters
            where id = character_id
            and public.is_member_of_project(project_id)
        )
    );

create policy "Members can manage castings"
    on public.castings for all
    using (
        exists (
            select 1 from public.characters
            where id = character_id
            and public.is_member_of_project(project_id)
        )
    )
    with check (
        exists (
            select 1 from public.characters
            where id = character_id
            and public.is_member_of_project(project_id)
        )
    );

-- 8. Políticas para Locations
create policy "Members can view locations"
    on public.locations for select
    using ( public.is_member_of_project(project_id) );

create policy "Members can manage locations"
    on public.locations for all
    using ( public.is_member_of_project(project_id) )
    with check ( public.is_member_of_project(project_id) );

-- 9. Políticas para Shooting Days
create policy "Members can view shooting days"
    on public.shooting_days for select
    using ( public.is_member_of_project(project_id) );

create policy "Members can manage shooting days"
    on public.shooting_days for all
    using ( public.is_member_of_project(project_id) )
    with check ( public.is_member_of_project(project_id) );

-- 10. Políticas para Project Settings
create policy "Members can view settings"
    on public.project_settings for select
    using ( public.is_member_of_project(project_id) );

create policy "Members can manage settings"
    on public.project_settings for all
    using ( public.is_member_of_project(project_id) )
    with check ( public.is_member_of_project(project_id) );


-- ========================================================
-- GATILHO AUTOMÁTICO DE CRIAÇÃO DE ORGANIZAÇÃO NO SIGNUP
-- ========================================================

-- Função que cria org automática e vincula o usuário
create or replace function public.handle_new_user()
returns trigger security definer as $$
declare
    v_org_id uuid;
    v_org_name text;
    v_slug text;
begin
    -- Pegar nome da organização do metadata de signup, ou usar padrão
    v_org_name := coalesce(new.raw_user_meta_data->>'org_name', 'Minha Produtora');
    
    -- Gerar slug simples
    v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(md5(random()::text) from 1 for 4);

    -- 1. Criar Organização
    insert into public.organizations (name, slug, plan)
    values (v_org_name, v_slug, 'free')
    returning id into v_org_id;

    -- 2. Adicionar Usuário como 'owner'
    insert into public.organization_members (org_id, user_id, role)
    values (v_org_id, new.id, 'owner');

    return new;
end;
$$ language plpgsql;

-- Trigger após inserção na auth.users
create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();


-- ========================================================
-- GATILHO DE ATUALIZAÇÃO DO Campo updated_at
-- ========================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger on_project_updated
    before update on public.projects
    for each row execute procedure public.handle_updated_at();


-- ============================================================
-- SCRIPT DE CORREÇÃO: Re-habilitar RLS + Políticas de INSERT
-- ============================================================
-- Execute este script INTEIRO no SQL Editor do Supabase Dashboard
-- Isso corrige o bug de um usuário ver projetos de outro usuário.

-- ============================================================
-- PASSO 1: Re-habilitar Row Level Security em TODAS as tabelas
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.castings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shooting_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASSO 2: Adicionar políticas de INSERT faltantes
-- ============================================================
-- Essas políticas permitem que um usuário autenticado crie
-- sua própria organização e se vincule a ela (auto-recuperação)

-- Política para criar organização
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.organizations;
CREATE POLICY "Enable insert for authenticated users" ON public.organizations
    FOR INSERT WITH CHECK ( auth.role() = 'authenticated' );

-- Política para vincular-se como membro
DROP POLICY IF EXISTS "Enable insert for authenticated users matching their uid" ON public.organization_members;
CREATE POLICY "Enable insert for authenticated users matching their uid" ON public.organization_members
    FOR INSERT WITH CHECK ( auth.uid() = user_id );

-- ============================================================
-- PASSO 3: Garantir políticas de INSERT para Projects
-- ============================================================
-- A política original usa WITH CHECK, mas vamos garantir que existe

DROP POLICY IF EXISTS "Members can insert projects in their org" ON public.projects;
CREATE POLICY "Members can insert projects in their org" ON public.projects
    FOR INSERT WITH CHECK ( public.is_member_of_org(org_id) );

-- ============================================================
-- PASSO 4: Garantir políticas de INSERT para tabelas filhas
-- ============================================================
-- As políticas "for all" já cobrem INSERT, mas vamos garantir
-- que existem policies explícitas de INSERT para cada tabela

-- Scenes
DROP POLICY IF EXISTS "Members can insert scenes" ON public.scenes;
CREATE POLICY "Members can insert scenes" ON public.scenes
    FOR INSERT WITH CHECK ( public.is_member_of_project(project_id) );

-- Characters
DROP POLICY IF EXISTS "Members can insert characters" ON public.characters;
CREATE POLICY "Members can insert characters" ON public.characters
    FOR INSERT WITH CHECK ( public.is_member_of_project(project_id) );

-- Actors
DROP POLICY IF EXISTS "Members can insert actors" ON public.actors;
CREATE POLICY "Members can insert actors" ON public.actors
    FOR INSERT WITH CHECK ( public.is_member_of_project(project_id) );

-- Castings
DROP POLICY IF EXISTS "Members can insert castings" ON public.castings;
CREATE POLICY "Members can insert castings" ON public.castings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.characters
            WHERE id = character_id
            AND public.is_member_of_project(project_id)
        )
    );

-- Locations
DROP POLICY IF EXISTS "Members can insert locations" ON public.locations;
CREATE POLICY "Members can insert locations" ON public.locations
    FOR INSERT WITH CHECK ( public.is_member_of_project(project_id) );

-- Shooting Days
DROP POLICY IF EXISTS "Members can insert shooting days" ON public.shooting_days;
CREATE POLICY "Members can insert shooting days" ON public.shooting_days
    FOR INSERT WITH CHECK ( public.is_member_of_project(project_id) );

-- Project Settings
DROP POLICY IF EXISTS "Members can insert settings" ON public.project_settings;
CREATE POLICY "Members can insert settings" ON public.project_settings
    FOR INSERT WITH CHECK ( public.is_member_of_project(project_id) );

-- ============================================================
-- PASSO 5: Garantir política de DELETE para tabelas filhas
-- ============================================================
-- O uploadScript faz DELETE em scenes/characters/locations/shooting_days
-- antes de reinserir. Precisamos de policies explícitas de DELETE.

DROP POLICY IF EXISTS "Members can delete scenes" ON public.scenes;
CREATE POLICY "Members can delete scenes" ON public.scenes
    FOR DELETE USING ( public.is_member_of_project(project_id) );

DROP POLICY IF EXISTS "Members can delete characters" ON public.characters;
CREATE POLICY "Members can delete characters" ON public.characters
    FOR DELETE USING ( public.is_member_of_project(project_id) );

DROP POLICY IF EXISTS "Members can delete locations" ON public.locations;
CREATE POLICY "Members can delete locations" ON public.locations
    FOR DELETE USING ( public.is_member_of_project(project_id) );

DROP POLICY IF EXISTS "Members can delete shooting days" ON public.shooting_days;
CREATE POLICY "Members can delete shooting days" ON public.shooting_days
    FOR DELETE USING ( public.is_member_of_project(project_id) );

DROP POLICY IF EXISTS "Members can delete actors" ON public.actors;
CREATE POLICY "Members can delete actors" ON public.actors
    FOR DELETE USING ( public.is_member_of_project(project_id) );

DROP POLICY IF EXISTS "Members can delete castings" ON public.castings;
CREATE POLICY "Members can delete castings" ON public.castings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.characters
            WHERE id = character_id
            AND public.is_member_of_project(project_id)
        )
    );

DROP POLICY IF EXISTS "Members can delete settings" ON public.project_settings;
CREATE POLICY "Members can delete settings" ON public.project_settings
    FOR DELETE USING ( public.is_member_of_project(project_id) );

-- ============================================================
-- PRONTO! Agora cada usuário só vê seus próprios dados.
-- ============================================================
