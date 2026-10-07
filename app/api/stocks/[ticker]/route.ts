import { NextRequest, NextResponse } from "next/server";
import { createBackendSession, parseJson } from "../../backend";

type ApiResult<T> = { errno: number; result: T };
type ExistsResult = { result: boolean };

const SERIES = {
  candles: "/modified-candles",
  holdings: "/bojong",
  holdingChanges: "/modified-have",
  power: "/power",
  direction: "/direction",
  rs: "/rs",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await context.params;

  if (!/^\d{6}$/.test(ticker)) {
    return NextResponse.json({ message: "종목코드는 숫자 6자리여야 합니다." }, { status: 400 });
  }

  try {
    const session = await createBackendSession(request);
    const existsResponse = await session.call(`/ticker-exists?ticker=${ticker}`);
    if (existsResponse.status === 401) return session.finish(NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 }));
    if (existsResponse.status !== 200) throw new Error(`외부 API 오류 (${existsResponse.status})`);
    const exists = parseJson<ExistsResult>(existsResponse);
    if (!exists.result) {
      return NextResponse.json({ message: "존재하지 않는 종목코드입니다." }, { status: 404 });
    }

    const entries = await Promise.all(Object.entries(SERIES).map(async ([key, path]) => {
      try {
        const upstream = await session.call(`${path}?ticker=${ticker}`);
        if (upstream.status !== 200) throw new Error(`외부 API 오류 (${upstream.status})`);
        const response = parseJson<ApiResult<number[][]>>(upstream);
        return [key, response.errno === 0 && Array.isArray(response.result) ? response.result : []] as const;
      } catch {
        return [key, []] as const;
      }
    }));
    const series = Object.fromEntries(entries) as Record<keyof typeof SERIES, number[][]>;

    if (!series.candles.length) throw new Error("주가 데이터를 반환하지 못했습니다.");
    return session.finish(NextResponse.json({ ticker, ...series }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
