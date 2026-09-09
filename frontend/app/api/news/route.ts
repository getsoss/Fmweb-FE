import { NextRequest, NextResponse } from "next/server";
import { get } from "node:https";
import { rootCertificates } from "node:tls";
import { LETS_ENCRYPT_YR_CHAIN } from "../auth/letsencrypt-yr-chain";

const API_BASE_URL = process.env.API_BASE_URL;

type NewsResponse = {
  errno: number;
  result: [string, string, string][];
};

function request(path: string): Promise<NewsResponse> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) return reject(new Error("API_BASE_URL 환경변수가 설정되지 않았습니다."));
    const url = new URL(path.replace(/^\/+/, ""), `${API_BASE_URL.replace(/\/+$/, "")}/`);
    const call = get(url, {
      rejectUnauthorized: true,
      ca: [...rootCertificates, LETS_ENCRYPT_YR_CHAIN],
      headers: { Accept: "application/json", "User-Agent": "ForceMonitor-Web/1.0" },
    }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) return reject(new Error(`외부 API 오류 (${response.statusCode ?? "unknown"})`));
        try {
          resolve(JSON.parse(body) as NewsResponse);
        } catch {
          reject(new Error("외부 API 응답을 해석하지 못했습니다."));
        }
      });
    });
    call.setTimeout(10_000, () => call.destroy(new Error("외부 API 요청 시간이 초과되었습니다.")));
    call.on("error", reject);
  });
}

export async function GET(requestUrl: NextRequest) {
  const query = requestUrl.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (!query || query.length > 100) {
    return NextResponse.json({ message: "종목명은 1자 이상 100자 이하여야 합니다." }, { status: 400 });
  }

  try {
    const response = await request(`/news?query=${encodeURIComponent(query)}`);
    if (response.errno !== 0) throw new Error("뉴스를 반환하지 못했습니다.");
    return NextResponse.json({ result: Array.isArray(response.result) ? response.result : [] });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "뉴스를 불러오지 못했습니다." }, { status: 502 });
  }
}
