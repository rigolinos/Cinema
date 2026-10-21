import { NextRequest, NextResponse } from "next/server";
import { normalizeAiScript, parseFdx } from "@/lib/script";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;

const PROMPT = `Você é um experiente assistente de direção cinematográfica (1º AD).
Analise o roteiro em anexo e extraia todas as cenas e os personagens de cada uma.
Responda só com JSON, sem markdown, neste formato:
{
  "scenes": [
    {
      "number": "número da cena",
      "int_ext": "INT" | "EXT" | "INT/EXT",
      "location_name": "NOME DA LOCAÇÃO EM MAIÚSCULAS",
      "time_of_day": "DIA" | "NOITE" | "AMANHECER" | "ENTARDECER",
      "characters": ["NOME DO PERSONAGEM"],
      "synopsis": "resumo de 1 frase da cena",
      "pages": 8,
      "weather_requirement": "any" | "sun" | "cloudy" | "rain",
      "notes": "observações de produção"
    }
  ]
}
"pages" é a duração em oitavos de página (3 = 3/8, 8 = 1 página).`;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  // Só quem está logado gasta a cota da IA.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para enviar um roteiro.", 401);

  let file: File | null;
  try {
    file = (await request.formData()).get("file") as File | null;
  } catch {
    return fail("Envio inválido.", 400);
  }

  if (!file) return fail("Nenhum arquivo enviado.", 400);
  if (file.size > MAX_BYTES) return fail("O arquivo passa de 10 MB.", 413);

  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".fdx")) {
    const parsed = parseFdx(new TextDecoder("utf-8").decode(buffer));
    if (!parsed) return fail("Não encontramos cenas neste arquivo do Final Draft.", 422);
    return NextResponse.json(parsed);
  }

  if (!name.endsWith(".pdf")) {
    return fail("Formato não aceito. Envie um PDF ou um arquivo do Final Draft (.fdx).", 415);
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === "your-gemini-api-key-here") {
    return fail("A leitura de PDF ainda não está configurada no servidor.", 503);
  }

  let response: Response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType: "application/pdf", data: Buffer.from(buffer).toString("base64") } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
  } catch (err) {
    console.error("Gemini indisponível:", err);
    return fail("Não conseguimos falar com a IA agora. Tente de novo em instantes.", 502);
  }

  if (!response.ok) {
    console.error("Gemini respondeu", response.status, await response.text().catch(() => ""));
    const message =
      response.status === 429
        ? "A IA atingiu o limite de uso por agora. Tente de novo em alguns minutos."
        : "A IA não conseguiu ler este roteiro. Tente de novo.";
    return fail(message, 502);
  }

  try {
    const result = await response.json();
    const raw: string = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return NextResponse.json(normalizeAiScript(JSON.parse(clean)));
  } catch (err) {
    console.error("Resposta da IA fora do formato:", err);
    const message = err instanceof Error && err.message.startsWith("A IA") ? err.message : "A IA devolveu uma resposta que não deu para ler. Tente de novo.";
    return fail(message, 422);
  }
}
