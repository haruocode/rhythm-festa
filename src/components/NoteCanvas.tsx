import { useEffect, useRef } from "react";
import type { Chart, Team } from "../game/chart";

const LOOK_AHEAD_MS = 2400;
const LOOK_BEHIND_MS = 360;
const JUDGMENT_LINE_RATIO = 0.78;
const NOTE_WIDTH_RATIO = 0.78;
const NOTE_HEIGHT_RATIO = 0.14;

type NoteCanvasProps = {
  chart: Chart;
  judgedNoteIds: ReadonlySet<string>;
  songTimeMs: number;
};

type LaneStyle = {
  label: string;
  fill: string;
  glow: string;
};

const laneStyles: Record<Team, LaneStyle> = {
  red: {
    label: "RED",
    fill: "#ef4444",
    glow: "rgb(239 68 68 / 0.32)",
  },
  blue: {
    label: "BLUE",
    fill: "#3b82f6",
    glow: "rgb(59 130 246 / 0.32)",
  },
};

export function NoteCanvas({ chart, judgedNoteIds, songTimeMs }: NoteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart(context, rect.width, rect.height, chart, judgedNoteIds, songTimeMs);
  }, [chart, judgedNoteIds, songTimeMs]);

  return (
    <canvas
      ref={canvasRef}
      className="noteCanvas"
      aria-label="赤チームと青チームのノーツ表示"
    />
  );
}

function drawChart(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  chart: Chart,
  judgedNoteIds: ReadonlySet<string>,
  songTimeMs: number,
) {
  context.clearRect(0, 0, width, height);

  const topPadding = 20;
  const bottomPadding = 28;
  const laneGap = 14;
  const laneWidth = (width - laneGap) / 2;
  const judgmentY = height * JUDGMENT_LINE_RATIO;
  const travelDistance = judgmentY - topPadding;
  const noteWidth = Math.max(160, laneWidth * NOTE_WIDTH_RATIO);
  const noteHeight = Math.max(34, Math.min(58, laneWidth * NOTE_HEIGHT_RATIO));

  drawBackground(context, width, height);
  drawLane(context, "red", 0, topPadding, laneWidth, height - bottomPadding);
  drawLane(context, "blue", laneWidth + laneGap, topPadding, laneWidth, height - bottomPadding);
  drawJudgmentLine(context, width, judgmentY);

  for (const note of chart.notes) {
    if (judgedNoteIds.has(note.id)) {
      continue;
    }

    const deltaMs = note.timeMs - songTimeMs;

    if (deltaMs > LOOK_AHEAD_MS || deltaMs < -LOOK_BEHIND_MS) {
      continue;
    }

    const laneX = note.team === "red" ? 0 : laneWidth + laneGap;
    const centerX = laneX + laneWidth / 2;
    const progress = 1 - deltaMs / LOOK_AHEAD_MS;
    const centerY = topPadding + progress * travelDistance;
    drawNote(context, note.team, centerX, centerY, noteWidth, noteHeight);
  }
}

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(1, "#020617");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawLane(
  context: CanvasRenderingContext2D,
  team: Team,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const style = laneStyles[team];

  context.fillStyle = style.glow;
  roundRect(context, x, y, width, height, 8);
  context.fill();

  context.strokeStyle = "rgb(255 247 237 / 0.28)";
  context.lineWidth = 3;
  roundRect(context, x + 1.5, y + 1.5, width - 3, height - 3, 8);
  context.stroke();

  context.fillStyle = "rgb(255 255 255 / 0.88)";
  context.font = "900 24px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(style.label, x + width / 2, y + 16);
}

function drawJudgmentLine(context: CanvasRenderingContext2D, width: number, y: number) {
  context.fillStyle = "rgb(251 191 36 / 0.2)";
  context.fillRect(0, y - 26, width, 52);

  context.strokeStyle = "rgb(255 247 237 / 0.56)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, y - 26);
  context.lineTo(width, y - 26);
  context.moveTo(0, y + 26);
  context.lineTo(width, y + 26);
  context.stroke();

  context.strokeStyle = "#fbbf24";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(0, y);
  context.lineTo(width, y);
  context.stroke();

  context.fillStyle = "#fbbf24";
  context.font = "900 22px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText("PUSH!", width / 2, y - 12);
}

function drawNote(
  context: CanvasRenderingContext2D,
  team: Team,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
) {
  const style = laneStyles[team];
  const x = centerX - width / 2;
  const y = centerY - height / 2;

  context.save();
  context.shadowBlur = 22;
  context.shadowColor = style.fill;
  context.fillStyle = style.fill;
  roundRect(context, x, y, width, height, 8);
  context.fill();
  context.restore();

  context.strokeStyle = "#fff7ed";
  context.lineWidth = 4;
  roundRect(context, x + 2, y + 2, width - 4, height - 4, 6);
  context.stroke();

  context.strokeStyle = "rgb(255 247 237 / 0.82)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x + 14, centerY);
  context.lineTo(x + width - 14, centerY);
  context.stroke();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
