-- A pessoa também guarda a ideia dela, não só as que a IA sugere (pedido da testadora em 2026-11-27).
-- A ideia dela não vem de outra tabela: o source_id é gerado aqui, e o texto inteiro fica em brief.
-- Ao usar, o vídeo segue o caminho de "Já tenho a ideia": a história parte do texto dela, sem inventar.

alter table public.saved_ideas drop constraint saved_ideas_source_check;
alter table public.saved_ideas add constraint saved_ideas_source_check check (source in ('video', 'quinzena', 'pessoa'));
alter table public.saved_ideas alter column source_id set default gen_random_uuid();
alter table public.saved_ideas add column brief text not null default '' check (char_length(brief) <= 1500);

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
    v_own boolean;
begin
    select * into v_idea from saved_ideas where id = p_saved_id and owner_id = auth.uid();
    if v_idea.id is null then
        raise exception 'Ideia não encontrada.';
    end if;
    if coalesce(cardinality(p_platforms), 0) = 0 then
        raise exception 'Escolha onde o vídeo vai sair.';
    end if;
    v_own := v_idea.source = 'pessoa';

    -- A principal é a primeira em pé (Reels, TikTok, Shorts); só YouTube grava deitado.
    select p into v_main from unnest(p_platforms) with ordinality as t(p, i)
        where p in ('reels', 'tiktok', 'shorts') order by i limit 1;

    insert into videos (owner_id, title, format_slug, hook, situation, payoff, objective, platform, platforms, duration_s, resources, stage, start_door, brief)
    values (auth.uid(), v_idea.title, v_idea.format_slug, v_idea.hook, v_idea.situation, v_idea.payoff, p_objective,
            coalesce(v_main, p_platforms[1]), p_platforms, p_duration, coalesce(p_resources, '{}'), 'roteiro',
            case when v_own then 'ideia' else 'zero' end,
            case when v_own then v_idea.brief else '' end)
    returning id into v_video;

    update saved_ideas set video_id = v_video where id = v_idea.id;
    return v_video;
end;
$$;

revoke all on function public.start_video_from_saved(uuid, text, text[], integer, text[]) from public, anon;
grant execute on function public.start_video_from_saved(uuid, text, text[], integer, text[]) to authenticated;
