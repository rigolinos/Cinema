// Supabase de mentira para testar o app sem tocar no banco real: guarda tudo em memória.
import http from "node:http";

const TOKEN = "11111111-1111-4111-8111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", role: "authenticated", exp: 9999999999, aud: "authenticated" })}.assinatura`;
const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "convidado@exemplo.test", app_metadata: {}, user_metadata: { full_name: "Bia Costa" }, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: 9999999999, refresh_token: "r", user };

const baseVideo = { objective: "crescer", platform: "reels", platforms: ["reels"], resources: ["sozinho"], archived_at: null, published_at: null, owner_id: user.id, hook: null, format_slug: null, brief: "", situation: "", payoff: "", shoot_date: null, shoot_place: null };
const videos = [
  { ...baseVideo, id: "draft", title: null, duration_s: 30, stage: "ideia", updated_at: "2026-10-30T12:00:00Z", created_at: "2026-10-30T12:00:00Z" },
  { ...baseVideo, id: "v1", title: "3 erros no arroz", hook: "Você lava o arroz errado", format_slug: "tres-erros", situation: "Mostra os erros na panela.", payoff: "Termina com o arroz soltinho.", duration_s: 30, stage: "gravar", updated_at: "2026-11-03T12:00:00Z", created_at: "2026-11-01T12:00:00Z" },
  { ...baseVideo, id: "v2", title: "Meu vídeo antigo", hook: "Gancho antigo", duration_s: 60, stage: "roteiro", updated_at: "2026-11-01T12:00:00Z", created_at: "2026-10-30T12:00:00Z" },
  { ...baseVideo, id: "v3", title: "Vídeo já gravado", hook: "Gancho gravado", duration_s: 15, stage: "pronto", updated_at: "2026-10-20T12:00:00Z", created_at: "2026-10-18T12:00:00Z" },
];
const block = (id, video_id, position, kind, label, speech, on_screen, action) => ({ id, video_id, position, kind, label, speech, on_screen, action, person_id: null });
const blocks = [
  block("b1", "v1", 0, "gancho", null, "Você lava o arroz errado.", "3 ERROS", "Mostra a panela"),
  block("b2", "v1", 1, "conteudo", "Erro 1", "Primeiro erro: pouca água.", "", "Coloca a água"),
  block("b3", "v1", 2, "chamada", null, "Segue para a parte dois.", "", "Aponta para a câmera"),
];
const shot = (id, block_id, position, shoot_order, framing, description, location) => ({ id, video_id: "v1", block_id, position, shoot_order, framing, angle: "altura_olhos", movement: "parado", orientation: "vertical", description, location, wardrobe: "", why: "Prende o olhar", recorded: false, good_take: false, takes: 0 });
const shots = [
  shot("s1", "b1", 0, 1, "close", "Close no rosto revelando a dúvida antes de abrir a panela no fogão", "Cozinha"),
  shot("s2", "b2", 1, 2, "detalhe", "Água entrando na panela", "Cozinha"),
  shot("s3", "b3", 2, 3, "medio", "Pessoa aponta para a câmera", "Sala"),
];
const ideas = [
  { id: "i1", video_id: "draft", round: 1, title: "Sair e lembrar algo essencial", hook: "Pessoa sai de casa sorrindo, assobiando", situation: "Ela sai de casa feliz e percebe, já na rua, que esqueceu algo.", payoff: "Volta correndo e encontra a chave na porta.", why: "Todo mundo já passou por isso.", format_slug: "pov", chosen: false, created_at: "2026-11-01T12:00:00Z" },
];
const part = {
  person: { name: "Bia Costa", role: "ator", roles: ["ator"], confirmed: false },
  video: { title: "A fofoca da escola", shoot_date: null, shoot_place: null, platform: "reels" },
  creator: "Rafa Lima",
  consented: false,
  blocks: [{ number: 1, kind: "gancho", label: null, speech: "Bia: Oi, gente!", on_screen: "", action: "", mine: true, cue: null }],
  shots: [],
};

let state;
const reset = () => {
  state = { claimed: false, mode: "free", rpcOff: false, calls: [], writes: [], videos: structuredClone(videos), shots: structuredClone(shots), blocks: structuredClone(blocks), ideas: structuredClone(ideas) };
};
reset();
const longInvite = { token: "22222222-2222-4222-8222-222222222222", title: "As 7 coisas que ninguém te conta antes de abrir um restaurante", duration_s: 90, stage: "planos", published_at: null, updated_at: "2026-11-02T18:00:00Z" };
const doneInvite = { token: "33333333-3333-4333-8333-333333333333", title: "Convite já gravado", duration_s: 15, stage: "pronto", published_at: "2026-10-20T12:00:00Z", updated_at: "2026-10-20T12:00:00Z" };

const rpc = {
  shared_part: () => state.part ?? part,
  invite_state: (_, logged) => (!logged ? "anon" : state.claimed ? "mine" : state.mode),
  claim_invite: () => {
    if (state.mode !== "free") return state.mode;
    state.claimed = true;
    return "mine";
  },
  release_invite: ({ p_token }) => {
    if (p_token === TOKEN) state.claimed = false;
    state.released = p_token;
    return true;
  },
  my_invites: () => [
    ...(state.claimed ? [{ token: TOKEN, title: part.video.title, duration_s: 30, stage: "gravar", published_at: null, updated_at: "2026-11-02T20:00:00Z" }] : []),
    ...(state.released === longInvite.token ? [] : [longInvite]),
    doneInvite,
  ],
  invite_claims: () => (state.claimed ? [{ person_id: "p1", name: "Bia Costa" }] : []),
  delete_empty_drafts: () => 0,
  set_shoot_order: () => null,
  choose_idea: ({ p_idea_id }) => {
    const idea = state.ideas.find((i) => i.id === p_idea_id);
    state.ideas.forEach((i) => {
      i.chosen = i.id === p_idea_id;
    });
    const v = state.videos.find((x) => x.id === idea.video_id);
    Object.assign(v, { title: idea.title, hook: idea.hook, situation: idea.situation, payoff: idea.payoff, format_slug: idea.format_slug, stage: "roteiro" });
    return null;
  },
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] ?? "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "Content-Range", "Access-Control-Allow-Credentials": "true" };
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    const body = raw ? JSON.parse(raw) : {};
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...cors, ...headers });
      res.end(JSON.stringify(data));
    };
    if (req.method === "OPTIONS") return send(200, {});

    const logged = (req.headers.authorization ?? "").includes(jwt);
    if (url.pathname === "/__reset") {
      reset();
      Object.assign(state, body);
      return send(200, {});
    }
    if (url.pathname === "/__state") return send(200, state);
    if (url.pathname === "/__blocks") {
      state.blocks = [...state.blocks.filter((x) => !body.some((n) => n.video_id === x.video_id)), ...body];
      return send(200, {});
    }
    if (url.pathname === "/__shots") {
      state.shots = [...state.shots, ...body];
      return send(200, {});
    }
    if (url.pathname === "/__video") {
      Object.assign(state.videos.find((v) => v.id === body.id), body);
      return send(200, {});
    }
    if (url.pathname === "/auth/v1/user") return logged ? send(200, user) : send(401, { code: "no_authorization", msg: "no" });
    if (url.pathname === "/auth/v1/token") return send(200, session);
    if (url.pathname === "/auth/v1/signup") {
      state.signup = { body, url: req.url };
      return send(200, { ...user, identities: [{}] });
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.split("/").pop();
      state.calls.push(fn);
      const off = state.rpcOff && ["invite_state", "claim_invite", "release_invite", "my_invites", "invite_claims"].includes(fn);
      if (off || !rpc[fn]) return send(404, { code: "PGRST202", message: "not found" });
      return send(200, rpc[fn](body, logged));
    }
    const tables = { videos: "videos", shots: "shots", script_blocks: "blocks", video_ideas: "ideas" };
    const table = tables[url.pathname.split("/").pop()];
    if (table) {
      const id = url.searchParams.get("id");
      const videoId = url.searchParams.get("video_id");
      const match = (r) => (!id || `eq.${r.id}` === id) && (!videoId || `eq.${r.video_id}` === videoId);
      if (req.method === "PATCH") {
        state.writes.push({ table, method: "PATCH", id, body });
        state[table].forEach((r) => {
          if (match(r)) Object.assign(r, body);
        });
        return send(200, state[table].filter(match));
      }
      if (req.method === "DELETE") {
        state.writes.push({ table, method: "DELETE", id });
        state[table] = state[table].filter((r) => !match(r));
        return send(200, []);
      }
      if (req.method === "POST") {
        const row = { ...baseVideo, id: `novo${state.writes.length}`, stage: "ideia", title: null, objective: null, platform: null, platforms: [], duration_s: null, resources: [], updated_at: "2026-11-03T13:00:00Z", created_at: "2026-11-03T13:00:00Z", ...body };
        state.writes.push({ table, method: "POST", body });
        state[table].push(row);
        return send(201, String(req.headers.accept).includes("vnd.pgrst.object") ? row : [row]);
      }
      let rows = state[table].filter(match);
      const stage = url.searchParams.get("stage");
      if (stage === "neq.pronto") rows = rows.filter((r) => r.stage !== "pronto");
      if (stage === "eq.ideia") rows = rows.filter((r) => r.stage === "ideia");
      if (url.searchParams.get("title") === "is.null") rows = rows.filter((r) => r.title === null);
      if ((url.searchParams.get("select") ?? "").includes("video_ideas(count)")) rows = rows.map((r) => ({ ...r, video_ideas: [{ count: state.ideas.filter((i) => i.video_id === r.id).length }] }));
      return send(200, rows, { "Content-Range": `0-${rows.length - 1}/${rows.length}` });
    }
    if (url.pathname === "/rest/v1/video_people") {
      if (req.method === "PATCH") {
        const id = url.searchParams.get("id");
        state.writes.push({ table: "people", method: "PATCH", id, body });
        state.people = (state.people ?? []).map((r) => (`eq.${r.id}` === id ? { ...r, ...body } : r));
        return send(200, state.people.filter((r) => `eq.${r.id}` === id));
      }
      if (req.method === "POST") {
        state.people = [...(state.people ?? []), ...(Array.isArray(body) ? body : [body])];
        return send(201, []);
      }
      if (state.people) return send(200, state.people);
      if (state.peopleOff) return send(200, []);
      return send(200, [
        { id: "p0", name: "Rafa Lima", role: "eu", roles: ["ator"], share_token: "00000000-0000-4000-8000-0000000000aa", share_enabled: true, confirmed_at: null },
        { id: "p1", name: "Bia Costa", role: "ator", roles: ["ator"], share_token: TOKEN, share_enabled: true, confirmed_at: null },
      ]);
    }
    if (url.pathname === "/rest/v1/image_consents") {
      const pessoa = url.searchParams.get("person_id");
      const rows = (state.consents ?? []).filter((c) => !pessoa || `eq.${c.person_id}` === pessoa);
      if (String(req.headers.accept).includes("vnd.pgrst.object")) return rows.length ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "0 rows" });
      return send(200, rows);
    }
    if (url.pathname === "/rest/v1/creator_profiles") return send(200, [state.profile ?? { display_name: "Rafa Lima", niche: "x", platforms: [] }]);
    if (url.pathname === "/rest/v1/legal_acceptances") return send(200, [{ document: "termos", version: "v1" }, { document: "privacidade", version: "v2" }]);
    return send(200, []);
  })
  .listen(54399, () => console.log("mock em 54399"));
