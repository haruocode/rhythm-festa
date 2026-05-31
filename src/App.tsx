import { useEffect, useRef, useState } from "react";
import { ChartMaker } from "./components/ChartMaker";
import { NoteCanvas } from "./components/NoteCanvas";
import { createSongFromAudioUrl, type SongController } from "./game/audio";
import { fallbackDemoChart, type Chart, type Team } from "./game/chart";
import { loadChartFromUrl } from "./game/chartLoader";
import {
  deleteChartFromCloud,
  saveChartToCloud,
  uploadMusicToCloud,
  type UploadedMusic,
} from "./game/cloudApi";
import { getTeamForKeyboardKey } from "./game/input";
import {
  findPassedNotes,
  judgeTeamInput,
  type JudgmentResult,
} from "./game/judgment";

type PlayState = "idle" | "playing" | "finished";
type AppMode = "play" | "maker";
type TeamInputFeedback = Record<Team, number>;
type JudgmentFeedback = {
  id: number;
  result: JudgmentResult;
};

const INPUT_FLASH_MS = 160;
const JUDGMENT_FLASH_MS = 520;
const DEMO_CHART_ID = "demo";
const CLOUD_DEMO_CHART_URL = `/api/charts/${DEMO_CHART_ID}`;
const FALLBACK_DEMO_CHART_URL = "/charts/demo.json";

function getModeFromPath(pathname: string): AppMode {
  return pathname === "/maker" ? "maker" : "play";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function App() {
  const songRef = useRef<SongController | null>(null);
  const chartRef = useRef<Chart>(fallbackDemoChart);
  const animationFrameRef = useRef<number | null>(null);
  const inputTimerRef = useRef<Record<Team, number | null>>({ red: null, blue: null });
  const judgedNoteIdsRef = useRef<Set<string>>(new Set());
  const judgmentFeedbackTimerRef = useRef<number | null>(null);
  const playStateRef = useRef<PlayState>("idle");
  const chartLoadErrorRef = useRef<string | null>(null);
  const appModeRef = useRef<AppMode>(getModeFromPath(window.location.pathname));
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [songTimeMs, setSongTimeMs] = useState(0);
  const [inputFeedback, setInputFeedback] = useState<TeamInputFeedback>({ red: 0, blue: 0 });
  const [judgedNoteIds, setJudgedNoteIds] = useState<ReadonlySet<string>>(new Set());
  const [judgmentFeedback, setJudgmentFeedback] = useState<JudgmentFeedback | null>(null);
  const [chart, setChart] = useState<Chart>(fallbackDemoChart);
  const [chartId, setChartId] = useState(DEMO_CHART_ID);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<AppMode>(() => getModeFromPath(window.location.pathname));

  useEffect(() => {
    playStateRef.current = playState;
  }, [playState]);

  useEffect(() => {
    chartLoadErrorRef.current = chartLoadError;
  }, [chartLoadError]);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    let disposed = false;

    loadDefaultChart()
      .then((loadedChart) => {
        if (disposed) {
          return;
        }

        chartRef.current = loadedChart;
        setChart(loadedChart);
        setChartLoadError(null);
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        setChartLoadError(error instanceof Error ? error.message : "Failed to load chart.");
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setAppMode(getModeFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.code === "Space" && !isEditableTarget(event.target)) {
        if (appModeRef.current !== "play") {
          return;
        }

        event.preventDefault();

        if (playStateRef.current === "playing") {
          void handleStop();
        } else if (chartLoadErrorRef.current === null) {
          void handleStart();
        }

        return;
      }

      const team = getTeamForKeyboardKey(event.key);

      if (!team) {
        return;
      }

      flashTeamInput(team);

      const song = songRef.current;

      if (!song) {
        return;
      }

      const currentChart = chartRef.current;
      const result = judgeTeamInput(
        currentChart.notes,
        judgedNoteIdsRef.current,
        team,
        song.getSongTimeMs(),
      );

      if (result) {
        recordJudgment(result);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      for (const timerId of Object.values(inputTimerRef.current)) {
        if (timerId !== null) {
          window.clearTimeout(timerId);
        }
      }

      if (judgmentFeedbackTimerRef.current !== null) {
        window.clearTimeout(judgmentFeedbackTimerRef.current);
      }

      void songRef.current?.dispose();
    };
  }, []);

  const flashTeamInput = (team: Team) => {
    const activeUntil = performance.now() + INPUT_FLASH_MS;

    setInputFeedback((currentFeedback) => ({
      ...currentFeedback,
      [team]: activeUntil,
    }));

    const existingTimer = inputTimerRef.current[team];

    if (existingTimer !== null) {
      window.clearTimeout(existingTimer);
    }

    inputTimerRef.current[team] = window.setTimeout(() => {
      setInputFeedback((currentFeedback) => {
        if (currentFeedback[team] !== activeUntil) {
          return currentFeedback;
        }

        return {
          ...currentFeedback,
          [team]: 0,
        };
      });

      inputTimerRef.current[team] = null;
    }, INPUT_FLASH_MS);
  };

  const updateSongTime = () => {
    const song = songRef.current;

    if (!song) {
      return;
    }

    const nextSongTimeMs = song.getSongTimeMs();
    setSongTimeMs(nextSongTimeMs);

    const missedNotes = findPassedNotes(chartRef.current.notes, judgedNoteIdsRef.current, nextSongTimeMs);

    for (const missedNote of missedNotes) {
      recordJudgment(missedNote);
    }

    if (nextSongTimeMs >= song.durationMs) {
      setPlayState("finished");
      return;
    }

    animationFrameRef.current = requestAnimationFrame(updateSongTime);
  };

  const handleStart = async () => {
    if (playStateRef.current === "playing" || chartLoadErrorRef.current !== null) {
      return;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    await songRef.current?.dispose();

    const currentChart = chartRef.current;
    const song = await createSongFromAudioUrl(currentChart.audioUrl);
    songRef.current = song;
    judgedNoteIdsRef.current = new Set();
    setJudgedNoteIds(new Set());
    setJudgmentFeedback(null);
    song.start();
    setPlayState("playing");
    setSongTimeMs(0);
    animationFrameRef.current = requestAnimationFrame(updateSongTime);
  };

  const handleStop = async () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    await songRef.current?.dispose();
    songRef.current = null;
    judgedNoteIdsRef.current = new Set();
    setJudgedNoteIds(new Set());
    setJudgmentFeedback(null);
    setPlayState("idle");
    setSongTimeMs(0);
  };

  const applyChart = (nextChart: Chart) => {
    void handleStop();
    chartRef.current = nextChart;
    setChart(nextChart);
    setChartLoadError(null);
  };

  const loadCloudChart = async (nextChartId: string) => {
    const loadedChart = await loadChartFromUrl(`/api/charts/${encodeURIComponent(nextChartId)}`);
    setChartId(nextChartId);
    applyChart(loadedChart);
  };

  const saveChart = async (nextChartId: string, nextChart: Chart, adminToken: string) => {
    await saveChartToCloud(nextChartId, nextChart, adminToken);
    setChartId(nextChartId);
    applyChart(nextChart);
  };

  const deleteChart = async (nextChartId: string, adminToken: string) => {
    await deleteChartFromCloud(nextChartId, adminToken);
  };

  const uploadMusic = async (file: File, adminToken: string): Promise<UploadedMusic> => {
    return await uploadMusicToCloud(file, adminToken);
  };

  const navigateToMode = (mode: AppMode) => {
    const nextPath = mode === "maker" ? "/maker" : "/";

    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }

    setAppMode(mode);
  };

  const recordJudgment = (result: JudgmentResult) => {
    if (judgedNoteIdsRef.current.has(result.noteId)) {
      return;
    }

    const nextJudgedNoteIds = new Set(judgedNoteIdsRef.current);
    nextJudgedNoteIds.add(result.noteId);
    judgedNoteIdsRef.current = nextJudgedNoteIds;
    setJudgedNoteIds(nextJudgedNoteIds);

    if (result.judgment !== "miss") {
      setJudgmentFeedback({
        id: performance.now(),
        result,
      });
    }

    if (judgmentFeedbackTimerRef.current !== null) {
      window.clearTimeout(judgmentFeedbackTimerRef.current);
    }

    judgmentFeedbackTimerRef.current = window.setTimeout(() => {
      setJudgmentFeedback(null);
      judgmentFeedbackTimerRef.current = null;
    }, JUDGMENT_FLASH_MS);
  };

  return (
    <main className="appShell">
      <nav className="modeTabs" aria-label="表示モード">
        <button
          className={appMode === "play" ? "active" : ""}
          type="button"
          onClick={() => navigateToMode("play")}
        >
          プレイ
        </button>
        <button
          className={appMode === "maker" ? "active" : ""}
          type="button"
          onClick={() => navigateToMode("maker")}
        >
          メイカー
        </button>
      </nav>

      {appMode === "maker" ? (
        <ChartMaker
          chart={chart}
          chartId={chartId}
          onApplyChart={applyChart}
          onDeleteChart={deleteChart}
          onLoadChart={loadCloudChart}
          onSaveChart={saveChart}
          onUploadMusic={uploadMusic}
        />
      ) : (
        <section className="stage" aria-labelledby="app-title">
        <div className="topBar">
          <div className="titleBlock">
            <p className="eyebrow">Rhythm Festa MVP</p>
            <h1 id="app-title">リズムフェスタ</h1>
          </div>
        </div>

        <div className="canvasWrap">
          <NoteCanvas chart={chart} judgedNoteIds={judgedNoteIds} songTimeMs={songTimeMs} />
          {judgmentFeedback && (
            <div
              key={judgmentFeedback.id}
              className={`judgmentFlash ${judgmentFeedback.result.team} ${judgmentFeedback.result.judgment}`}
              aria-live="polite"
            >
              {judgmentFeedback.result.judgment.toUpperCase()}
            </div>
          )}
        </div>

        <div className="buttonRow">
          <button
            className="primaryButton"
            type="button"
            onClick={handleStart}
            disabled={playState === "playing" || chartLoadError !== null}
          >
            スタート
          </button>
          <button
            className="secondaryButton"
            type="button"
            onClick={handleStop}
            disabled={playState === "idle"}
          >
            ストップ
          </button>
        </div>

        <div className="teamPreview" aria-label="チーム入力">
          <div className={inputFeedback.red > 0 ? "team red active" : "team red"}>
            <span>RED</span>
            <strong>A</strong>
          </div>
          <div className={inputFeedback.blue > 0 ? "team blue active" : "team blue"}>
            <span>BLUE</span>
            <strong>L</strong>
          </div>
        </div>

        <p className="statusText">
          {chartLoadError && `チャート読み込みエラー: ${chartLoadError}`}
          {!chartLoadError && playState === "idle" && `${chart.title} を読み込みました。スタートできます。`}
          {playState === "playing" && "タイミングよく押すと GOOD。押さないバーは下まで流れます。"}
          {playState === "finished" && "デモ曲が終わりました。もう一度スタートできます。"}
        </p>
        </section>
      )}
    </main>
  );
}

export default App;

async function loadDefaultChart(): Promise<Chart> {
  try {
    return await loadChartFromUrl(CLOUD_DEMO_CHART_URL);
  } catch {
    return await loadChartFromUrl(FALLBACK_DEMO_CHART_URL);
  }
}
