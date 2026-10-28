"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Clapperboard, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLATFORMS, type Platform } from "@/lib/ideas";
import { cn } from "@/lib/utils";
import { InstallItem } from "@/components/gravai/instalar";
import { MemorySection } from "@/components/gravai/memoria";
import { PrivacySection } from "@/components/gravai/privacy-section";
import { ReportAi } from "@/components/gravai/denunciar";

const field =
  "min-h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus:border-foreground";

export default function PerfilPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    createClient()
      .from("creator_profiles")
      .select("display_name, niche, platforms")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName(data.display_name ?? "");
        setNiche(data.niche ?? "");
        setPlatforms((data.platforms ?? []) as Platform[]);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const { error } = await createClient()
      .from("creator_profiles")
      .upsert(
        { display_name: name.trim() || null, niche: niche.trim() || null, platforms },
        { onConflict: "user_id" },
      );
    setStatus(error ? "error" : "saved");
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">Perfil</p>
        <h1 className="font-display text-[32px]">{name.trim() || "Você"}</h1>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
      </header>

      <form onSubmit={save} className="flex flex-col gap-5 rounded-2xl bg-card p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          O Gravaí usa estas respostas para sugerir ideias que combinem com você.
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor="nome" className="text-sm font-semibold">
            Como quer ser chamado
          </label>
          <input id="nome" value={name} onChange={(e) => { setName(e.target.value); setStatus("idle"); }} maxLength={80} className={field} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="nicho" className="text-sm font-semibold">
            Sobre o que é o seu perfil
          </label>
          <input
            id="nicho"
            value={niche}
            onChange={(e) => { setNiche(e.target.value); setStatus("idle"); }}
            maxLength={120}
            placeholder="Ex.: treino em casa"
            className={field}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Onde você posta</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLATFORMS) as Platform[]).map((p) => {
              const on = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setPlatforms((list) => (on ? list.filter((x) => x !== p) : [...list, p]));
                    setStatus("idle");
                  }}
                  className={cn(
                    "min-h-11 rounded-full border border-input px-4 text-sm font-semibold",
                    on && "border-foreground bg-foreground text-background",
                  )}
                >
                  {PLATFORMS[p]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <button
          type="submit"
          disabled={status === "saving"}
          className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
        >
          {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : "Salvar"}
        </button>
        {status === "saved" && (
          <p role="status" className="flex items-center gap-2 text-sm font-semibold">
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            Salvo. Vou usar isso nas próximas ideias.
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            Não deu para salvar. Confira a internet e tente de novo; se continuar, saia e entre de novo na conta.
          </p>
        )}
      </form>

      <Link href="/aprenda" className="flex min-h-14 items-center gap-3 rounded-2xl border border-border p-4">
        <BookOpen className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="flex flex-col">
          <span className="font-bold">Aprenda o básico do set</span>
          <span className="text-sm text-muted-foreground">Gancho, planos, ângulos e as regras que fazem diferença</span>
        </span>
      </Link>

      <Link href="/dashboard" className="flex min-h-14 items-center gap-3 rounded-2xl border border-border p-4">
        <Clapperboard className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="flex flex-col">
          <span className="font-bold">Modo produção</span>
          <span className="text-sm text-muted-foreground">Filmes e curtas: decupagem, elenco e ordem do dia</span>
        </span>
      </Link>

      <MemorySection />

      <InstallItem />

      <PrivacySection />

      <ReportAi area="outro" content="" label="Denunciar uma resposta da IA" />

      <button type="button" onClick={logout} className="flex min-h-12 items-center gap-2 self-start font-semibold text-muted-foreground">
        <LogOut className="size-5" strokeWidth={1.75} aria-hidden="true" />
        Sair
      </button>
    </div>
  );
}
