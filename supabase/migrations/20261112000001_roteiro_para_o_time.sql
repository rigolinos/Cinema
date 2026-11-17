-- Roteiro para todo o time: quem só atua passa a receber o roteiro inteiro, não só as cenas dele.
-- Para atuar bem num vídeo curto, a pessoa precisa entender a cena toda (pedido da testadora em 2026-11-17).
-- 'mine' continua como antes (as falas da pessoa saem dele); 'in_scene' diz em que cenas ela aparece,
-- contando também os planos em que foi marcada, para o roteiro destacar essas cenas mesmo sem fala.

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
    v_creator_first text;
begin
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu';
    if v_person.id is null then
        return null;
    end if;
    select * into v_video from videos where id = v_person.video_id;
    select nullif(split_part(trim(display_name), ' ', 1), '') into v_creator_first from creator_profiles where user_id = v_video.owner_id;

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
                'in_scene', o.mine or o.in_shots,
                'cue', (regexp_split_to_array(nullif(trim(o.prev_speech), ''), E'\n'))[cardinality(regexp_split_to_array(nullif(trim(o.prev_speech), ''), E'\n'))]
            ) order by o.position)
            from (
                select b.*,
                       (b.person_id = v_person.id or ('ator' = any(v_person.roles) and public.speaks_in(b.speech, v_person.name))) as mine,
                       lag(b.speech) over (order by b.position) as prev_speech,
                       exists (select 1 from shots sh where sh.block_id = b.id and v_person.id = any(sh.person_ids)) as in_shots
                from script_blocks b
                where b.video_id = v_video.id
            ) o
        ), '[]'::jsonb),
        'shots', coalesce((
            select jsonb_agg(jsonb_build_object(
                'number', s.number, 'block', s.block_number,
                'framing', s.framing, 'angle', s.angle, 'movement', s.movement, 'orientation', s.orientation,
                'description', s.description, 'location', s.location, 'wardrobe', s.wardrobe, 'why', s.why,
                'recorded', s.recorded, 'good', s.good_take, 'takes', s.takes,
                'mine', s.mine,
                -- Só o primeiro nome de quem divide o plano: é o que a pessoa precisa para saber com quem grava.
                'people', (
                    select coalesce(jsonb_agg(n.first_name order by n.created_at) filter (where n.first_name is not null), '[]'::jsonb)
                    from (
                        select p.created_at,
                               case when p.role = 'eu' and lower(trim(p.name)) in ('', 'eu') then v_creator_first
                                    else nullif(split_part(trim(p.name), ' ', 1), '') end as first_name
                        from video_people p
                        where p.video_id = v_video.id and p.id = any(s.person_ids)
                    ) n
                )
            ) order by coalesce(s.shoot_order, s.position + 1000), s.position)
            from (
                select sh.*, b.position + 1 as block_number,
                       row_number() over (order by b.position, sh.position) as number,
                       -- Quem o plano marca manda; plano sem ninguém marcado segue quem fala na cena, como antes.
                       case when cardinality(sh.person_ids) > 0 then v_person.id = any(sh.person_ids)
                            else (b.person_id = v_person.id or ('ator' = any(v_person.roles) and public.speaks_in(b.speech, v_person.name))) end as mine
                from shots sh
                join script_blocks b on b.id = sh.block_id
                where sh.video_id = v_video.id
            ) s
        ), '[]'::jsonb)
    );
end;
$$;
grant execute on function public.shared_part(uuid) to anon, authenticated;
