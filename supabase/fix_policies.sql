-- Adicionar políticas de inserção para permitir auto-recuperação de produtora/organização
drop policy if exists "Enable insert for authenticated users" on public.organizations;
create policy "Enable insert for authenticated users" on public.organizations
    for insert with check ( auth.role() = 'authenticated' );

drop policy if exists "Enable insert for authenticated users matching their uid" on public.organization_members;
create policy "Enable insert for authenticated users matching their uid" on public.organization_members
    for insert with check ( auth.uid() = user_id );
