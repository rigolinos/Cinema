// Radar da semana: trends escolhidas pela equipe (tabela trend_radar). O app nunca inventa trend.

export interface RadarItem {
  id: string;
  week_start: string;
  title: string;
  what: string;
  how_to_adapt: string;
  format_slug: string | null;
}

// Uma trend vale por duas semanas a partir da semana em que entrou.
export const RADAR_DAYS = 14;

export function radarSince(today = new Date()): string {
  const d = new Date(today);
  d.setDate(d.getDate() - RADAR_DAYS);
  return d.toISOString().slice(0, 10);
}
