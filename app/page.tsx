"use client";

import { useEffect, useMemo, useState } from "react";

type Materials = {
  abydos: number;
  soft: number;
  wood: number;
  sturdy: number;
};

type Plan = {
  maxCraft: number; // 세트 수
  sturdyToWood: number;
  softToWood: number;
  woodToPowder: number;
  powderToAbydos: number;
  powderToSoft: number;
  powderUsed: number;
  powderLeft: number;
  crafted: number;
  leftovers: {
    abydos: number;
    soft: number;
    wood: number;
    sturdy: number;
  };
};

const RECIPE = {
  abydos: 43,
  soft: 59,
  wood: 112,
};

function toInt(value: string) {
  const num = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function ceilDiv(a: number, b: number) {
  if (a <= 0) return 0;
  return Math.floor((a + b - 1) / b);
}

function format(num: number) {
  return num.toLocaleString("ko-KR");
}

function parseFormatted(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function canCraftWithPlan(input: Materials, targetSets: number): Plan | null {
  const needA = RECIPE.abydos * targetSets;
  const needS = RECIPE.soft * targetSets;
  const needW = RECIPE.wood * targetSets;

  const sturdyToWood = Math.floor(input.sturdy / 5);
  const sturdyLeft = input.sturdy % 5;
  const baseWood = input.wood + sturdyToWood * 50;

  let best: Plan | null = null;

  const abydosDeficit = Math.max(0, needA - input.abydos);
  const fixedPowderToAbydos = ceilDiv(abydosDeficit, 10);

  // 경매장 구매는 최대 제작량 계산에 포함하지 않음
  const baseSoft = input.soft;

  // 필요한 soft가 부족하면 powder -> soft로 메울 수 있는 범위 탐색
  const minPowderToSoft = ceilDiv(Math.max(0, needS - baseSoft), 50);
  const maxPowderToSoft = minPowderToSoft + 12;

  for (let powderToSoft = minPowderToSoft; powderToSoft <= maxPowderToSoft; powderToSoft += 1) {
    const softFromPowder = powderToSoft * 50;
    const totalSoftPool = baseSoft + softFromPowder;

    // 제작에 필요한 soft를 남기고 남는 soft만 wood로 전환 가능
    const maxSoftToWood = Math.floor(Math.max(0, totalSoftPool - needS) / 25);

    for (let softToWood = 0; softToWood <= maxSoftToWood; softToWood += 1) {
      const softConsumedForWood = softToWood * 25;
      const woodFromSoft = softToWood * 50;

      const finalSoftBeforeCraft = totalSoftPool - softConsumedForWood;
      if (finalSoftBeforeCraft < needS) continue;

      const woodPoolBeforePowder = baseWood + woodFromSoft;

      const totalPowderConversions = fixedPowderToAbydos + powderToSoft;
      const totalPowderNeeded = totalPowderConversions * 100;
      const woodToPowder = ceilDiv(totalPowderNeeded, 80);

      const powderMade = woodToPowder * 80;
      if (powderMade < totalPowderNeeded) continue;

      const finalWoodBeforeCraft = woodPoolBeforePowder - woodToPowder * 100;
      if (finalWoodBeforeCraft < needW) continue;

      const finalAbydosBeforeCraft = input.abydos + fixedPowderToAbydos * 10;
      if (finalAbydosBeforeCraft < needA) continue;

      const candidate: Plan = {
        maxCraft: targetSets,
        sturdyToWood,
        softToWood,
        woodToPowder,
        powderToAbydos: fixedPowderToAbydos,
        powderToSoft,
        powderUsed: totalPowderNeeded,
        powderLeft: powderMade - totalPowderNeeded,
        crafted: targetSets,
        leftovers: {
          abydos: finalAbydosBeforeCraft - needA,
          soft: finalSoftBeforeCraft - needS,
          wood: finalWoodBeforeCraft - needW,
          sturdy: sturdyLeft,
        },
      };

      if (!best) {
        best = candidate;
        continue;
      }

      const bestScore =
        best.powderToSoft * 10_000 +
        best.softToWood * 100 +
        best.woodToPowder;

      const candidateScore =
        candidate.powderToSoft * 10_000 +
        candidate.softToWood * 100 +
        candidate.woodToPowder;

      const bestLeftoverSum =
        best.leftovers.abydos + best.leftovers.soft + best.leftovers.wood + best.powderLeft;
      const candidateLeftoverSum =
        candidate.leftovers.abydos +
        candidate.leftovers.soft +
        candidate.leftovers.wood +
        candidate.powderLeft;

      if (
        candidateScore < bestScore ||
        (candidateScore === bestScore && candidateLeftoverSum > bestLeftoverSum)
      ) {
        best = candidate;
      }
    }
  }

  return best;
}

function calculatePlan(input: Materials): Plan {
  const sturdyToWood = Math.floor(input.sturdy / 5);
  const sturdyLeft = input.sturdy % 5;
  const baseWood = input.wood + sturdyToWood * 50;

  const upperBound =
    Math.floor((input.abydos + Math.floor((baseWood * 2) / 25) + Math.floor(input.soft / 5)) / 43) + 300;

  let best: Plan | null = null;

  for (let targetSets = 0; targetSets <= upperBound; targetSets += 1) {
    const candidate = canCraftWithPlan(input, targetSets);
    if (candidate) {
      best = candidate;
    }
  }

  return (
    best ?? {
      maxCraft: 0,
      sturdyToWood,
      softToWood: 0,
      woodToPowder: 0,
      powderToAbydos: 0,
      powderToSoft: 0,
      powderUsed: 0,
      powderLeft: 0,
      crafted: 0,
      leftovers: {
        abydos: input.abydos,
        soft: input.soft,
        wood: baseWood,
        sturdy: sturdyLeft,
      },
    }
  );
}

export default function Page() {
  const [form, setForm] = useState({
    abydos: "0",
    soft: "0",
    wood: "0",
    sturdy: "0",
  });
  const [copied, setCopied] = useState(false);
  const [showPowderPlan, setShowPowderPlan] = useState(true);
  const [showMarketPlan, setShowMarketPlan] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("abydos-calculator-form");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<typeof form>;
      setForm((prev) => ({
        abydos: parseFormatted(parsed.abydos ?? prev.abydos),
        soft: parseFormatted(parsed.soft ?? prev.soft),
        wood: parseFormatted(parsed.wood ?? prev.wood),
        sturdy: parseFormatted(parsed.sturdy ?? prev.sturdy),
      }));
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("abydos-calculator-form", JSON.stringify(form));
  }, [form]);

  const materials = useMemo<Materials>(
    () => ({
      abydos: toInt(form.abydos),
      soft: toInt(form.soft),
      wood: toInt(form.wood),
      sturdy: toInt(form.sturdy),
    }),
    [form]
  );

  const result = useMemo(() => calculatePlan(materials), [materials]);

  const rows = [
    { key: "abydos", label: "아비도스 목재", value: form.abydos },
    { key: "soft", label: "부드러운 목재", value: form.soft },
    { key: "wood", label: "목재", value: form.wood },
    { key: "sturdy", label: "튼튼한 목재", value: form.sturdy },
  ] as const;

  const steps = [
  {
    key: "sturdyToWood",
    show: result.sturdyToWood > 0,
    text: `튼튼한 목재 ${format(result.sturdyToWood * 5)}개 → 목재 ${format(
      result.sturdyToWood * 50
    )}개`,
    sub: `교환 횟수: ${format(result.sturdyToWood)}번 (5 → 50)`,
  },
  {
    key: "softToWood",
    show: result.softToWood > 0,
    text: `부드러운 목재 ${format(result.softToWood * 25)}개 → 목재 ${format(
      result.softToWood * 50
    )}개`,
    sub: `교환 횟수: ${format(result.softToWood)}번 (25 → 50)`,
  },
  {
    key: "woodToPowder",
    show: result.woodToPowder > 0,
    text: `목재 ${format(result.woodToPowder * 100)}개 → 벌목의 가루 ${format(
      result.woodToPowder * 80
    )}개`,
    sub: `교환 횟수: ${format(result.woodToPowder)}번 (100 → 80)`,
  },
  {
    key: "powderToAbydos",
    show: result.powderToAbydos > 0,
    text: `벌목의 가루 ${format(result.powderToAbydos * 100)}개 → 아비도스 목재 ${format(
      result.powderToAbydos * 10
    )}개`,
    sub: `교환 횟수: ${format(result.powderToAbydos)}번 (100 → 10)`,
  },
  {
    key: "powderToSoft",
    show: result.powderToSoft > 0,
    text: `벌목의 가루 ${format(result.powderToSoft * 100)}개 → 부드러운 목재 ${format(
      result.powderToSoft * 50
    )}개`,
    sub: `교환 횟수: ${format(result.powderToSoft)}번 (100 → 50)`,
  },
  {
    key: "crafted",
    show: result.crafted > 0,
    text: `상급 아비도스 융화 재료 ${format(result.crafted * 10)}개 제작`,
  },
].filter((step) => step.show);

  const nextSoftShortage = Math.max(0, RECIPE.soft - result.leftovers.soft);
  const nextMarketSets = ceilDiv(nextSoftShortage, 100);
  const nextMarketBought = nextMarketSets * 100;
  const nextPowderToSoft = ceilDiv(nextSoftShortage, 50);
  const nextPowderUsed = nextPowderToSoft * 100;
  const nextSoftMade = nextPowderToSoft * 50;

  const handleCopy = async () => {
    const summary = [
      "[상급 아비도스 융화 재료 계산 결과]",
      `최대 제작 가능: ${format(result.maxCraft * 10)}개 (${format(result.maxCraft)}세트)`,
      "",
      "추천 교환 순서:",
      ...(steps.length > 0 ? steps.map((step, i) => `${i + 1}. ${step.text}`) : ["- 제작 불가"]),
      "",
      "보조 전략:",
      `- 다음 1세트 기준 부드러운 목재 부족: ${format(nextSoftShortage)}개`,
      `- 벌목의 가루 충당 시: ${format(nextPowderToSoft)}회, 벌목의 가루 ${format(nextPowderUsed)}개`,
      `- 경매장 구매 시: ${format(nextMarketSets)}세트, 총 ${format(nextMarketBought)}개`,
      "",
      "제작 후 남는 재료:",
      `- 아비도스 목재: ${format(result.leftovers.abydos)}개`,
      `- 부드러운 목재: ${format(result.leftovers.soft)}개`,
      `- 목재: ${format(result.leftovers.wood)}개`,
      `- 튼튼한 목재: ${format(result.leftovers.sturdy)}개`,
      `- 벌목의 가루: ${format(result.powderLeft)}개`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      alert("복사에 실패했어요. 브라우저 권한을 확인해주세요.");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-4">
            <span className="w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Lost Ark 재료 최적화 계산기
            </span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              상급 아비도스 융화 재료 최대 제작 계산기
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              보유 중인 아비도스 목재, 부드러운 목재, 목재, 튼튼한 목재를 입력하면 최대 제작량과 교환
              전략을 바로 계산해준다.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl backdrop-blur sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">재료 입력</h2>
              <p className="mt-1 text-sm text-zinc-400">숫자를 입력하면 결과가 바로 갱신된다.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((row) => (
                <label key={row.key} className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-300">{row.label}</span>
                  <input
                    inputMode="numeric"
                    value={format(toInt(row.value))}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [row.key]: parseFormatted(e.target.value),
                      }))
                    }
                    placeholder="보유 개수 입력"
                    className="h-12 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
              <div className="mb-2 font-medium text-zinc-200">기준 공식</div>
              <div className="space-y-1 leading-6">
                <p>상급 아비도스 융화 재료 1세트(10개) = 아비도스 목재 43 + 부드러운 목재 59 + 목재 112</p>
                <p>튼튼한 목재 5 → 목재 50</p>
                <p>부드러운 목재 25 → 목재 50</p>
                <p>목재 100 → 벌목의 가루 80</p>
                <p>벌목의 가루 100 → 아비도스 목재 10</p>
                <p>벌목의 가루 100 → 부드러운 목재 50</p>
                <p>경매장 구매: 부드러운 목재 100개 = 1세트</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl backdrop-blur sm:p-6">
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <h2 className="text-xl font-semibold">계산 결과</h2>
                <p className="mt-1 text-sm text-zinc-400">현재 입력 기준 전체 최적 전략</p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
              >
                교환식 복사
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={showPowderPlan}
                  onChange={(e) => setShowPowderPlan(e.target.checked)}
                  className="h-4 w-4 accent-sky-400"
                />
                벌목의 가루 우선안
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={showMarketPlan}
                  onChange={(e) => setShowMarketPlan(e.target.checked)}
                  className="h-4 w-4 accent-amber-400"
                />
                경매장 구매 우선안
              </label>
            </div>

            {copied && (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                복사 완료! 계산 결과를 클립보드에 저장했어요.
              </div>
            )}

            <div className="mb-4 rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-amber-500/10 p-5 text-center shadow-lg shadow-emerald-900/20">
              <div className="text-xs text-emerald-200">최대 제작 가능</div>
              <div className="mt-2 text-5xl font-extrabold text-emerald-100">
                {format(result.maxCraft * 10)}
                <span className="ml-1 text-2xl text-amber-300">개</span>
              </div>
              <div className="mt-1 text-sm text-zinc-400">({format(result.maxCraft)}세트)</div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-200">추천 교환 순서</div>
                <div className="space-y-2">
                  {steps.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                      현재 보유 재료만으로는 제작할 수 없어요.
                    </div>
                  ) : (
                      steps.map((step, index) => (
                        <div
                          key={step.key}
                          className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200"
                        >
                          <div>
                            <span className="mr-2 font-semibold text-amber-300">
                              {index + 1}단계
                            </span>
                            {step.text}
                          </div>

                          {"sub" in step && step.sub && (
                            <div className="mt-1 text-xs text-zinc-400">
                              {step.sub}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {showPowderPlan && (
                  <div className="rounded-2xl border border-sky-500/20 bg-zinc-950/70 p-4">
                    <div className="mb-3 text-sm font-semibold text-sky-300">부드러운 목재 충당 (벌목의 가루)</div>
                    <div className="space-y-2 text-sm text-zinc-300">
                      <p>다음 1세트 기준 부족한 부드러운 목재: {format(nextSoftShortage)}개</p>
                      <p>벌목의 가루 → 부드러운 목재: {format(nextPowderToSoft)}회</p>
                      <p>사용한 벌목의 가루: {format(nextPowderUsed)}개</p>
                      <p>확보한 부드러운 목재: {format(nextSoftMade)}개</p>

                      {nextPowderToSoft === 0 && (
                        <p className="text-xs text-zinc-500">현재 남은 부드러운 목재로 다음 1세트도 바로 제작 가능해요.</p>
                      )}
                    </div>
                  </div>
                )}

                {showMarketPlan && (
                  <div className="rounded-2xl border border-amber-500/20 bg-zinc-950/70 p-4">
                    <div className="mb-3 text-sm font-semibold text-amber-300">경매장 구매</div>

                    <div className="space-y-2 text-sm text-zinc-300">
                      <p>다음 1세트 기준 부족한 부드러운 목재: {format(nextSoftShortage)}개</p>
                      <p>구매 세트 수: {format(nextMarketSets)}세트</p>
                      <p>총 구매량: {format(nextMarketBought)}개</p>

                      {nextMarketSets === 0 && (
                        <p className="text-xs text-zinc-500">현재 남은 부드러운 목재로 다음 1세트도 바로 제작 가능해요.</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {nextMarketSets === 0 ? (
                        <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
                          구매 없음
                        </div>
                      ) : (
                        Array.from({ length: Math.min(nextMarketSets, 12) }).map((_, index) => (
                          <div
                            key={index}
                            className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                          >
                            100개 1세트
                          </div>
                        ))
                      )}

                      {nextMarketSets > 12 && (
                        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                          + {format(nextMarketSets - 12)}세트 더
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!showPowderPlan && !showMarketPlan && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
                  표시할 전략을 선택해주세요.
                </div>
              )}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-200">제작 후 남는 재료</div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-zinc-400">아비도스 목재</div>
                    <div className="mt-1 text-lg font-semibold">{format(result.leftovers.abydos)}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-zinc-400">부드러운 목재</div>
                    <div className="mt-1 text-lg font-semibold">{format(result.leftovers.soft)}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-zinc-400">목재</div>
                    <div className="mt-1 text-lg font-semibold">{format(result.leftovers.wood)}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-zinc-400">튼튼한 목재</div>
                    <div className="mt-1 text-lg font-semibold">{format(result.leftovers.sturdy)}</div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">남는 벌목의 가루: {format(result.powderLeft)}개</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}