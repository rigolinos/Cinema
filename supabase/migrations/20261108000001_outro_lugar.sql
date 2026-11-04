-- "Em casa", "Na rua" ou "Nos dois" não atendem quem grava em academia, estúdio ou numa viagem.
alter table public.videos drop constraint video_resources_ok;
alter table public.videos
    add constraint video_resources_ok check (resources <@ array['sozinho', 'com_alguem', 'em_casa', 'na_rua', 'outro_lugar']::text[]);
