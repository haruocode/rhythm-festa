export type Team = "red" | "blue";

export type Note = {
  id: string;
  timeMs: number;
  team: Team;
  judged: boolean;
};

export type Chart = {
  title: string;
  artist?: string;
  audioUrl: string;
  notes: Note[];
};

const notePattern: Team[] = [
  "red",
  "blue",
  "red",
  "blue",
  "red",
  "red",
  "blue",
  "blue",
  "red",
  "blue",
  "blue",
  "red",
  "red",
  "blue",
  "red",
  "blue",
];

export const fallbackDemoChart: Chart = {
  title: "Festival Demo",
  artist: "Rhythm Festa",
  audioUrl: "/music/demo.mp3",
  notes: notePattern.map((team, index) => ({
    id: `demo-note-${index + 1}`,
    timeMs: 1000 + index * 520,
    team,
    judged: false,
  })),
};
