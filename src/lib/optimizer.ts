import type { Scene, Actor, Location, Casting, Character, ShootingDay, ProjectSettings } from "@/types/database";

export interface SchedulingInput {
  scenes: Scene[];
  actors: Actor[];
  locations: Location[];
  castings: Casting[];
  characters: Character[];
  settings: ProjectSettings;
}

export function optimizeSchedule({
  scenes,
  actors,
  locations,
  castings,
  characters,
  settings,
}: SchedulingInput): ShootingDay[] {
  if (scenes.length === 0) return [];

  // 1. Create mapping helpers
  const characterToActorMap = new Map<string, Actor>();
  const actorMap = new Map<string, Actor>(actors.map((a) => [a.id, a]));
  const characterMap = new Map<string, Character>(characters.map((c) => [c.id, c]));

  castings.forEach((c) => {
    const char = characterMap.get(c.character_id);
    const actor = actorMap.get(c.actor_id);
    if (char && actor) {
      characterToActorMap.set(char.name.toUpperCase(), actor);
    }
  });

  const locationMap = new Map<string, Location>(
    locations.map((l) => [l.name.toUpperCase(), l])
  );

  // 2. Estimate hours and pages for each scene
  // 1 page = 8 eighths. We assume 1 eighth of a page takes approx 0.5 hours to shoot, plus setup.
  const getSceneComplexity = (s: Scene) => {
    const actorCount = s.dependencies?.length || 0; // characters count
    const isExt = s.int_ext === "EXT";
    return (s.pages / 8) * 1.5 + (isExt ? 1.5 : 1) + actorCount * 0.2;
  };

  // Group scenes by Location Name
  const locationGroups = new Map<string, Scene[]>();
  scenes.forEach((s) => {
    const locName = s.location_name.toUpperCase();
    if (!locationGroups.has(locName)) {
      locationGroups.set(locName, []);
    }
    locationGroups.get(locName)!.push(s);
  });

  // Sort locations by volume (total pages) descending to prioritize large locations
  const sortedLocations = Array.from(locationGroups.entries()).sort((a, b) => {
    const pagesA = a[1].reduce((sum, s) => sum + s.pages, 0);
    const pagesB = b[1].reduce((sum, s) => sum + s.pages, 0);
    return pagesB - pagesA;
  });

  const shootingDays: ShootingDay[] = [];
  let currentDayNumber = 1;
  
  // Date tracking starting from production start date
  const currentDate = new Date(settings.production_start + "T12:00:00");
  const maxHours = settings.max_hours_per_day || 12;

  // Function to format date to YYYY-MM-DD
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  // Helper to advance date by 1 day (skipping Sundays as a production standard)
  const nextProductionDate = (d: Date) => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    if (next.getDay() === 0) { // 0 is Sunday
      next.setDate(next.getDate() + 1);
    }
    return next;
  };

  // 3. Heuristic Scheduling Loop
  for (const [locName, locScenes] of sortedLocations) {
    const location = locationMap.get(locName);
    const setupTime = location?.setup_time_hours || 2;
    
    // Sort scenes within location to optimize actor blocks
    // First by light requirement (DIA vs NOITE) to keep shooting blocks continuous
    // Then by size (smaller pages first for quick wins)
    const sortedScenes = [...locScenes].sort((a, b) => {
      if (a.time_of_day === b.time_of_day) {
        return a.pages - b.pages;
      }
      const order = { AMANHECER: 0, DIA: 1, ENTARDECER: 2, NOITE: 3 };
      return order[a.time_of_day] - order[b.time_of_day];
    });

    let currentDayScenes: Scene[] = [];
    let currentDayHours = setupTime; // Start day with location setup

    const packScenesIntoDays = () => {
      if (currentDayScenes.length > 0) {
        // Collect actors present in current day's scenes
        const dayActors = new Set<string>();
        currentDayScenes.forEach((s) => {
          // Check characters in the scene
          // Find actor for each character
          scenes.forEach((originalScene) => {
            if (originalScene.id === s.id) {
              // Extract characters from this scene using simple text parsing or database characters
              // Since characters are mapped to scene_ids, we can find actors casting
            }
          });

          // In FDX parsing, characters are list of strings in the scene
          // Let's check which actors correspond to these characters
          const sceneChars = (s as any).characters || [];
          sceneChars.forEach((charName: string) => {
            const actor = characterToActorMap.get(charName.toUpperCase());
            if (actor) {
              dayActors.add(actor.full_name);
            } else {
              dayActors.add(charName.toUpperCase() + " (Sem Cast)");
            }
          });
        });

        const dayActorNames = Array.from(dayActors);
        const dayActorIds = dayActorNames
          .map((name) => actors.find((a) => a.full_name === name)?.id)
          .filter(Boolean) as string[];

        // Calculate Cost Estimates
        const locCost = location?.cost_per_day || 0;
        const actorsCost = dayActorIds.reduce((sum, id) => {
          const actor = actorMap.get(id);
          return sum + (actor?.cost_per_day || 0);
        }, 0);

        const totalCostEstimate = locCost + actorsCost;

        // Verify warnings/alerts
        const alerts: string[] = [];
        if (!location?.is_covered && location?.weather_risk === "high") {
          alerts.push("⚠ Locação ao ar livre — risco climático ALTO");
        }
        
        currentDayScenes.forEach((s) => {
          if (s.weather_requirement === "sun" && !location?.is_covered) {
            alerts.push(`☀ Cena ${s.number} requer sol (locação aberta)`);
          } else if (s.weather_requirement === "rain" && !location?.is_covered) {
            alerts.push(`🌧 Cena ${s.number} requer chuva — preparar efeitos artificiais`);
          }
        });

        if (currentDayHours > maxHours) {
          alerts.push(`⏰ Dia longo: ${currentDayHours.toFixed(1)}h estimadas (limite ${maxHours}h)`);
        }

        // Add Shooting Day
        shootingDays.push({
          id: `day_${currentDayNumber}`,
          project_id: settings.project_id,
          day_number: currentDayNumber,
          date: formatDate(currentDate),
          location_id: location?.id || "",
          scene_ids: currentDayScenes.map((s) => s.id),
          actor_ids: dayActorIds,
          estimated_hours: Number(currentDayHours.toFixed(1)),
          cost_estimate: totalCostEstimate,
          notes: alerts.join("\n"),
        });

        // Advance to next day
        currentDayNumber++;
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1); // Skip Sunday
      }
    };

    for (const scene of sortedScenes) {
      const complexity = getSceneComplexity(scene);
      
      // If adding this scene exceeds the max hours per day, pack current scenes and start a new day
      if (currentDayScenes.length > 0 && currentDayHours + complexity > maxHours) {
        packScenesIntoDays();
        currentDayScenes = [scene];
        currentDayHours = setupTime + complexity;
      } else {
        currentDayScenes.push(scene);
        currentDayHours += complexity;
      }
    }

    // Pack remaining scenes for the location
    packScenesIntoDays();
  }

  return shootingDays;
}
