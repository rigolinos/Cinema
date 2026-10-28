-- Denúncias de conteúdo gerado pela IA. A Google Play pede que a pessoa consiga sinalizar, de dentro do app,
-- uma resposta ofensiva ou perigosa da IA. Guarda o trecho como estava na tela para a equipe revisar.

create table public.ai_reports (
    id uuid primary key default gen_random_uuid(),
    reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    area text not null check (area in ('ideia', 'roteiro', 'publicar', 'outro')),
    reason text not null check (reason in ('ofensivo', 'perigoso', 'errado', 'outro')),
    content text not null default '' check (char_length(content) <= 2000), -- o que a IA mostrou
    note text not null default '' check (char_length(note) <= 500), -- o que a pessoa escreveu
    ref_id uuid, -- vídeo ou ideia de onde veio, quando houver
    created_at timestamptz not null default now()
);

create index ai_reports_created_idx on public.ai_reports (created_at desc);

alter table public.ai_reports enable row level security;

-- A pessoa só envia e vê as próprias denúncias; a revisão é feita pela equipe no painel do Supabase.
create policy "Pessoa denuncia conteúdo da IA" on public.ai_reports
    for insert with check (reporter_id = auth.uid());
create policy "Pessoa vê as próprias denúncias" on public.ai_reports
    for select using (reporter_id = auth.uid());
