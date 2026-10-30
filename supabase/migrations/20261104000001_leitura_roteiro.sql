-- Roteiro colado: a leitura estruturada que a IA faz antes de montar as partes
-- (quem fala; fala, tela, ação e câmera; ortografia corrigida). Fica guardada para as sugestões,
-- os planos e a publicação entenderem o roteiro. A pessoa não vê; o dono lê e escreve pelas regras do vídeo.
alter table public.videos
    add column script_reading jsonb
    check (script_reading is null or (jsonb_typeof(script_reading) = 'object' and pg_column_size(script_reading) <= 64000));
