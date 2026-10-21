-- L5: pessoas do vídeo. Quem aparece e quem filma, cada um com um link só com a parte dele,
-- e o aceite de uso de imagem. O link abre sem login: o visitante não lê nenhuma tabela,
-- só chama as funções abaixo com o código secreto (share_token) da pessoa.

alter table public.videos
    add column shoot_date date,
    add column shoot_place text check (char_length(shoot_place) <= 120);

create table public.video_people (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos(id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 80),
    role text not null check (role in ('eu', 'ator', 'filma', 'equipe')),
    share_token uuid not null unique default gen_random_uuid(),
    share_enabled boolean not null default true,
    confirmed_at timestamptz,          -- só a própria pessoa confirma, pelo link
    created_at timestamptz not null default now()
);

create index video_people_video_idx on public.video_people (video_id, created_at);
create unique index video_people_one_eu on public.video_people (video_id) where role = 'eu';

alter table public.video_people enable row level security;

create policy "Dono vê as pessoas do vídeo" on public.video_people
    for select using (public.owns_video(video_id));
create policy "Dono adiciona pessoas" on public.video_people
    for insert with check (public.owns_video(video_id) and confirmed_at is null);
create policy "Dono edita pessoas" on public.video_people
    for update using (public.owns_video(video_id)) with check (public.owns_video(video_id));
create policy "Dono tira pessoas" on public.video_people
    for delete using (public.owns_video(video_id));

-- O dono muda nome, função e liga/desliga o link; a confirmação e o código não.
revoke update on public.video_people from anon, authenticated;
grant update (name, role, share_enabled) on public.video_people to authenticated;

-- Quem aparece em cada bloco do roteiro.
alter table public.script_blocks
    add column person_id uuid references public.video_people(id) on delete set null;

create or replace function public.block_person_same_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.person_id is not null
       and not exists (select 1 from video_people where id = new.person_id and video_id = new.video_id) then
        raise exception 'A pessoa precisa ser do mesmo vídeo.';
    end if;
    return new;
end;
$$;

create trigger block_person_same_video
    before insert or update of person_id on public.script_blocks
    for each row execute procedure public.block_person_same_video();

-- Aceites de uso de imagem: guardados como prova, nunca alterados nem apagados.
-- Ficam mesmo se a pessoa ou o vídeo forem removidos.
create table public.image_consents (
    id uuid primary key default gen_random_uuid(),
    person_id uuid references public.video_people(id) on delete set null,
    video_id uuid references public.videos(id) on delete set null,
    owner_id uuid not null references auth.users(id) on delete cascade,
    video_title text not null,
    accepted_name text not null check (char_length(trim(accepted_name)) between 3 and 120),
    text_version text not null,
    accepted_at timestamptz not null default now()
);

create unique index image_consents_one_per_person on public.image_consents (person_id, text_version) where person_id is not null;

alter table public.image_consents enable row level security;

create policy "Dono vê os aceites dos seus vídeos" on public.image_consents
    for select using (owner_id = auth.uid());

-- ── Funções do link (sem login) ───────────────────────────────────────

-- A parte de uma pessoa: o vídeo, a função dela, as falas dela (ator) ou os planos (quem filma).
create or replace function public.shared_part(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_person video_people;
    v_video videos;
begin
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu';
    if v_person.id is null then
        return null;
    end if;
    select * into v_video from videos where id = v_person.video_id;

    return jsonb_build_object(
        'person', jsonb_build_object('name', v_person.name, 'role', v_person.role, 'confirmed', v_person.confirmed_at is not null),
        'video', jsonb_build_object(
            'title', coalesce(v_video.title, 'Vídeo'),
            'shoot_date', v_video.shoot_date,
            'shoot_place', v_video.shoot_place,
            'platform', v_video.platform
        ),
        'creator', coalesce((select nullif(trim(display_name), '') from creator_profiles where user_id = v_video.owner_id), 'Quem te chamou'),
        'consented', exists (select 1 from image_consents where person_id = v_person.id),
        'blocks', coalesce((
            select jsonb_agg(jsonb_build_object(
                'number', b.position + 1, 'kind', b.kind, 'label', b.label,
                'speech', b.speech, 'on_screen', b.on_screen, 'action', b.action,
                'mine', b.person_id = v_person.id
            ) order by b.position)
            from script_blocks b
            where b.video_id = v_video.id
              and (v_person.role in ('filma', 'equipe') or b.person_id = v_person.id)
        ), '[]'::jsonb),
        'shots', case when v_person.role in ('filma', 'equipe') then coalesce((
            select jsonb_agg(jsonb_build_object(
                'block', (select position + 1 from script_blocks where id = s.block_id),
                'framing', s.framing, 'angle', s.angle, 'movement', s.movement, 'orientation', s.orientation,
                'description', s.description, 'location', s.location, 'wardrobe', s.wardrobe, 'why', s.why
            ) order by coalesce(s.shoot_order, s.position + 1000), s.position)
            from shots s
            where s.video_id = v_video.id
        ), '[]'::jsonb) else '[]'::jsonb end
    );
end;
$$;

create or replace function public.confirm_presence(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    update video_people
    set confirmed_at = coalesce(confirmed_at, now())
    where share_token = p_token and share_enabled and role <> 'eu';
    return found;
end;
$$;

-- Aceite de uso de imagem pelo link. O texto exibido à pessoa é a versão p_version (no app).
create or replace function public.accept_image_use(p_token uuid, p_name text, p_version text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_person video_people;
    v_video videos;
begin
    if p_version is null or p_version !~ '^imagem-v[0-9]+$' then
        raise exception 'Versão do termo inválida.';
    end if;
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu';
    if v_person.id is null then
        return false;
    end if;
    select * into v_video from videos where id = v_person.video_id;

    insert into image_consents (person_id, video_id, owner_id, video_title, accepted_name, text_version)
    values (v_person.id, v_video.id, v_video.owner_id, coalesce(v_video.title, 'Vídeo'), trim(p_name), p_version)
    on conflict (person_id, text_version) where person_id is not null do nothing;
    return true;
end;
$$;

revoke all on function public.shared_part(uuid) from public;
revoke all on function public.confirm_presence(uuid) from public;
revoke all on function public.accept_image_use(uuid, text, text) from public;
grant execute on function public.shared_part(uuid) to anon, authenticated;
grant execute on function public.confirm_presence(uuid) to anon, authenticated;
grant execute on function public.accept_image_use(uuid, text, text) to anon, authenticated;
