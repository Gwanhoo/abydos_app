"use client";

import { useEffect, useMemo, useState } from "react";

type Materials = {
  abydos: number;
  soft: number;
  wood: number;
  sturdy: number;
};

type RecipeKey = "normal" | "advanced";

type Recipe = {
  key: RecipeKey;
  title: string;
  abydos: number;
  soft: number;
  wood: number;
  craftFeePerSet: number; // 완성품 10개 기준
};

type Plan = {
  maxCraft: number; // 완성품 세트 수 (1세트 = 10개)
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

type Prices = {
  wood: number; // 100개 묶음 최저가
  soft: number; // 100개 묶음 최저가
  sturdy: number; // 100개 묶음 최저가
  abydosWood: number; // 100개 묶음 최저가
  normalFusion: number; // 1개 최저가
  advancedFusion: number; // 1개 최저가
};

type Economy = {
  rawSellValue: number;
  craftedCount: number;
  craftedSellValue: number;
  craftFee: number;
  leftoversSellValue: number;
  finalCraftValue: number;
  diff: number;
  isProfit: boolean;
};

type ConversionCheck = {
  label: string;
  fromValue: number;
  toValue: number;
  diff: number;
  isProfit: boolean;
};

const SELL_FEE_RATE = 0.05;
const MATERIAL_BUNDLE_SIZE = 100;
const PRODUCT_COUNT_PER_SET = 10;

const RECIPES: Record<RecipeKey, Recipe> = {
  normal: {
    key: "normal",
    title: "아비도스 융화 재료",
    abydos: 33,
    soft: 45,
    wood: 86,
    craftFeePerSet: 400,
  },
  advanced: {
    key: "advanced",
    title: "상급 아비도스 융화 재료",
    abydos: 43,
    soft: 59,
    wood: 112,
    craftFeePerSet: 520,
  },
};

function applyCraftFeeDiscount(baseFee: number, discountPercent: number) {
  const safeDiscount = Math.max(0, Math.min(discountPercent, 100));
  return Math.floor(baseFee * (1 - safeDiscount / 100));
}

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

function applySellFee(value: number) {
  return Math.floor(value * (1 - SELL_FEE_RATE));
}

// 재료 판매는 100개 단위만 가능
function bundledSellValue(quantity: number, bundlePrice: number) {
  const sellableBundles = Math.floor(quantity / MATERIAL_BUNDLE_SIZE);
  return applySellFee(sellableBundles * bundlePrice);
}

// 교환 손익 체크용 비례 가치
function proportionalValue(quantity: number, bundlePrice: number) {
  return (quantity / MATERIAL_BUNDLE_SIZE) * bundlePrice;
}

function canCraftWithPlan(
  input: Materials,
  targetSets: number,
  recipe: Recipe,
): Plan | null {
  const needA = recipe.abydos * targetSets;
  const needS = recipe.soft * targetSets;
  const needW = recipe.wood * targetSets;

  const sturdyToWood = Math.floor(input.sturdy / 5);
  const sturdyLeft = input.sturdy % 5;
  const baseWood = input.wood + sturdyToWood * 50;

  let best: Plan | null = null;

  const abydosDeficit = Math.max(0, needA - input.abydos);
  const fixedPowderToAbydos = ceilDiv(abydosDeficit, 10);

  const baseSoft = input.soft;
  const minPowderToSoft = ceilDiv(Math.max(0, needS - baseSoft), 50);
  const maxPowderToSoft = minPowderToSoft + 12;

  for (
    let powderToSoft = minPowderToSoft;
    powderToSoft <= maxPowderToSoft;
    powderToSoft += 1
  ) {
    const softFromPowder = powderToSoft * 50;
    const totalSoftPool = baseSoft + softFromPowder;

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
        best.powderToSoft * 10_000 + best.softToWood * 100 + best.woodToPowder;

      const candidateScore =
        candidate.powderToSoft * 10_000 +
        candidate.softToWood * 100 +
        candidate.woodToPowder;

      const bestLeftoverSum =
        best.leftovers.abydos +
        best.leftovers.soft +
        best.leftovers.wood +
        best.powderLeft;
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

function calculatePlan(input: Materials, recipe: Recipe): Plan {
  const sturdyToWood = Math.floor(input.sturdy / 5);
  const sturdyLeft = input.sturdy % 5;
  const baseWood = input.wood + sturdyToWood * 50;

  const upperBound =
    Math.floor(
      (input.abydos +
        Math.floor((baseWood * 2) / 25) +
        Math.floor(input.soft / 5)) /
        Math.max(1, recipe.abydos),
    ) + 300;

  let best: Plan | null = null;

  for (let targetSets = 0; targetSets <= upperBound; targetSets += 1) {
    const candidate = canCraftWithPlan(input, targetSets, recipe);
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

function calculateEconomy(
  materials: Materials,
  result: Plan,
  recipe: Recipe,
  prices: Prices,
): Economy {
  const rawSellValue =
    bundledSellValue(materials.abydos, prices.abydosWood) +
    bundledSellValue(materials.soft, prices.soft) +
    bundledSellValue(materials.wood, prices.wood) +
    bundledSellValue(materials.sturdy, prices.sturdy);

  const craftedCount = result.crafted * PRODUCT_COUNT_PER_SET;
  const itemPrice =
    recipe.key === "normal" ? prices.normalFusion : prices.advancedFusion;

  const craftedSellValue = applySellFee(craftedCount * itemPrice);
  const craftFee = result.crafted * recipe.craftFeePerSet;

  const leftoversSellValue =
    bundledSellValue(result.leftovers.abydos, prices.abydosWood) +
    bundledSellValue(result.leftovers.soft, prices.soft) +
    bundledSellValue(result.leftovers.wood, prices.wood) +
    bundledSellValue(result.leftovers.sturdy, prices.sturdy);

  const finalCraftValue = craftedSellValue - craftFee + leftoversSellValue;
  const diff = finalCraftValue - rawSellValue;

  return {
    rawSellValue,
    craftedCount,
    craftedSellValue,
    craftFee,
    leftoversSellValue,
    finalCraftValue,
    diff,
    isProfit: diff >= 0,
  };
}

function getConversionChecks(prices: Prices): ConversionCheck[] {
  const sturdyToWoodFrom = proportionalValue(5, prices.sturdy);
  const sturdyToWoodTo = proportionalValue(50, prices.wood);

  const softToWoodFrom = proportionalValue(25, prices.soft);
  const softToWoodTo = proportionalValue(50, prices.wood);

  const woodToAbydosFrom = proportionalValue(100, prices.wood);
  const woodToAbydosTo = proportionalValue(10, prices.abydosWood);

  const woodToSoftFrom = proportionalValue(100, prices.wood);
  const woodToSoftTo = proportionalValue(50, prices.soft);

  return [
    {
      label: "튼튼한 목재 5 → 목재 50",
      fromValue: sturdyToWoodFrom,
      toValue: sturdyToWoodTo,
      diff: sturdyToWoodTo - sturdyToWoodFrom,
      isProfit: sturdyToWoodTo >= sturdyToWoodFrom,
    },
    {
      label: "부드러운 목재 25 → 목재 50",
      fromValue: softToWoodFrom,
      toValue: softToWoodTo,
      diff: softToWoodTo - softToWoodFrom,
      isProfit: softToWoodTo >= softToWoodFrom,
    },
    {
      label: "목재 100 → 벌목의 가루 80 → 아비도스 목재 10",
      fromValue: woodToAbydosFrom,
      toValue: woodToAbydosTo,
      diff: woodToAbydosTo - woodToAbydosFrom,
      isProfit: woodToAbydosTo >= woodToAbydosFrom,
    },
    {
      label: "목재 100 → 벌목의 가루 80 → 부드러운 목재 50",
      fromValue: woodToSoftFrom,
      toValue: woodToSoftTo,
      diff: woodToSoftTo - woodToSoftFrom,
      isProfit: woodToSoftTo >= woodToSoftFrom,
    },
  ];
}

export default function Page() {
  const [target, setTarget] = useState<RecipeKey>("advanced");
  const [form, setForm] = useState({
    abydos: "0",
    soft: "0",
    wood: "0",
    sturdy: "0",
  });
  const [craftFeeDiscount, setCraftFeeDiscount] = useState("0");
  const [copied, setCopied] = useState(false);
  const [showPowderPlan, setShowPowderPlan] = useState(true);
  const [showMarketPlan, setShowMarketPlan] = useState(true);
  const [prices, setPrices] = useState<Prices>({
    wood: 104,
    soft: 206,
    sturdy: 1030,
    abydosWood: 1294,
    normalFusion: 99,
    advancedFusion: 130,
  });
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [priceError, setPriceError] = useState("");

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

  useEffect(() => {
    async function loadPrices() {
      try {
        setIsLoadingPrices(true);
        setPriceError("");

        const res = await fetch("/api/lostark/prices", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message ?? "시세를 불러오지 못했습니다.");
        }

        const data = await res.json();
        setPrices(data);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "시세를 불러오지 못했습니다.";
        setPriceError(message);
      } finally {
        setIsLoadingPrices(false);
      }
    }

    loadPrices();

    const interval = setInterval(() => {
      loadPrices();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const materials = useMemo<Materials>(
    () => ({
      abydos: toInt(form.abydos),
      soft: toInt(form.soft),
      wood: toInt(form.wood),
      sturdy: toInt(form.sturdy),
    }),
    [form],
  );

  const recipe = useMemo(() => {
    const base = RECIPES[target];
    const discount = toInt(craftFeeDiscount);

    return {
      ...base,
      craftFeePerSet: applyCraftFeeDiscount(base.craftFeePerSet, discount),
    };
  }, [target, craftFeeDiscount]);

  const result = useMemo(
    () => calculatePlan(materials, recipe),
    [materials, recipe],
  );
  const economy = useMemo(
    () => calculateEconomy(materials, result, recipe, prices),
    [materials, result, recipe, prices],
  );
  const conversionChecks = useMemo(() => getConversionChecks(prices), [prices]);

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
        result.sturdyToWood * 50,
      )}개`,
      sub: `교환 횟수: ${format(result.sturdyToWood)}번 (5 → 50)`,
    },
    {
      key: "softToWood",
      show: result.softToWood > 0,
      text: `부드러운 목재 ${format(result.softToWood * 25)}개 → 목재 ${format(
        result.softToWood * 50,
      )}개`,
      sub: `교환 횟수: ${format(result.softToWood)}번 (25 → 50)`,
    },
    {
      key: "woodToPowder",
      show: result.woodToPowder > 0,
      text: `목재 ${format(result.woodToPowder * 100)}개 → 벌목의 가루 ${format(
        result.woodToPowder * 80,
      )}개`,
      sub: `교환 횟수: ${format(result.woodToPowder)}번 (100 → 80)`,
    },
    {
      key: "powderToAbydos",
      show: result.powderToAbydos > 0,
      text: `벌목의 가루 ${format(result.powderToAbydos * 100)}개 → 아비도스 목재 ${format(
        result.powderToAbydos * 10,
      )}개`,
      sub: `교환 횟수: ${format(result.powderToAbydos)}번 (100 → 10)`,
    },
    {
      key: "powderToSoft",
      show: result.powderToSoft > 0,
      text: `벌목의 가루 ${format(result.powderToSoft * 100)}개 → 부드러운 목재 ${format(
        result.powderToSoft * 50,
      )}개`,
      sub: `교환 횟수: ${format(result.powderToSoft)}번 (100 → 50)`,
    },
    {
      key: "crafted",
      show: result.crafted > 0,
      text: `${recipe.title} ${format(result.crafted * PRODUCT_COUNT_PER_SET)}개 제작`,
    },
  ].filter((step) => step.show);

  const nextSoftShortage = Math.max(0, recipe.soft - result.leftovers.soft);
  const nextMarketSets = ceilDiv(nextSoftShortage, 100);
  const nextMarketBought = nextMarketSets * 100;
  const nextPowderToSoft = ceilDiv(nextSoftShortage, 50);
  const nextPowderUsed = nextPowderToSoft * 100;
  const nextSoftMade = nextPowderToSoft * 50;

  const handleCopy = async () => {
    const summary = [
      `[${recipe.title} 계산 결과]`,
      `최대 제작 가능: ${format(result.maxCraft * PRODUCT_COUNT_PER_SET)}개 (${format(result.maxCraft)}세트)`,
      "",
      "추천 교환 순서:",
      ...(steps.length > 0
        ? steps.map((step, i) => `${i + 1}. ${step.text}`)
        : ["- 제작 불가"]),
      "",
      `재료 판매 가치: ${format(economy.rawSellValue)} 골드`,
      `제작 후 판매 가치: ${format(economy.finalCraftValue)} 골드`,
      `${economy.isProfit ? "제작이 더 이득" : "재료 판매가 더 이득"}: ${economy.diff >= 0 ? "+" : ""}${format(economy.diff)} 골드`,
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
              최대 제작 가이드 + 손익 체크
            </h1>

            <p className="max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              기존 최대 제작 수량과 교환 순서는 유지하고, 최저가 기준으로 재료
              판매가 유리한지 제작 후 판매가 유리한지만 함께 보여줍니다.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTarget("normal")}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  target === "normal"
                    ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300"
                }`}
              >
                아비도스
              </button>

              <button
                type="button"
                onClick={() => setTarget("advanced")}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  target === "advanced"
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300"
                }`}
              >
                상급 아비도스
              </button>
            </div>

            {isLoadingPrices ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
                시세 불러오는 중...
              </div>
            ) : priceError ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {priceError}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="text-xs text-zinc-400">목재 (100개)</div>
                  <div className="mt-1 text-lg font-semibold">
                    {format(prices.wood)} 골드
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="text-xs text-zinc-400">
                    부드러운 목재 (100개)
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {format(prices.soft)} 골드
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="text-xs text-zinc-400">
                    튼튼한 목재 (100개)
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {format(prices.sturdy)} 골드
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="text-xs text-zinc-400">
                    아비도스 목재 (100개)
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {format(prices.abydosWood)} 골드
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="text-xs text-zinc-400">
                    아비도스 융화 재료 (1개)
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {format(prices.normalFusion)} 골드
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="text-xs text-zinc-400">
                    상급 아비도스 융화 재료 (1개)
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {format(prices.advancedFusion)} 골드
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="grid items-start gap-4 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl backdrop-blur sm:p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">재료 입력</h2>

                <div className="mt-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-zinc-300">
                      제작 수수료 감소 (%)
                    </span>
                    <input
                      inputMode="numeric"
                      value={format(toInt(craftFeeDiscount))}
                      onChange={(e) =>
                        setCraftFeeDiscount(parseFormatted(e.target.value))
                      }
                      placeholder="예: 17"
                      className="h-12 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                </div>

                <p className="mt-2 text-sm text-zinc-400">
                  숫자를 입력하면 결과가 바로 갱신됩니다.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {rows.map((row) => (
                  <label key={row.key} className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-zinc-300">
                      {row.label}
                    </span>
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

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm text-zinc-400">
                <div className="mb-3 text-base font-semibold text-zinc-100">
                  현재 기준 공식
                </div>

                <div className="space-y-2 leading-8">
                  <p>
                    상급 아비도스 융화 재료 1세트(10개) = 아비도스 목재 43 +
                    부드러운 목재 59 + 목재 112
                  </p>
                  <p>기본 제작 수수료: 520 골드 / 세트</p>
                  <p>
                    수수료 감소 적용 후: {format(recipe.craftFeePerSet)} 골드 /
                    세트
                  </p>
                  <p>벌목 재료 판매 단위: 100개</p>
                  <p>완성품 판매 단위: 1개</p>
                  <p>판매 수수료: 5%</p>
                  <p>튼튼한 목재 5 → 목재 50</p>
                  <p>부드러운 목재 25 → 목재 50</p>
                  <p>목재 100 → 벌목의 가루 80</p>
                  <p>벌목의 가루 100 → 아비도스 목재 10</p>
                  <p>벌목의 가루 100 → 부드러운 목재 50</p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="mb-4 text-base font-semibold text-zinc-100">
                  제작 후 남는 재료
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">
                      아비도스 목재
                    </div>
                    <div className="mt-2 text-2xl font-bold text-zinc-100">
                      {format(result.leftovers.abydos)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">
                      부드러운 목재
                    </div>
                    <div className="mt-2 text-2xl font-bold text-zinc-100">
                      {format(result.leftovers.soft)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">목재</div>
                    <div className="mt-2 text-2xl font-bold text-zinc-100">
                      {format(result.leftovers.wood)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">
                      튼튼한 목재
                    </div>
                    <div className="mt-2 text-2xl font-bold text-zinc-100">
                      {format(result.leftovers.sturdy)}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-zinc-500">
                  남는 벌목의 가루: {format(result.powderLeft)}개
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl backdrop-blur sm:p-6">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">계산 결과</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    기존 최대 제작 가이드 + 손익 판단
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
                >
                  결과 복사
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
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
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  복사 완료! 계산 결과를 클립보드에 저장했어요.
                </div>
              )}

              <div
                className={`rounded-2xl border p-5 sm:p-6 ${
                  economy.isProfit
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-rose-500/30 bg-rose-500/10"
                }`}
              >
                <div className="mb-4 text-base font-semibold text-zinc-100">
                  손익 판단
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">
                      재료 판매 가치
                    </div>
                    <div className="mt-2 text-2xl font-bold leading-tight text-zinc-100">
                      {format(economy.rawSellValue)} 골드
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">
                      완성품 판매 가치
                    </div>
                    <div className="mt-2 text-2xl font-bold leading-tight text-zinc-100">
                      {format(economy.craftedSellValue)} 골드
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">
                      제작 수수료
                    </div>
                    <div className="mt-2 text-2xl font-bold leading-tight text-zinc-100">
                      {format(economy.craftFee)} 골드
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="text-sm leading-6 text-zinc-400">
                      남은 재료 판매 가치
                    </div>
                    <div className="mt-2 text-2xl font-bold leading-tight text-zinc-100">
                      {format(economy.leftoversSellValue)} 골드
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="text-sm text-zinc-400">최종 비교</div>
                  <div
                    className={`mt-3 text-2xl font-extrabold leading-tight sm:text-3xl ${
                      economy.isProfit ? "text-emerald-200" : "text-rose-200"
                    }`}
                  >
                    {economy.isProfit
                      ? "제작하고 판매가 더 이득"
                      : "재료 판매가 더 이득"}
                  </div>
                  <div
                    className={`mt-2 text-xl font-bold ${
                      economy.isProfit ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {economy.diff >= 0 ? "+" : ""}
                    {format(economy.diff)} 골드
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-amber-500/10 p-5 text-center shadow-lg shadow-emerald-900/20">
                <div className="text-xs text-emerald-200">최대 제작 가능</div>
                <div className="mt-2 text-5xl font-extrabold text-emerald-100">
                  {format(result.maxCraft * PRODUCT_COUNT_PER_SET)}
                  <span className="ml-1 text-2xl text-amber-300">개</span>
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  ({format(result.maxCraft)}세트)
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-200">
                  추천 교환 순서
                </div>

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
                        <div className="leading-6">
                          <span className="mr-2 font-semibold text-amber-300">
                            {index + 1}단계
                          </span>
                          {step.text}
                        </div>

                        {"sub" in step && step.sub && (
                          <div className="mt-1 text-xs leading-5 text-zinc-400">
                            {step.sub}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-200">
                  교환 손익 체크 (최저가 기준)
                </div>

                <div className="space-y-2">
                  {conversionChecks.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm"
                    >
                      <div className="font-medium leading-6 text-zinc-200">
                        {item.label}
                      </div>
                      <div className="mt-1 leading-6 text-zinc-400">
                        교환 전 가치 {format(Math.floor(item.fromValue))} → 교환
                        후 가치 {format(Math.floor(item.toValue))}
                      </div>
                      <div
                        className={`mt-1 font-semibold ${
                          item.isProfit ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {item.isProfit ? "이득" : "손해"} (
                        {item.diff >= 0 ? "+" : ""}
                        {format(Math.floor(item.diff))} 골드)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {showPowderPlan && (
                  <div className="rounded-2xl border border-sky-500/20 bg-zinc-950/70 p-4">
                    <div className="mb-3 text-sm font-semibold text-sky-300">
                      부드러운 목재 충당 (벌목의 가루)
                    </div>

                    <div className="space-y-2 text-sm leading-6 text-zinc-300">
                      <p>
                        다음 1세트 기준 부족한 부드러운 목재:{" "}
                        {format(nextSoftShortage)}개
                      </p>
                      <p>
                        벌목의 가루 → 부드러운 목재: {format(nextPowderToSoft)}
                        회
                      </p>
                      <p>사용한 벌목의 가루: {format(nextPowderUsed)}개</p>
                      <p>확보한 부드러운 목재: {format(nextSoftMade)}개</p>

                      {nextPowderToSoft === 0 && (
                        <p className="text-xs text-zinc-500">
                          현재 남은 부드러운 목재로 다음 1세트도 바로 제작
                          가능해요.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {showMarketPlan && (
                  <div className="rounded-2xl border border-amber-500/20 bg-zinc-950/70 p-4">
                    <div className="mb-3 text-sm font-semibold text-amber-300">
                      경매장 구매
                    </div>

                    <div className="space-y-2 text-sm leading-6 text-zinc-300">
                      <p>
                        다음 1세트 기준 부족한 부드러운 목재:{" "}
                        {format(nextSoftShortage)}개
                      </p>
                      <p>구매 세트 수: {format(nextMarketSets)}세트</p>
                      <p>총 구매량: {format(nextMarketBought)}개</p>

                      {nextMarketSets === 0 && (
                        <p className="text-xs text-zinc-500">
                          현재 남은 부드러운 목재로 다음 1세트도 바로 제작
                          가능해요.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {nextMarketSets === 0 ? (
                        <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
                          구매 없음
                        </div>
                      ) : (
                        Array.from({
                          length: Math.min(nextMarketSets, 12),
                        }).map((_, index) => (
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
