-- L2: o roteiro do vídeo, em blocos (gancho, contexto, conteúdo, virada, chamada final).
-- Cada bloco separa o que a pessoa fala, o texto que aparece na tela e o que acontece em cena.

create table public.script_blocks (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos(id) on delete cascade,
    position integer not null check (position >= 0),
    kind text not null check (kind in ('gancho', 'contexto', 'conteudo', 'virada', 'chamada')),
    label text check (char_length(label) <= 80),
    speech text not null default '' check (char_length(speech) <= 1500),
    on_screen text not null default '' check (char_length(on_screen) <= 300),
    action text not null default '' check (char_length(action) <= 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index script_blocks_video_idx on public.script_blocks (video_id, position);

alter table public.script_blocks enable row level security;

create policy "Dono vê o roteiro" on public.script_blocks
    for select using (public.owns_video(video_id));
create policy "Dono escreve o roteiro" on public.script_blocks
    for insert with check (public.owns_video(video_id));
create policy "Dono edita o roteiro" on public.script_blocks
    for update using (public.owns_video(video_id)) with check (public.owns_video(video_id));
create policy "Dono apaga blocos do roteiro" on public.script_blocks
    for delete using (public.owns_video(video_id));

create trigger on_script_block_updated
    before update on public.script_blocks
    for each row execute procedure public.handle_updated_at();

-- Troca o roteiro inteiro de uma vez (rascunho novo da IA ou reordenação), sem deixar o vídeo
-- com metade dos blocos se algo falhar no meio.
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
    insert into script_blocks (video_id, position, kind, label, speech, on_screen, action)
    select p_video_id,
           (b.ord - 1)::integer,
           b.item->>'kind',
           nullif(b.item->>'label', ''),
           coalesce(b.item->>'speech', ''),
           coalesce(b.item->>'on_screen', ''),
           coalesce(b.item->>'action', '')
    from jsonb_array_elements(p_blocks) with ordinality as b(item, ord)
    returning *;
end;
$$;

revoke all on function public.replace_script(uuid, jsonb) from public, anon;
grant execute on function public.replace_script(uuid, jsonb) to authenticated;
