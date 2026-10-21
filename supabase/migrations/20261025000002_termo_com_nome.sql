-- O termo de imagem precisa nomear quem recebe a autorização.
-- Sem o nome do criador no perfil, o link não aceita autorização; o aceite guarda esse nome como prova.

alter table public.image_consents add column creator_name text check (char_length(creator_name) <= 120);

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
        'creator', (select nullif(trim(display_name), '') from creator_profiles where user_id = v_video.owner_id),
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

create or replace function public.accept_image_use(p_token uuid, p_name text, p_version text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_person video_people;
    v_video videos;
    v_creator text;
begin
    if p_version is null or p_version !~ '^imagem-v[0-9]+$' then
        raise exception 'Versão do termo inválida.';
    end if;
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu';
    if v_person.id is null then
        return false;
    end if;
    select * into v_video from videos where id = v_person.video_id;
    select nullif(trim(display_name), '') into v_creator from creator_profiles where user_id = v_video.owner_id;
    if v_creator is null then
        raise exception 'Quem convidou ainda não informou o nome.';
    end if;

    insert into image_consents (person_id, video_id, owner_id, video_title, creator_name, accepted_name, text_version)
    values (v_person.id, v_video.id, v_video.owner_id, coalesce(v_video.title, 'Vídeo'), v_creator, trim(p_name), p_version)
    on conflict (person_id, text_version) where person_id is not null do nothing;
    return true;
end;
$$;
