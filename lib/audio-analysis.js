import { buildDemoAnalysis } from "@/lib/mvp-presets";

const FRAME_SIZE = 2048;
const MIN_BPM = 70;
const MAX_BPM = 180;

export async function analyzeAudioFile(file) {
  if (typeof window === "undefined") {
    throw new Error("오디오 분석은 브라우저에서만 실행할 수 있습니다.");
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("이 브라우저는 Web Audio API를 지원하지 않습니다.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContextClass();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = mergeChannels(audioBuffer);
    const rmsFrames = extractRmsFrames(mono, FRAME_SIZE);
    const estimatedBpm = estimateTempo(rmsFrames, audioBuffer.sampleRate / FRAME_SIZE);
    const averageEnergy = average(rmsFrames);
    const peakEnergy = Math.max(...rmsFrames, 0);
    const energyScore = Math.round(Math.min(100, averageEnergy * 320));
    const structure = inferStructure(
      rmsFrames,
      audioBuffer.duration,
      audioBuffer.sampleRate / FRAME_SIZE
    );

    return {
      source: "upload",
      fileName: file.name,
      durationSeconds: Math.round(audioBuffer.duration),
      estimatedBpm,
      energyScore,
      energyLabel: describeEnergy(energyScore),
      dynamicRange: describeDynamicRange(peakEnergy - averageEnergy),
      pocket: describePocket(estimatedBpm, energyScore),
      moodTags: inferMoodTags(estimatedBpm, energyScore),
      structure
    };
  } catch (error) {
    return {
      ...buildDemoAnalysis(),
      source: "fallback",
      fileName: file.name,
      note: "정밀 디코딩에 실패해 데모 분석값으로 대체했습니다."
    };
  } finally {
    await audioContext.close();
  }
}

function mergeChannels(audioBuffer) {
  const { numberOfChannels, length } = audioBuffer;
  const merged = new Float32Array(length);

  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      merged[index] += channelData[index] / numberOfChannels;
    }
  }

  return merged;
}

function extractRmsFrames(samples, frameSize) {
  const frames = [];

  for (let start = 0; start < samples.length; start += frameSize) {
    let sum = 0;
    const frameEnd = Math.min(start + frameSize, samples.length);

    for (let index = start; index < frameEnd; index += 1) {
      sum += samples[index] * samples[index];
    }

    frames.push(Math.sqrt(sum / Math.max(1, frameEnd - start)));
  }

  return frames;
}

function estimateTempo(rmsFrames, framesPerSecond) {
  const normalized = normalize(rmsFrames);
  const threshold = percentile(normalized, 0.8);
  const minDistanceFrames = Math.max(1, Math.round(framesPerSecond * 0.18));
  const peaks = [];

  for (let index = 1; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const isPeak =
      current > threshold &&
      current > normalized[index - 1] &&
      current >= normalized[index + 1];

    if (!isPeak) {
      continue;
    }

    if (peaks.length === 0 || index - peaks[peaks.length - 1] > minDistanceFrames) {
      peaks.push(index);
    }
  }

  const candidates = new Map();

  for (let index = 0; index < peaks.length; index += 1) {
    for (let lookahead = 1; lookahead <= 8 && index + lookahead < peaks.length; lookahead += 1) {
      const gap = peaks[index + lookahead] - peaks[index];
      const seconds = gap / framesPerSecond;

      if (seconds <= 0) {
        continue;
      }

      let bpm = 60 / seconds;
      while (bpm < MIN_BPM) {
        bpm *= 2;
      }
      while (bpm > MAX_BPM) {
        bpm /= 2;
      }

      const rounded = Math.round(bpm);
      candidates.set(rounded, (candidates.get(rounded) || 0) + 1);
    }
  }

  if (candidates.size === 0) {
    return buildDemoAnalysis().estimatedBpm;
  }

  return [...candidates.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function inferStructure(rmsFrames, durationSeconds, framesPerSecond) {
  const segmentCount = durationSeconds < 70 ? 4 : durationSeconds < 120 ? 5 : 6;
  const framesPerSegment = Math.max(1, Math.floor(rmsFrames.length / segmentCount));
  const labelsByCount = {
    4: ["Intro", "Verse", "Hook", "Outro"],
    5: ["Intro", "Verse 1", "Hook", "Verse 2", "Outro"],
    6: ["Intro", "Verse 1", "Hook", "Verse 2", "Bridge", "Hook"]
  };

  return labelsByCount[segmentCount].map((label, index) => {
    const start = index * framesPerSegment;
    const end = index === segmentCount - 1 ? rmsFrames.length : start + framesPerSegment;
    const slice = rmsFrames.slice(start, end);
    const intensityScore = average(normalize(slice)) || 0;

    return {
      label,
      seconds: Math.max(8, Math.round((end - start) / framesPerSecond)),
      intensity:
        intensityScore > 0.66 ? "high" : intensityScore > 0.33 ? "medium" : "low"
    };
  });
}

function inferMoodTags(bpm, energyScore) {
  const tags = [];

  if (bpm < 90) {
    tags.push("무게감");
  } else if (bpm < 120) {
    tags.push("집중감");
  } else {
    tags.push("질주감");
  }

  if (energyScore < 40) {
    tags.push("서늘함");
  } else if (energyScore < 70) {
    tags.push("자신감");
  } else {
    tags.push("폭발감");
  }

  if (bpm >= 90 && bpm <= 110) {
    tags.push("그루브");
  }

  return tags;
}

function describeEnergy(score) {
  if (score < 35) {
    return "낮고 묵직한 에너지";
  }
  if (score < 65) {
    return "탄력 있는 미드 에너지";
  }
  return "강하게 밀어붙이는 하이 에너지";
}

function describeDynamicRange(delta) {
  if (delta < 0.03) {
    return "작음";
  }
  if (delta < 0.08) {
    return "중간";
  }
  return "큼";
}

function describePocket(bpm, energyScore) {
  if (bpm < 88) {
    return energyScore > 60 ? "느리지만 강한 붐뱁 포켓" : "천천히 눌러가는 붐뱁 포켓";
  }
  if (bpm < 116) {
    return "중속에서 스냅이 살아있는 포켓";
  }
  return "트랩 드럼 위로 빠르게 타는 포켓";
}

function normalize(values) {
  if (values.length === 0) {
    return [];
  }

  const max = Math.max(...values);
  const min = Math.min(...values);

  if (max === min) {
    return values.map(() => 0.5);
  }

  return values.map((value) => (value - min) / (max - min));
}

function percentile(values, target) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * target));
  return sorted[index];
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
