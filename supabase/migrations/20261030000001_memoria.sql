-- Memória do criador: o Gravaí guarda sinais do uso (o que a pessoa escolhe, pede, muda e pula)
-- e, de tempos em tempos, a IA resume em poucas linhas "o que já entendi sobre você".
-- Tudo é da própria pessoa: ela vê, corrige e pode apagar (esquecer tudo).

create table public.creator_signals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    video_id uuid references public.videos(id) on delete set null,
    kind text not null check (kind in (
        'ideia_escolhida', 'pedido_ideia', 'pedido_bloco', 'roteiro_editado',
        'plano_apagado', 'plano_adicionado', 'plano_pulado', 'ideia_quinzena_usada', 'formato_usado'
    )),
    detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 2048),
    created_at timestamptz not null default now()
);

create index creator_signals_user_idx on public.creator_signals (user_id, created_at desc);

alter table public.creator_signals enable row level security;

create policy "Pessoa vê os próprios sinais" on public.creator_signals
    for select using (user_id = auth.uid());
create policy "Pessoa registra os próprios sinais" on public.creator_signals
    for insert with check (user_id = auth.uid() and (video_id is null or public.owns_video(video_id)));

-- O resumo. items = [{"text": "...", "source": "ia" | "voce"}]; "voce" é o que a própria pessoa escreveu
-- ou corrigiu, e a IA não muda. insight = a última coisa nova que a IA percebeu (para a mensagem no Início).
create table public.creator_memory (
    user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
    items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 12 and pg_column_size(items) <= 4096),
    insight text check (char_length(insight) <= 200),
    signals_seen integer not null default 0,
    summarized_at timestamptz,
    updated_at timestamptz not null default now()
);

alter table public.creator_memory enable row level security;

create policy "Pessoa vê a própria memória" on public.creator_memory
    for select using (user_id = auth.uid());
create policy "Pessoa cria a própria memória" on public.creator_memory
    for insert with check (user_id = auth.uid());
create policy "Pessoa edita a própria memória" on public.creator_memory
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger on_creator_memory_updated
    before update on public.creator_memory
    for each row execute procedure public.handle_updated_at();

-- Esquecer tudo: apaga os sinais e o resumo da própria pessoa.
create or replace function public.forget_my_memory()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'É preciso estar logado.';
    end if;
    delete from creator_signals where user_id = auth.uid();
    delete from creator_memory where user_id = auth.uid();
end;
$$;

revoke all on function public.forget_my_memory() from public, anon;
grant execute on function public.forget_my_memory() to authenticated;

-- Esquecer precisa de permissão para apagar.
create policy "Pessoa apaga os próprios sinais" on public.creator_signals
    for delete using (user_id = auth.uid());
create policy "Pessoa apaga a própria memória" on public.creator_memory
    for delete using (user_id = auth.uid());
