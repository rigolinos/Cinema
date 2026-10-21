-- L3: a decupagem. Cada bloco do roteiro vira os planos (as tomadas) que a pessoa vai gravar.

create table public.shots (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos(id) on delete cascade,
    block_id uuid not null references public.script_blocks(id) on delete cascade,
    position integer not null check (position >= 0),        -- ordem no roteiro
    shoot_order integer check (shoot_order >= 0),            -- ordem de gravação (null = ainda não montada)
    framing text not null check (framing in ('detalhe', 'close', 'medio', 'americano', 'aberto')),
    angle text not null check (angle in ('altura_olhos', 'de_cima', 'de_baixo', 'lateral', 'por_cima_ombro')),
    movement text not null check (movement in ('parado', 'aproximando', 'afastando', 'acompanhando', 'panoramica')),
    orientation text not null default 'vertical' check (orientation in ('vertical', 'horizontal')),
    description text not null default '' check (char_length(description) <= 300),
    location text not null default '' check (char_length(location) <= 80),
    wardrobe text not null default '' check (char_length(wardrobe) <= 80),
    why text not null default '' check (char_length(why) <= 300),
    recorded boolean not null default false,                 -- marcado no modo set (L4)
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index shots_video_idx on public.shots (video_id, position);

alter table public.shots enable row level security;

create policy "Dono vê os planos" on public.shots
    for select using (public.owns_video(video_id));
create policy "Dono cria planos" on public.shots
    for insert with check (public.owns_video(video_id));
create policy "Dono edita planos" on public.shots
    for update using (public.owns_video(video_id)) with check (public.owns_video(video_id));
create policy "Dono apaga planos" on public.shots
    for delete using (public.owns_video(video_id));

-- O plano e o bloco precisam ser do mesmo vídeo.
create or replace function public.shot_block_same_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from script_blocks where id = new.block_id and video_id = new.video_id) then
        raise exception 'O plano precisa ser de um bloco do mesmo vídeo.';
    end if;
    return new;
end;
$$;

create trigger shot_block_same_video
    before insert or update of block_id, video_id on public.shots
    for each row execute procedure public.shot_block_same_video();

create trigger on_shot_updated
    before update on public.shots
    for each row execute procedure public.handle_updated_at();

-- Troca a decupagem inteira de uma vez (rascunho novo da IA).
create or replace function public.replace_shots(p_video_id uuid, p_shots jsonb)
returns setof public.shots
language plpgsql
security invoker
set search_path = public
as $$
begin
    if not public.owns_video(p_video_id) then
        raise exception 'Vídeo não encontrado.';
    end if;
    if jsonb_typeof(p_shots) <> 'array' or jsonb_array_length(p_shots) = 0 or jsonb_array_length(p_shots) > 60 then
        raise exception 'A decupagem precisa ter entre 1 e 60 planos.';
    end if;

    delete from shots where video_id = p_video_id;

    return query
    insert into shots (video_id, block_id, position, framing, angle, movement, orientation, description, location, wardrobe, why)
    select p_video_id,
           (s.item->>'block_id')::uuid,
           (s.ord - 1)::integer,
           s.item->>'framing',
           s.item->>'angle',
           s.item->>'movement',
           coalesce(s.item->>'orientation', 'vertical'),
           coalesce(s.item->>'description', ''),
           coalesce(s.item->>'location', ''),
           coalesce(s.item->>'wardrobe', ''),
           coalesce(s.item->>'why', '')
    from jsonb_array_elements(p_shots) with ordinality as s(item, ord)
    returning *;
end;
$$;

revoke all on function public.replace_shots(uuid, jsonb) from public, anon;
grant execute on function public.replace_shots(uuid, jsonb) to authenticated;

-- Grava a ordem de gravação montada pelo app (lista com todos os planos, uma vez cada).
create or replace function public.set_shoot_order(p_video_id uuid, p_shot_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_total integer;
begin
    if not public.owns_video(p_video_id) then
        raise exception 'Vídeo não encontrado.';
    end if;
    select count(*) into v_total from shots where video_id = p_video_id;
    if coalesce(array_length(p_shot_ids, 1), 0) <> v_total
       or (select count(distinct x) from unnest(p_shot_ids) as x) <> v_total
       or exists (select 1 from unnest(p_shot_ids) as x where not exists (select 1 from shots s where s.id = x and s.video_id = p_video_id)) then
        raise exception 'A lista precisa ter todos os planos do vídeo, uma vez cada.';
    end if;

    update shots s
    set shoot_order = o.ord - 1
    from unnest(p_shot_ids) with ordinality as o(shot_id, ord)
    where s.id = o.shot_id;
end;
$$;

revoke all on function public.set_shoot_order(uuid, uuid[]) from public, anon;
grant execute on function public.set_shoot_order(uuid, uuid[]) to authenticated;
