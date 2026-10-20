import { describe, expect, it } from "vitest";
import { nextShootingDate, optimizeSchedule } from "@/lib/optimizer";
import type { Actor, Casting, Character, Location, ProjectSettings, Scene } from "@/types/database";

const scene = (id: string, location: string, extra: Partial<Scene> = {}): Scene => ({
  id,
  project_id: "p",
  number: id,
  int_ext: "INT",
  location_name: location,
  time_of_day: "DIA",
  synopsis: "",
  pages: 8,
  estimated_hours: 0,
  weather_requirement: "any",
  dependencies: [],
  order_index: 0,
  ...extra,
});

const character = (id: string, name: string, sceneIds: string[]): Character => ({
  id,
  project_id: "p",
  name,
  scene_ids: sceneIds,
  size: "small",
  total_scenes: sceneIds.length,
});

const actor = (id: string, name: string, cost: number): Actor => ({
  id,
  project_id: "p",
  full_name: name,
  cost_per_day: cost,
  blocked_dates: [],
  max_consecutive_days: 6,
});

const location = (id: string, name: string, extra: Partial<Location> = {}): Location => ({
  id,
  project_id: "p",
  name,
  cost_per_day: 100,
  availability: [],
  setup_time_hours: 2,
  is_covered: true,
  weather_risk: "low",
  ...extra,
});

// 2026-10-24 é um sábado.
const settings: ProjectSettings = {
  id: "s",
  project_id: "p",
  production_start: "2026-10-24",
  production_end: "2026-11-30",
  max_hours_per_day: 12,
  num_crews: 1,
};

describe("optimizeSchedule", () => {
  it("coloca no dia os atores dos personagens das cenas e soma o custo", () => {
    const scenes = [scene("s1", "CASA"), scene("s2", "CASA")];
    const characters = [character("c1", "LUCAS", ["s1", "s2"]), character("c2", "MARINA", ["s2"])];
    const actors = [actor("a1", "Ator Lucas", 500), actor("a2", "Atriz Marina", 300)];
    const castings: Casting[] = [{ id: "k1", character_id: "c1", actor_id: "a1", confirmed: true }];

    const days = optimizeSchedule({ scenes, characters, actors, castings, locations: [location("l1", "CASA")], settings });

    expect(days).toHaveLength(1);
    expect(days[0].actor_ids).toEqual(["a1"]);
    expect(days[0].cost_estimate).toBe(100 + 500);
    expect(days[0].notes).toContain("Sem ator: MARINA");
  });

  it("agrupa por locação e pula o domingo", () => {
    const scenes = [scene("s1", "CASA"), scene("s2", "PRAIA", { int_ext: "EXT" }), scene("s3", "CASA")];
    const days = optimizeSchedule({ scenes, characters: [], actors: [], castings: [], locations: [], settings });

    expect(days.map((d) => d.scene_ids)).toEqual([["s1", "s3"], ["s2"]]);
    expect(days.map((d) => d.date)).toEqual(["2026-10-24", "2026-10-26"]);
    expect(days.map((d) => d.day_number)).toEqual([1, 2]);
  });

  it("abre outro dia quando passa do limite de horas", () => {
    const scenes = [scene("s1", "CASA", { pages: 40 }), scene("s2", "CASA", { pages: 40 })];
    const days = optimizeSchedule({ scenes, characters: [], actors: [], castings: [], locations: [], settings });
    expect(days).toHaveLength(2);
  });

  it("avisa sobre clima em locação aberta", () => {
    const scenes = [scene("s1", "PRAIA", { int_ext: "EXT", weather_requirement: "sun" })];
    const locations = [location("l1", "PRAIA", { is_covered: false, weather_risk: "high" })];
    const [day] = optimizeSchedule({ scenes, characters: [], actors: [], castings: [], locations, settings });
    expect(day.notes).toContain("risco de clima alto");
    expect(day.notes).toContain("Cena s1 precisa de sol");
  });

  it("sem cenas, sem dias", () => {
    expect(optimizeSchedule({ scenes: [], characters: [], actors: [], castings: [], locations: [], settings })).toEqual([]);
  });
});

describe("nextShootingDate", () => {
  it("pula do sábado para a segunda", () => {
    const next = nextShootingDate(new Date("2026-10-24T12:00:00"));
    expect(next.getDay()).toBe(1);
  });
});
