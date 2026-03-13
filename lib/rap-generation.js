import { buildDemoAnalysis, normalizeKeywordInput, tonePresets } from "@/lib/mvp-presets";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

const rhymeBanks = [
  ["밤", "맘", "판", "감"],
  ["길", "일", "실", "빛"],
  ["불", "물", "숨", "꿈"]
];

const draftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          note: { type: "string" },
          lines: {
            type: "array",
            minItems: 4,
            maxItems: 8,
            items: { type: "string" }
          }
        },
        required: ["name", "note", "lines"]
      }
    },
    flowGuide: {
      type: "object",
      additionalProperties: false,
      properties: {
        delivery: { type: "string" },
        breath: { type: "string" },
        hookMove: { type: "string" }
      },
      required: ["delivery", "breath", "hookMove"]
    },
    nextStep: { type: "string" }
  },
  required: ["title", "summary", "sections", "flowGuide", "nextStep"]
};

export async function generateRapDraft(payload) {
  const input = normalizeInput(payload);

  if (!process.env.OPENAI_API_KEY) {
    return {
      ...buildTemplateDraft(input),
      engine: {
        mode: "fallback",
        label: "Template Draft",
        model: "local-template",
        note: "OPENAI_API_KEY가 없어 템플릿 기반 초안으로 생성했습니다."
      }
    };
  }

  try {
    const aiDraft = await requestOpenAiDraft(input);
    return {
      ...sanitizeDraft(aiDraft, input.analysis),
      engine: {
        mode: "live",
        label: "OpenAI Live",
        model: DEFAULT_MODEL
      }
    };
  } catch (error) {
    return {
      ...buildTemplateDraft(input),
      engine: {
        mode: "fallback",
        label: "Template Draft",
        model: DEFAULT_MODEL,
        note: `OpenAI 호출에 실패해 템플릿 초안으로 전환했습니다. ${error.message}`
      }
    };
  }
}

async function requestOpenAiDraft(input) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(buildOpenAiRequest(input))
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(formatOpenAiError(response.status, message));
  }

  const payload = await response.json();
  const rawText = payload.output_text || extractOutputText(payload);

  if (!rawText) {
    throw new Error("모델 응답 본문을 찾지 못했습니다.");
  }

  return JSON.parse(rawText);
}

function formatOpenAiError(status, rawMessage) {
  const payload = parseErrorPayload(rawMessage);
  const apiMessage = payload?.error?.message;
  const errorCode = payload?.error?.code;

  if (status === 429 && errorCode === "insufficient_quota") {
    return "OpenAI API 크레딧 또는 결제 한도가 부족합니다. ChatGPT Pro와 API 결제는 별도이므로 Platform의 Billing/Usage에서 API 사용 가능 상태를 확인해주세요.";
  }

  if (apiMessage) {
    return `Responses API ${status}: ${apiMessage}`;
  }

  return `Responses API ${status}: ${rawMessage}`;
}

function parseErrorPayload(rawMessage) {
  try {
    return JSON.parse(rawMessage);
  } catch {
    return null;
  }
}

function buildOpenAiRequest(input) {
  const requestBody = {
    model: DEFAULT_MODEL,
    instructions: [
      "당신은 한국 힙합 작사 코치다.",
      "입력받은 비트 분석 결과와 사용자 의도를 반영해 실제 공연 가능한 한국어 랩 가사 초안을 만든다.",
      "가사는 자연스러운 한국어로 작성하고, 구간별로 플로우가 달라지게 만든다.",
      "훅은 따라 부르기 쉽게 반복구를 분명히 만들고, 벌스는 이미지와 태도를 살린다.",
      "반드시 JSON Schema에 맞는 JSON만 출력한다."
    ].join(" "),
    input: buildPrompt(input),
    text: {
      format: {
        type: "json_schema",
        name: "pmtm_rap_draft",
        strict: true,
        schema: draftSchema
      }
    }
  };

  if (DEFAULT_MODEL.startsWith("gpt-5")) {
    requestBody.reasoning = { effort: "low" };
  }

  return requestBody;
}

function buildPrompt(input) {
  const structureText = input.analysis.structure
    .map((segment) => `${segment.label} ${segment.seconds}s ${segment.intensity}`)
    .join(", ");

  return [
    "다음 정보로 랩 가사 초안을 작성해줘.",
    `파일명: ${input.fileName}`,
    `주제: ${input.theme}`,
    `톤: ${input.tone.label} (${input.tone.stance})`,
    `키워드: ${input.keywords.join(", ") || "없음"}`,
    `레퍼런스 무드: ${input.artistReference}`,
    `BPM: ${input.analysis.estimatedBpm}`,
    `에너지: ${input.analysis.energyLabel} (${input.analysis.energyScore}/100)`,
    `포켓: ${input.analysis.pocket}`,
    `무드 태그: ${input.analysis.moodTags.join(", ")}`,
    `구조 추정: ${structureText}`,
    "출력 규칙:",
    "1. Verse 1, Hook, Verse 2 세 섹션으로 작성",
    "2. Verse는 각 8줄, Hook은 4줄",
    "3. Hook은 반복구가 분명하고 공연에서 따라 부르기 쉬워야 함",
    "4. BPM에 맞는 전달 방식과 호흡 포인트를 flowGuide에 써야 함",
    "5. 전체적으로 데모데이에서 바로 보여줄 수 있을 정도로 완성도 있게 작성"
  ].join("\n");
}

function extractOutputText(payload) {
  if (!payload?.output || !Array.isArray(payload.output)) {
    return "";
  }

  for (const item of payload.output) {
    if (!item?.content || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content?.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

function sanitizeDraft(draft, analysis) {
  return {
    title: sanitizeText(draft.title, "PMTM Draft"),
    summary: sanitizeText(
      draft.summary,
      `${analysis.estimatedBpm} BPM 기반으로 생성한 랩 초안입니다.`
    ),
    sections: Array.isArray(draft.sections) ? draft.sections.map(sanitizeSection) : [],
    flowGuide: sanitizeFlowGuide(draft.flowGuide),
    nextStep: sanitizeText(
      draft.nextStep,
      "다음 단계에서는 라임 점수화와 가이드 보컬 TTS를 붙일 수 있습니다."
    )
  };
}

function sanitizeSection(section) {
  return {
    name: sanitizeText(section?.name, "Section"),
    note: sanitizeText(section?.note, ""),
    lines: Array.isArray(section?.lines)
      ? section.lines.map((line) => sanitizeText(line, "")).filter(Boolean)
      : []
  };
}

function sanitizeFlowGuide(flowGuide) {
  return {
    delivery: sanitizeText(flowGuide?.delivery, "리듬을 크게 타며 전달하세요."),
    breath: sanitizeText(flowGuide?.breath, "4줄 단위로 호흡을 정리하세요."),
    hookMove: sanitizeText(flowGuide?.hookMove, "훅의 첫 줄은 반복감을 강하게 유지하세요.")
  };
}

function normalizeInput(payload) {
  const analysis = payload.analysis || buildDemoAnalysis();
  return {
    analysis,
    fileName: sanitizeText(payload.fileName, analysis.fileName || "demo beat"),
    theme: sanitizeText(payload.theme, "성장과 야망"),
    tone: tonePresets[payload.tone] || tonePresets.ambition,
    keywords: normalizeKeywordInput(payload.keywords),
    artistReference: sanitizeText(
      payload.artistReference,
      "묵직하지만 귀에 걸리는 힙합 톤"
    )
  };
}

function buildTemplateDraft({ analysis, tone, theme, artistReference, keywords }) {
  const rhymeSet = rhymeBanks[analysis.estimatedBpm % rhymeBanks.length];
  const seedWords = [
    ...keywords,
    tone.imagery[0],
    tone.imagery[1],
    theme,
    analysis.moodTags[0]
  ].filter(Boolean);

  return {
    title: makeTitle(theme, keywords),
    summary: `${analysis.estimatedBpm} BPM의 ${analysis.energyLabel} 비트로 읽고, ${tone.label} 톤에 맞춰 ${theme} 중심의 가사를 짰습니다.`,
    sections: [
      {
        name: "Verse 1",
        note: `${analysis.structure[1]?.label || "Verse"} 구간에 맞춘 8마디 초안`,
        lines: [
          buildLine(seedWords[0], tone.verbs[0], rhymeSet[0], analysis),
          buildLine(seedWords[1], tone.verbs[1], rhymeSet[1], analysis),
          `낮게 눌러도 선명해, ${theme}를 걸고 더 멀리 ${rhymeSet[2]}`,
          `리듬 위에 ${seedWords[2] || "메시지"}를 실어, 내 이름값으로 남겨 ${rhymeSet[3]}`,
          `이 ${analysis.estimatedBpm}의 포켓 안에서 발을 맞춰 천천히 더 크게 ${rhymeSet[0]}`,
          `${artistReference} 무드처럼 단단히 쌓아, 한 줄 한 줄 증명해 ${rhymeSet[1]}`,
          `${tone.imagery[2]} 번쩍여도 중심은 안 흔들려, 시선은 이미 ${rhymeSet[2]}`,
          `오늘의 벌스가 내일의 무대가 돼, 결국 끝엔 내가 남아 ${rhymeSet[3]}`
        ]
      },
      {
        name: "Hook",
        note: `${analysis.structure.find((segment) => segment.label.includes("Hook"))?.seconds || 16}초 정도 반복하기 좋은 훅`,
        lines: [
          `${tone.hook}, ${theme}를 걸고 더 위로`,
          `${tone.hook}, ${seedWords[0] || "이 꿈"}을 끝까지 밀어`,
          `${tone.hook}, ${analysis.moodTags.join(" 그리고 ")}`,
          `${tone.hook}, 결국 판을 바꾸는 이름으로`
        ]
      },
      {
        name: "Verse 2",
        note: "후반부 에너지 상승을 위한 변주 벌스",
        lines: [
          `처음엔 작았던 소리도 지금은 ${tone.imagery[3]}처럼 번져`,
          `${seedWords[1] || "목표"}를 쫓던 발걸음이 이제는 무대를 먼저 점거해`,
          `낯선 밤도 지나왔지, 그래서 지금 딕션이 더 무겁게 떨어져`,
          `${analysis.pocket} 위에서 간격을 쪼개, 듣는 순간 바로 꽂히게`,
          `가사마다 숨을 걸고, 훅에선 다 같이 따라오게`,
          `${theme} 하나로 출발했지만 끝에 남는 건 태도와 증거`,
          `비트가 멈춰도 여운은 남겨, 마지막까지 실루엣은 선명해`,
          `프메더머니 목걸이처럼 걸어, 잘 들었다는 말까지 끌어내`
        ]
      }
    ],
    flowGuide: buildFlowGuide(analysis),
    nextStep:
      "다음 단계에서는 실제 LLM 프롬프트 엔진과 라임 점수화, 박자 단위 음절 정렬, 가이드 보컬 TTS를 붙이면 2차 MVP로 확장할 수 있습니다."
  };
}

function buildLine(seed, verb, rhyme, analysis) {
  return `${seed || "이 장면"} 위로 숨을 얹어 ${verb}, ${analysis.moodTags[0]}으로 찍어 ${rhyme}`;
}

function buildFlowGuide(analysis) {
  const delivery =
    analysis.estimatedBpm < 90
      ? "단어 끝을 끌어주면서 자음 타격을 크게 살리는 전달"
      : analysis.estimatedBpm < 120
        ? "16분 음표를 너무 빽빽하게 채우지 말고 스윙감을 남기는 전달"
        : "짧은 구를 연속으로 잘라 타격감 있게 밀어붙이는 전달";

  const breath =
    analysis.energyScore < 50
      ? "2줄마다 여백을 주고 발음 선명도를 유지하세요."
      : "4줄 단위로 호흡을 끊고 훅 직전에 숨을 크게 가져가세요.";

  return {
    delivery,
    breath,
    hookMove: "훅 첫 줄은 단체로 따라 부를 수 있게 가장 쉬운 어휘와 반복구를 유지하세요."
  };
}

function makeTitle(theme, keywords) {
  const anchor = keywords[0] || "Stage";
  return `${anchor} / ${theme}`;
}

function sanitizeText(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}
