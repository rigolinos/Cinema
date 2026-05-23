import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { optimizeSchedule } from "./optimizer";
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

  // Actions
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

// Fallback high-fidelity local state for demo mode
const demoProjects: Project[] = [
  {
    id: "1",
    org_id: "demo-org",
    title: "O Último Farol",
    description: "Um drama psicológico tenso à beira-mar.",
    status: "planning",
    max_hours_per_day: 12,
    num_crews: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    org_id: "demo-org",
    title: "Sombras de São Paulo",
    description: "Um filme noir nas noites chuvosas da metrópole.",
    status: "draft",
    max_hours_per_day: 12,
    num_crews: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Fallback for demo/unauthenticated mode
        set({ projects: demoProjects, loading: false });
        return;
      }

      // Query projects from Supabase
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      set({ projects: data as Project[], loading: false });
    } catch (err: any) {
      console.warn("Failed fetching from Supabase, entering demo mode:", err.message);
      set({ projects: demoProjects, loading: false });
    }
  },

  fetchProjectDetails: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const project = get().projects.find((p) => p.id === projectId) || null;
      set({ currentProject: project });

      if (!session) {
        // Unauthenticated demo details - filled automatically
        // Add fake delay for realism
        await new Promise((r) => setTimeout(r, 400));
        set({ loading: false });
        return;
      }

      // Fetch all dynamic elements concurrently from Supabase
      const [
        scenesRes,
        charsRes,
        actorsRes,
        locationsRes,
        settingsRes,
        shootingDaysRes,
      ] = await Promise.all([
        supabase.from("scenes").select("*").eq("project_id", projectId).order("order_index"),
        supabase.from("characters").select("*").eq("project_id", projectId),
        supabase.from("actors").select("*").eq("project_id", projectId),
        supabase.from("locations").select("*").eq("project_id", projectId),
        supabase.from("project_settings").select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("shooting_days").select("*").eq("project_id", projectId).order("day_number"),
      ]);

      // Fetch castings for characters of this project
      let castingsData: Casting[] = [];
      if (charsRes.data && charsRes.data.length > 0) {
        const charIds = charsRes.data.map((c) => c.id);
        const castingsRes = await supabase
          .from("castings")
          .select("*")
          .in("character_id", charIds);
        if (!castingsRes.error) {
          castingsData = castingsRes.data as Casting[];
        }
      }

      set({
        scenes: (scenesRes.data || []) as Scene[],
        characters: (charsRes.data || []) as Character[],
        actors: (actorsRes.data || []) as Actor[],
        locations: (locationsRes.data || []) as Location[],
        settings: settingsRes.data as ProjectSettings | null,
        shootingDays: (shootingDaysRes.data || []) as ShootingDay[],
        castings: castingsData,
        loading: false,
      });
    } catch (err: any) {
      console.error("Error fetching project details from Supabase:", err);
      set({ loading: false, error: err.message });
    }
  },

  createProject: async (title: string, description?: string) => {
    set({ loading: true, error: null });
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Fallback for demo
        const newProj: Project = {
          id: `demo_${Date.now()}`,
          org_id: "demo-org",
          title,
          description,
          status: "draft",
          max_hours_per_day: 12,
          num_crews: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({
          projects: [newProj, ...state.projects],
          loading: false,
        }));
        return newProj;
      }

      // 1. Get user org with self-healing fallback
      let orgId = "";
      const { data: memberData, error: memberErr } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (memberErr || !memberData) {
        console.log("Usuário logado sem organização. Criando organização e associação auto-recuperáveis...");
        const userEmail = session.user.email || "User";
        const orgName = `Produtora de ${userEmail.split("@")[0]}`;
        const slug = `${userEmail.split("@")[0].toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`;

        // Insert organization
        const { data: orgData, error: orgErr } = await supabase
          .from("organizations")
          .insert({ name: orgName, slug, plan: "free" })
          .select()
          .maybeSingle();

        if (orgErr) {
          console.error("Erro ao criar organização auto-recuperável:", orgErr);
          throw new Error("Tabelas do banco de dados ausentes ou ilegíveis. Por favor, execute o arquivo 'supabase/schema.sql' no SQL Editor do seu Dashboard do Supabase para criar as tabelas!");
        }

        if (!orgData) {
          throw new Error("Erro ao criar organização auto-recuperável: nenhuma linha retornada.");
        }

        // Link user to organization
        const { error: linkErr } = await supabase
          .from("organization_members")
          .insert({ org_id: orgData.id, user_id: session.user.id, role: "owner" });

        if (linkErr) {
          console.error("Erro ao vincular membro auto-recuperável:", linkErr);
          throw new Error("Não foi possível associar o seu usuário à organização criada: " + linkErr.message);
        }

        orgId = orgData.id;
      } else {
        orgId = memberData.org_id;
      }

      // 2. Insert project
      const { data: projData, error: projErr } = await supabase
        .from("projects")
        .insert({
          org_id: orgId,
          title,
          description,
          status: "draft",
        })
        .select()
        .single();

      if (projErr) {
        console.error("Erro ao inserir projeto:", projErr);
        throw new Error("Erro de banco de dados ao criar projeto: " + projErr.message);
      }

      // 3. Create default project settings
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(today.getDate() + 30);

      const { error: settingsErr } = await supabase.from("project_settings").insert({
        project_id: projData.id,
        production_start: today.toISOString().split("T")[0],
        production_end: nextMonth.toISOString().split("T")[0],
        max_hours_per_day: 12,
        num_crews: 1,
      });

      if (settingsErr) {
        console.warn("Erro não crítico ao criar project_settings default:", settingsErr);
      }

      set((state) => ({
        projects: [projData as Project, ...state.projects],
        loading: false,
      }));

      return projData as Project;
    } catch (err: any) {
      console.error("Erro em createProject:", err);
      set({ loading: false, error: err.message });
      return null;
    }
  },

  uploadScript: async (projectId: string, file: File) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Call route handler parsing API
      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Erro no parsing do arquivo.");

      const parsedData = await res.json();
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Fallback for demo
        set({
          scenes: parsedData.scenes.map((s: any) => ({ ...s, project_id: projectId })),
          characters: parsedData.characters.map((c: any) => ({ ...c, id: `char_${c.name}`, project_id: projectId })),
          locations: parsedData.locations.map((l: any) => ({ ...l, id: `loc_${l.name}`, project_id: projectId })),
          loading: false,
        });
        return true;
      }

      // 1. Delete old data for this project in Supabase to start fresh
      await Promise.all([
        supabase.from("scenes").delete().eq("project_id", projectId),
        supabase.from("characters").delete().eq("project_id", projectId),
        supabase.from("locations").delete().eq("project_id", projectId),
        supabase.from("shooting_days").delete().eq("project_id", projectId),
      ]);

      // 2. Insert new parsed Scenes
      const scenesToInsert = parsedData.scenes.map((s: any) => ({
        project_id: projectId,
        number: s.number,
        int_ext: s.int_ext,
        location_name: s.location_name,
        time_of_day: s.time_of_day,
        synopsis: s.synopsis || "Cena extraída pelo parser.",
        pages: s.pages || 8,
        weather_requirement: s.weather_requirement || "any",
        notes: s.notes || "",
        order_index: s.order_index,
      }));

      const { data: insertedScenes, error: scenesErr } = await supabase
        .from("scenes")
        .insert(scenesToInsert)
        .select();

      if (scenesErr) throw scenesErr;

      // 3. Insert Characters and link scene IDs
      const charactersToInsert = parsedData.characters.map((c: any) => {
        // Map names to matching inserted scene IDs
        const matchedSceneIds = (insertedScenes || [])
          .filter((s) => {
            const parsedScene = parsedData.scenes.find((ps: any) => ps.number === s.number);
            return parsedScene?.characters?.includes(c.name);
          })
          .map((s) => s.id);

        return {
          project_id: projectId,
          name: c.name,
          scene_ids: matchedSceneIds,
          size: c.size || "small",
          total_scenes: countOccurrences(parsedData.scenes, c.name),
        };
      });

      await supabase.from("characters").insert(charactersToInsert);

      // 4. Insert Locations
      const locationsToInsert = parsedData.locations.map((l: any) => ({
        project_id: projectId,
        name: l.name,
        cost_per_day: 0,
        is_covered: l.isCovered,
        weather_risk: l.weatherRisk || "low",
        setup_time_hours: 2,
      }));

      await supabase.from("locations").insert(locationsToInsert);

      // 5. Update Project Status to planning
      await supabase
        .from("projects")
        .update({ status: "planning" })
        .eq("id", projectId);

      // Reload project state
      await get().fetchProjectDetails(projectId);
      return true;
    } catch (err: any) {
      set({ loading: false, error: err.message });
      return false;
    }
  },

  addActor: async (projectId: string, fullName: string, costPerDay: number) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Fallback for demo
        const newActor: Actor = {
          id: `actor_${Date.now()}`,
          project_id: projectId,
          full_name: fullName,
          cost_per_day: costPerDay,
          blocked_dates: [],
          max_consecutive_days: 6,
        };
        set((state) => ({
          actors: [...state.actors, newActor],
        }));
        return newActor;
      }

      const { data, error } = await supabase
        .from("actors")
        .insert({
          project_id: projectId,
          full_name: fullName,
          cost_per_day: costPerDay,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        actors: [...state.actors, data as Actor],
      }));
      return data as Actor;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  },

  deleteActor: async (actorId: string) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        set((state) => ({
          actors: state.actors.filter((a) => a.id !== actorId),
        }));
        return true;
      }

      const { error } = await supabase.from("actors").delete().eq("id", actorId);
      if (error) throw error;

      set((state) => ({
        actors: state.actors.filter((a) => a.id !== actorId),
      }));
      return true;
    } catch (err: any) {
      console.error(err);
      return false;
    }
  },

  linkActor: async (characterId: string, actorId: string) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const newCasting: Casting = {
          id: `casting_${Date.now()}`,
          character_id: characterId,
          actor_id: actorId,
          confirmed: true,
        };
        set((state) => ({
          castings: [...state.castings.filter((c) => c.character_id !== characterId), newCasting],
        }));
        return true;
      }

      // Remove old casting if exists
      await supabase.from("castings").delete().eq("character_id", characterId);

      const { data, error } = await supabase
        .from("castings")
        .insert({
          character_id: characterId,
          actor_id: actorId,
          confirmed: true,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        castings: [...state.castings.filter((c) => c.character_id !== characterId), data as Casting],
      }));
      return true;
    } catch (err: any) {
      console.error(err);
      return false;
    }
  },

  unlinkActor: async (characterId: string) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        set((state) => ({
          castings: state.castings.filter((c) => c.character_id !== characterId),
        }));
        return true;
      }

      const { error } = await supabase.from("castings").delete().eq("character_id", characterId);
      if (error) throw error;

      set((state) => ({
        castings: state.castings.filter((c) => c.character_id !== characterId),
      }));
      return true;
    } catch (err: any) {
      console.error(err);
      return false;
    }
  },

  updateLocation: async (location: Location) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        set((state) => ({
          locations: state.locations.map((l) => (l.id === location.id ? location : l)),
        }));
        return true;
      }

      const { error } = await supabase
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

      set((state) => ({
        locations: state.locations.map((l) => (l.id === location.id ? location : l)),
      }));
      return true;
    } catch (err: any) {
      console.error(err);
      return false;
    }
  },

  updateSettings: async (settings: Partial<ProjectSettings>) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        set((state) => ({
          settings: state.settings ? { ...state.settings, ...settings } : null,
        }));
        return true;
      }

      const { data, error } = await supabase
        .from("project_settings")
        .update(settings)
        .eq("project_id", get().currentProject?.id)
        .select()
        .single();

      if (error) throw error;

      set({ settings: data as ProjectSettings });
      return true;
    } catch (err: any) {
      console.error(err);
      return false;
    }
  },

  generateProjectSchedule: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const state = get();
      
      // Calculate optimized schedule
      const generatedDays = optimizeSchedule({
        scenes: state.scenes,
        actors: state.actors,
        locations: state.locations,
        castings: state.castings,
        characters: state.characters,
        settings: state.settings || {
          id: "default",
          project_id: projectId,
          production_start: new Date().toISOString().split("T")[0],
          production_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          max_hours_per_day: 12,
          num_crews: 1,
        },
      });

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Fallback for demo
        set({ shootingDays: generatedDays, loading: false });
        return;
      }

      // Save to Supabase (clear old days first)
      await supabase.from("shooting_days").delete().eq("project_id", projectId);

      const daysToInsert = generatedDays.map((d) => ({
        project_id: projectId,
        day_number: d.day_number,
        date: d.date,
        location_id: d.location_id || null,
        scene_ids: d.scene_ids,
        actor_ids: d.actor_ids,
        estimated_hours: d.estimated_hours,
        cost_estimate: d.cost_estimate,
        notes: d.notes,
      }));

      const { data: insertedDays, error } = await supabase
        .from("shooting_days")
        .insert(daysToInsert)
        .select();

      if (error) throw error;

      // Update Project Status to scheduled
      await supabase
        .from("projects")
        .update({ status: "scheduled" })
        .eq("id", projectId);

      set({ shootingDays: (insertedDays || []) as ShootingDay[], loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  reorderShootingDays: async (projectId: string, dayIds: string[]) => {
    // Client-side reorder with updated day numbers and dates
    const state = get();
    const orderedDays = dayIds.map((id, index) => {
      const originalDay = state.shootingDays.find((d) => d.id === id)!;
      return {
        ...originalDay,
        day_number: index + 1,
        // Optional: Re-calculate dates based on production starts
      };
    });

    set({ shootingDays: orderedDays });

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return;

    // Persist reordered day numbers to Supabase
    try {
      await Promise.all(
        orderedDays.map((d) =>
          supabase
            .from("shooting_days")
            .update({ day_number: d.day_number })
            .eq("id", d.id)
        )
      );
    } catch (err) {
      console.error("Failed to save drag-and-drop order to database:", err);
    }
  },
}));

// Helper to count character name occurrences in FDX scenes
function countOccurrences(scenes: any[], charName: string): number {
  return scenes.filter((s) => s.characters?.includes(charName)).length;
}
