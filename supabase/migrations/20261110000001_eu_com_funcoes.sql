-- Quem cria o vídeo também tem funções: aparece, filma, ajuda no set. Pode não aparecer, e
-- sem função nenhuma só escreve e dirige. Começa aparecendo, como era antes.

alter table public.video_people drop constraint video_people_roles_ok;

create or replace function public.video_people_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.role = 'eu' then
        -- Quem cria aparece até dizer que não.
        if tg_op = 'INSERT' and cardinality(new.roles) = 0 then
            new.roles := array['ator'];
        end if;
    elsif cardinality(new.roles) = 0 then
        new.roles := array[new.role];
    elsif not new.role = any(new.roles) then
        new.role := new.roles[1];
    end if;
    return new;
end;
$$;

update public.video_people set roles = '{ator}' where role = 'eu' and roles = '{}';

alter table public.video_people
    add constraint video_people_roles_ok check (
        roles <@ array['ator', 'filma', 'equipe']::text[]
        and (role = 'eu' or (cardinality(roles) >= 1 and role = any(roles)))
    );

-- Quem deixa de aparecer sai dos planos em que estava marcado.
create or replace function public.left_the_frame()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    if 'ator' = any(old.roles) and not 'ator' = any(new.roles) then
        update shots set person_ids = array_remove(person_ids, new.id)
        where video_id = new.video_id and new.id = any(person_ids);
    end if;
    return new;
end;
$$;
revoke all on function public.left_the_frame() from public, anon, authenticated;

create trigger video_people_left_the_frame
    after update of roles on public.video_people
    for each row execute function public.left_the_frame();
