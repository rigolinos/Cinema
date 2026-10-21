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

console.log('Superfície:');
const noRls = (await q(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`)).rows.map((x) => x.relname);
ok(noRls.length === 0, 'toda tabela do public tem RLS' + (noRls.length ? ': ' + noRls.join(', ') : ''));
const definerSemPath = (await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')`)).rows.map((x) => x.proname);
ok(definerSemPath.length === 0, 'toda função security definer tem search_path' + (definerSemPath.length ? ': ' + definerSemPath.join(', ') : ''));

console.log(fails ? `\n${fails} falha(s).` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
