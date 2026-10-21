"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Users,
  UserPlus,
  Check,
  ChevronRight,
  Film,
  AlertCircle,
  X,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCinemaStore } from "@/lib/store";

interface CharacterData {
  id: string;
  name: string;
  totalScenes: number;
  size: "protagonist" | "supporting" | "small";
  actorName: string | null;
  actorId: string | null;
  confirmed: boolean;
}

const sizeLabels = {
  protagonist: "Protagonista",
  supporting: "Coadjuvante",
  small: "Pequeno papel",
};

const sizeColors = {
  protagonist: "bg-primary/10 text-primary",
  supporting: "bg-chart-2/10 text-chart-2",
  small: "bg-muted text-muted-foreground",
};

export default function CastingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[3];

  const {
    characters: storeCharacters,
    actors: storeActors,
    castings: storeCastings,
    fetchProjectDetails,
    addActor,
    linkActor: linkActorAction,
    unlinkActor: unlinkActorAction,
    loading,
  } = useCinemaStore();

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails(projectId);
    }
  }, [projectId, fetchProjectDetails]);

  // Dynamically resolve and map character/actor link data
  const getLinkedActor = (charId: string) => {
    const casting = storeCastings.find((cas) => cas.character_id === charId);
    if (!casting) return { actorId: null, actorName: null, confirmed: false };
    const actor = storeActors.find((a) => a.id === casting.actor_id);
    return {
      actorId: casting.actor_id,
      actorName: actor ? actor.full_name : "Ator Desconhecido",
      confirmed: casting.confirmed,
    };
  };

  const characters: CharacterData[] = storeCharacters.map((c) => {
    const link = getLinkedActor(c.id);
    return {
      id: c.id,
      name: c.name,
      totalScenes: c.total_scenes,
      size: c.size,
      actorId: link.actorId,
      actorName: link.actorName,
      confirmed: link.confirmed,
    };
  });

  const actors = storeActors.map((a) => ({
    id: a.id,
    fullName: a.full_name,
    costPerDay: a.cost_per_day,
  }));

  const [selectedChar, setSelectedChar] = useState<CharacterData | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showNewActorDialog, setShowNewActorDialog] = useState(false);
  const [newActorName, setNewActorName] = useState("");
  const [newActorCost, setNewActorCost] = useState("");
  const [searchActor, setSearchActor] = useState("");

  const linked = characters.filter((c) => c.actorName);
  const unlinked = characters.filter((c) => !c.actorName);
  const progress = characters.length > 0 ? Math.round((linked.length / characters.length) * 100) : 0;

  function openLinkDialog(char: CharacterData) {
    setSelectedChar(char);
    setSearchActor("");
    setShowDialog(true);
  }

  async function linkActor(actorId: string) {
    if (!selectedChar) return;
    await linkActorAction(selectedChar.id, actorId);
    setShowDialog(false);
    setSelectedChar(null);
  }

  async function unlinkActor(charId: string) {
    await unlinkActorAction(charId);
  }

  async function addNewActor() {
    if (!newActorName.trim()) return;
    const createdActor = await addActor(
      projectId,
      newActorName.trim(),
      Number(newActorCost) || 0
    );
    if (createdActor && selectedChar) {
      await linkActorAction(selectedChar.id, createdActor.id);
    }
    setNewActorName("");
    setNewActorCost("");
    setShowNewActorDialog(false);
  }

  const filteredActors = actors.filter((a) =>
    a.fullName.toLowerCase().includes(searchActor.toLowerCase())
  );

  // Actors already assigned to a character
  const assignedActorIds = new Set(
    characters.filter((c) => c.actorId).map((c) => c.actorId)
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Carregando casting...</p>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="font-semibold text-lg">Nenhum personagem encontrado</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
          Você precisa fazer o upload do roteiro antes de configurar o casting dos personagens.
        </p>
        <Button onClick={() => router.push(`/dashboard/project/${projectId}/upload`)}>
          Ir para Upload de Roteiro
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Casting</h2>
        <p className="text-muted-foreground mt-1">
          Vincule cada personagem do roteiro a um ator real.
        </p>
      </div>

      {/* Progress Bar */}
      <Card className="border-border/50 bg-card mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {linked.length} de {characters.length} personagens vinculados
            </span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Character Cards */}
      <div className="space-y-3">
        {characters
          .sort((a, b) => {
            const order = { protagonist: 0, supporting: 1, small: 2 };
            return order[a.size] - order[b.size] || b.totalScenes - a.totalScenes;
          })
          .map((char) => (
            <Card
              key={char.id}
              className={cn(
                "border-border/50 transition-all",
                char.actorName
                  ? "bg-card"
                  : "bg-card/20 border-dashed"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Character Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{char.name}</h3>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px]", sizeColors[char.size])}
                      >
                        {sizeLabels[char.size]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Film className="h-3 w-3" />
                        {char.totalScenes} cenas
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ~{Math.ceil(char.totalScenes / 3)} dias estimados
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-muted-foreground/30">
                    →
                  </div>

                  {/* Actor Link */}
                  <div className="flex items-center gap-2 min-w-[200px]">
                    {char.actorName ? (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{char.actorName}</p>
                            <p className="text-[10px] text-muted-foreground">Vinculado</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => unlinkActor(char.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-dashed"
                        onClick={() => openLinkDialog(char)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Vincular ator
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Warning for unlinked */}
      {unlinked.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-warning">
          <AlertCircle className="h-4 w-4" />
          <span>
            {unlinked.length} personagen{unlinked.length > 1 ? "s" : ""} sem ator vinculado.
            Você pode continuar e vincular depois.
          </span>
        </div>
      )}

      {/* Continue */}
      <div className="mt-6 flex justify-end gap-3">
        <Button
          className="font-semibold"
          onClick={() =>
            router.push(`/dashboard/project/${projectId}/setup`)
          }
        >
          Continuar para Produção
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Link Actor Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Vincular ator a {selectedChar?.name}
            </DialogTitle>
            <DialogDescription>
              Selecione um ator já cadastrado ou adicione um novo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ator..."
                value={searchActor}
                onChange={(e) => setSearchActor(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>

            {/* Actor List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredActors.map((actor) => {
                const isAssigned = assignedActorIds.has(actor.id);
                return (
                  <button
                    key={actor.id}
                    disabled={isAssigned}
                    onClick={() => linkActor(actor.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border border-border/50 p-3 text-left transition-all",
                      isAssigned
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{actor.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {actor.costPerDay.toLocaleString("pt-BR")}/dia
                      </p>
                    </div>
                    {isAssigned && (
                      <Badge variant="secondary" className="text-[10px]">
                        Já vinculado
                      </Badge>
                    )}
                  </button>
                );
              })}

              {filteredActors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum ator encontrado.
                </p>
              )}
            </div>

            <Separator />

            {/* Add New Actor */}
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed"
              onClick={() => setShowNewActorDialog(true)}
            >
              <UserPlus className="h-4 w-4" />
              Adicionar novo ator
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Actor Dialog */}
      <Dialog open={showNewActorDialog} onOpenChange={setShowNewActorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Ator</DialogTitle>
            <DialogDescription>
              Cadastre um novo ator para vincular ao personagem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actorName">Nome completo</Label>
              <Input
                id="actorName"
                placeholder="Ex: Pedro Cardoso"
                value={newActorName}
                onChange={(e) => setNewActorName(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actorCost">Custo por diária (R$)</Label>
              <Input
                id="actorCost"
                type="number"
                placeholder="Ex: 5000"
                value={newActorCost}
                onChange={(e) => setNewActorCost(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewActorDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={addNewActor}
              disabled={!newActorName.trim()}
              className="font-semibold"
            >
              Criar e vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
