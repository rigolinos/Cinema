"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  TableProperties,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  ChevronRight,
  Cloud,
  CloudRain,
  CloudSun,
  Snowflake,
  Wind,
  CloudFog,
  Filter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { IntExt, TimeOfDay, WeatherRequirement } from "@/types/database";

interface SceneRow {
  id: string;
  number: string;
  int_ext: IntExt;
  location_name: string;
  time_of_day: TimeOfDay;
  characters: string[];
  synopsis: string;
  pages: number;
  weather_requirement: WeatherRequirement;
}

const timeIcons: Record<TimeOfDay, React.ReactNode> = {
  DIA: <Sun className="h-3.5 w-3.5 text-amber-400" />,
  NOITE: <Moon className="h-3.5 w-3.5 text-indigo-400" />,
  AMANHECER: <Sunrise className="h-3.5 w-3.5 text-orange-300" />,
  ENTARDECER: <Sunset className="h-3.5 w-3.5 text-rose-400" />,
};

const weatherIcons: Record<WeatherRequirement, React.ReactNode> = {
  any: <CloudSun className="h-3.5 w-3.5 text-muted-foreground" />,
  sun: <Sun className="h-3.5 w-3.5 text-amber-400" />,
  cloudy: <Cloud className="h-3.5 w-3.5 text-slate-400" />,
  rain: <CloudRain className="h-3.5 w-3.5 text-blue-400" />,
  snow: <Snowflake className="h-3.5 w-3.5 text-cyan-300" />,
  wind: <Wind className="h-3.5 w-3.5 text-teal-400" />,
  fog: <CloudFog className="h-3.5 w-3.5 text-gray-400" />,
};

const weatherLabels: Record<WeatherRequirement, string> = {
  any: "Qualquer",
  sun: "Sol",
  cloudy: "Nublado",
  rain: "Chuva",
  snow: "Neve",
  wind: "Vento",
  fog: "Neblina",
};

// Mock data simulating AI-extracted scenes
const mockScenes: SceneRow[] = [
  {
    id: "1",
    number: "1",
    int_ext: "EXT",
    location_name: "PRAIA DE COPACABANA",
    time_of_day: "AMANHECER",
    characters: ["LUCAS", "MARINA"],
    synopsis: "Lucas caminha sozinho pela praia. Marina aparece ao longe.",
    pages: 3,
    weather_requirement: "sun",
  },
  {
    id: "2",
    number: "2",
    int_ext: "INT",
    location_name: "APARTAMENTO DE LUCAS",
    time_of_day: "DIA",
    characters: ["LUCAS"],
    synopsis: "Lucas acorda e se prepara. Flashbacks da noite anterior.",
    pages: 2,
    weather_requirement: "any",
  },
  {
    id: "3",
    number: "3",
    int_ext: "INT",
    location_name: "DELEGACIA",
    time_of_day: "DIA",
    characters: ["LUCAS", "DELEGADO SILVA", "GUARDA"],
    synopsis: "Lucas é interrogado sobre o desaparecimento.",
    pages: 5,
    weather_requirement: "any",
  },
  {
    id: "4",
    number: "4",
    int_ext: "EXT",
    location_name: "RUA DO CENTRO",
    time_of_day: "NOITE",
    characters: ["LUCAS", "INFORMANTE"],
    synopsis: "Lucas encontra o informante em um beco escuro.",
    pages: 4,
    weather_requirement: "rain",
  },
  {
    id: "5",
    number: "5",
    int_ext: "INT",
    location_name: "BAR DO ZÉ",
    time_of_day: "NOITE",
    characters: ["LUCAS", "MARINA", "ZÉ"],
    synopsis: "Lucas e Marina se reencontram no bar. Tensão.",
    pages: 6,
    weather_requirement: "any",
  },
  {
    id: "6",
    number: "6",
    int_ext: "EXT",
    location_name: "PRAIA DE COPACABANA",
    time_of_day: "ENTARDECER",
    characters: ["MARINA"],
    synopsis: "Marina reflete sozinha olhando o mar.",
    pages: 2,
    weather_requirement: "cloudy",
  },
  {
    id: "7",
    number: "7",
    int_ext: "INT",
    location_name: "DELEGACIA",
    time_of_day: "DIA",
    characters: ["DELEGADO SILVA", "GUARDA"],
    synopsis: "Delegado descobre nova evidência.",
    pages: 3,
    weather_requirement: "any",
  },
  {
    id: "8",
    number: "8",
    int_ext: "EXT",
    location_name: "MORRO DA FAVELA",
    time_of_day: "DIA",
    characters: ["LUCAS", "INFORMANTE", "CAPANGAS"],
    synopsis: "Perseguição pelas vielas do morro.",
    pages: 8,
    weather_requirement: "sun",
  },
  {
    id: "9",
    number: "9",
    int_ext: "INT",
    location_name: "HOSPITAL",
    time_of_day: "NOITE",
    characters: ["LUCAS", "MARINA", "MÉDICA"],
    synopsis: "Lucas é levado ao hospital. Marina chega desesperada.",
    pages: 4,
    weather_requirement: "any",
  },
  {
    id: "10",
    number: "10",
    int_ext: "INT/EXT",
    location_name: "APARTAMENTO DE LUCAS",
    time_of_day: "DIA",
    characters: ["LUCAS", "MARINA"],
    synopsis: "Desfecho. Lucas e Marina decidem o futuro juntos.",
    pages: 5,
    weather_requirement: "sun",
  },
];

import { useCinemaStore } from "@/lib/store";

export default function BreakdownPage() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[3];

  const { scenes, characters, fetchProjectDetails, loading } = useCinemaStore();

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails(projectId);
    }
  }, [projectId, fetchProjectDetails]);

  const [filter, setFilter] = useState("");

  // Dynamically resolve character names for each scene from the store schema
  const getSceneCharacters = (sceneId: string) => {
    return characters
      .filter((c) => c.scene_ids?.includes(sceneId))
      .map((c) => c.name);
  };

  const processedScenes = scenes.map((s) => ({
    ...s,
    characters: getSceneCharacters(s.id),
  }));

  const filteredScenes = processedScenes.filter(
    (s) =>
      s.location_name.toLowerCase().includes(filter.toLowerCase()) ||
      s.characters.some((c) => c.toLowerCase().includes(filter.toLowerCase())) ||
      s.synopsis.toLowerCase().includes(filter.toLowerCase())
  );

  // Stats
  const uniqueLocations = new Set(scenes.map((s) => s.location_name)).size;
  const uniqueCharacters = new Set(characters.map((c) => c.name)).size;
  const totalPages = scenes.reduce((a, s) => a + s.pages, 0);
  const extScenes = scenes.filter((s) => s.int_ext === "EXT" || s.int_ext === "INT/EXT").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Carregando breakdown de cenas...</p>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <TableProperties className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="font-semibold text-lg">Nenhuma cena encontrada</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
          Você precisa fazer o upload do roteiro antes de revisar o breakdown de cenas.
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
        <h2 className="text-xl font-bold">Breakdown de Cenas</h2>
        <p className="text-muted-foreground mt-1">
          Revise e edite as cenas extraídas pela IA. Confirme antes de prosseguir.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Cenas", value: scenes.length, color: "text-primary" },
          { label: "Locações", value: uniqueLocations, color: "text-chart-2" },
          { label: "Personagens", value: uniqueCharacters, color: "text-chart-3" },
          { label: "Páginas", value: `${totalPages}/8`, color: "text-chart-4" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/30">
            <CardContent className="p-4">
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter & Actions */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por locação, personagem..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sun className="h-3 w-3 text-amber-400" />
          {extScenes} EXT
        </Badge>
        <Badge variant="secondary" className="gap-1">
          {scenes.length - extScenes} INT
        </Badge>
      </div>

      {/* Scene Table */}
      <Card className="border-border/50 bg-card/30 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead className="w-[80px]">Tipo</TableHead>
                <TableHead>Locação</TableHead>
                <TableHead className="w-[100px]">Horário</TableHead>
                <TableHead className="w-[90px]">Clima</TableHead>
                <TableHead>Personagens</TableHead>
                <TableHead>Sinopse</TableHead>
                <TableHead className="w-[60px] text-center">Pgs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScenes.map((scene) => (
                <TableRow
                  key={scene.id}
                  className="border-border/30 hover:bg-primary/5 transition-colors cursor-default"
                >
                  <TableCell className="font-mono text-xs font-medium">
                    {scene.number}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-medium",
                        scene.int_ext === "EXT"
                          ? "bg-blue-500/10 text-blue-400"
                          : scene.int_ext === "INT/EXT"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {scene.int_ext}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {scene.location_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {timeIcons[scene.time_of_day]}
                      <span className="text-xs text-muted-foreground">
                        {scene.time_of_day}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {weatherIcons[scene.weather_requirement]}
                      <span className="text-xs text-muted-foreground">
                        {weatherLabels[scene.weather_requirement]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {scene.characters.map((char) => (
                        <Badge
                          key={char}
                          variant="secondary"
                          className="text-[10px] bg-primary/5 text-primary/80"
                        >
                          {char}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                    {scene.synopsis}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {scene.pages}/8
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Continue */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline">Adicionar Cena</Button>
        <Button
          className="font-semibold"
          onClick={() =>
            router.push(`/dashboard/project/${projectId}/casting`)
          }
        >
          Confirmar e ir para Casting
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
