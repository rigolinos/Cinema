"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  MapPin,
  ChevronRight,
  Calendar,
  CloudRain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface LocationData {
  id: string;
  name: string;
  address: string;
  costPerDay: number;
  setupHours: number;
  isCovered: boolean;
  weatherRisk: "low" | "medium" | "high";
}

const weatherRiskLabels = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};

const weatherRiskColors = {
  low: "bg-green-500/10 text-green-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  high: "bg-red-500/10 text-red-500",
};

export default function SetupPage() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[3];

  const {
    locations: storeLocations,
    settings: storeSettings,
    fetchProjectDetails,
    updateLocation: updateLocationAction,
    updateSettings: updateSettingsAction,
  } = useCinemaStore();

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails(projectId);
    }
  }, [projectId, fetchProjectDetails]);

  // Map settings to dynamic local form fields
  const [productionStart, setProductionStart] = useState("2026-07-01");
  const [productionEnd, setProductionEnd] = useState("2026-08-15");
  const [maxHoursPerDay, setMaxHoursPerDay] = useState("12");
  const [numCrews, setNumCrews] = useState("1");

  // Quando a configuração chega do banco, o formulário passa a mostrá-la.
  const [syncedSettings, setSyncedSettings] = useState(storeSettings);
  if (storeSettings !== syncedSettings) {
    setSyncedSettings(storeSettings);
    if (storeSettings) {
      setProductionStart(storeSettings.production_start || "");
      setProductionEnd(storeSettings.production_end || "");
      setMaxHoursPerDay(String(storeSettings.max_hours_per_day || 12));
      setNumCrews(String(storeSettings.num_crews || 1));
    }
  }

  const locations: LocationData[] = storeLocations.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address || "",
    costPerDay: l.cost_per_day || 0,
    setupHours: l.setup_time_hours || 2,
    isCovered: l.is_covered ?? true,
    weatherRisk: l.weather_risk || "low",
  }));

  const [editLocation, setEditLocation] = useState<LocationData | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const totalDailyCost = locations.reduce((a, l) => a + l.costPerDay, 0);
  const coveredCount = locations.filter((l) => l.isCovered).length;
  const highRiskCount = locations.filter((l) => l.weatherRisk === "high").length;

  function openEditDialog(loc: LocationData) {
    setEditLocation({ ...loc });
    setShowEditDialog(true);
  }

  async function saveLocation() {
    if (!editLocation) return;
    await updateLocationAction({
      id: editLocation.id,
      project_id: projectId,
      name: editLocation.name,
      address: editLocation.address,
      cost_per_day: editLocation.costPerDay,
      setup_time_hours: editLocation.setupHours,
      is_covered: editLocation.isCovered,
      weather_risk: editLocation.weatherRisk,
      availability: [],
    });
    setShowEditDialog(false);
    setEditLocation(null);
  }

  async function handleSaveAndContinue() {
    await updateSettingsAction({
      production_start: productionStart,
      production_end: productionEnd,
      max_hours_per_day: Number(maxHoursPerDay) || 12,
      num_crews: Number(numCrews) || 1,
    });
    router.push(`/dashboard/project/${projectId}/schedule`);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Configuração da Produção</h2>
        <p className="text-muted-foreground mt-1">
          Configure locações, período de filmagem e parâmetros da produção.
        </p>
      </div>

      <Tabs defaultValue="locations" className="space-y-6">
        <TabsList className="bg-card/30 border border-border/50">
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="h-4 w-4" />
            Locações
          </TabsTrigger>
          <TabsTrigger value="production" className="gap-2">
            <Calendar className="h-4 w-4" />
            Produção
          </TabsTrigger>
        </TabsList>

        {/* Locations Tab */}
        <TabsContent value="locations">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-primary">{locations.length}</p>
                <p className="text-xs text-muted-foreground">Locações</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-chart-3">{coveredCount}</p>
                <p className="text-xs text-muted-foreground">Cobertas</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-destructive">{highRiskCount}</p>
                <p className="text-xs text-muted-foreground">Risco Alto</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-chart-4">
                  R$ {(totalDailyCost / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-muted-foreground">Custo/dia total</p>
              </CardContent>
            </Card>
          </div>

          {/* Location Cards */}
          <div className="space-y-3">
            {locations.map((loc) => (
              <Card
                key={loc.id}
                className="border-border/50 bg-card/30 hover:border-primary/20 transition-all cursor-pointer"
                onClick={() => openEditDialog(loc)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{loc.name}</h3>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            loc.isCovered
                              ? "bg-muted text-muted-foreground"
                              : "bg-blue-500/10 text-blue-400"
                          )}
                        >
                          {loc.isCovered ? "INT" : "EXT"}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] gap-1",
                            weatherRiskColors[loc.weatherRisk]
                          )}
                        >
                          <CloudRain className="h-2.5 w-2.5" />
                          Risco {weatherRiskLabels[loc.weatherRisk]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {loc.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-semibold">
                          R$ {loc.costPerDay.toLocaleString("pt-BR")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">por dia</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{loc.setupHours}h</p>
                        <p className="text-[10px] text-muted-foreground">montagem</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle className="text-base">Período de Filmagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Data de início</Label>
                  <Input
                    id="start"
                    type="date"
                    value={productionStart}
                    onChange={(e) => setProductionStart(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">Data de término</Label>
                  <Input
                    id="end"
                    type="date"
                    value={productionEnd}
                    onChange={(e) => setProductionEnd(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxHours">Horas máx. por dia</Label>
                  <Input
                    id="maxHours"
                    type="number"
                    min="4"
                    max="16"
                    value={maxHoursPerDay}
                    onChange={(e) => setMaxHoursPerDay(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crews">Número de equipes</Label>
                  <Input
                    id="crews"
                    type="number"
                    min="1"
                    max="5"
                    value={numCrews}
                    onChange={(e) => setNumCrews(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Continue */}
      <div className="mt-6 flex justify-end gap-3">
        <Button
          className="font-semibold"
          onClick={handleSaveAndContinue}
        >
          Gerar Ordem do Dia
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Locação</DialogTitle>
            <DialogDescription>
              Ajuste os detalhes da locação.
            </DialogDescription>
          </DialogHeader>

          {editLocation && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editLocation.name}
                  onChange={(e) =>
                    setEditLocation({ ...editLocation, name: e.target.value })
                  }
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={editLocation.address}
                  onChange={(e) =>
                    setEditLocation({ ...editLocation, address: e.target.value })
                  }
                  className="bg-background/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Custo por dia (R$)</Label>
                  <Input
                    type="number"
                    value={editLocation.costPerDay}
                    onChange={(e) =>
                      setEditLocation({
                        ...editLocation,
                        costPerDay: Number(e.target.value),
                      })
                    }
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montagem (horas)</Label>
                  <Input
                    type="number"
                    value={editLocation.setupHours}
                    onChange={(e) =>
                      setEditLocation({
                        ...editLocation,
                        setupHours: Number(e.target.value),
                      })
                    }
                    className="bg-background/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={editLocation.isCovered ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setEditLocation({ ...editLocation, isCovered: true })
                      }
                    >
                      Coberta
                    </Button>
                    <Button
                      variant={!editLocation.isCovered ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setEditLocation({ ...editLocation, isCovered: false })
                      }
                    >
                      Ao ar livre
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Risco climático</Label>
                  <div className="flex gap-2">
                    {(["low", "medium", "high"] as const).map((risk) => (
                      <Button
                        key={risk}
                        variant={
                          editLocation.weatherRisk === risk ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setEditLocation({ ...editLocation, weatherRisk: risk })
                        }
                      >
                        {weatherRiskLabels[risk]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveLocation} className="font-semibold">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
