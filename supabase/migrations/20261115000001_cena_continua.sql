-- Uma cena pode ter mais de uma parte: a parte que continua a cena anterior aparece sem cabeçalho
-- próprio, como num roteiro de filme. Antes, o app agrupava só pelo cabeçalho igual, o que juntava
-- duas cenas que a pessoa marcou separadas no mesmo lugar. Agora a parte diz se continua a anterior.

alter table public.script_blocks add column same_scene boolean not null default false;

-- Roteiros feitos desde o cabeçalho de cena (17/11): partes seguidas com o mesmo cabeçalho eram uma cena só.
update public.script_blocks b
set same_scene = true
from (
    select id, heading, lag(heading) over (partition by video_id order by position) as prev
    from public.script_blocks
) p
where b.id = p.id and p.heading is not null and p.heading = p.prev;

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
    insert into script_blocks (video_id, position, kind, label, speech, on_screen, action, heading, same_scene)
    select p_video_id,
           (b.ord - 1)::integer,
           b.item->>'kind',
           nullif(b.item->>'label', ''),
           coalesce(b.item->>'speech', ''),
           coalesce(b.item->>'on_screen', ''),
           coalesce(b.item->>'action', ''),
           nullif(left(trim(b.item->>'heading'), 80), ''),
           b.ord > 1 and coalesce((b.item->>'same_scene')::boolean, false)
    from jsonb_array_elements(p_blocks) with ordinality as b(item, ord)
    returning *;
end;
$$;

revoke all on function public.replace_script(uuid, jsonb) from public, anon;
grant execute on function public.replace_script(uuid, jsonb) to authenticated;
