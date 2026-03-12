import { buildDemoAnalysis, normalizeKeywordInput, tonePresets } from "@/lib/mvp-presets";

const rhymeBanks = [
  ["밤", "맘", "판", "감"],
  ["길", "일", "실", "빛"],
  ["불", "물", "숨", "꿈"]
];

export async function POST(request) {
  const body = await request.json();
  const analysis = body.analysis || buildDemoAnalysis();
  const tone = tonePresets[body.tone] || tonePresets.ambition;
  const keywords = normalizeKeywordInput(body.keywords);
  const theme = sanitizeText(body.theme, "성장과 야망");
  const artistReference = sanitizeText(body.artistReference, "묵직하지만 귀에 걸리는 힙합 톤");
  const title = makeTitle(theme, keywords);
  const summary = `${analysis.estimatedBpm} BPM의 ${analysis.energyLabel} 비트로 읽고, ${tone.label} 톤에 맞춰 ${theme} 중심의 가사를 짰습니다.`;
  const sections = buildSections({
    analysis,
    tone,
    theme,
    artistReference,
    keywords
  });

  return Response.json({
    title,
    summary,
    sections,
    flowGuide: buildFlowGuide(analysis),
    nextStep:
      "다음 단계에서는 실제 LLM 프롬프트 엔진과 라임 점수화, 박자 단위 음절 정렬, 가이드 보컬 TTS를 붙이면 2차 MVP로 확장할 수 있습니다."
  });
}

function buildSections({ analysis, tone, theme, artistReference, keywords }) {
  const rhymeSet = rhymeBanks[analysis.estimatedBpm % rhymeBanks.length];
  const seedWords = [
    ...keywords,
    tone.imagery[0],
    tone.imagery[1],
    theme,
    analysis.moodTags[0]
  ].filter(Boolean);

  return [
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
  ];
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
