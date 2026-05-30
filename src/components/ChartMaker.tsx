import { useEffect, useMemo, useState } from "react";
import type { Chart, ChartSection, Note, Team } from "../game/chart";

type ChartMakerProps = {
  chart: Chart;
  onApplyChart: (chart: Chart) => void;
};

type MakerForm = {
  title: string;
  artist: string;
  audioUrl: string;
  firstTimeMs: number;
  endTimeMs: number;
  bpm: number;
  quarterNoteMs: number;
};

type SlotMap = Record<string, Team>;
type MakerSection = ChartSection;

const SLOTS_PER_MEASURE = 16;
const BEATS_PER_MEASURE = 4;

export function ChartMaker({ chart, onApplyChart }: ChartMakerProps) {
  const [form, setForm] = useState<MakerForm>(() => createInitialForm(chart));
  const [slots, setSlots] = useState<SlotMap>(() => createInitialSlots(chart, createInitialForm(chart)));
  const [sections, setSections] = useState<MakerSection[]>(() => createInitialSections(chart));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    const nextForm = createInitialForm(chart);
    setForm(nextForm);
    setSlots(createInitialSlots(chart, nextForm));
    setSections(createInitialSections(chart));
  }, [chart]);

  const sixteenthMs = getSixteenthMs(form.quarterNoteMs);
  const measureCount = getMeasureCount(form.firstTimeMs, form.endTimeMs, sixteenthMs);
  const generatedChart = useMemo(() => createChartFromForm(form, slots, sections), [form, slots, sections]);
  const generatedJson = useMemo(() => JSON.stringify(generatedChart, null, 2), [generatedChart]);

  const updateNumber = (key: keyof Pick<MakerForm, "firstTimeMs" | "endTimeMs">, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: Number(value),
    }));
  };

  const updateBpm = (value: string) => {
    const bpm = Number(value);

    setForm((current) => ({
      ...current,
      bpm,
      quarterNoteMs: Math.round((60000 / Math.max(1, bpm)) * 1000) / 1000,
    }));
  };

  const updateQuarterNoteMs = (value: string) => {
    const quarterNoteMs = Number(value);

    setForm((current) => ({
      ...current,
      quarterNoteMs,
      bpm: Math.round((60000 / Math.max(1, quarterNoteMs)) * 100) / 100,
    }));
  };

  const toggleSlot = (slotIndex: number) => {
    setSlots((current) => {
      const key = String(slotIndex);
      const next = { ...current };
      const currentTeam = next[key];

      if (currentTeam === undefined) {
        next[key] = "red";
      } else if (currentTeam === "red") {
        next[key] = "blue";
      } else {
        delete next[key];
      }

      return next;
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedJson);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([`${generatedJson}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "demo.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearSlots = () => {
    setSlots({});
  };

  const addSection = () => {
    const nextIndex = sections.length + 1;

    setSections((current) => [
      ...current,
      {
        id: `section-${nextIndex}`,
        name: `Section ${nextIndex}`,
        startMeasure: 1,
        endMeasure: Math.min(8, measureCount),
      },
    ]);
  };

  const updateSection = (
    sectionId: string,
    key: keyof Pick<MakerSection, "name" | "startMeasure" | "endMeasure">,
    value: string,
  ) => {
    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        return {
          ...section,
          [key]: key === "name" ? value : Number(value),
        };
      }),
    );
  };

  const deleteSection = (sectionId: string) => {
    setSections((current) => current.filter((section) => section.id !== sectionId));
  };

  return (
    <section className="makerStage" aria-labelledby="maker-title">
      <header className="makerHeader">
        <div>
          <p className="eyebrow">Chart Maker</p>
          <h1 id="maker-title">譜面メイカー</h1>
        </div>
        <div className="makerSummary">
          <span>{generatedChart.notes.length} notes</span>
          <span>{form.bpm} BPM</span>
          <span>{form.quarterNoteMs} ms / beat</span>
          <span>{Math.round(sixteenthMs * 1000) / 1000} ms / 16th</span>
        </div>
      </header>

      <div className="makerGrid">
        <aside className="makerControls">
          <label>
            曲名
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          <label>
            アーティスト
            <input
              value={form.artist}
              onChange={(event) => setForm((current) => ({ ...current, artist: event.target.value }))}
            />
          </label>

          <label>
            音源URL
            <input
              value={form.audioUrl}
              onChange={(event) => setForm((current) => ({ ...current, audioUrl: event.target.value }))}
            />
          </label>

          <div className="makerNumberGrid">
            <label>
              最初のバー timeMs
              <input
                type="number"
                min="0"
                step="1"
                value={form.firstTimeMs}
                onChange={(event) => updateNumber("firstTimeMs", event.target.value)}
              />
            </label>

            <label>
              曲の終了 timeMs
              <input
                type="number"
                min="1"
                step="1"
                value={form.endTimeMs}
                onChange={(event) => updateNumber("endTimeMs", event.target.value)}
              />
            </label>

            <label>
              BPM
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.bpm}
                onChange={(event) => updateBpm(event.target.value)}
              />
            </label>

            <label>
              4分音符ms
              <input
                type="number"
                min="1"
                step="0.001"
                value={form.quarterNoteMs}
                onChange={(event) => updateQuarterNoteMs(event.target.value)}
              />
            </label>
          </div>

          <button className="dangerButton" type="button" onClick={clearSlots}>
            配置をクリア
          </button>

          <div className="sectionEditor">
            <div className="sectionEditorHeader">
              <strong>小節群</strong>
              <button type="button" onClick={addSection}>
                追加
              </button>
            </div>
            {sections.map((section) => (
              <div className="sectionForm" key={section.id}>
                <label>
                  名前
                  <input
                    value={section.name}
                    onChange={(event) => updateSection(section.id, "name", event.target.value)}
                  />
                </label>
                <label>
                  開始
                  <input
                    type="number"
                    min="1"
                    max={measureCount}
                    value={section.startMeasure}
                    onChange={(event) => updateSection(section.id, "startMeasure", event.target.value)}
                  />
                </label>
                <label>
                  終了
                  <input
                    type="number"
                    min="1"
                    max={measureCount}
                    value={section.endMeasure}
                    onChange={(event) => updateSection(section.id, "endMeasure", event.target.value)}
                  />
                </label>
                <button type="button" onClick={() => deleteSection(section.id)}>
                  削除
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="makerSequencer" aria-label="1小節16分割の譜面入力">
          {Array.from({ length: measureCount }, (_, measureIndex) => (
            <div className="measureRow" key={measureIndex}>
              <div className="measureLabel">
                <span>{measureIndex + 1}</span>
                {getSectionNameForMeasure(sections, measureIndex + 1) && (
                  <strong>{getSectionNameForMeasure(sections, measureIndex + 1)}</strong>
                )}
              </div>
              <div className="slotGrid">
                {Array.from({ length: SLOTS_PER_MEASURE }, (_, slotInMeasure) => {
                  const slotIndex = measureIndex * SLOTS_PER_MEASURE + slotInMeasure;
                  const team = slots[String(slotIndex)];

                  return (
                    <button
                      className={team ? `slotButton ${team}` : "slotButton"}
                      key={slotIndex}
                      type="button"
                      onClick={() => toggleSlot(slotIndex)}
                      aria-label={`${measureIndex + 1}小節 ${slotInMeasure + 1}番目`}
                    >
                      {team ? team[0].toUpperCase() : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="makerOutput">
          <textarea value={generatedJson} readOnly spellCheck={false} />
          <div className="makerActions">
            <button type="button" onClick={() => onApplyChart(generatedChart)}>
              プレビューに反映
            </button>
            <button type="button" onClick={handleCopy}>
              JSONコピー
            </button>
            <button type="button" onClick={handleDownload}>
              ダウンロード
            </button>
          </div>
          <p className="makerStatus">
            {copyState === "idle" && "クリック: 空 -> red -> blue -> 空。JSONには配置したバーだけ記録されます。"}
            {copyState === "copied" && "JSONをコピーしました。"}
            {copyState === "failed" && "コピーできませんでした。"}
          </p>
        </div>
      </div>
    </section>
  );
}

function createInitialSections(chart: Chart): MakerSection[] {
  return chart.sections ?? [];
}

function createInitialForm(chart: Chart): MakerForm {
  const firstNote = chart.notes[0];
  const secondNote = chart.notes[1];
  const quarterNoteMs = firstNote && secondNote ? secondNote.timeMs - firstNote.timeMs : 469;
  const lastNote = chart.notes.at(-1);
  const inferredBpm = Math.round((60000 / Math.max(1, quarterNoteMs)) * 100) / 100;

  return {
    title: chart.title,
    artist: chart.artist ?? "",
    audioUrl: chart.audioUrl,
    firstTimeMs: firstNote?.timeMs ?? 2050,
    endTimeMs: lastNote?.timeMs ?? 255310,
    bpm: inferredBpm,
    quarterNoteMs,
  };
}

function createInitialSlots(chart: Chart, form: MakerForm): SlotMap {
  const slots: SlotMap = {};
  const sixteenthMs = getSixteenthMs(form.quarterNoteMs);

  for (const note of chart.notes) {
    const slotIndex = Math.round((note.timeMs - form.firstTimeMs) / sixteenthMs);

    if (slotIndex >= 0) {
      slots[String(slotIndex)] = note.team;
    }
  }

  return slots;
}

function createChartFromForm(form: MakerForm, slots: SlotMap, sections: MakerSection[]): Chart {
  const sixteenthMs = getSixteenthMs(form.quarterNoteMs);
  const firstTimeMs = Math.max(0, Math.floor(form.firstTimeMs));
  const endTimeMs = Math.max(firstTimeMs, Math.floor(form.endTimeMs));

  const notes: Note[] = Object.entries(slots)
    .map(([slotIndexText, team]) => ({
      slotIndex: Number(slotIndexText),
      team,
    }))
    .filter(({ slotIndex }) => Number.isInteger(slotIndex) && slotIndex >= 0)
    .map(({ slotIndex, team }) => ({
      id: `${team}-${slotIndex + 1}`,
      timeMs: Math.round(firstTimeMs + slotIndex * sixteenthMs),
      team,
      judged: false,
    }))
    .filter((note) => note.timeMs <= endTimeMs)
    .sort((a, b) => a.timeMs - b.timeMs);

  return {
    title: form.title.trim() || "Untitled Chart",
    artist: form.artist.trim() || undefined,
    audioUrl: form.audioUrl.trim() || "/music/demo.mp3",
    sections: normalizeSections(sections),
    notes,
  };
}

function getSixteenthMs(quarterNoteMs: number): number {
  return Math.max(1, quarterNoteMs) / BEATS_PER_MEASURE;
}

function getMeasureCount(firstTimeMs: number, endTimeMs: number, sixteenthMs: number): number {
  const durationMs = Math.max(0, endTimeMs - firstTimeMs);
  const totalSlots = Math.floor(durationMs / sixteenthMs) + 1;
  return Math.max(1, Math.ceil(totalSlots / SLOTS_PER_MEASURE));
}

function normalizeSections(sections: MakerSection[]): MakerSection[] | undefined {
  const normalizedSections = sections
    .map((section, index) => {
      const startMeasure = Math.max(1, Math.floor(section.startMeasure));
      const endMeasure = Math.max(startMeasure, Math.floor(section.endMeasure));

      return {
        id: section.id || `section-${index + 1}`,
        name: section.name.trim() || `Section ${index + 1}`,
        startMeasure,
        endMeasure,
      };
    })
    .sort((a, b) => a.startMeasure - b.startMeasure);

  return normalizedSections.length > 0 ? normalizedSections : undefined;
}

function getSectionNameForMeasure(sections: MakerSection[], measure: number): string | null {
  const section = sections.find(
    (candidate) => measure >= candidate.startMeasure && measure <= candidate.endMeasure,
  );

  return section?.name ?? null;
}
