-- L1: o criador, seus vídeos e as ideias que o assistente sugere.
-- Tudo é privado: cada pessoa só vê o que é dela.

-- Perfil do criador: o assistente usa em todas as conversas.
create table public.creator_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
    display_name text check (char_length(display_name) <= 80),
    niche text check (char_length(niche) <= 120),
    platforms text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint creator_platforms_ok check (platforms <@ array['reels', 'tiktok', 'shorts', 'youtube']::text[])
);

alter table public.creator_profiles enable row level security;

create policy "Criador lê o próprio perfil" on public.creator_profiles
    for select using (user_id = auth.uid());
create policy "Criador cria o próprio perfil" on public.creator_profiles
    for insert with check (user_id = auth.uid());
create policy "Criador edita o próprio perfil" on public.creator_profiles
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger on_creator_profile_updated
    before update on public.creator_profiles
    for each row execute procedure public.handle_updated_at();

-- Um vídeo e a trilha dele (ideia → roteiro → pessoas → planos → gravar).
create table public.videos (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    title text check (char_length(title) <= 140),
    format_slug text check (char_length(format_slug) <= 60),
    hook text check (char_length(hook) <= 300),
    objective text check (objective in ('crescer', 'vender', 'divertir', 'ensinar')),
    platform text check (platform in ('reels', 'tiktok', 'shorts', 'youtube')),
    duration_s integer check (duration_s between 5 and 3600),
    resources text[] not null default '{}',
    stage text not null default 'ideia' check (stage in ('ideia', 'roteiro', 'pessoas', 'planos', 'gravar', 'pronto')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint video_resources_ok check (resources <@ array['sozinho', 'com_alguem', 'em_casa', 'na_rua']::text[])
);

create index videos_owner_idx on public.videos (owner_id, updated_at desc);

alter table public.videos enable row level security;

create policy "Dono vê os próprios vídeos" on public.videos
    for select using (owner_id = auth.uid());
create policy "Dono cria vídeo" on public.videos
    for insert with check (owner_id = auth.uid());
create policy "Dono edita o vídeo" on public.videos
    for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Dono apaga o vídeo" on public.videos
    for delete using (owner_id = auth.uid());

create trigger on_video_updated
    before update on public.videos
    for each row execute procedure public.handle_updated_at();

-- Ideias sugeridas para um vídeo. Cada pedido ao assistente é uma rodada (round).
create table public.video_ideas (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos(id) on delete cascade,
    round integer not null default 1,
    title text not null check (char_length(title) <= 140),
    format_slug text check (char_length(format_slug) <= 60),
    hook text not null check (char_length(hook) <= 300),
    why text check (char_length(why) <= 400),
    chosen boolean not null default false,
    created_at timestamptz not null default now()
);

create index video_ideas_video_idx on public.video_ideas (video_id, round desc);
create unique index video_ideas_one_chosen on public.video_ideas (video_id) where chosen;

alter table public.video_ideas enable row level security;

create or replace function public.owns_video(p_video_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from videos where id = p_video_id and owner_id = auth.uid());
$$;

create policy "Dono vê as ideias do vídeo" on public.video_ideas
    for select using (public.owns_video(video_id));
create policy "Dono guarda ideias do vídeo" on public.video_ideas
    for insert with check (public.owns_video(video_id) and not chosen);
create policy "Dono apaga ideias do vídeo" on public.video_ideas
    for delete using (public.owns_video(video_id));

-- Escolher uma ideia: marca a escolhida, copia para o vídeo e avança a trilha.
create or replace function public.choose_idea(p_idea_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_idea video_ideas;
begin
    select * into v_idea from video_ideas where id = p_idea_id;
    if v_idea.id is null or not public.owns_video(v_idea.video_id) then
        raise exception 'Ideia não encontrada.';
    end if;

    update video_ideas set chosen = false where video_id = v_idea.video_id and chosen;
    update video_ideas set chosen = true where id = p_idea_id;

    update videos
    set title = v_idea.title,
        format_slug = v_idea.format_slug,
        hook = v_idea.hook,
        stage = case when stage = 'ideia' then 'roteiro' else stage end
    where id = v_idea.video_id;
end;
$$;

revoke all on function public.choose_idea(uuid) from public, anon;
grant execute on function public.choose_idea(uuid) to authenticated;

-- Limite diário de uso da IA por pessoa (a cota gratuita é compartilhada).
create table public.ai_usage (
    user_id uuid not null references auth.users(id) on delete cascade,
    day date not null default current_date,
    calls integer not null default 0,
    primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

create policy "Pessoa vê o próprio uso" on public.ai_usage
    for select using (user_id = auth.uid());

-- Gasta uma chamada da cota do dia. Devolve false quando o limite acabou.
create or replace function public.consume_ai_call()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit constant integer := 40;
    v_calls integer;
begin
    if auth.uid() is null then
        raise exception 'É preciso estar logado.';
    end if;

    insert into ai_usage (user_id, day, calls)
    values (auth.uid(), current_date, 1)
    on conflict (user_id, day) do update set calls = ai_usage.calls + 1
    where ai_usage.calls < v_limit
    returning calls into v_calls;

    return v_calls is not null;
end;
$$;

revoke all on function public.consume_ai_call() from public, anon;
grant execute on function public.consume_ai_call() to authenticated;
