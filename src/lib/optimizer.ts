import type { Scene, Actor, Location, Casting, Character, ShootingDay, ProjectSettings } from "@/types/database";

export interface SchedulingInput {
  scenes: Scene[];
  actors: Actor[];
  locations: Location[];
  castings: Casting[];
  characters: Character[];
  settings: ProjectSettings;
}

const TIME_ORDER = { AMANHECER: 0, DIA: 1, ENTARDECER: 2, NOITE: 3 } as const;

// Personagens de cada cena, pela ligação guardada em characters.scene_ids.
export function charactersByScene(characters: Character[]): Map<string, Character[]> {
  const map = new Map<string, Character[]>();
  for (const c of characters) {
    for (const sceneId of c.scene_ids ?? []) {
      const list = map.get(sceneId) ?? [];
      list.push(c);
      map.set(sceneId, list);
    }
  }
  return map;
}

// Horas estimadas: 1 página (8/8) leva cerca de 1,5 h; externa pesa mais; cada personagem soma um pouco.
export function sceneHours(scene: Scene, characterCount: number): number {
  return (scene.pages / 8) * 1.5 + (scene.int_ext === "EXT" ? 1.5 : 1) + characterCount * 0.2;
}

// Próxima data de gravação, pulando domingo.
export function nextShootingDate(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  if (next.getDay() === 0) next.setDate(next.getDate() + 1);
  return next;
}

const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function optimizeSchedule({ scenes, actors, locations, castings, characters, settings }: SchedulingInput): ShootingDay[] {
  if (scenes.length === 0) return [];

  const actorById = new Map(actors.map((a) => [a.id, a]));
  const actorByCharacter = new Map<string, Actor>();
  for (const c of castings) {
    const actor = actorById.get(c.actor_id);
    if (actor) actorByCharacter.set(c.character_id, actor);
  }
  const sceneCharacters = charactersByScene(characters);
  const locationByName = new Map(locations.map((l) => [l.name.toUpperCase(), l]));

  // Agrupa por locação; as locações com mais páginas vêm primeiro.
  const groups = new Map<string, Scene[]>();
  for (const s of scenes) {
    const key = s.location_name.toUpperCase();
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const sortedGroups = [...groups].sort(
    (a, b) => b[1].reduce((sum, s) => sum + s.pages, 0) - a[1].reduce((sum, s) => sum + s.pages, 0),
  );

  const days: ShootingDay[] = [];
  let date = new Date(settings.production_start + "T12:00:00");
  if (date.getDay() === 0) date = nextShootingDate(date);
  const maxHours = settings.max_hours_per_day || 12;

  for (const [locName, locScenes] of sortedGroups) {
    const location = locationByName.get(locName);
    const setupTime = location?.setup_time_hours ?? 2;

    // Mesma luz junta; dentro dela, cenas menores primeiro.
    const ordered = [...locScenes].sort((a, b) =>
      a.time_of_day === b.time_of_day ? a.pages - b.pages : TIME_ORDER[a.time_of_day] - TIME_ORDER[b.time_of_day],
    );

    let dayScenes: Scene[] = [];
    let dayHours = setupTime;

    const closeDay = () => {
      if (dayScenes.length === 0) return;

      const actorIds = new Set<string>();
      for (const s of dayScenes) {
        for (const c of sceneCharacters.get(s.id) ?? []) {
          const actor = actorByCharacter.get(c.id);
          if (actor) actorIds.add(actor.id);
        }
      }
      const actorsCost = [...actorIds].reduce((sum, id) => sum + (actorById.get(id)?.cost_per_day ?? 0), 0);

      const alerts: string[] = [];
      const open = location ? !location.is_covered : dayScenes.some((s) => s.int_ext !== "INT");
      if (open && location?.weather_risk === "high") alerts.push("Locação ao ar livre: risco de clima alto");
      for (const s of dayScenes) {
        if (s.weather_requirement === "sun" && open) alerts.push(`Cena ${s.number} precisa de sol`);
        if (s.weather_requirement === "rain" && open) alerts.push(`Cena ${s.number} pede chuva: preparar efeito`);
      }
      const uncast = new Set<string>();
      for (const s of dayScenes) {
        for (const c of sceneCharacters.get(s.id) ?? []) if (!actorByCharacter.has(c.id)) uncast.add(c.name);
      }
      if (uncast.size > 0) alerts.push(`Sem ator: ${[...uncast].join(", ")}`);
      if (dayHours > maxHours) alerts.push(`Dia longo: ${dayHours.toFixed(1)} h (limite ${maxHours} h)`);

      days.push({
        id: `day_${days.length + 1}`,
        project_id: settings.project_id,
        day_number: days.length + 1,
        date: formatDate(date),
        location_id: location?.id ?? "",
        scene_ids: dayScenes.map((s) => s.id),
        actor_ids: [...actorIds],
        estimated_hours: Number(dayHours.toFixed(1)),
        cost_estimate: (location?.cost_per_day ?? 0) + actorsCost,
        notes: alerts.join("\n"),
      });
      date = nextShootingDate(date);
    };

    for (const scene of ordered) {
      const hours = sceneHours(scene, sceneCharacters.get(scene.id)?.length ?? 0);
      if (dayScenes.length > 0 && dayHours + hours > maxHours) {
        closeDay();
        dayScenes = [scene];
        dayHours = setupTime + hours;
      } else {
        dayScenes.push(scene);
        dayHours += hours;
      }
    }
    closeDay();
  }

  return days;
}
