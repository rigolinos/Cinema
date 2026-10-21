-- L7: ideias da quinzena. A cada 15 dias, ideias feitas para o nicho de cada criador,
-- e um toque começa o vídeo direto no roteiro.

create table public.creator_ideas (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    period_start date not null,
    position integer not null check (position between 0 and 11),
    title text not null check (char_length(title) <= 140),
    format_slug text check (char_length(format_slug) <= 60),
    hook text not null check (char_length(hook) <= 300),
    why text check (char_length(why) <= 400),
    video_id uuid references public.videos(id) on delete set null,   -- vídeo que nasceu desta ideia
    created_at timestamptz not null default now(),
    unique (owner_id, period_start, position)
);

alter table public.creator_ideas enable row level security;

create policy "Criador vê as próprias ideias" on public.creator_ideas
    for select using (owner_id = auth.uid());
create policy "Criador guarda as próprias ideias" on public.creator_ideas
    for insert with check (owner_id = auth.uid() and video_id is null);

-- Começa um vídeo a partir de uma ideia da quinzena: o vídeo já nasce com a ideia e vai para o roteiro.
create or replace function public.start_video_from_idea(
    p_idea_id uuid,
    p_objective text,
    p_platform text,
    p_duration integer,
    p_resources text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_idea creator_ideas;
    v_video uuid;
begin
    select * into v_idea from creator_ideas where id = p_idea_id and owner_id = auth.uid();
    if v_idea.id is null then
        raise exception 'Ideia não encontrada.';
    end if;

    insert into videos (owner_id, title, format_slug, hook, objective, platform, duration_s, resources, stage)
    values (auth.uid(), v_idea.title, v_idea.format_slug, v_idea.hook, p_objective, p_platform, p_duration, coalesce(p_resources, '{}'), 'roteiro')
    returning id into v_video;

    update creator_ideas set video_id = v_video where id = v_idea.id;
    return v_video;
end;
$$;

revoke all on function public.start_video_from_idea(uuid, text, text, integer, text[]) from public, anon;
grant execute on function public.start_video_from_idea(uuid, text, text, integer, text[]) to authenticated;
