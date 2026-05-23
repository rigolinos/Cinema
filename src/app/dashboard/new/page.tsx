"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Film } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCinemaStore } from "@/lib/store";

export default function NewProjectPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { createProject, error: storeError } = useCinemaStore();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    const newProject = await createProject(title, description);
    
    if (newProject) {
      router.push(`/dashboard/project/${newProject.id}/upload`);
    } else {
      setLoading(false);
    }
  }


  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos projetos
      </Link>

      <div className="max-w-lg">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Novo Projeto</CardTitle>
            <CardDescription>
              Crie uma nova produção e comece a planejar sua ordem do dia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {storeError && (
              <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-foreground text-sm flex flex-col gap-1.5 animate-scale-in">
                <p className="font-semibold flex items-center gap-2">
                  <span>⚠️ Falha na Criação do Projeto</span>
                </p>
                <p className="text-muted-foreground leading-relaxed text-xs">{storeError}</p>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Nome da produção *</Label>
                <Input
                  id="title"
                  placeholder="Ex: O Último Farol"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  placeholder="Breve descrição do projeto"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-background/50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Link href="/dashboard">
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="font-semibold"
                  disabled={loading || !title.trim()}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Projeto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
