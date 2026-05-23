// Types for the Director's Assistant application

export type UserRole = 'owner' | 'admin' | 'member';
export type ProjectStatus = 'draft' | 'planning' | 'scheduled' | 'in_production' | 'wrapped';
export type IntExt = 'INT' | 'EXT' | 'INT/EXT';
export type TimeOfDay = 'DIA' | 'NOITE' | 'AMANHECER' | 'ENTARDECER';
export type CharacterSize = 'protagonist' | 'supporting' | 'small';
export type WeatherRequirement = 'any' | 'sun' | 'cloudy' | 'rain' | 'snow' | 'wind' | 'fog';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  script_file_url?: string;
  production_start?: string;
  production_end?: string;
  max_hours_per_day: number;
  num_crews: number;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  number: string;
  int_ext: IntExt;
  location_name: string;
  time_of_day: TimeOfDay;
  synopsis: string;
  pages: number; // in eighths
  estimated_hours: number;
  weather_requirement: WeatherRequirement;
  dependencies: string[]; // scene ids
  notes?: string;
  order_index: number;
}

export interface Character {
  id: string;
  project_id: string;
  name: string; // as in script e.g. "JOÃO"
  scene_ids: string[];
  size: CharacterSize;
  total_scenes: number;
}

export interface Actor {
  id: string;
  project_id: string;
  full_name: string;
  cost_per_day: number;
  blocked_dates: string[]; // ISO date strings
  max_consecutive_days: number;
  availability_start?: string;
  availability_end?: string;
  notes?: string;
}

export interface Casting {
  id: string;
  character_id: string;
  actor_id: string;
  confirmed: boolean;
}

export interface Location {
  id: string;
  project_id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  cost_per_day: number;
  availability: { start: string; end: string }[];
  setup_time_hours: number;
  is_covered: boolean; // true = studio/covered, false = open air
  weather_risk: 'low' | 'medium' | 'high'; // climate risk level
  notes?: string;
}

export interface ShootingDay {
  id: string;
  project_id: string;
  day_number: number;
  date: string;
  location_id: string;
  scene_ids: string[];
  actor_ids: string[];
  estimated_hours: number;
  cost_estimate: number;
  notes?: string;
}

export interface ProjectSettings {
  id: string;
  project_id: string;
  production_start: string;
  production_end: string;
  max_hours_per_day: number;
  num_crews: number;
}
