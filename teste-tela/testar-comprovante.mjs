// Comprovante de uso de imagem: o botão aparece só para quem autorizou e a folha traz o registro,
// o texto aceito e o código. Supabase de mentira, dados inventados.
import path from "node:path";
import { APP, abrir, check, reset } from "./base-mock.mjs";

const out = process.argv[2];
const aceite = { id: "c1", person_id: "p1", video_id: "v1", accepted_name: "Bia Costa", accepted_at: "2026-11-17T19:46:00Z", video_title: "3 erros no arroz", creator_name: "Rafa Lima", text_version: "imagem-v1", accepted_text: null };
const { b, p, erros } = await abrir();

await reset({ consents: [aceite] });
await p.goto(`${APP}/video/v1/pessoas`, { waitUntil: "networkidle" });
const botoes = await p.getByRole("link", { name: "Ver comprovante" }).count();
check("o botão aparece só para quem autorizou", botoes === 1, String(botoes));
await p.getByRole("link", { name: "Ver comprovante" }).click();
await p.waitForURL("**/video/v1/pessoas/comprovante/p1");
await p.getByText("Autorização de uso de imagem").waitFor();
const t = await p.locator("body").innerText();
check("traz quem autorizou, para quem e o vídeo", t.includes("Bia Costa (nome digitado ao aceitar)") && t.includes("Rafa Lima") && t.includes("3 erros no arroz"));
check("data e hora no horário de Brasília", t.includes("17/11/2026, 16:46 (horário de Brasília)"), t.match(/\d\d\/\d\d\/\d{4}[^\n]*/)?.[0] ?? "");
check("o texto aceito, remontado pela versão", t.includes("Autorizo Rafa Lima a usar, sem cobrar nada") && t.includes("Declaro que tenho 18 anos ou mais."));
check("o código de verificação", /GRV-[0-9A-F]{4}-[0-9A-F]{4}/.test(t), t.match(/GRV-\S+/)?.[0] ?? "");
await p.screenshot({ path: path.join(out, "cp-1-comprovante.png"), fullPage: true });
await p.emulateMedia({ media: "print" });
check("na impressão, os botões somem", !(await p.getByRole("button", { name: "Salvar em PDF" }).isVisible()));
await p.screenshot({ path: path.join(out, "cp-2-impressao.png"), fullPage: true });
await p.emulateMedia({ media: "screen" });

await p.goto(`${APP}/video/v1/pessoas/comprovante/p9`, { waitUntil: "networkidle" });
await p.getByText("Não há autorização").waitFor();
check("pessoa sem autorização: avisa", true);
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
