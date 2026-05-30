# AGENTS.md

## Project Overview

This project is a browser-based rhythm attraction game for local community events.

The game is inspired by rhythm games such as Taiko no Tatsujin and arcade music games, but the goal is not to clone Beatmania. The goal is to create a simple, accessible, team-based rhythm attraction that children, parents, and local community members can enjoy together.

The first target experience is:

- Red team presses a large red button.
- Blue team presses a large blue button.
- Notes fall in sync with music.
- Players press their team button when the note reaches the judgment line.
- The game emphasizes fun, visibility, and accessibility over strict competitive scoring.

The intended event use case is a non-commercial local festival or school/community event.

## Core Concept

The game should feel like:

- Taiko no Tatsujin
- A quiz-show button game
- A school festival attraction
- A team-based rhythm challenge

The design should prioritize:

- Simple rules
- Big visuals
- Clear colors
- Forgiving timing
- Immediate feedback
- Fun for kindergarten and elementary school children
- Playability with physical large buttons

## MVP Requirements

### Players

The MVP supports two teams:

- Red team
- Blue team

Each team has one input.

### Input

During development, keyboard input is used:

- `A` key: Red team
- `L` key: Blue team

In the future, these keys may be mapped to large physical USB arcade buttons.

The game should be designed so that replacing keyboard input with USB button input requires little or no game logic change.

### Gameplay

The game plays a music track and displays notes.

Each note belongs to one team:

```ts
type Team = "red" | "blue";

type Note = {
  timeMs: number;
  team: Team;
};
```

When a red note reaches the judgment line, the red team should press its button.

When a blue note reaches the judgment line, the blue team should press its button.

### Judgment

Use forgiving timing windows suitable for children and event play.

Suggested default:

```ts
const JUDGMENT_WINDOWS = {
  perfect: 120,
  good: 220,
};
```

Judgment labels:

- PERFECT
- GOOD
- MISS

Avoid overly strict rhythm-game judgment at the MVP stage.

### Scoring

The MVP should include:

- Team score
- Combo count
- Final result screen

Suggested scoring:

```ts
PERFECT: +100;
GOOD: +50;
MISS: +0;
```

### Visual Style

Prioritize visibility on a large screen.

Use:

- Large red and blue elements
- Large text
- High contrast
- Clear judgment line
- Big feedback animations
- Simple layout

Avoid small UI elements that children cannot easily understand from a distance.

### Music

For development and testing, use only:

- Original music
- Royalty-free music
- AI-generated music whose terms allow this use
- Other properly licensed music

Do not bundle commercial songs such as J-POP or K-POP tracks unless the rights are cleared.

### Technology Stack

Use:

- React
- TypeScript
- Vite
- Canvas API
- Web Audio API

Do not introduce Rust or WebAssembly for the MVP.

Rust/WASM may be considered later for:

- Audio analysis
- Automatic chart generation
- Heavy waveform processing
- BMS parsing
- Advanced performance-sensitive logic

## Timing and Audio

Use Web Audio API as the main timing source.

Avoid using React state as the source of truth for frame-by-frame rhythm timing.

Recommended approach:

```ts
const songTimeMs = (audioContext.currentTime - songStartAudioTime) * 1000;
```

Use `requestAnimationFrame` for drawing.

Use Canvas for notes and judgment-line rendering.

React should mainly manage:

- Screens
- Menus
- Settings
- Result display
- High-level game state

## Architecture Guidelines

Separate the game into small modules.

Suggested structure:

```txt
src/
  components/
  game/
    chart.ts
    engine.ts
    input.ts
    judgment.ts
    scoring.ts
    timing.ts
  screens/
    TitleScreen.tsx
    GameScreen.tsx
    ResultScreen.tsx
  assets/
    music/
    charts/
```

### Internal Model

Use a simple internal chart model first.

Example:

```ts
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
```

Do not implement BMS support in the MVP.

If BMS support is added later, implement it as an importer:

```txt
BMS file
↓
parser
↓
internal Chart model
```

The game engine should not depend directly on BMS.

## Event Hardware Assumptions

The future physical setup may include:

- One large red button
- One large blue button
- USB encoder board
- PC
- External display or projector
- Speakers

The buttons should appear to the browser as normal keyboard input.

Avoid Bluetooth input devices for event play because of possible latency and reliability issues.

Prefer wired USB devices.

## Latency Policy

The MVP does not need Rust/WASM for latency.

Focus on:

- Web Audio API timing
- Wired input devices
- Game-mode display settings
- Forgiving judgment windows
- Optional input offset calibration later

Possible future setting:

```ts
type GameSettings = {
  inputOffsetMs: number;
};
```

## Accessibility and Event Design

This is not only a game; it is an attraction.

Prioritize:

- Easy understanding within 5 seconds
- Fun even when players miss notes
- Bright feedback
- Encouraging messages
- Cooperative modes
- Short play sessions

Recommended song length for events:

- 60 to 120 seconds

Avoid long songs for the first event version.

## Future Ideas

Potential future features:

- Cooperative mode: both teams aim for a shared combo target
- Team battle mode
- Big button LED control
- Sound effects
- Confetti animation
- Fireworks animation
- Local ranking
- Simple chart editor
- AI-assisted chart generation
- Touch screen support
- 4-team mode
- BMS import
- WebAssembly-based audio analysis

## Development Priorities

Build in this order:

1. Play music with Web Audio API
2. Display current song time
3. Draw notes on Canvas
4. Add keyboard input
5. Add judgment
6. Add score and combo
7. Add result screen
8. Add simple chart JSON loading
9. Add visual feedback
10. Add physical button support

## Non-Goals for MVP

Do not implement these in the MVP:

- BMS support
- Online multiplayer
- Account system
- Song store
- Commercial song support
- Rust/WASM
- Complex note types
- Long notes
- Ranking server
- Advanced audio effects
- Strict competitive rhythm-game timing

## Coding Style

Use TypeScript strictly.

Prefer simple, readable code over clever abstractions.

Keep game timing logic independent from React rendering.

Avoid putting core game state entirely in React state if it updates every frame.

Use clear domain names:

- `Chart`
- `Note`
- `Team`
- `Judgment`
- `Score`
- `GameEngine`

## Important Product Direction

Do not turn this into a complex Beatmania clone.

The product direction is:

> A simple, team-based rhythm attraction for children and local community events.

When making implementation decisions, prefer the option that makes the game easier to understand, easier to operate at an event, and more fun for children.
