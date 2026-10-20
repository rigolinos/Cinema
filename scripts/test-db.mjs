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

await as('authenticated', A, 'SELECT id FROM public.replace_script($1, $2::jsonb)', [vidA, JSON.stringify([{ kind: 'gancho', speech: 'Novo roteiro' }])]);
ok((await one('SELECT count(*)::int AS n FROM public.shots WHERE video_id = $1', [vidA])).n === 0, 'roteiro novo apaga os planos dos blocos antigos');

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
