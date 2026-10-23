-- Ideias guardadas: o marcador nos cartões de ideia (como o "salvar" do Instagram).
-- A pessoa guarda sem sair da lista e depois começa o vídeo com um toque, na tela Ideias.

create table public.saved_ideas (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    source text not null check (source in ('video', 'quinzena')),
    source_id uuid not null, -- video_ideas.id ou creator_ideas.id
    title text not null check (char_length(title) between 1 and 140),
    format_slug text check (char_length(format_slug) <= 60),
    hook text not null check (char_length(hook) <= 300),
    why text check (char_length(why) <= 400),
    video_id uuid references public.videos(id) on delete set null, -- vídeo começado a partir dela
    created_at timestamptz not null default now(),
    unique (owner_id, source_id)
);

create index saved_ideas_owner_idx on public.saved_ideas (owner_id, created_at desc);

alter table public.saved_ideas enable row level security;

create policy "Pessoa vê as ideias que guardou" on public.saved_ideas
    for select using (owner_id = auth.uid());
-- Guarda o texto da ideia como veio; o vínculo com o vídeo só muda pela função abaixo.
create policy "Pessoa guarda ideias" on public.saved_ideas
    for insert with check (owner_id = auth.uid() and video_id is null);
create policy "Pessoa tira ideias guardadas" on public.saved_ideas
    for delete using (owner_id = auth.uid());

-- Começar um vídeo a partir de uma ideia guardada: já nasce no roteiro.
create or replace function public.start_video_from_saved(
    p_saved_id uuid,
    p_objective text,
    p_platforms text[],
    p_duration integer,
    p_resources text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_idea saved_ideas;
    v_video uuid;
    v_main text;
begin
    select * into v_idea from saved_ideas where id = p_saved_id and owner_id = auth.uid();
    if v_idea.id is null then
        raise exception 'Ideia não encontrada.';
    end if;
    if coalesce(cardinality(p_platforms), 0) = 0 then
        raise exception 'Escolha onde o vídeo vai sair.';
    end if;

    -- A principal é a primeira em pé (Reels, TikTok, Shorts); só YouTube grava deitado.
    select p into v_main from unnest(p_platforms) with ordinality as t(p, i)
        where p in ('reels', 'tiktok', 'shorts') order by i limit 1;

    insert into videos (owner_id, title, format_slug, hook, objective, platform, platforms, duration_s, resources, stage)
    values (auth.uid(), v_idea.title, v_idea.format_slug, v_idea.hook, p_objective, coalesce(v_main, p_platforms[1]), p_platforms,
            p_duration, coalesce(p_resources, '{}'), 'roteiro')
    returning id into v_video;

    update saved_ideas set video_id = v_video where id = v_idea.id;
    return v_video;
end;
$$;

revoke all on function public.start_video_from_saved(uuid, text, text[], integer, text[]) from public, anon;
grant execute on function public.start_video_from_saved(uuid, text, text[], integer, text[]) to authenticated;

-- Guardar uma ideia é um sinal forte do que a pessoa curte: entra na memória.
alter table public.creator_signals drop constraint creator_signals_kind_check;
alter table public.creator_signals add constraint creator_signals_kind_check check (kind in (
    'ideia_escolhida', 'pedido_ideia', 'pedido_bloco', 'roteiro_editado',
    'plano_apagado', 'plano_adicionado', 'plano_pulado', 'ideia_quinzena_usada', 'formato_usado', 'ideia_guardada'
));
