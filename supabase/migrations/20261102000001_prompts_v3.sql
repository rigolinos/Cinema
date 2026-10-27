-- Prompts v3: ideias com situação e desfecho, três portas de entrada, produto para quem vende
-- e os sinais novos da memória.

-- A ideia completa: a cena (situation) e o desfecho exato (payoff: a virada, o resultado, a dica ou a oferta).
alter table public.video_ideas
    add column situation text not null default '' check (char_length(situation) <= 600),
    add column payoff text not null default '' check (char_length(payoff) <= 600);

alter table public.creator_ideas
    add column situation text not null default '' check (char_length(situation) <= 600),
    add column payoff text not null default '' check (char_length(payoff) <= 600),
    add column objective text check (objective in ('crescer', 'vender', 'divertir', 'ensinar'));

alter table public.saved_ideas
    add column situation text not null default '' check (char_length(situation) <= 600),
    add column payoff text not null default '' check (char_length(payoff) <= 600);

-- O vídeo guarda a ideia escolhida inteira, o que a pessoa trouxe (briefing, ideia ou roteiro colado)
-- e por qual porta começou.
alter table public.videos
    add column situation text not null default '' check (char_length(situation) <= 600),
    add column payoff text not null default '' check (char_length(payoff) <= 600),
    add column brief text not null default '' check (char_length(brief) <= 4000),
    add column start_door text check (start_door in ('zero', 'ideia', 'roteiro'));

-- Quem vende conta o que vende e por que comprar dali; vem preenchido no próximo vídeo de venda.
alter table public.creator_profiles
    add column product text check (char_length(product) <= 200),
    add column product_edge text check (char_length(product_edge) <= 200);

-- Escolher uma ideia leva a cena e o desfecho para o vídeo.
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
        situation = v_idea.situation,
        payoff = v_idea.payoff,
        stage = case when stage = 'ideia' then 'roteiro' else stage end
    where id = v_idea.video_id;
end;
$$;

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

    insert into videos (owner_id, title, format_slug, hook, situation, payoff, objective, platform, duration_s, resources, stage, start_door)
    values (auth.uid(), v_idea.title, v_idea.format_slug, v_idea.hook, v_idea.situation, v_idea.payoff, p_objective, p_platform,
            p_duration, coalesce(p_resources, '{}'), 'roteiro', 'zero')
    returning id into v_video;

    update creator_ideas set video_id = v_video where id = v_idea.id;
    return v_video;
end;
$$;

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

    insert into videos (owner_id, title, format_slug, hook, situation, payoff, objective, platform, platforms, duration_s, resources, stage, start_door)
    values (auth.uid(), v_idea.title, v_idea.format_slug, v_idea.hook, v_idea.situation, v_idea.payoff, p_objective,
            coalesce(v_main, p_platforms[1]), p_platforms, p_duration, coalesce(p_resources, '{}'), 'roteiro', 'zero')
    returning id into v_video;

    update saved_ideas set video_id = v_video where id = v_idea.id;
    return v_video;
end;
$$;

-- Sinais novos da memória: roteiro colado, sugestão aceita ou recusada e a porta de entrada.
alter table public.creator_signals drop constraint creator_signals_kind_check;
alter table public.creator_signals add constraint creator_signals_kind_check check (kind in (
    'ideia_escolhida', 'pedido_ideia', 'pedido_bloco', 'roteiro_editado',
    'plano_apagado', 'plano_adicionado', 'plano_pulado', 'ideia_quinzena_usada', 'formato_usado', 'ideia_guardada',
    'roteiro_colado', 'sugestao_aceita', 'sugestao_recusada', 'porta_entrada'
));
