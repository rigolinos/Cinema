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
