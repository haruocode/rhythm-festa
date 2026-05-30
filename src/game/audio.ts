const DEMO_BPM = 116;
const BEAT_SECONDS = 60 / DEMO_BPM;
const BAR_SECONDS = BEAT_SECONDS * 4;
const LOOP_BARS = 4;
const DEMO_DURATION_SECONDS = BAR_SECONDS * LOOP_BARS;

type ScheduledNode = OscillatorNode | AudioBufferSourceNode;

export type DemoSongController = {
  durationMs: number;
  start: () => void;
  getSongTimeMs: () => number;
  dispose: () => Promise<void>;
};

export async function createDemoSong(): Promise<DemoSongController> {
  const audioContext = new AudioContext();
  const masterGain = audioContext.createGain();
  const scheduledNodes: ScheduledNode[] = [];
  let songStartAudioTime: number | null = null;

  masterGain.gain.value = 0.75;
  masterGain.connect(audioContext.destination);

  const scheduleTone = (time: number, frequency: number, duration: number, gain: number) => {
    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, time);
    noteGain.gain.setValueAtTime(0, time);
    noteGain.gain.linearRampToValueAtTime(gain, time + 0.015);
    noteGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    oscillator.connect(noteGain);
    noteGain.connect(masterGain);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
    scheduledNodes.push(oscillator);
  };

  const scheduleKick = (time: number) => {
    const oscillator = audioContext.createOscillator();
    const kickGain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(120, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.16);
    kickGain.gain.setValueAtTime(0.9, time);
    kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    oscillator.connect(kickGain);
    kickGain.connect(masterGain);
    oscillator.start(time);
    oscillator.stop(time + 0.2);
    scheduledNodes.push(oscillator);
  };

  const scheduleSong = (startTime: number) => {
    const melody = [392, 440, 523.25, 440, 392, 329.63, 392, 523.25];

    for (let bar = 0; bar < LOOP_BARS; bar += 1) {
      for (let beat = 0; beat < 4; beat += 1) {
        scheduleKick(startTime + bar * BAR_SECONDS + beat * BEAT_SECONDS);
      }

      melody.forEach((frequency, index) => {
        const noteTime = startTime + bar * BAR_SECONDS + index * (BEAT_SECONDS / 2);
        scheduleTone(noteTime, frequency, BEAT_SECONDS * 0.42, 0.24);
      });
    }
  };

  return {
    durationMs: DEMO_DURATION_SECONDS * 1000,
    start: () => {
      const startTime = audioContext.currentTime + 0.08;
      songStartAudioTime = startTime;
      scheduleSong(startTime);
    },
    getSongTimeMs: () => {
      if (songStartAudioTime === null) {
        return 0;
      }

      const elapsedSeconds = audioContext.currentTime - songStartAudioTime;
      return Math.max(0, elapsedSeconds * 1000);
    },
    dispose: async () => {
      scheduledNodes.forEach((node) => {
        try {
          node.stop();
        } catch {
          // The node may already have finished naturally.
        }
      });

      await audioContext.close();
    },
  };
}
