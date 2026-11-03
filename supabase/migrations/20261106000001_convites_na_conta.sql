-- Convite salvo na conta: quem foi chamado guarda o vídeo na própria lista para voltar sem procurar o link.
-- Só a pessoa salva, por escolha dela, e cada convite fica em uma conta só. Quem convidou vê qual foi.
-- O acesso continua sendo o do link: desligou o link, o vídeo some da lista.

alter table public.video_people
    add column claimed_by uuid references auth.users(id) on delete set null,
    add column claimed_at timestamptz;

create index video_people_claimed_idx on public.video_people (claimed_by) where claimed_by is not null;

-- O dono não coloca o convite na conta de ninguém. A alteração já é limitada às colunas liberadas para ele.
drop policy "Dono adiciona pessoas" on public.video_people;
create policy "Dono adiciona pessoas" on public.video_people
    for insert with check (public.owns_video(video_id) and confirmed_at is null and claimed_by is null and claimed_at is null);

-- Como o convite está para quem abriu o link: anon, free, mine, taken ou owner. Link inválido devolve null.
create or replace function public.invite_state(p_token uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_person video_people;
begin
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu';
    if v_person.id is null then
        return null;
    end if;
    if auth.uid() is null then
        return 'anon';
    end if;
    if exists (select 1 from videos where id = v_person.video_id and owner_id = auth.uid()) then
        return 'owner';
    end if;
    if v_person.claimed_by = auth.uid() then
        return 'mine';
    end if;
    return case when v_person.claimed_by is null then 'free' else 'taken' end;
end;
$$;

-- Salva o convite na conta de quem está logado e devolve como ele ficou.
create or replace function public.claim_invite(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_person video_people;
begin
    if auth.uid() is null then
        raise exception 'Entre na sua conta para salvar o convite.';
    end if;
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu' for update;
    if v_person.id is null then
        return null;
    end if;
    if exists (select 1 from videos where id = v_person.video_id and owner_id = auth.uid()) then
        return 'owner';
    end if;
    if v_person.claimed_by = auth.uid() then
        return 'mine';
    end if;
    if v_person.claimed_by is not null then
        return 'taken';
    end if;
    update video_people set claimed_by = auth.uid(), claimed_at = now() where id = v_person.id;
    return 'mine';
end;
$$;

-- Tira da lista de quem salvou. O vídeo e o link continuam como estão.
create or replace function public.release_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    update video_people set claimed_by = null, claimed_at = null where share_token = p_token and claimed_by = auth.uid();
    return found;
end;
$$;

-- Os vídeos em que a pessoa está como convidada: só o que aparece no cartão.
create or replace function public.my_invites()
returns table (token uuid, title text, duration_s integer, stage text, published_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
    select p.share_token, coalesce(v.title, 'Vídeo'), v.duration_s::integer, v.stage::text, v.published_at, v.updated_at
    from video_people p
    join videos v on v.id = p.video_id
    where p.claimed_by = auth.uid() and p.share_enabled and p.role <> 'eu'
    order by v.updated_at desc;
$$;

-- Para quem convidou: em qual conta cada convite foi salvo, pelo nome, sem mostrar e-mail.
create or replace function public.invite_claims(p_video uuid)
returns table (person_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
    select p.id, coalesce(nullif(trim(c.display_name), ''), nullif(trim(u.raw_user_meta_data->>'full_name'), ''), 'Conta sem nome')
    from video_people p
    join auth.users u on u.id = p.claimed_by
    left join creator_profiles c on c.user_id = p.claimed_by
    where p.video_id = p_video and public.owns_video(p_video);
$$;

revoke all on function public.invite_state(uuid) from public;
revoke all on function public.claim_invite(uuid) from public, anon;
revoke all on function public.release_invite(uuid) from public, anon;
revoke all on function public.my_invites() from public, anon;
revoke all on function public.invite_claims(uuid) from public, anon;
grant execute on function public.invite_state(uuid) to anon, authenticated;
grant execute on function public.claim_invite(uuid) to authenticated;
grant execute on function public.release_invite(uuid) to authenticated;
grant execute on function public.my_invites() to authenticated;
grant execute on function public.invite_claims(uuid) to authenticated;
