import type { Chart, Note, Team } from "./chart";

type RawChart = {
  title?: unknown;
  artist?: unknown;
  audioUrl?: unknown;
  notes?: unknown;
};

type RawNote = {
  id?: unknown;
  timeMs?: unknown;
  team?: unknown;
};

export async function loadChartFromUrl(chartUrl: string): Promise<Chart> {
  const response = await fetch(chartUrl);

  if (!response.ok) {
    throw new Error(`Failed to load chart: ${chartUrl}`);
  }

  const rawChart = (await response.json()) as RawChart;
  return parseChart(rawChart);
}

function parseChart(rawChart: RawChart): Chart {
  if (typeof rawChart.title !== "string" || rawChart.title.length === 0) {
    throw new Error("Chart title must be a non-empty string.");
  }

  if (typeof rawChart.audioUrl !== "string" || rawChart.audioUrl.length === 0) {
    throw new Error("Chart audioUrl must be a non-empty string.");
  }

  if (!Array.isArray(rawChart.notes)) {
    throw new Error("Chart notes must be an array.");
  }

  return {
    title: rawChart.title,
    artist: typeof rawChart.artist === "string" ? rawChart.artist : undefined,
    audioUrl: rawChart.audioUrl,
    notes: rawChart.notes.map(parseNote),
  };
}

function parseNote(rawNote: unknown, index: number): Note {
  const note = rawNote as RawNote;

  if (typeof note.timeMs !== "number" || !Number.isFinite(note.timeMs) || note.timeMs < 0) {
    throw new Error(`Note ${index + 1} timeMs must be a non-negative number.`);
  }

  if (!isTeam(note.team)) {
    throw new Error(`Note ${index + 1} team must be "red" or "blue".`);
  }

  return {
    id: typeof note.id === "string" && note.id.length > 0 ? note.id : `note-${index + 1}`,
    timeMs: note.timeMs,
    team: note.team,
    judged: false,
  };
}

function isTeam(value: unknown): value is Team {
  return value === "red" || value === "blue";
}
