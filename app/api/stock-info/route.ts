import { NextRequest, NextResponse } from "next/server";
import { createBackendSession, parseJson } from "../backend";

type StockInfo = {
  name: string;
  ma20_up: boolean;
  bojong_profit_rate: number;
  trading_value: number;
  _5d_avg_trading_value: number;
  ibdrs: number;
  n_top_acc: number;
};

type StockInfoResponse = {
  count: number;
  result: Record<string, StockInfo>;
};

export async function GET(request: NextRequest) {
  try {
    const session = await createBackendSession(request);
    const upstream = await session.call("/jminfo");
    if (upstream.status === 401) return session.finish(NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 }));
    if (upstream.status !== 200) throw new Error(`외부 API 오류 (${upstream.status})`);
    const response = parseJson<StockInfoResponse>(upstream);
    if (!response.result || typeof response.result !== "object" || Array.isArray(response.result)) throw new Error("종목 정보를 반환하지 못했습니다.");
    return session.finish(NextResponse.json(response));
  } catch (error) {
    const message = error instanceof Error ? error.message : "종목 정보를 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
