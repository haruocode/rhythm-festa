import type { Chart, ChartSection, Note, Team } from "./chart";

type RawChart = {
  title?: unknown;
  artist?: unknown;
  audioUrl?: unknown;
  sections?: unknown;
  notes?: unknown;
};

type RawNote = {
  id?: unknown;
  timeMs?: unknown;
  team?: unknown;
};

type RawSection = {
  id?: unknown;
  name?: unknown;
  startMeasure?: unknown;
  endMeasure?: unknown;
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
    sections: Array.isArray(rawChart.sections) ? rawChart.sections.map(parseSection) : undefined,
    notes: rawChart.notes.map(parseNote),
  };
}

function parseSection(rawSection: unknown, index: number): ChartSection {
  const section = rawSection as RawSection;

  if (typeof section.name !== "string" || section.name.length === 0) {
    throw new Error(`Section ${index + 1} name must be a non-empty string.`);
  }

  if (!isPositiveInteger(section.startMeasure)) {
    throw new Error(`Section ${index + 1} startMeasure must be a positive integer.`);
  }

  if (!isPositiveInteger(section.endMeasure)) {
    throw new Error(`Section ${index + 1} endMeasure must be a positive integer.`);
  }

  return {
    id: typeof section.id === "string" && section.id.length > 0 ? section.id : `section-${index + 1}`,
    name: section.name,
    startMeasure: section.startMeasure,
    endMeasure: Math.max(section.startMeasure, section.endMeasure),
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
