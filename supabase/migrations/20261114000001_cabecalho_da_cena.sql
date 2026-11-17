-- Cabeçalho da cena, como num roteiro de filme: "INT. COZINHA – DIA". A IA escreve ao montar o roteiro e
-- divide as cenas por ele (mudou o lugar ou o momento, é outra cena). Cenas antigas ficam sem: o app mostra
-- "CENA 1" ou o lugar dos planos.

alter table public.script_blocks add column heading text check (char_length(heading) <= 80);

create or replace function public.replace_script(p_video_id uuid, p_blocks jsonb)
returns setof public.script_blocks
language plpgsql
security invoker
set search_path = public
as $$
begin
    if not public.owns_video(p_video_id) then
        raise exception 'Vídeo não encontrado.';
    end if;
    if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) = 0 or jsonb_array_length(p_blocks) > 20 then
        raise exception 'O roteiro precisa ter entre 1 e 20 blocos.';
    end if;

    delete from script_blocks where video_id = p_video_id;

    return query
    insert into script_blocks (video_id, position, kind, label, speech, on_screen, action, heading)
    select p_video_id,
           (b.ord - 1)::integer,
           b.item->>'kind',
           nullif(b.item->>'label', ''),
           coalesce(b.item->>'speech', ''),
           coalesce(b.item->>'on_screen', ''),
           coalesce(b.item->>'action', ''),
           nullif(left(trim(b.item->>'heading'), 80), '')
    from jsonb_array_elements(p_blocks) with ordinality as b(item, ord)
    returning *;
end;
$$;

revoke all on function public.replace_script(uuid, jsonb) from public, anon;
grant execute on function public.replace_script(uuid, jsonb) to authenticated;
