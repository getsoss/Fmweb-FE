import { NextRequest, NextResponse } from "next/server";
import { createBackendSession, parseJson } from "../backend";

type NewsResponse = {
  errno: number;
  result: [string, string, string][];
};

export async function GET(requestUrl: NextRequest) {
  const query = requestUrl.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (!query || query.length > 100) {
    return NextResponse.json({ message: "종목명은 1자 이상 100자 이하여야 합니다." }, { status: 400 });
  }

  try {
    const session = await createBackendSession(requestUrl);
    const upstream = await session.call(`/news?query=${encodeURIComponent(query)}`);
    if (upstream.status === 401) return session.finish(NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 }));
    if (upstream.status !== 200) throw new Error(`외부 API 오류 (${upstream.status})`);
    const response = parseJson<NewsResponse>(upstream);
    if (response.errno !== 0) throw new Error("뉴스를 반환하지 못했습니다.");
    return session.finish(NextResponse.json({ result: Array.isArray(response.result) ? response.result : [] }));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "뉴스를 불러오지 못했습니다." }, { status: 502 });
  }
}
