import { useEffect, useRef, useState } from "react";
import { NoteCanvas } from "./components/NoteCanvas";
import { createDemoSong, type DemoSongController } from "./game/audio";
import { demoChart, type Team } from "./game/chart";
import { getTeamForKeyboardKey } from "./game/input";
import { formatSongTime } from "./game/timing";

type PlayState = "idle" | "playing" | "finished";
type TeamInputFeedback = Record<Team, number>;

const INPUT_FLASH_MS = 160;

function App() {
  const songRef = useRef<DemoSongController | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const inputTimerRef = useRef<Record<Team, number | null>>({ red: null, blue: null });
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [songTimeMs, setSongTimeMs] = useState(0);
  const [inputFeedback, setInputFeedback] = useState<TeamInputFeedback>({ red: 0, blue: 0 });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      const team = getTeamForKeyboardKey(event.key);

      if (!team) {
        return;
      }

      flashTeamInput(team);
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

    if (nextSongTimeMs >= song.durationMs) {
      setPlayState("finished");
      return;
    }

    animationFrameRef.current = requestAnimationFrame(updateSongTime);
  };

  const handleStart = async () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    await songRef.current?.dispose();

    const song = await createDemoSong();
    songRef.current = song;
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
    setPlayState("idle");
    setSongTimeMs(0);
  };

  return (
    <main className="appShell">
      <section className="stage" aria-labelledby="app-title">
        <div className="topBar">
          <div className="titleBlock">
            <p className="eyebrow">Rhythm Festa MVP</p>
            <h1 id="app-title">リズムフェスタ</h1>
          </div>

          <div className="timePanel" aria-live="polite">
            <span className="timeLabel">SONG TIME</span>
            <strong>{formatSongTime(songTimeMs)}</strong>
          </div>
        </div>

        <div className="canvasWrap">
          <NoteCanvas chart={demoChart} songTimeMs={songTimeMs} />
          <div className="inputFlashLayer" aria-live="polite">
            {inputFeedback.red > 0 && <div className="inputFlash red">RED!</div>}
            {inputFeedback.blue > 0 && <div className="inputFlash blue">BLUE!</div>}
          </div>
        </div>

        <div className="buttonRow">
          <button
            className="primaryButton"
            type="button"
            onClick={handleStart}
            disabled={playState === "playing"}
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
          {playState === "idle" && "スタートを押すと、Web Audio API のデモ曲が流れます。"}
          {playState === "playing" && "A は赤、L は青。押すとチーム表示が光ります。"}
          {playState === "finished" && "デモ曲が終わりました。もう一度スタートできます。"}
        </p>
      </section>
    </main>
  );
}

export default App;
