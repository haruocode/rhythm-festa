export function formatSongTime(songTimeMs: number): string {
  return `${Math.floor(songTimeMs).toLocaleString("en-US")} ms`;
}
