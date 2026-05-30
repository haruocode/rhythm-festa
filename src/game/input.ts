import type { Team } from "./chart";

const keyToTeam: Record<string, Team | undefined> = {
  a: "red",
  l: "blue",
};

export function getTeamForKeyboardKey(key: string): Team | null {
  return keyToTeam[key.toLowerCase()] ?? null;
}
