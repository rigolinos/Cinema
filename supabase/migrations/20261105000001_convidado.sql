-- Convidado: uma pessoa pode ter mais de um papel (atua e filma), e o link mostra a lista de planos
-- com o que já foi gravado, para acompanhar a gravação.
-- Quem só atua continua sem ver o roteiro inteiro: recebe as partes em que aparece (marcada na parte
-- ou com fala "Nome: …") e, como deixa, a última fala da parte anterior.

alter table public.video_people add column roles text[] not null default '{}';
update public.video_people set roles = array[role] where role <> 'eu';
alter table public.video_people
    add constraint video_people_roles_ok check (
        roles <@ array['ator', 'filma', 'equipe']::text[]
        and ((role = 'eu' and roles = '{}') or (role <> 'eu' and cardinality(roles) >= 1 and role = any(roles)))
    );
grant update (roles) on public.video_people to authenticated;

-- Quem manda só o papel principal (versão anterior do app) continua funcionando: os papéis vêm dele.
-- Quem manda os papéis e um principal que não está entre eles fica com o primeiro papel como principal.
create or replace function public.video_people_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.role = 'eu' then
        new.roles := '{}';
    elsif cardinality(new.roles) = 0 then
        new.roles := array[new.role];
    elsif not new.role = any(new.roles) then
        new.role := new.roles[1];
    end if;
    return new;
end;
$$;

create trigger video_people_roles
    before insert or update of role, roles on public.video_people
    for each row execute procedure public.video_people_roles();

-- A pessoa fala nesta parte? Procura uma linha que comece com o primeiro nome dela e dois-pontos.
create or replace function public.speaks_in(p_speech text, p_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
    select coalesce(p_speech, '') ~* (
        '(^|\n)\s*' || regexp_replace(split_part(trim(p_name), ' ', 1), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\s*:'
    );
$$;

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
    v_crew boolean;
begin
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu';
    if v_person.id is null then
        return null;
    end if;
    select * into v_video from videos where id = v_person.video_id;
    v_crew := v_person.roles && array['filma', 'equipe']::text[];

    return jsonb_build_object(
        'person', jsonb_build_object('name', v_person.name, 'role', v_person.role, 'roles', to_jsonb(v_person.roles), 'confirmed', v_person.confirmed_at is not null),
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
                'number', o.position + 1, 'kind', o.kind, 'label', o.label,
                'speech', o.speech, 'on_screen', o.on_screen, 'action', o.action,
                'mine', o.mine,
                'cue', (regexp_split_to_array(nullif(trim(o.prev_speech), ''), E'\n'))[cardinality(regexp_split_to_array(nullif(trim(o.prev_speech), ''), E'\n'))]
            ) order by o.position)
            from (
                select b.*,
                       (b.person_id = v_person.id or ('ator' = any(v_person.roles) and public.speaks_in(b.speech, v_person.name))) as mine,
                       lag(b.speech) over (order by b.position) as prev_speech
                from script_blocks b
                where b.video_id = v_video.id
            ) o
            where v_crew or o.mine
        ), '[]'::jsonb),
        'shots', coalesce((
            select jsonb_agg(jsonb_build_object(
                'number', s.number, 'block', s.block_number,
                'framing', s.framing, 'angle', s.angle, 'movement', s.movement, 'orientation', s.orientation,
                'description', s.description, 'location', s.location, 'wardrobe', s.wardrobe, 'why', s.why,
                'recorded', s.recorded, 'good', s.good_take, 'takes', s.takes,
                'mine', s.mine
            ) order by coalesce(s.shoot_order, s.position + 1000), s.position)
            from (
                select sh.*, b.position + 1 as block_number,
                       row_number() over (order by b.position, sh.position) as number,
                       (b.person_id = v_person.id or ('ator' = any(v_person.roles) and public.speaks_in(b.speech, v_person.name))) as mine
                from shots sh
                join script_blocks b on b.id = sh.block_id
                where sh.video_id = v_video.id
            ) s
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.speaks_in(text, text) from public;
grant execute on function public.shared_part(uuid) to anon, authenticated;
