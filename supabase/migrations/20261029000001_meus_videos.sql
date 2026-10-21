-- Meus vídeos: arquivar sem apagar, e limpar rascunhos vazios (vídeo criado e abandonado sem resposta nenhuma).

alter table public.videos add column archived_at timestamptz;

create index videos_owner_active_idx on public.videos (owner_id, updated_at desc) where archived_at is null;

-- Vazio = sem título, sem nenhuma resposta e sem ideia sugerida.
create or replace function public.is_empty_draft(v public.videos)
returns boolean
language sql
stable
set search_path = public
as $$
    select v.title is null and v.objective is null and v.platform is null and v.duration_s is null
       and coalesce(cardinality(v.resources), 0) = 0
       and not exists (select 1 from video_ideas i where i.video_id = v.id);
$$;

-- Apaga os rascunhos vazios da própria pessoa, menos os criados há menos de `p_keep_minutes` minutos
-- (para não sumir com o que ela acabou de abrir). Devolve quantos apagou.
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
          and public.is_empty_draft(v)
          and v.created_at < now() - make_interval(mins => greatest(p_keep_minutes, 0))
        returning 1
    )
    select count(*) into v_count from gone;
    return v_count;
end;
$$;

revoke all on function public.delete_empty_drafts(integer) from public, anon;
grant execute on function public.delete_empty_drafts(integer) to authenticated;
