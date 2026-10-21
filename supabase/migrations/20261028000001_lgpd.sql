-- LGPD: registro dos aceites de Termos e Política de Privacidade, e exclusão da própria conta.

-- Cada aceite fica registrado (documento, versão, data). Nunca é alterado; some só junto com a conta.
create table public.legal_acceptances (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    document text not null check (document in ('termos', 'privacidade')),
    version text not null check (version ~ '^v[0-9]+$'),
    accepted_at timestamptz not null default now(),
    unique (user_id, document, version)
);

alter table public.legal_acceptances enable row level security;

create policy "Pessoa vê os próprios aceites" on public.legal_acceptances
    for select using (user_id = auth.uid());
create policy "Pessoa registra o próprio aceite" on public.legal_acceptances
    for insert with check (user_id = auth.uid());

-- No cadastro, o app manda as versões aceitas em raw_user_meta_data.legal = {"termos": "v1", "privacidade": "v1"}.
-- Assim o aceite fica gravado mesmo quando a conta ainda precisa confirmar o e-mail.
create or replace function public.handle_new_user_legal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_doc text;
    v_version text;
begin
    for v_doc in select unnest(array['termos', 'privacidade']) loop
        v_version := new.raw_user_meta_data->'legal'->>v_doc;
        if v_version ~ '^v[0-9]+$' then
            insert into legal_acceptances (user_id, document, version)
            values (new.id, v_doc, v_version)
            on conflict do nothing;
        end if;
    end loop;
    return new;
end;
$$;

create trigger on_auth_user_created_legal
    after insert on auth.users
    for each row execute procedure public.handle_new_user_legal();

-- Excluir a própria conta: some tudo o que é da pessoa (vídeos, roteiros, planos, pessoas convidadas,
-- autorizações recebidas, ideias, aceites, perfil) e as produtoras em que ela era a única integrante.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'É preciso estar logado.';
    end if;

    delete from organizations o
    where exists (select 1 from organization_members m where m.org_id = o.id and m.user_id = v_uid)
      and not exists (select 1 from organization_members m where m.org_id = o.id and m.user_id <> v_uid);

    delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
