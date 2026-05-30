import { useEffect, useRef, useState } from "react";
import { NoteCanvas } from "./components/NoteCanvas";
import { createDemoSong, type DemoSongController } from "./game/audio";
import { demoChart } from "./game/chart";
import { formatSongTime } from "./game/timing";

type PlayState = "idle" | "playing" | "finished";

function App() {
  const songRef = useRef<DemoSongController | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [songTimeMs, setSongTimeMs] = useState(0);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      void songRef.current?.dispose();
    };
  }, []);

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

        <NoteCanvas chart={demoChart} songTimeMs={songTimeMs} />

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
          <div className="team red">
            <span>RED</span>
            <strong>A</strong>
          </div>
          <div className="team blue">
            <span>BLUE</span>
            <strong>L</strong>
          </div>
        </div>

        <p className="statusText">
          {playState === "idle" && "スタートを押すと、Web Audio API のデモ曲が流れます。"}
          {playState === "playing" && "赤と青のノーツが判定ラインに向かって落ちています。"}
          {playState === "finished" && "デモ曲が終わりました。もう一度スタートできます。"}
        </p>
      </section>
    </main>
  );
}

export default App;
