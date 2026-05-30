import { useEffect, useRef } from "react";
import type { Chart, Team } from "../game/chart";

const LOOK_AHEAD_MS = 2400;
const LOOK_BEHIND_MS = 360;
const JUDGMENT_LINE_RATIO = 0.78;
const NOTE_RADIUS_RATIO = 0.085;

type NoteCanvasProps = {
  chart: Chart;
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

export function NoteCanvas({ chart, songTimeMs }: NoteCanvasProps) {
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
    drawChart(context, rect.width, rect.height, chart, songTimeMs);
  }, [chart, songTimeMs]);

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
  songTimeMs: number,
) {
  context.clearRect(0, 0, width, height);

  const topPadding = 20;
  const bottomPadding = 28;
  const laneGap = 14;
  const laneWidth = (width - laneGap) / 2;
  const judgmentY = height * JUDGMENT_LINE_RATIO;
  const travelDistance = judgmentY - topPadding;
  const noteRadius = Math.max(20, Math.min(42, laneWidth * NOTE_RADIUS_RATIO));

  drawBackground(context, width, height);
  drawLane(context, "red", 0, topPadding, laneWidth, height - bottomPadding);
  drawLane(context, "blue", laneWidth + laneGap, topPadding, laneWidth, height - bottomPadding);
  drawJudgmentLine(context, width, judgmentY);

  for (const note of chart.notes) {
    const deltaMs = note.timeMs - songTimeMs;

    if (deltaMs > LOOK_AHEAD_MS || deltaMs < -LOOK_BEHIND_MS) {
      continue;
    }

    const laneX = note.team === "red" ? 0 : laneWidth + laneGap;
    const centerX = laneX + laneWidth / 2;
    const progress = 1 - deltaMs / LOOK_AHEAD_MS;
    const centerY = topPadding + progress * travelDistance;
    drawNote(context, note.team, centerX, centerY, noteRadius);
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
  context.strokeStyle = "#fbbf24";
  context.lineWidth = 8;
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
  radius: number,
) {
  const style = laneStyles[team];

  context.save();
  context.shadowBlur = 22;
  context.shadowColor = style.fill;
  context.fillStyle = style.fill;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.strokeStyle = "#fff7ed";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(centerX, centerY, radius - 2.5, 0, Math.PI * 2);
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
