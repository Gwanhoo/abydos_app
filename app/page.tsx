"use client";

import { useEffect, useMemo, useState } from "react";

type Materials = {
  abydos: number;
  soft: number;
  wood: number;
  sturdy: number;
};

type Plan = {
  maxCraft: number;
  sturdyToWood: number;
  softToPowder: number;
  softToWood: number;
  woodToPowder: number;
  powderToAbydos: number;
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
  return Math.floor((a + b - 1) / b);
}

function format(num: number) {
  return num.toLocaleString("ko-KR");
}

function calculatePlan(input: Materials): Plan {
  const sturdyToWood = Math.floor(input.sturdy / 5);
  const sturdyLeft = input.sturdy % 5;
  const baseWood = input.wood + sturdyToWood * 50;

  let best: Plan | null = null;

  // 충분히 큰 상한. 실제로는 이보다 빨리 제한됨.
  const upperBound = Math.max(
    0,
    Math.floor((input.abydos + Math.floor((input.soft + baseWood) / 6)) / RECIPE.abydos) + 200
  );

  for (let n = 0; n <= upperBound; n += 1) {
    const needA = RECIPE.abydos * n;
    const needS = RECIPE.soft * n;
    const needW = RECIPE.wood * n;

    if (needS > input.soft) break;

    const softConvertible = input.soft - needS;
    let foundForThisN: Plan | null = null;

    for (let softToPowder = 0; softToPowder <= Math.floor(softConvertible / 50); softToPowder += 1) {
      const softRemainingAfterPowder = softConvertible - softToPowder * 50;
      const maxSoftToWood = Math.floor(softRemainingAfterPowder / 25);

      const abydosDeficit = Math.max(0, needA - input.abydos);
      const abydosBatchNeed = ceilDiv(abydosDeficit, 10);
      const minPowderConversions = abydosBatchNeed === 0 ? 0 : ceilDiv(abydosBatchNeed * 5, 4);

      const woodToPowder = Math.max(0, minPowderConversions - softToPowder);

      const requiredWoodBeforePowder = needW + woodToPowder * 100;
      const missingWood = Math.max(0, requiredWoodBeforePowder - baseWood);
      const softToWood = ceilDiv(missingWood, 50);

      if (softToWood > maxSoftToWood) continue;

      const totalPowderConversions = softToPowder + woodToPowder;
      const powderMade = totalPowderConversions * 80;
      const powderToAbydos = Math.floor(powderMade / 100);
      const abydosMade = powderToAbydos * 10;

      const finalAbydos = input.abydos + abydosMade;
      const finalSoft = input.soft - softToPowder * 50 - softToWood * 25;
      const finalWood = baseWood + softToWood * 50 - woodToPowder * 100;

      if (finalAbydos < needA || finalSoft < needS || finalWood < needW) continue;

      const powderUsed = powderToAbydos * 100;
      const powderLeft = powderMade - powderUsed;

      const candidate: Plan = {
        maxCraft: n,
        sturdyToWood,
        softToPowder,
        softToWood,
        woodToPowder,
        powderToAbydos,
        powderUsed,
        powderLeft,
        crafted: n,
        leftovers: {
          abydos: finalAbydos - needA,
          soft: finalSoft - needS,
          wood: finalWood - needW,
          sturdy: sturdyLeft,
        },
      };

      if (!foundForThisN) {
        foundForThisN = candidate;
      } else {
        const currentCost =
          foundForThisN.softToPowder * 50 +
          foundForThisN.softToWood * 25 +
          foundForThisN.woodToPowder * 100;
        const candidateCost =
          candidate.softToPowder * 50 + candidate.softToWood * 25 + candidate.woodToPowder * 100;

        if (
          candidateCost < currentCost ||
          (candidateCost === currentCost &&
            candidate.leftovers.soft + candidate.leftovers.wood >
              foundForThisN.leftovers.soft + foundForThisN.leftovers.wood)
        ) {
          foundForThisN = candidate;
        }
      }
    }

    if (foundForThisN) {
      best = foundForThisN;
    } else {
      break;
    }
  }

  return (
    best ?? {
      maxCraft: 0,
      sturdyToWood,
      softToPowder: 0,
      softToWood: 0,
      woodToPowder: 0,
      powderToAbydos: 0,
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

function parseFormatted(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export default function Page() {
  const [form, setForm] = useState({
    abydos: "0",
    soft: "0",
    wood: "0",
    sturdy: "0",
  });
  const [copied, setCopied] = useState(false);

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
      icon: "🪵",
      text: `튼튼한 목재 ${format(result.sturdyToWood * 5)}개 → 목재 ${format(result.sturdyToWood * 50)}개`,
    },
    {
      key: "softToWood",
      show: result.softToWood > 0,
      icon: "🔁",
      text: `부드러운 목재 ${format(result.softToWood * 25)}개 → 목재 ${format(result.softToWood * 50)}개`,
    },
    {
      key: "softToPowder",
      show: result.softToPowder > 0,
      icon: "🧪",
      text: `부드러운 목재 ${format(result.softToPowder * 50)}개 → 벌목의 가루 ${format(result.softToPowder * 80)}개`,
    },
    {
      key: "woodToPowder",
      show: result.woodToPowder > 0,
      icon: "⚙️",
      text: `목재 ${format(result.woodToPowder * 100)}개 → 벌목의 가루 ${format(result.woodToPowder * 80)}개`,
    },
    {
      key: "powderToAbydos",
      show: result.powderToAbydos > 0,
      icon: "✨",
      text: `벌목의 가루 ${format(result.powderUsed)}개 → 아비도스 목재 ${format(result.powderToAbydos * 10)}개`,
    },
    {
      key: "crafted",
      show: result.crafted > 0,
      icon: "🏆",
      text: `상급 아비도스 융화 재료 ${format(result.crafted)}개 제작`,
    },
  ].filter((step) => step.show);

  const handleCopy = async () => {
    const summary = [
      "[상급 아비도스 융화 재료 계산 결과]",
      `최대 제작 가능: ${format(result.maxCraft)}개`,
      "",
      "추천 교환 순서:",
      ...(steps.length > 0 ? steps.map((step, i) => `${i + 1}. ${step.text}`) : ["- 교환 불필요"]),
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
              보유 중인 아비도스 목재, 부드러운 목재, 목재, 튼튼한 목재를 입력하면 교환을 어떻게 해야 상급 아비도스
              융화 재료를 가장 많이 만들 수 있는지 바로 계산해준다.
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
                <p>상급 아비도스 융화 재료 1개 = 아비도스 목재 43 + 부드러운 목재 59 + 목재 112</p>
                <p>튼튼한 목재 5 → 목재 50</p>
                <p>부드러운 목재 25 → 목재 50</p>
                <p>목재 100 → 벌목의 가루 80</p>
                <p>부드러운 목재 50 → 벌목의 가루 80</p>
                <p>벌목의 가루 100 → 아비도스 목재 10</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl backdrop-blur sm:p-6">
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <h2 className="text-xl font-semibold">계산 결과</h2>
                <p className="mt-1 text-sm text-zinc-400">현재 입력 기준 최적 교환식</p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
              >
                교환식 복사
              </button>
            </div>

            {copied && (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                복사 완료! 계산 결과를 클립보드에 저장했어요.
              </div>
            )}

            <div className="mb-4 rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-amber-500/10 p-5 text-center shadow-lg shadow-emerald-900/20">
              <div className="text-xs tracking-wide text-emerald-200">최대 제작 가능 개수</div>
              <div className="mt-2 text-5xl font-extrabold leading-none text-emerald-100 sm:text-6xl">
                {format(result.maxCraft)}
                <span className="ml-1 text-2xl text-amber-300 sm:text-3xl">개</span>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-200">추천 교환 순서</div>
                <div className="space-y-2">
                  {steps.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                      교환 없이도 현재 제작 가능한 상태예요.
                    </div>
                  ) : (
                    steps.map((step, index) => (
                      <div key={step.key} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm">
                          {step.icon}
                        </span>
                        <div className="text-sm text-zinc-200">
                          <span className="mr-2 font-semibold text-amber-300">{index + 1}단계</span>
                          {step.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

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
