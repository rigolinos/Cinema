-- Um vídeo pode sair em várias plataformas ao mesmo tempo (TikTok e Reels, por exemplo).
-- videos.platform continua sendo a principal: é ela que decide se o vídeo é gravado em pé ou deitado.

alter table public.videos add column platforms text[] not null default '{}';
alter table public.videos add constraint videos_platforms_ok
    check (platforms <@ array['reels', 'tiktok', 'shorts', 'youtube']::text[] and cardinality(platforms) <= 4);

update public.videos set platforms = array[platform] where platform is not null;

-- Mantém as duas colunas de acordo: quem só manda a principal (como start_video_from_idea) ganha a lista com ela;
-- quem só manda a lista ganha a primeira como principal.
create or replace function public.sync_video_platforms()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    -- A lista mudou: a principal precisa estar nela (senão vira a primeira da lista).
    if tg_op = 'UPDATE' and new.platforms is distinct from old.platforms then
        if cardinality(new.platforms) = 0 then
            new.platform := null;
        elsif new.platform is null or not (new.platform = any(new.platforms)) then
            new.platform := new.platforms[1];
        end if;
    -- Só a principal mudou (ou é um vídeo novo): a lista acompanha.
    elsif new.platform is null and cardinality(new.platforms) > 0 then
        new.platform := new.platforms[1];
    elsif new.platform is not null and not (new.platform = any(new.platforms)) then
        new.platforms := array[new.platform];
    end if;
    return new;
end;
$$;

create trigger on_video_platforms
    before insert or update of platform, platforms on public.videos
    for each row execute procedure public.sync_video_platforms();

-- Publicação: um texto por plataforma (legenda, título e hashtags mudam de uma para outra).
alter table public.video_posts add column platform text;
update public.video_posts p set platform = coalesce(v.platform, 'reels') from public.videos v where v.id = p.video_id;
alter table public.video_posts alter column platform set not null;
alter table public.video_posts add constraint video_posts_platform_ok check (platform in ('reels', 'tiktok', 'shorts', 'youtube'));
alter table public.video_posts drop constraint video_posts_pkey;
alter table public.video_posts add primary key (video_id, platform);

-- Trocar de plataforma apaga o texto da que saiu.
create policy "Dono apaga a publicação" on public.video_posts
    for delete using (public.owns_video(video_id));
