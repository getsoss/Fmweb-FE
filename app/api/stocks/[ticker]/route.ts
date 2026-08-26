import { NextResponse } from "next/server";
import { get } from "node:https";
import { rootCertificates } from "node:tls";
import { LETS_ENCRYPT_YR_CHAIN } from "../../auth/letsencrypt-yr-chain";

const API_BASE_URL = process.env.API_BASE_URL;

type ApiResult<T> = { errno: number; result: T };
type ExistsResult = { result: boolean };

const SERIES = {
  candles: "/modified-candles",
  holdings: "/bojong",
  averageTradePrices: "/modified-average-trade-price",
  holdingChanges: "/modified-have",
  power: "/power",
  direction: "/direction",
  rs: "/rs",
} as const;

async function request<T>(path: string): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL 환경변수가 설정되지 않았습니다.");
  }

  return new Promise((resolve, reject) => {
    // The upstream omits part of its certificate chain. Keep this exception
    // scoped to the configured API host; user input is only used as a query value.
    const url = new URL(path.replace(/^\/+/, ""), `${API_BASE_URL.replace(/\/+$/, "")}/`);
    const call = get(url, { rejectUnauthorized: true, ca: [...rootCertificates, LETS_ENCRYPT_YR_CHAIN], headers: { Accept: "application/json", "User-Agent": "ForceMonitor-Web/1.0" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`외부 API 오류 (${response.statusCode ?? "unknown"})`));
          return;
        }
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          reject(new Error("외부 API 응답을 해석하지 못했습니다."));
        }
      });
    });
    call.setTimeout(10_000, () => call.destroy(new Error("외부 API 요청 시간이 초과되었습니다.")));
    call.on("error", reject);
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await context.params;

  if (!/^\d{6}$/.test(ticker)) {
    return NextResponse.json({ message: "종목코드는 숫자 6자리여야 합니다." }, { status: 400 });
  }

  try {
    const exists = await request<ExistsResult>(`/ticker-exists?ticker=${ticker}`);
    if (!exists.result) {
      return NextResponse.json({ message: "존재하지 않는 종목코드입니다." }, { status: 404 });
    }

    const entries = await Promise.all(Object.entries(SERIES).map(async ([key, path]) => {
      try {
        const response = await request<ApiResult<number[][]>>(`${path}?ticker=${ticker}`);
        return [key, response.errno === 0 && Array.isArray(response.result) ? response.result : []] as const;
      } catch {
        return [key, []] as const;
      }
    }));
    const series = Object.fromEntries(entries) as Record<keyof typeof SERIES, number[][]>;

    if (!series.candles.length) throw new Error("주가 데이터를 반환하지 못했습니다.");
    return NextResponse.json({ ticker, ...series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
