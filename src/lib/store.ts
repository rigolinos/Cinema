import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { optimizeSchedule } from "./optimizer";
import type { ParsedScript } from "./script";
import type {
  Project,
  Scene,
  Character,
  Actor,
  Casting,
  Location,
  ShootingDay,
  ProjectSettings,
} from "@/types/database";

interface CinemaState {
  projects: Project[];
  currentProject: Project | null;
  scenes: Scene[];
  characters: Character[];
  actors: Actor[];
  locations: Location[];
  castings: Casting[];
  shootingDays: ShootingDay[];
  settings: ProjectSettings | null;
  loading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchProjectDetails: (projectId: string) => Promise<void>;
  createProject: (title: string, description?: string) => Promise<Project | null>;
  uploadScript: (projectId: string, file: File) => Promise<boolean>;
  addActor: (projectId: string, fullName: string, costPerDay: number) => Promise<Actor | null>;
  deleteActor: (actorId: string) => Promise<boolean>;
  linkActor: (characterId: string, actorId: string) => Promise<boolean>;
  unlinkActor: (characterId: string) => Promise<boolean>;
  updateLocation: (location: Location) => Promise<boolean>;
  updateSettings: (settings: Partial<ProjectSettings>) => Promise<boolean>;
  generateProjectSchedule: (projectId: string) => Promise<void>;
  reorderShootingDays: (projectId: string, dayIds: string[]) => Promise<void>;
}

function message(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Erro inesperado.";
}

const today = () => new Date().toISOString().split("T")[0];
const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

export const useCinemaStore = create<CinemaState>((set, get) => ({
  projects: [],
  currentProject: null,
  scenes: [],
  characters: [],
  actors: [],
  locations: [],
  castings: [],
  shootingDays: [],
  settings: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await createClient()
        .from("projects")
        .select("*, scenes(count), actors(count), shooting_days(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Row = Project & Record<"scenes" | "actors" | "shooting_days", { count: number }[]>;
      const projects = (data as Row[]).map(({ scenes, actors, shooting_days, ...p }) => ({
        ...p,
        counts: {
          scenes: scenes?.[0]?.count ?? 0,
          actors: actors?.[0]?.count ?? 0,
          days: shooting_days?.[0]?.count ?? 0,
        },
      }));
      set({ projects, loading: false });
    } catch (err) {
      set({ projects: [], loading: false, error: message(err) });
    }
  },

  fetchProjectDetails: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const supabase = createClient();
      const [projectRes, scenesRes, charsRes, actorsRes, locationsRes, settingsRes, daysRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("scenes").select("*").eq("project_id", projectId).order("order_index"),
        supabase.from("characters").select("*").eq("project_id", projectId),
        supabase.from("actors").select("*").eq("project_id", projectId),
        supabase.from("locations").select("*").eq("project_id", projectId),
        supabase.from("project_settings").select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("shooting_days").select("*").eq("project_id", projectId).order("day_number"),
      ]);
      const failed = [projectRes, scenesRes, charsRes, actorsRes, locationsRes, settingsRes, daysRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      const characters = (charsRes.data ?? []) as Character[];
      let castings: Casting[] = [];
      if (characters.length > 0) {
        const { data, error } = await supabase
          .from("castings")
          .select("*")
          .in("character_id", characters.map((c) => c.id));
        if (error) throw error;
        castings = data as Casting[];
      }

      set({
        currentProject: (projectRes.data as Project | null) ?? null,
        scenes: (scenesRes.data ?? []) as Scene[],
        characters,
        actors: (actorsRes.data ?? []) as Actor[],
        locations: (locationsRes.data ?? []) as Location[],
        settings: (settingsRes.data as ProjectSettings | null) ?? null,
        shootingDays: (daysRes.data ?? []) as ShootingDay[],
        castings,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: message(err) });
    }
  },

  createProject: async (title: string, description?: string) => {
    set({ loading: true, error: null });
    try {
      const supabase = createClient();

      // Organização da pessoa (o banco cria uma se ainda não houver).
      const { data: orgId, error: orgErr } = await supabase.rpc("ensure_my_org");
      if (orgErr) throw orgErr;

      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({ org_id: orgId, title, description, status: "draft" })
        .select()
        .single();
      if (projErr) throw projErr;

      const { error: settingsErr } = await supabase.from("project_settings").insert({
        project_id: project.id,
        production_start: today(),
        production_end: inDays(30),
        max_hours_per_day: 12,
        num_crews: 1,
      });
      if (settingsErr) console.warn("Configuração padrão do projeto não foi criada:", settingsErr);

      set((state) => ({ projects: [project as Project, ...state.projects], loading: false }));
      return project as Project;
    } catch (err) {
      set({ loading: false, error: "Não foi possível criar o projeto: " + message(err) });
      return null;
    }
  },

  uploadScript: async (projectId: string, file: File) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Não foi possível ler o arquivo.");
      }
      const parsed = (await res.json()) as ParsedScript;

      const supabase = createClient();

      // Começa do zero: o roteiro novo substitui o anterior.
      for (const table of ["shooting_days", "scenes", "characters", "locations"] as const) {
        const { error } = await supabase.from(table).delete().eq("project_id", projectId);
        if (error) throw error;
      }

      const { data: insertedScenes, error: scenesErr } = await supabase
        .from("scenes")
        .insert(
          parsed.scenes.map((s) => ({
            project_id: projectId,
            number: s.number,
            int_ext: s.int_ext,
            location_name: s.location_name,
            time_of_day: s.time_of_day,
            synopsis: s.synopsis || "Sem resumo.",
            pages: s.pages,
            weather_requirement: s.weather_requirement,
            notes: s.notes,
            order_index: s.order_index,
          })),
        )
        .select();
      if (scenesErr) throw scenesErr;

      const sceneIdByNumber = new Map((insertedScenes ?? []).map((s) => [s.number as string, s.id as string]));

      if (parsed.characters.length > 0) {
        const { error } = await supabase.from("characters").insert(
          parsed.characters.map((c) => {
            const sceneIds = parsed.scenes
              .filter((s) => s.characters.includes(c.name))
              .map((s) => sceneIdByNumber.get(s.number))
              .filter((id): id is string => Boolean(id));
            return { project_id: projectId, name: c.name, scene_ids: sceneIds, size: c.size, total_scenes: sceneIds.length };
          }),
        );
        if (error) throw error;
      }

      if (parsed.locations.length > 0) {
        const { error } = await supabase.from("locations").insert(
          parsed.locations.map((l) => ({
            project_id: projectId,
            name: l.name,
            cost_per_day: 0,
            is_covered: l.isCovered,
            weather_risk: l.weatherRisk,
            setup_time_hours: 2,
          })),
        );
        if (error) throw error;
      }

      await supabase.from("projects").update({ status: "planning" }).eq("id", projectId);
      await get().fetchProjectDetails(projectId);
      return true;
    } catch (err) {
      set({ loading: false, error: message(err) });
      return false;
    }
  },

  addActor: async (projectId: string, fullName: string, costPerDay: number) => {
    try {
      const { data, error } = await createClient()
        .from("actors")
        .insert({ project_id: projectId, full_name: fullName, cost_per_day: costPerDay })
        .select()
        .single();
      if (error) throw error;
      set((state) => ({ actors: [...state.actors, data as Actor] }));
      return data as Actor;
    } catch (err) {
      set({ error: message(err) });
      return null;
    }
  },

  deleteActor: async (actorId: string) => {
    try {
      const { error } = await createClient().from("actors").delete().eq("id", actorId);
      if (error) throw error;
      set((state) => ({
        actors: state.actors.filter((a) => a.id !== actorId),
        castings: state.castings.filter((c) => c.actor_id !== actorId),
      }));
      return true;
    } catch (err) {
      set({ error: message(err) });
      return false;
    }
  },

  linkActor: async (characterId: string, actorId: string) => {
    try {
      const supabase = createClient();
      const { error: delErr } = await supabase.from("castings").delete().eq("character_id", characterId);
      if (delErr) throw delErr;
      const { data, error } = await supabase
        .from("castings")
        .insert({ character_id: characterId, actor_id: actorId, confirmed: true })
        .select()
        .single();
      if (error) throw error;
      set((state) => ({
        castings: [...state.castings.filter((c) => c.character_id !== characterId), data as Casting],
      }));
      return true;
    } catch (err) {
      set({ error: message(err) });
      return false;
    }
  },

  unlinkActor: async (characterId: string) => {
    try {
      const { error } = await createClient().from("castings").delete().eq("character_id", characterId);
      if (error) throw error;
      set((state) => ({ castings: state.castings.filter((c) => c.character_id !== characterId) }));
      return true;
    } catch (err) {
      set({ error: message(err) });
      return false;
    }
  },

  updateLocation: async (location: Location) => {
    try {
      const { error } = await createClient()
        .from("locations")
        .update({
          name: location.name,
          address: location.address,
          cost_per_day: location.cost_per_day,
          is_covered: location.is_covered,
          weather_risk: location.weather_risk,
          setup_time_hours: location.setup_time_hours,
        })
        .eq("id", location.id);
      if (error) throw error;
      set((state) => ({ locations: state.locations.map((l) => (l.id === location.id ? location : l)) }));
      return true;
    } catch (err) {
      set({ error: message(err) });
      return false;
    }
  },

  updateSettings: async (settings: Partial<ProjectSettings>) => {
    const projectId = get().currentProject?.id;
    if (!projectId) return false;
    try {
      const supabase = createClient();
      const { data: existing, error: readErr } = await supabase
        .from("project_settings")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();
      if (readErr) throw readErr;

      const query = existing
        ? supabase.from("project_settings").update(settings).eq("project_id", projectId)
        : supabase.from("project_settings").insert({
            project_id: projectId,
            production_start: today(),
            production_end: inDays(30),
            ...settings,
          });
      const { data, error } = await query.select().single();
      if (error) throw error;
      set({ settings: data as ProjectSettings });
      return true;
    } catch (err) {
      set({ error: message(err) });
      return false;
    }
  },

  generateProjectSchedule: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const state = get();
      const generated = optimizeSchedule({
        scenes: state.scenes,
        actors: state.actors,
        locations: state.locations,
        castings: state.castings,
        characters: state.characters,
        settings: state.settings ?? {
          id: "default",
          project_id: projectId,
          production_start: today(),
          production_end: inDays(30),
          max_hours_per_day: 12,
          num_crews: 1,
        },
      });

      const supabase = createClient();
      const { error: delErr } = await supabase.from("shooting_days").delete().eq("project_id", projectId);
      if (delErr) throw delErr;

      let inserted: ShootingDay[] = [];
      if (generated.length > 0) {
        const { data, error } = await supabase
          .from("shooting_days")
          .insert(
            generated.map((d) => ({
              project_id: projectId,
              day_number: d.day_number,
              date: d.date,
              location_id: d.location_id || null,
              scene_ids: d.scene_ids,
              actor_ids: d.actor_ids,
              estimated_hours: d.estimated_hours,
              cost_estimate: d.cost_estimate,
              notes: d.notes,
            })),
          )
          .select();
        if (error) throw error;
        inserted = ((data ?? []) as ShootingDay[]).sort((a, b) => a.day_number - b.day_number);
      }

      await supabase.from("projects").update({ status: "scheduled" }).eq("id", projectId);
      set({ shootingDays: inserted, loading: false });
    } catch (err) {
      set({ loading: false, error: message(err) });
    }
  },

  reorderShootingDays: async (projectId: string, dayIds: string[]) => {
    const previous = get().shootingDays;
    const reordered = dayIds
      .map((id) => previous.find((d) => d.id === id))
      .filter((d): d is ShootingDay => Boolean(d))
      .map((d, index) => ({ ...d, day_number: index + 1 }));
    set({ shootingDays: reordered });

    const { error } = await createClient().rpc("reorder_shooting_days", {
      p_project_id: projectId,
      p_day_ids: dayIds,
    });
    if (error) {
      set({ shootingDays: previous, error: "Não foi possível salvar a nova ordem: " + error.message });
    }
  },
}));
