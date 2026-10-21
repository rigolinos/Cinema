-- Fecha a falha das organizações e prende as funções ao schema public.
--
-- Antes: qualquer pessoa logada podia se inserir em organization_members de QUALQUER
-- organização, com qualquer papel (inclusive 'owner'), e criar organizações à vontade.
-- O dono também podia mudar o próprio plano ('free' -> 'enterprise') direto pela API.

drop policy if exists "Enable insert for authenticated users matching their uid" on public.organization_members;
drop policy if exists "Enable insert for authenticated users" on public.organizations;

-- O dono só muda o nome; plano e slug ficam com o servidor.
revoke update on public.organizations from anon, authenticated;
grant update (name) on public.organizations to authenticated;

-- Funções security definer sempre com search_path fixo.
alter function public.is_member_of_org(uuid) set search_path = public;
alter function public.is_member_of_project(uuid) set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.handle_updated_at() set search_path = public;

-- Quem ficou sem organização (conta criada antes do gatilho) ganha a sua por aqui,
-- no lugar da "auto-recuperação" que o app fazia inserindo direto nas tabelas.
create or replace function public.ensure_my_org()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_org uuid;
    v_name text;
begin
    if v_uid is null then
        raise exception 'É preciso estar logado.';
    end if;

    select org_id into v_org
    from organization_members
    where user_id = v_uid
    order by created_at
    limit 1;

    if v_org is not null then
        return v_org;
    end if;

    select coalesce(nullif(trim(raw_user_meta_data->>'org_name'), ''), 'Meu estúdio')
    into v_name
    from auth.users
    where id = v_uid;

    insert into organizations (name, slug, plan)
    values (
        coalesce(v_name, 'Meu estúdio'),
        lower(regexp_replace(coalesce(v_name, 'estudio'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(md5(random()::text) from 1 for 6),
        'free'
    )
    returning id into v_org;

    insert into organization_members (org_id, user_id, role)
    values (v_org, v_uid, 'owner');

    return v_org;
end;
$$;

revoke all on function public.ensure_my_org() from public, anon;
grant execute on function public.ensure_my_org() to authenticated;

-- Reordenar os dias de gravação numa transação só. Atualizar um dia por vez esbarrava
-- no unique (project_id, day_number) e falhava sem aviso.
create or replace function public.reorder_shooting_days(p_project_id uuid, p_day_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_total integer;
begin
    if not public.is_member_of_project(p_project_id) then
        raise exception 'Sem acesso a este projeto.';
    end if;

    select count(*) into v_total from shooting_days where project_id = p_project_id;

    if coalesce(array_length(p_day_ids, 1), 0) <> v_total
       or (select count(distinct x) from unnest(p_day_ids) as x) <> v_total
       or exists (
           select 1 from unnest(p_day_ids) as x
           where not exists (select 1 from shooting_days d where d.id = x and d.project_id = p_project_id)
       ) then
        raise exception 'A lista precisa ter todos os dias do projeto, uma vez cada.';
    end if;

    update shooting_days set day_number = -day_number where project_id = p_project_id;

    update shooting_days d
    set day_number = o.ord
    from unnest(p_day_ids) with ordinality as o(day_id, ord)
    where d.id = o.day_id;
end;
$$;

revoke all on function public.reorder_shooting_days(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_shooting_days(uuid, uuid[]) to authenticated;
