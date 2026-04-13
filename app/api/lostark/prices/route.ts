import { NextResponse } from "next/server";

const LOSTARK_API_BASE = "https://developer-lostark.game.onstove.com";

type MarketItem = {
  Name: string;
  CurrentMinPrice: number;
};

async function fetchMarketItems(body: Record<string, unknown>) {
  const apiKey = process.env.LOSTARK_API_KEY;

  if (!apiKey) {
    throw new Error("LOSTARK_API_KEY가 설정되지 않았습니다.");
  }

  const res = await fetch(`${LOSTARK_API_BASE}/markets/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      authorization: `bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lost Ark API 요청 실패: ${res.status} ${text}`);
  }

  return res.json();
}

function findPrice(items: MarketItem[], name: string) {
  return items.find((item) => item.Name === name)?.CurrentMinPrice ?? 0;
}

export async function GET() {
  try {
    const [woodData, fusionData] = await Promise.all([
      fetchMarketItems({
        Sort: "GRADE",
        CategoryCode: 90300,
        CharacterClass: "",
        ItemTier: null,
        ItemGrade: "",
        ItemName: "",
        PageNo: 1,
        SortCondition: "ASC",
      }),
      fetchMarketItems({
        Sort: "GRADE",
        CategoryCode: 50010,
        CharacterClass: "",
        ItemTier: null,
        ItemGrade: "",
        ItemName: "아비도스 융화",
        PageNo: 1,
        SortCondition: "ASC",
      }),
    ]);

    const woodItems = (woodData?.Items ?? []) as MarketItem[];
    const fusionItems = (fusionData?.Items ?? []) as MarketItem[];

    return NextResponse.json({
      wood: findPrice(woodItems, "목재"),
      soft: findPrice(woodItems, "부드러운 목재"),
      sturdy: findPrice(woodItems, "튼튼한 목재"),
      abydosWood: findPrice(woodItems, "아비도스 목재"),
      normalFusion: findPrice(fusionItems, "아비도스 융화 재료"),
      advancedFusion: findPrice(fusionItems, "상급 아비도스 융화 재료"),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}