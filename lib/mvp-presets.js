export function buildDemoAnalysis() {
  return {
    source: "demo",
    fileName: "PMTM demo beat",
    durationSeconds: 92,
    estimatedBpm: 94,
    energyScore: 68,
    energyLabel: "탄력 있는 미드 에너지",
    dynamicRange: "중간 이상",
    pocket: "붐뱁과 트랩 사이의 스냅 있는 포켓",
    moodTags: ["자신감", "야망", "집중감"],
    structure: [
      { id: "segment-1", label: "Intro", seconds: 16, intensity: "low" },
      { id: "segment-2", label: "Verse 1", seconds: 32, intensity: "medium" },
      { id: "segment-3", label: "Hook", seconds: 16, intensity: "high" },
      { id: "segment-4", label: "Verse 2", seconds: 28, intensity: "medium" }
    ]
  };
}

export const tonePresets = {
  ambition: {
    label: "야망",
    hook: "올라가 더 위로",
    verbs: ["밀어붙여", "끌어올려", "확실히 찍어"],
    imagery: ["조명", "목걸이", "스테이지", "도시의 불빛"],
    stance: "성장 서사를 강하게 밀어붙이는 톤"
  },
  flex: {
    label: "플렉스",
    hook: "지금 분위길 뒤집어",
    verbs: ["뒤집어", "쓸어담아", "정리해"],
    imagery: ["체인", "스피커", "베이스", "플래시"],
    stance: "자신감과 존재감을 크게 드러내는 톤"
  },
  introspective: {
    label: "자기고백",
    hook: "조용히 더 깊이",
    verbs: ["버텨냈어", "적어 내려가", "꽉 잡아"],
    imagery: ["새벽", "방 안의 공기", "메모장", "발자국"],
    stance: "내면 독백과 감정선을 살리는 톤"
  }
};

export function normalizeKeywordInput(rawKeywords) {
  return (rawKeywords || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}
