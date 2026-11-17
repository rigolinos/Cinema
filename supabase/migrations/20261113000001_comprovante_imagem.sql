-- Comprovante de uso de imagem: o aceite passa a guardar o texto exato que a pessoa autorizou.
-- O texto é montado aqui, no banco, com o mesmo nome e título que ficam no registro: quem chama não manda texto.
-- Aceites antigos ficam sem texto guardado; o comprovante remonta pela versão (imagem-v1 não mudou).
-- Sem IP nem aparelho, por decisão do dono do produto em 2026-11-17.

alter table public.image_consents add column accepted_text text check (char_length(accepted_text) <= 4000);

-- Igual a consentText em src/lib/pessoas.ts. Mudou o texto? Nova versão do termo, nas duas pontas.
create or replace function public.consent_text_v1(p_creator text, p_title text)
returns text
language sql
immutable
set search_path = public
as $$
    select concat_ws(E'\n',
        'Autorizo ' || p_creator || ' a usar, sem cobrar nada, a minha imagem e a minha voz gravadas para o vídeo “' || p_title || '”.',
        'O vídeo pode ser publicado em redes sociais e plataformas de vídeo, inteiro ou em trechos, inclusive em divulgação do próprio vídeo.',
        'Posso pedir a qualquer momento para não aparecer em publicações novas. O que já foi publicado antes do pedido pode continuar no ar.',
        'Declaro que tenho 18 anos ou mais.'
    );
$$;

create or replace function public.accept_image_use(p_token uuid, p_name text, p_version text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_person video_people;
    v_video videos;
    v_creator text;
    v_title text;
begin
    if p_version is null or p_version !~ '^imagem-v[0-9]+$' then
        raise exception 'Versão do termo inválida.';
    end if;
    select * into v_person from video_people where share_token = p_token and share_enabled and role <> 'eu';
    if v_person.id is null then
        return false;
    end if;
    select * into v_video from videos where id = v_person.video_id;
    select nullif(trim(display_name), '') into v_creator from creator_profiles where user_id = v_video.owner_id;
    if v_creator is null then
        raise exception 'Quem convidou ainda não informou o nome.';
    end if;
    v_title := coalesce(v_video.title, 'Vídeo');

    insert into image_consents (person_id, video_id, owner_id, video_title, creator_name, accepted_name, text_version, accepted_text)
    values (v_person.id, v_video.id, v_video.owner_id, v_title, v_creator, trim(p_name), p_version,
            case when p_version = 'imagem-v1' then public.consent_text_v1(v_creator, v_title) end)
    on conflict (person_id, text_version) where person_id is not null do nothing;
    return true;
end;
$$;

revoke all on function public.accept_image_use(uuid, text, text) from public;
grant execute on function public.accept_image_use(uuid, text, text) to anon, authenticated;
