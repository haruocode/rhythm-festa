import type { Note, Team } from "./chart";

export type Judgment = "good" | "miss";

export const JUDGMENT_WINDOWS = {
  good: 220,
  missedNoteCleanup: 720,
} as const;

export type JudgmentResult = {
  noteId: string;
  team: Team;
  judgment: Judgment;
  timingDeltaMs: number;
};

export function judgeTeamInput(
  notes: Note[],
  judgedNoteIds: ReadonlySet<string>,
  team: Team,
  songTimeMs: number,
): JudgmentResult | null {
  let bestNote: Note | null = null;
  let bestAbsDeltaMs = Number.POSITIVE_INFINITY;
  let bestDeltaMs = 0;

  for (const note of notes) {
    if (note.team !== team || judgedNoteIds.has(note.id)) {
      continue;
    }

    const deltaMs = songTimeMs - note.timeMs;
    const absDeltaMs = Math.abs(deltaMs);

    if (absDeltaMs <= JUDGMENT_WINDOWS.good && absDeltaMs < bestAbsDeltaMs) {
      bestNote = note;
      bestAbsDeltaMs = absDeltaMs;
      bestDeltaMs = deltaMs;
    }
  }

  if (!bestNote) {
    return null;
  }

  return {
    noteId: bestNote.id,
    team,
    judgment: "good",
    timingDeltaMs: bestDeltaMs,
  };
}

export function findMissedNotes(
  notes: Note[],
  judgedNoteIds: ReadonlySet<string>,
  songTimeMs: number,
): JudgmentResult[] {
  return notes
    .filter((note) => !judgedNoteIds.has(note.id) && songTimeMs - note.timeMs > JUDGMENT_WINDOWS.good)
    .map((note) => ({
      noteId: note.id,
      team: note.team,
      judgment: "miss",
      timingDeltaMs: songTimeMs - note.timeMs,
    }));
}

export function findPassedNotes(
  notes: Note[],
  judgedNoteIds: ReadonlySet<string>,
  songTimeMs: number,
): JudgmentResult[] {
  return notes
    .filter((note) => !judgedNoteIds.has(note.id) && songTimeMs - note.timeMs > JUDGMENT_WINDOWS.missedNoteCleanup)
    .map((note) => ({
      noteId: note.id,
      team: note.team,
      judgment: "miss",
      timingDeltaMs: songTimeMs - note.timeMs,
    }));
}
