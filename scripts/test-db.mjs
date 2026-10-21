// Aplica todas as migrations de supabase/migrations num Postgres em memória (PGlite)
// e testa as regras que não podem quebrar. Não conecta em nenhum banco real.
//
//   npm run test:db
//
// O ambiente do Supabase (auth, papéis anon/authenticated) é simulado com o mínimo
// que as migrations usam.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

const dir = path.resolve('supabase/migrations');
const db = new PGlite();
const q = (sql, params) => db.query(sql, params);
const ex = (sql) => db.exec(sql);
const one = async (sql, params) => (await q(sql, params)).rows[0];

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  ok    ' : '  FALHA ') + msg);
  if (!cond) fails++;
};

// Executa como um papel do Supabase, com auth.uid() = uid. Devolve { rows } ou { err }.
async function as(role, uid, sql, params) {
  await ex(`SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false); SELECT set_config('request.jwt.claim.role', '${role}', false); SET ROLE ${role}`);
  try {
    return { rows: (await q(sql, params)).rows };
  } catch (e) {
    return { err: e.message };
  } finally {
    await ex('RESET ROLE');
  }
}

await ex(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
    AS $f$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $f$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
`);

console.log('Migrations:');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  const sql = fs
    .readFileSync(path.join(dir, file), 'utf8')
    .replace(/^﻿/, '')
    .replace(/create extension if not exists "uuid-ossp";/i, ''); // não usado; o PGlite não traz
  try {
    await ex(sql);
    console.log('  ok    ' + file);
  } catch (e) {
    console.log('  FALHA ' + file + ': ' + e.message);
    process.exit(1);
  }
}

// ── Dados ─────────────────────────────────────────────────────────────
const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';
const C = 'cccccccc-0000-0000-0000-000000000003';
await q(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'a@teste.dev', '{"org_name":"Estúdio A"}')`, [A]);
await q(`INSERT INTO auth.users (id, email) VALUES ($1, 'b@teste.dev')`, [B]);

console.log('Cadastro:');
const orgA = (await one('SELECT org_id FROM public.organization_members WHERE user_id = $1', [A]))?.org_id;
ok(orgA, 'conta nova ganha organização');
ok((await one('SELECT role FROM public.organization_members WHERE user_id = $1', [A]))?.role === 'owner', 'e é dona dela');
ok((await one('SELECT name FROM public.organizations WHERE id = $1', [orgA]))?.name === 'Estúdio A', 'com o nome informado no cadastro');

console.log('Organizações:');
let r = await as('authenticated', B, `INSERT INTO public.organization_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`, [orgA, B]);
ok(r.err, 'ninguém entra sozinho na organização de outra pessoa');
r = await as('authenticated', B, `INSERT INTO public.organizations (name, slug) VALUES ('X', 'x')`);
ok(r.err, 'ninguém cria organização direto pela API');
r = await as('authenticated', A, `UPDATE public.organizations SET plan = 'enterprise' WHERE id = $1`, [orgA]);
ok(r.err, 'a dona não muda o próprio plano');
r = await as('authenticated', A, `UPDATE public.organizations SET name = 'Estúdio A2' WHERE id = $1 RETURNING name`, [orgA]);
ok(r.rows?.[0]?.name === 'Estúdio A2', 'a dona muda o nome');
r = await as('authenticated', B, `UPDATE public.organizations SET name = 'invadido' WHERE id = $1 RETURNING id`, [orgA]);
ok(!r.err && r.rows.length === 0, 'outra pessoa não muda o nome');

console.log('ensure_my_org:');
r = await as('authenticated', A, 'SELECT public.ensure_my_org() AS id');
ok(r.rows?.[0]?.id === orgA, 'devolve a organização que já existe');
await ex(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created`);
await q(`INSERT INTO auth.users (id, email) VALUES ($1, 'c@teste.dev')`, [C]);
await ex(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created`);
r = await as('authenticated', C, 'SELECT public.ensure_my_org() AS id');
const orgC = r.rows?.[0]?.id;
ok(orgC && orgC !== orgA, 'cria uma organização para quem não tem');
ok((await one('SELECT role FROM public.organization_members WHERE user_id = $1 AND org_id = $2', [C, orgC]))?.role === 'owner', 'e a pessoa vira dona');
r = await as('anon', null, 'SELECT public.ensure_my_org() AS id');
ok(r.err, 'visitante não executa');

console.log('Projetos:');
r = await as('authenticated', A, `INSERT INTO public.projects (org_id, title) VALUES ($1, 'Filme A') RETURNING id`, [orgA]);
const projA = r.rows?.[0]?.id;
ok(projA, 'membro cria projeto na própria organização');
r = await as('authenticated', B, `INSERT INTO public.projects (org_id, title) VALUES ($1, 'Intruso') RETURNING id`, [orgA]);
ok(r.err, 'não cria projeto em organização alheia');
r = await as('authenticated', B, 'SELECT id FROM public.projects');
ok(!r.err && r.rows.length === 0, 'não vê projetos de outra organização');
r = await as('authenticated', B, `INSERT INTO public.scenes (project_id, number, int_ext, location_name, time_of_day, synopsis, pages) VALUES ($1, '1', 'INT', 'Casa', 'DIA', 'x', 8) RETURNING id`, [projA]);
ok(r.err, 'não cria cena em projeto alheio');
r = await as('anon', null, 'SELECT id FROM public.projects');
ok(!r.err && r.rows.length === 0, 'visitante não vê projetos');

console.log('Reordenar dias:');
const day = async (n) => (await as('authenticated', A, `INSERT INTO public.shooting_days (project_id, day_number, date) VALUES ($1, $2, current_date + $2::int) RETURNING id`, [projA, n])).rows[0].id;
const d1 = await day(1);
const d2 = await day(2);
const d3 = await day(3);
r = await as('authenticated', A, 'SELECT public.reorder_shooting_days($1, $2)', [projA, [d3, d1, d2]]);
ok(!r.err, 'reordena sem esbarrar no unique' + (r.err ? ': ' + r.err : ''));
const order = (await q('SELECT id FROM public.shooting_days WHERE project_id = $1 ORDER BY day_number', [projA])).rows.map((x) => x.id);
ok(JSON.stringify(order) === JSON.stringify([d3, d1, d2]), 'na ordem pedida');
r = await as('authenticated', A, 'SELECT public.reorder_shooting_days($1, $2)', [projA, [d1, d1, d2]]);
ok(r.err, 'recusa lista com dia repetido');
r = await as('authenticated', A, 'SELECT public.reorder_shooting_days($1, $2)', [projA, [d1, d2]]);
ok(r.err, 'recusa lista incompleta');
r = await as('authenticated', B, 'SELECT public.reorder_shooting_days($1, $2)', [projA, [d1, d2, d3]]);
ok(r.err, 'quem não é membro não reordena');

console.log('Perfil do criador:');
r = await as('authenticated', A, `INSERT INTO public.creator_profiles (niche, platforms) VALUES ('treino em casa', '{reels,tiktok}') RETURNING user_id`);
ok(r.rows?.[0]?.user_id === A, 'criador cria o próprio perfil');
r = await as('authenticated', B, `INSERT INTO public.creator_profiles (user_id, niche) VALUES ($1, 'invasão')`, [A]);
ok(r.err, 'ninguém cria perfil no nome de outra pessoa');
r = await as('authenticated', B, 'SELECT * FROM public.creator_profiles');
ok(!r.err && r.rows.length === 0, 'ninguém lê o perfil de outra pessoa');
r = await as('authenticated', A, `UPDATE public.creator_profiles SET platforms = '{orkut}'`);
ok(r.err, 'plataforma fora da lista é recusada');

console.log('Vídeos e ideias:');
r = await as('authenticated', A, `INSERT INTO public.videos (objective, platform, duration_s, resources) VALUES ('crescer', 'reels', 30, '{sozinho,em_casa}') RETURNING id, stage`);
const vidA = r.rows?.[0]?.id;
ok(vidA && r.rows[0].stage === 'ideia', 'vídeo nasce na etapa ideia');
r = await as('authenticated', B, 'SELECT id FROM public.videos');
ok(!r.err && r.rows.length === 0, 'ninguém vê o vídeo de outra pessoa');
r = await as('authenticated', B, `UPDATE public.videos SET title = 'invadido' WHERE id = $1 RETURNING id`, [vidA]);
ok(!r.err && r.rows.length === 0, 'ninguém edita o vídeo de outra pessoa');
r = await as('authenticated', B, `INSERT INTO public.videos (owner_id) VALUES ($1)`, [A]);
ok(r.err, 'ninguém cria vídeo no nome de outra pessoa');

const idea = async (uid, title, extra = '') =>
  as('authenticated', uid, `INSERT INTO public.video_ideas (video_id, title, hook, format_slug ${extra ? ', chosen' : ''}) VALUES ($1, $2, 'Gancho', 'tres-erros' ${extra ? ', ' + extra : ''}) RETURNING id`, [vidA, title]);
r = await idea(A, 'Ideia 1');
const idea1 = r.rows?.[0]?.id;
const idea2 = (await idea(A, 'Ideia 2')).rows?.[0]?.id;
ok(idea1 && idea2, 'dono guarda ideias no vídeo');
r = await idea(B, 'Intrusa');
ok(r.err, 'ninguém guarda ideia no vídeo de outra pessoa');
r = await idea(A, 'Já escolhida', 'true');
ok(r.err, 'ideia não nasce escolhida (só pelo choose_idea)');
r = await as('authenticated', B, 'SELECT id FROM public.video_ideas');
ok(!r.err && r.rows.length === 0, 'ninguém vê as ideias de outra pessoa');
r = await as('anon', null, 'SELECT id FROM public.video_ideas');
ok(!r.err && r.rows.length === 0, 'visitante não vê ideias');

r = await as('authenticated', B, 'SELECT public.choose_idea($1)', [idea1]);
ok(r.err, 'ninguém escolhe ideia do vídeo de outra pessoa');
r = await as('authenticated', A, 'SELECT public.choose_idea($1)', [idea1]);
ok(!r.err, 'dono escolhe uma ideia' + (r.err ? ': ' + r.err : ''));
let v = await one('SELECT title, hook, format_slug, stage FROM public.videos WHERE id = $1', [vidA]);
ok(v.title === 'Ideia 1' && v.hook === 'Gancho' && v.format_slug === 'tres-erros' && v.stage === 'roteiro', 'o vídeo recebe a ideia e avança para o roteiro');
r = await as('authenticated', A, 'SELECT public.choose_idea($1)', [idea2]);
const chosen = (await q('SELECT id FROM public.video_ideas WHERE video_id = $1 AND chosen', [vidA])).rows.map((x) => x.id);
ok(!r.err && chosen.length === 1 && chosen[0] === idea2, 'trocar de ideia deixa só uma escolhida');

console.log('Roteiro:');
const blocos = JSON.stringify([
  { kind: 'gancho', speech: 'Você erra isso.', on_screen: '3 ERROS' },
  { kind: 'conteudo', label: 'Erro 1', speech: 'Primeiro erro.', action: 'Mostra o agachamento' },
  { kind: 'chamada', speech: 'Segue para mais.' },
]);
r = await as('authenticated', A, 'SELECT id, position, kind, label FROM public.replace_script($1, $2::jsonb) ORDER BY position', [vidA, blocos]);
ok(!r.err && r.rows.length === 3 && r.rows.map((x) => x.kind).join() === 'gancho,conteudo,chamada', 'dono grava o roteiro em blocos, na ordem' + (r.err ? ': ' + r.err : ''));
ok(r.rows?.[1]?.label === 'Erro 1' && r.rows?.[0]?.label === null, 'rótulo opcional por bloco');
const bloco1 = r.rows?.[0]?.id;
r = await as('authenticated', A, 'SELECT id FROM public.replace_script($1, $2::jsonb)', [vidA, JSON.stringify([{ kind: 'gancho', speech: 'Novo' }])]);
const total = (await one('SELECT count(*)::int AS n FROM public.script_blocks WHERE video_id = $1', [vidA])).n;
ok(!r.err && total === 1, 'um rascunho novo substitui o anterior inteiro');
r = await as('authenticated', A, 'SELECT id FROM public.replace_script($1, $2::jsonb)', [vidA, JSON.stringify([{ kind: 'gancho' }, { kind: 'monologo' }])]);
const depois = (await one('SELECT count(*)::int AS n FROM public.script_blocks WHERE video_id = $1', [vidA])).n;
ok(r.err && depois === 1, 'bloco inválido cancela tudo e mantém o roteiro anterior');
r = await as('authenticated', A, 'SELECT public.replace_script($1, $2::jsonb)', [vidA, '[]']);
ok(r.err, 'roteiro vazio é recusado');
r = await as('authenticated', B, 'SELECT public.replace_script($1, $2::jsonb)', [vidA, blocos]);
ok(r.err, 'ninguém grava roteiro no vídeo de outra pessoa');
r = await as('authenticated', B, 'SELECT id FROM public.script_blocks');
ok(!r.err && r.rows.length === 0, 'ninguém lê o roteiro de outra pessoa');
const atual = (await one('SELECT id FROM public.script_blocks WHERE video_id = $1', [vidA])).id;
r = await as('authenticated', B, `UPDATE public.script_blocks SET speech = 'invadido' WHERE id = $1 RETURNING id`, [atual]);
ok(!r.err && r.rows.length === 0, 'ninguém edita o roteiro de outra pessoa');
r = await as('authenticated', A, `UPDATE public.script_blocks SET speech = 'Editado à mão' WHERE id = $1 RETURNING speech`, [atual]);
ok(r.rows?.[0]?.speech === 'Editado à mão', 'dono edita um bloco');
r = await as('authenticated', A, `UPDATE public.script_blocks SET speech = repeat('a', 1501) WHERE id = $1`, [atual]);
ok(r.err, 'fala com mais de 1500 caracteres é recusada');
ok(bloco1 !== atual, 'blocos do rascunho antigo não ficam para trás');

console.log('Planos:');
const blocosA = (await as('authenticated', A, 'SELECT id FROM public.replace_script($1, $2::jsonb) ORDER BY position', [vidA, blocos])).rows.map((x) => x.id);
const plano = (blockId, extra = {}) => ({ block_id: blockId, framing: 'close', angle: 'altura_olhos', movement: 'parado', description: 'Rosto', location: 'Sala', ...extra });
r = await as('authenticated', A, 'SELECT id, position, orientation FROM public.replace_shots($1, $2::jsonb) ORDER BY position', [
  vidA,
  JSON.stringify([plano(blocosA[0]), plano(blocosA[1], { framing: 'aberto', location: 'Quarto' }), plano(blocosA[2], { orientation: 'horizontal' })]),
]);
ok(!r.err && r.rows.length === 3 && r.rows[0].orientation === 'vertical' && r.rows[2].orientation === 'horizontal', 'dono grava a decupagem' + (r.err ? ': ' + r.err : ''));
const planos = r.rows.map((x) => x.id);
r = await as('authenticated', A, 'SELECT public.replace_shots($1, $2::jsonb)', [vidA, JSON.stringify([plano(blocosA[0], { framing: 'super_close' })])]);
ok(r.err && (await one('SELECT count(*)::int AS n FROM public.shots WHERE video_id = $1', [vidA])).n === 3, 'enquadramento inválido cancela tudo e mantém a decupagem anterior');

const vidB = (await as('authenticated', B, `INSERT INTO public.videos (objective) VALUES ('crescer') RETURNING id`)).rows[0].id;
const blocoB = (await as('authenticated', B, 'SELECT id FROM public.replace_script($1, $2::jsonb)', [vidB, blocos])).rows[0].id;
r = await as('authenticated', A, 'SELECT public.replace_shots($1, $2::jsonb)', [vidA, JSON.stringify([plano(blocoB)])]);
ok(r.err, 'plano não pode apontar para bloco de outro vídeo');
r = await as('authenticated', B, 'SELECT public.replace_shots($1, $2::jsonb)', [vidA, JSON.stringify([plano(blocosA[0])])]);
ok(r.err, 'ninguém grava planos no vídeo de outra pessoa');
r = await as('authenticated', B, 'SELECT id FROM public.shots');
ok(!r.err && r.rows.length === 0, 'ninguém lê os planos de outra pessoa');
r = await as('authenticated', B, `UPDATE public.shots SET recorded = true WHERE id = $1 RETURNING id`, [planos[0]]);
ok(!r.err && r.rows.length === 0, 'ninguém marca plano de outra pessoa');

r = await as('authenticated', A, 'SELECT public.set_shoot_order($1, $2)', [vidA, [planos[1], planos[0], planos[2]]]);
const ordem = (await q('SELECT id FROM public.shots WHERE video_id = $1 ORDER BY shoot_order', [vidA])).rows.map((x) => x.id);
ok(!r.err && JSON.stringify(ordem) === JSON.stringify([planos[1], planos[0], planos[2]]), 'grava a ordem de gravação' + (r.err ? ': ' + r.err : ''));
r = await as('authenticated', A, 'SELECT public.set_shoot_order($1, $2)', [vidA, [planos[0], planos[0], planos[1]]]);
ok(r.err, 'ordem com plano repetido é recusada');
r = await as('authenticated', B, 'SELECT public.set_shoot_order($1, $2)', [vidA, planos]);
ok(r.err, 'ninguém mexe na ordem de outra pessoa');

console.log('Modo set:');
r = await as('authenticated', A, `UPDATE public.shots SET recorded = true, takes = takes + 1, good_take = true WHERE id = $1 RETURNING takes, good_take, recorded`, [planos[0]]);
ok(r.rows?.[0]?.takes === 1 && r.rows[0].good_take && r.rows[0].recorded, 'dono marca take gravado e take bom');
r = await as('authenticated', A, `UPDATE public.shots SET takes = 100 WHERE id = $1`, [planos[0]]);
ok(r.err, 'mais de 99 takes é recusado');
r = await as('authenticated', B, `UPDATE public.shots SET good_take = false WHERE id = $1 RETURNING id`, [planos[0]]);
ok(!r.err && r.rows.length === 0, 'ninguém mexe nos takes de outra pessoa');

console.log('Pessoas e link sem login:');
const pessoa = async (uid, name, role) =>
  as('authenticated', uid, `INSERT INTO public.video_people (video_id, name, role) VALUES ($1, $2, $3) RETURNING id, share_token`, [vidA, name, role]);
const eu = (await pessoa(A, 'Ana', 'eu')).rows[0];
r = await pessoa(A, 'Ana de novo', 'eu');
ok(r.err, 'só existe um "eu" por vídeo');
const ator = (await pessoa(A, 'Bruno', 'ator')).rows[0];
const filma = (await pessoa(A, 'Carla', 'filma')).rows[0];
ok(ator?.share_token && filma?.share_token, 'dono adiciona ator e quem filma, cada um com seu código');
r = await pessoa(B, 'Intruso', 'ator');
ok(r.err, 'ninguém adiciona pessoa no vídeo de outra pessoa');
r = await as('authenticated', B, 'SELECT id FROM public.video_people');
ok(!r.err && r.rows.length === 0, 'ninguém vê as pessoas do vídeo de outra pessoa');
r = await as('anon', null, 'SELECT id FROM public.video_people');
ok(r.err || r.rows.length === 0, 'visitante não lê a tabela de pessoas');

await as('authenticated', A, `UPDATE public.script_blocks SET person_id = $1 WHERE id = $2`, [ator.id, blocosA[1]]);
await as('authenticated', A, `UPDATE public.script_blocks SET person_id = $1 WHERE id = $2`, [eu.id, blocosA[0]]);
r = await as('authenticated', B, 'SELECT id FROM public.video_people WHERE video_id = $1', [vidB]);
const pessoaB = (await as('authenticated', B, `INSERT INTO public.video_people (video_id, name, role) VALUES ($1, 'Outro', 'ator') RETURNING id`, [vidB])).rows[0];
r = await as('authenticated', A, `UPDATE public.script_blocks SET person_id = $1 WHERE id = $2`, [pessoaB.id, blocosA[2]]);
ok(r.err, 'bloco não pode apontar para pessoa de outro vídeo');

r = await as('anon', null, 'SELECT public.shared_part($1) AS p', [ator.share_token]);
const parteAtor = r.rows?.[0]?.p;
ok(parteAtor?.person?.name === 'Bruno' && parteAtor.blocks.length === 1 && parteAtor.blocks[0].mine && parteAtor.shots.length === 0, 'o ator vê só o bloco dele, sem os planos' + (r.err ? ': ' + r.err : ''));
r = await as('anon', null, 'SELECT public.shared_part($1) AS p', [filma.share_token]);
const parteFilma = r.rows?.[0]?.p;
ok(parteFilma?.blocks.length === 3 && parteFilma.shots.length === 3, 'quem filma vê o roteiro e os planos');
ok(!JSON.stringify(parteFilma).includes(A) && !JSON.stringify(parteFilma).includes('share_token'), 'o link não expõe ids de conta nem códigos');
r = await as('anon', null, 'SELECT public.shared_part($1) AS p', [eu.share_token]);
ok(r.rows?.[0]?.p === null, 'o código do "eu" não abre nada');
r = await as('anon', null, 'SELECT public.shared_part(gen_random_uuid()) AS p');
ok(r.rows?.[0]?.p === null, 'código inventado não abre nada');

r = await as('anon', null, 'SELECT public.confirm_presence($1) AS ok', [ator.share_token]);
ok(r.rows?.[0]?.ok === true, 'a pessoa confirma presença pelo link');
r = await as('authenticated', A, `UPDATE public.video_people SET confirmed_at = now() WHERE id = $1`, [filma.id]);
ok(r.err, 'o dono não confirma no lugar da pessoa');
r = await as('authenticated', A, `UPDATE public.video_people SET share_token = gen_random_uuid() WHERE id = $1`, [filma.id]);
ok(r.err, 'o dono não troca o código à mão');

r = await as('anon', null, `SELECT public.accept_image_use($1, 'Bruno Souza', 'imagem-v1') AS ok`, [ator.share_token]);
ok(r.err, 'sem o nome de quem convidou, o termo não pode ser aceito');
ok(parteAtor.creator === null, 'o link avisa que falta o nome de quem convidou');
await as('authenticated', A, `UPDATE public.creator_profiles SET display_name = 'Ana Lima'`);
r = await as('anon', null, `SELECT public.accept_image_use($1, 'Bruno Souza', 'imagem-v1') AS ok`, [ator.share_token]);
ok(r.rows?.[0]?.ok === true, 'a pessoa aceita o uso de imagem pelo link');
ok((await one('SELECT creator_name FROM public.image_consents WHERE person_id = $1', [ator.id]))?.creator_name === 'Ana Lima', 'o aceite guarda o nome de quem recebeu a autorização');
await as('anon', null, `SELECT public.accept_image_use($1, 'Bruno Souza', 'imagem-v1')`, [ator.share_token]);
ok((await one('SELECT count(*)::int AS n FROM public.image_consents WHERE person_id = $1', [ator.id])).n === 1, 'aceitar de novo não duplica');
r = await as('anon', null, `SELECT public.accept_image_use($1, 'Bruno', 'qualquer')`, [ator.share_token]);
ok(r.err, 'versão de termo inválida é recusada');
r = await as('authenticated', A, 'SELECT accepted_name, video_title FROM public.image_consents');
ok(r.rows?.length === 1 && r.rows[0].accepted_name === 'Bruno Souza', 'o dono vê o aceite');
r = await as('authenticated', B, 'SELECT id FROM public.image_consents');
ok(!r.err && r.rows.length === 0, 'ninguém vê os aceites de outra pessoa');
r = await as('anon', null, 'SELECT id FROM public.image_consents');
ok(r.err || r.rows.length === 0, 'visitante não lê os aceites');
r = await as('authenticated', A, `INSERT INTO public.image_consents (owner_id, video_title, accepted_name, text_version) VALUES ($1, 'x', 'Falso Nome', 'imagem-v1')`, [A]);
ok(r.err, 'o dono não cria aceite falso');
r = await as('authenticated', A, 'DELETE FROM public.image_consents RETURNING id');
ok(!r.err && r.rows.length === 0, 'aceite não é apagado');

await as('authenticated', A, `UPDATE public.video_people SET share_enabled = false WHERE id = $1`, [filma.id]);
r = await as('anon', null, 'SELECT public.shared_part($1) AS p', [filma.share_token]);
ok(r.rows?.[0]?.p === null, 'link desligado não abre mais');
r = await as('anon', null, 'SELECT public.confirm_presence($1) AS ok', [filma.share_token]);
ok(r.rows?.[0]?.ok === false, 'link desligado não confirma presença');

await as('authenticated', A, 'DELETE FROM public.video_people WHERE id = $1', [ator.id]);
ok((await one('SELECT count(*)::int AS n FROM public.image_consents WHERE accepted_name = $1', ['Bruno Souza'])).n === 1, 'tirar a pessoa do vídeo mantém o aceite');

await as('authenticated', A, 'SELECT id FROM public.replace_script($1, $2::jsonb)', [vidA, JSON.stringify([{ kind: 'gancho', speech: 'Novo roteiro' }])]);
ok((await one('SELECT count(*)::int AS n FROM public.shots WHERE video_id = $1', [vidA])).n === 0, 'roteiro novo apaga os planos dos blocos antigos');

console.log('Publicar e radar:');
r = await as('authenticated', A, `INSERT INTO public.video_posts (video_id, caption, hashtags) VALUES ($1, 'Legenda', '{"#treino"}') RETURNING video_id`, [vidA]);
ok(!r.err, 'dono guarda a publicação' + (r.err ? ': ' + r.err : ''));
r = await as('authenticated', A, `UPDATE public.video_posts SET title = repeat('x', 101) WHERE video_id = $1`, [vidA]);
ok(r.err, 'título com mais de 100 caracteres é recusado');
r = await as('authenticated', B, 'SELECT video_id FROM public.video_posts');
ok(!r.err && r.rows.length === 0, 'ninguém vê a publicação de outra pessoa');
r = await as('authenticated', B, `INSERT INTO public.video_posts (video_id) VALUES ($1)`, [vidA]);
ok(r.err, 'ninguém escreve a publicação de outra pessoa');
r = await as('authenticated', A, `UPDATE public.videos SET published_at = now() WHERE id = $1 RETURNING published_at`, [vidA]);
ok(r.rows?.[0]?.published_at, 'dono marca o vídeo como publicado');

await q(`SELECT public.admin_add_radar(current_date, 'POV de segunda', 'Vídeos POV sobre a segunda-feira.', 'Mostre a sua segunda no seu nicho.', 'pov')`);
r = await as('authenticated', B, 'SELECT title FROM public.trend_radar');
ok(r.rows?.length === 1, 'quem está logado lê o radar');
r = await as('anon', null, 'SELECT title FROM public.trend_radar');
ok(r.err || r.rows.length === 0, 'visitante não lê o radar');
r = await as('authenticated', A, `INSERT INTO public.trend_radar (week_start, title, what, how_to_adapt) VALUES (current_date, 'Falso', 'Trend inventada aqui', 'Qualquer coisa assim')`);
ok(r.err, 'ninguém do app escreve no radar');
r = await as('authenticated', A, `SELECT public.admin_add_radar(current_date, 'Falso', 'Trend inventada aqui', 'Qualquer coisa assim')`);
ok(r.err, 'só a equipe (terminal) usa admin_add_radar');

console.log('Apagar vídeo:');
r = await as('authenticated', B, 'DELETE FROM public.videos WHERE id = $1 RETURNING id', [vidA]);
ok(!r.err && r.rows.length === 0, 'ninguém apaga o vídeo de outra pessoa');
const consentsAntes = (await one('SELECT count(*)::int AS n FROM public.image_consents')).n;
r = await as('authenticated', A, 'DELETE FROM public.videos WHERE id = $1 RETURNING id', [vidA]);
ok(!r.err && r.rows.length === 1, 'dono apaga o próprio vídeo' + (r.err ? ': ' + r.err : ''));
const sobras = await one(`SELECT
  (SELECT count(*) FROM public.video_ideas WHERE video_id = $1) + (SELECT count(*) FROM public.script_blocks WHERE video_id = $1)
  + (SELECT count(*) FROM public.shots WHERE video_id = $1) + (SELECT count(*) FROM public.video_people WHERE video_id = $1)
  + (SELECT count(*) FROM public.video_posts WHERE video_id = $1) AS n`, [vidA]);
ok(Number(sobras.n) === 0, 'ideias, roteiro, planos, pessoas e publicação vão junto');
ok((await one('SELECT count(*)::int AS n FROM public.image_consents')).n === consentsAntes && consentsAntes > 0, 'as autorizações de imagem ficam guardadas');

console.log('Ideias da quinzena:');
const ideiaQ = async (uid, pos) =>
  as('authenticated', uid, `INSERT INTO public.creator_ideas (period_start, position, title, format_slug, hook, why) VALUES ('2026-10-19', $1, $2, 'pov', 'Gancho', 'Porque sim') RETURNING id`, [pos, `Ideia ${pos}`]);
r = await ideiaQ(A, 0);
const q1 = r.rows?.[0]?.id;
ok(q1, 'criador guarda as ideias da quinzena' + (r.err ? ': ' + r.err : ''));
r = await ideiaQ(A, 0);
ok(r.err, 'a mesma posição não se repete na quinzena');
r = await as('authenticated', B, 'SELECT id FROM public.creator_ideas');
ok(!r.err && r.rows.length === 0, 'ninguém vê as ideias de outra pessoa');
r = await as('authenticated', B, 'SELECT public.start_video_from_idea($1, $2, $3, $4, $5)', [q1, 'crescer', 'reels', 30, ['sozinho']]);
ok(r.err, 'ninguém começa vídeo com a ideia de outra pessoa');
r = await as('authenticated', A, 'SELECT public.start_video_from_idea($1, $2, $3, $4, $5) AS id', [q1, 'crescer', 'reels', 30, ['sozinho', 'em_casa']]);
const vidQ = r.rows?.[0]?.id;
ok(vidQ, 'dono começa um vídeo a partir da ideia' + (r.err ? ': ' + r.err : ''));
const vq = await one('SELECT owner_id, title, hook, format_slug, stage, platform, duration_s FROM public.videos WHERE id = $1', [vidQ]);
ok(vq?.owner_id === A && vq.title === 'Ideia 0' && vq.hook === 'Gancho' && vq.format_slug === 'pov' && vq.stage === 'roteiro' && vq.platform === 'reels', 'o vídeo nasce com a ideia, já no roteiro');
ok((await one('SELECT video_id FROM public.creator_ideas WHERE id = $1', [q1]))?.video_id === vidQ, 'a ideia fica marcada como usada');
r = await as('authenticated', A, 'SELECT public.start_video_from_idea($1, $2, $3, $4, $5)', [q1, 'crescer', 'orkut', 30, ['sozinho']]);
ok(r.err, 'plataforma inválida é recusada');
r = await as('authenticated', A, `UPDATE public.creator_ideas SET video_id = NULL WHERE id = $1 RETURNING id`, [q1]);
ok(r.err || r.rows.length === 0, 'a marca de usada só muda pelo app');
r = await as('anon', null, 'SELECT public.start_video_from_idea($1, $2, $3, $4, $5)', [q1, 'crescer', 'reels', 30, ['sozinho']]);
ok(r.err, 'visitante não começa vídeo');

console.log('Cota da IA:');
let liberadas = 0;
for (let i = 0; i < 42; i++) {
  r = await as('authenticated', A, 'SELECT public.consume_ai_call() AS ok');
  if (r.rows?.[0]?.ok) liberadas++;
}
ok(liberadas === 40, `libera 40 chamadas por dia (liberou ${liberadas})`);
r = await as('authenticated', B, 'SELECT public.consume_ai_call() AS ok');
ok(r.rows?.[0]?.ok === true, 'a cota é por pessoa');
r = await as('authenticated', A, `INSERT INTO public.ai_usage (user_id, day, calls) VALUES ($1, current_date + 1, 0)`, [A]);
ok(r.err, 'ninguém mexe na própria cota direto');
r = await as('anon', null, 'SELECT public.consume_ai_call()');
ok(r.err, 'visitante não usa a IA');

console.log('Superfície:');
const noRls = (await q(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`)).rows.map((x) => x.relname);
ok(noRls.length === 0, 'toda tabela do public tem RLS' + (noRls.length ? ': ' + noRls.join(', ') : ''));
const definerSemPath = (await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')`)).rows.map((x) => x.proname);
ok(definerSemPath.length === 0, 'toda função security definer tem search_path' + (definerSemPath.length ? ': ' + definerSemPath.join(', ') : ''));

console.log(fails ? `\n${fails} falha(s).` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
