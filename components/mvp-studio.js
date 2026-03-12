"use client";

import { useMemo, useState } from "react";

import { analyzeAudioFile } from "@/lib/audio-analysis";
import { buildDemoAnalysis, tonePresets } from "@/lib/mvp-presets";

const initialForm = {
  theme: "성장과 야망",
  tone: "ambition",
  keywords: "무대, 목걸이, 밤, 증명",
  artistReference: "빈지노, 창모 같은 자신감 있는 무드"
};

export default function MvpStudio() {
  const [form, setForm] = useState(initialForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [result, setResult] = useState(null);
  const [statusText, setStatusText] = useState("비트를 넣으면 바로 데모 가능한 초안을 만들어드립니다.");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const combinedLyrics = useMemo(() => {
    if (!result) {
      return "";
    }

    return result.sections
      .map((section) => `[${section.name}]\n${section.lines.join("\n")}`)
      .join("\n\n");
  }, [result]);

  async function handleGenerate(mode) {
    setErrorMessage("");
    setIsSubmitting(true);
    setResult(null);

    try {
      let nextAnalysis = null;

      if (mode === "demo") {
        setStatusText("샘플 비트 설정으로 구조와 BPM을 불러오는 중입니다.");
        nextAnalysis = buildDemoAnalysis();
      } else {
        if (!selectedFile) {
          throw new Error("비트 파일을 업로드하거나 샘플 모드를 사용해주세요.");
        }

        setStatusText("업로드한 비트에서 BPM과 에너지, 구조를 분석하고 있습니다.");
        nextAnalysis = await analyzeAudioFile(selectedFile);
      }

      setAnalysis(nextAnalysis);
      setStatusText("분석 결과를 바탕으로 랩 가사 초안을 조합하고 있습니다.");

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          fileName: selectedFile?.name || nextAnalysis.fileName,
          analysis: nextAnalysis
        })
      });

      if (!response.ok) {
        throw new Error("가사 생성 API 응답에 실패했습니다.");
      }

      const payload = await response.json();
      setResult(payload);
      setStatusText("초안 생성이 완료됐습니다. 훅과 벌스 밸런스를 바로 확인해보세요.");
    } catch (error) {
      setErrorMessage(error.message || "생성 중 문제가 발생했습니다.");
      setStatusText("입력값을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyLyrics() {
    if (!combinedLyrics) {
      return;
    }

    await navigator.clipboard.writeText(combinedLyrics);
    setStatusText("가사를 클립보드에 복사했습니다.");
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">PMTM WEB MVP</p>
          <h1>비트를 넣으면 랩 가사 초안이 바로 나오는 데모 스튜디오</h1>
          <p className="hero-description">
            프메더머니의 1차 MVP를 웹 서비스 형태로 압축했습니다. 업로드한 비트의 BPM,
            에너지, 구간 흐름을 간단 분석한 뒤 그 결과에 맞는 랩 가사 초안을 생성합니다.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-card accent-card">
            <span>핵심 흐름</span>
            <strong>Upload → Analyze → Write</strong>
          </div>
          <div className="stat-card">
            <span>이번 MVP 범위</span>
            <strong>비트 분석 + 가사 초안 + 플로우 가이드</strong>
          </div>
          <div className="stat-card">
            <span>다음 단계</span>
            <strong>LLM 연동, TTS 가이드 보컬, 정밀 구조 인식</strong>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel input-panel">
          <div className="panel-head">
            <h2>입력 스튜디오</h2>
            <p>{statusText}</p>
          </div>

          <label className="upload-card">
            <span className="upload-title">비트 업로드</span>
            <span className="upload-subtitle">
              `mp3`, `wav`, `m4a` 같은 파일을 넣어보세요.
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
            <strong>{selectedFile ? selectedFile.name : "파일을 선택해주세요"}</strong>
          </label>

          <div className="field-grid">
            <label className="field">
              <span>가사 주제</span>
              <input
                value={form.theme}
                onChange={(event) => setForm({ ...form, theme: event.target.value })}
                placeholder="예: 성장, 야망, 증명"
              />
            </label>

            <label className="field">
              <span>톤</span>
              <select
                value={form.tone}
                onChange={(event) => setForm({ ...form, tone: event.target.value })}
              >
                {Object.entries(tonePresets).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>핵심 키워드</span>
            <input
              value={form.keywords}
              onChange={(event) => setForm({ ...form, keywords: event.target.value })}
              placeholder="쉼표로 구분해서 입력"
            />
          </label>

          <label className="field">
            <span>레퍼런스 아티스트/무드</span>
            <textarea
              rows={4}
              value={form.artistReference}
              onChange={(event) => setForm({ ...form, artistReference: event.target.value })}
              placeholder="예: 붐뱁 기반, 무게감 있는 딕션"
            />
          </label>

          <div className="button-row">
            <button type="button" className="primary-button" onClick={() => handleGenerate("upload")} disabled={isSubmitting}>
              {isSubmitting ? "생성 중..." : "업로드 비트로 생성"}
            </button>
            <button type="button" className="ghost-button" onClick={() => handleGenerate("demo")} disabled={isSubmitting}>
              샘플 비트로 체험
            </button>
          </div>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </div>

        <div className="panel output-panel">
          <div className="panel-head">
            <h2>결과 미리보기</h2>
            <p>분석 카드와 벌스/훅 초안이 이 영역에 표시됩니다.</p>
          </div>

          {analysis ? (
            <div className="analysis-block">
              <div className="metric-row">
                <MetricCard label="BPM" value={`${analysis.estimatedBpm}`} />
                <MetricCard label="Energy" value={`${analysis.energyScore}/100`} />
                <MetricCard label="Pocket" value={analysis.pocket} />
              </div>

              <div className="analysis-detail-card">
                <h3>비트 해석</h3>
                <p>
                  {analysis.energyLabel}, 다이내믹은 {analysis.dynamicRange}, 무드는{" "}
                  {analysis.moodTags.join(" · ")} 로 읽었습니다.
                </p>
                {analysis.note ? <p className="note-text">{analysis.note}</p> : null}
              </div>

              <div className="structure-list">
                {analysis.structure.map((segment) => (
                  <div key={`${segment.label}-${segment.seconds}`} className={`segment-card ${segment.intensity}`}>
                    <span>{segment.label}</span>
                    <strong>{segment.seconds}s</strong>
                    <small>{segment.intensity}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>왼쪽에서 비트를 넣거나 샘플 모드로 시작하면 분석 결과가 여기에 나타납니다.</p>
            </div>
          )}

          {result ? (
            <div className="lyrics-block">
              <div className="lyrics-head">
                <div>
                  <p className="eyebrow">Generated Draft</p>
                  <h3>{result.title}</h3>
                </div>
                <button type="button" className="ghost-button compact-button" onClick={handleCopyLyrics}>
                  가사 복사
                </button>
              </div>

              <p className="summary-text">{result.summary}</p>

              <div className="coach-grid">
                <CoachCard label="추천 전달감" value={result.flowGuide.delivery} />
                <CoachCard label="호흡 포인트" value={result.flowGuide.breath} />
                <CoachCard label="훅 운용" value={result.flowGuide.hookMove} />
              </div>

              <div className="lyrics-sections">
                {result.sections.map((section) => (
                  <article key={section.name} className="lyrics-section-card">
                    <div className="lyrics-section-head">
                      <h4>{section.name}</h4>
                      <span>{section.note}</span>
                    </div>
                    <div className="lyric-lines">
                      {section.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="analysis-detail-card">
                <h3>다음 고도화 포인트</h3>
                <p>{result.nextStep}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CoachCard({ label, value }) {
  return (
    <div className="coach-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
