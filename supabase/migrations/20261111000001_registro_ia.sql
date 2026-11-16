-- Registro de qual modelo de IA respondeu cada pedido. Sem isso, não dá para saber se um texto fraco veio
-- do modelo principal ou da reserva. Guarda só a tarefa, o modelo e o tempo: nenhum texto da pessoa.

create table public.ai_calls (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    task text not null check (char_length(task) between 1 and 40),
    provider text not null check (provider in ('gemini', 'groq')),
    model text not null check (char_length(model) between 1 and 80),
    attempts smallint not null check (attempts between 1 and 20), -- pedidos feitos até sair uma resposta válida
    ms integer not null check (ms >= 0),
    created_at timestamptz not null default now()
);

create index ai_calls_user_idx on public.ai_calls (user_id, created_at desc);
create index ai_calls_created_idx on public.ai_calls (created_at desc);

alter table public.ai_calls enable row level security;

-- A pessoa só registra e vê as próprias chamadas; a equipe olha o conjunto no painel do Supabase.
create policy "Pessoa registra as próprias chamadas de IA" on public.ai_calls
    for insert with check (user_id = auth.uid());
create policy "Pessoa vê as próprias chamadas de IA" on public.ai_calls
    for select using (user_id = auth.uid());
