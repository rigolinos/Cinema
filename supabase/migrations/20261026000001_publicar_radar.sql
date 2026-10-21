-- L6: publicar o vídeo (legenda, título, hashtags, capa) e o radar da semana.

alter table public.videos add column published_at timestamptz;

-- O texto da publicação de cada vídeo (um por vídeo).
create table public.video_posts (
    video_id uuid primary key references public.videos(id) on delete cascade,
    caption text not null default '' check (char_length(caption) <= 2200),
    title text not null default '' check (char_length(title) <= 100),
    hashtags text[] not null default '{}' check (cardinality(hashtags) <= 8),
    cover_text text not null default '' check (char_length(cover_text) <= 60),
    cover_idea text not null default '' check (char_length(cover_idea) <= 300),
    updated_at timestamptz not null default now()
);

alter table public.video_posts enable row level security;

create policy "Dono vê a publicação" on public.video_posts
    for select using (public.owns_video(video_id));
create policy "Dono cria a publicação" on public.video_posts
    for insert with check (public.owns_video(video_id));
create policy "Dono edita a publicação" on public.video_posts
    for update using (public.owns_video(video_id)) with check (public.owns_video(video_id));

create trigger on_video_post_updated
    before update on public.video_posts
    for each row execute procedure public.handle_updated_at();

-- Radar da semana: trends escolhidas pela equipe, nunca inventadas pelo app.
-- Quem está logado lê; só a equipe escreve, pelo terminal (admin_add_radar).
create table public.trend_radar (
    id uuid primary key default gen_random_uuid(),
    week_start date not null,
    title text not null check (char_length(title) between 3 and 80),
    what text not null check (char_length(what) between 10 and 300),
    how_to_adapt text not null check (char_length(how_to_adapt) between 10 and 400),
    format_slug text check (char_length(format_slug) <= 60),
    created_at timestamptz not null default now()
);

create index trend_radar_week_idx on public.trend_radar (week_start desc);

alter table public.trend_radar enable row level security;

create policy "Quem está logado lê o radar" on public.trend_radar
    for select to authenticated using (true);

revoke insert, update, delete on public.trend_radar from anon, authenticated;

-- Para a equipe, pelo terminal:
--   npx supabase db query --linked "select public.admin_add_radar('2026-10-26', 'Título', 'O que é', 'Como adaptar', 'pov')"
create or replace function public.admin_add_radar(p_week_start date, p_title text, p_what text, p_how text, p_format text default null)
returns uuid
language sql
security definer
set search_path = public
as $$
    insert into trend_radar (week_start, title, what, how_to_adapt, format_slug)
    values (p_week_start, trim(p_title), trim(p_what), trim(p_how), nullif(trim(p_format), ''))
    returning id;
$$;

revoke all on function public.admin_add_radar(date, text, text, text, text) from public, anon, authenticated;
