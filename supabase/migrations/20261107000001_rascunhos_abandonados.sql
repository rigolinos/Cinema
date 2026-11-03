-- Rascunhos abandonados: respondeu às perguntas ou pediu ideias, não escolheu nenhuma e não voltou em 7 dias.
-- Eles enchiam a lista com "Vídeo sem ideia ainda". As ideias marcadas com Guardar ficam em saved_ideas e não somem.

-- Vazio de verdade: quem colou um texto ou já tem roteiro não está vazio, mesmo sem responder às perguntas.
create or replace function public.is_empty_draft(v public.videos)
returns boolean
language sql
stable
set search_path = public
as $$
    select v.title is null and v.objective is null and v.platform is null and v.duration_s is null
       and coalesce(cardinality(v.resources), 0) = 0
       and v.hook is null and v.brief = ''
       and not exists (select 1 from video_ideas i where i.video_id = v.id)
       and not exists (select 1 from script_blocks b where b.video_id = v.id);
$$;

create or replace function public.is_abandoned_draft(v public.videos)
returns boolean
language sql
stable
set search_path = public
as $$
    select v.title is null and v.hook is null and v.brief = '' and v.stage = 'ideia'
       and greatest(v.created_at, v.updated_at) < now() - interval '7 days'
       and not exists (select 1 from script_blocks b where b.video_id = v.id);
$$;

create or replace function public.delete_empty_drafts(p_keep_minutes integer default 60)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_count integer;
begin
    with gone as (
        delete from videos v
        where v.owner_id = auth.uid()
          and (
              (public.is_empty_draft(v) and v.created_at < now() - make_interval(mins => greatest(p_keep_minutes, 0)))
              or public.is_abandoned_draft(v)
          )
        returning 1
    )
    select count(*) into v_count from gone;
    return v_count;
end;
$$;
