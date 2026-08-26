import { NextRequest, NextResponse } from "next/server";
import { get } from "node:https";
import { rootCertificates } from "node:tls";
import { LETS_ENCRYPT_YR_CHAIN } from "../auth/letsencrypt-yr-chain";

const API_BASE_URL = process.env.API_BASE_URL;

function request(path: string): Promise<{ errno: number; result: [string, number][] }> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) return reject(new Error("API_BASE_URL 환경변수가 설정되지 않았습니다."));
    const url = new URL(path.replace(/^\/+/, ""), `${API_BASE_URL.replace(/\/+$/, "")}/`);
    const call = get(url, { rejectUnauthorized: true, ca: [...rootCertificates, LETS_ENCRYPT_YR_CHAIN], headers: { Accept: "application/json", "User-Agent": "ForceMonitor-Web/1.0" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) return reject(new Error(`외부 API 오류 (${response.statusCode})`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error("외부 API 응답을 해석하지 못했습니다.")); }
      });
    });
    call.setTimeout(10_000, () => call.destroy(new Error("외부 API 요청 시간이 초과되었습니다.")));
    call.on("error", reject);
  });
}

export async function GET(requestUrl: NextRequest) {
  const type = requestUrl.nextUrl.searchParams.get("type") ?? "price";
  const date = requestUrl.nextUrl.searchParams.get("date") ?? "";
  const price = requestUrl.nextUrl.searchParams.get("price") ?? "";
  const filter = requestUrl.nextUrl.searchParams.get("filter") ?? "";
  const datebegin = requestUrl.nextUrl.searchParams.get("datebegin") ?? "";
  const dateend = requestUrl.nextUrl.searchParams.get("dateend") ?? "";
  const investors = requestUrl.nextUrl.searchParams.get("investors") ?? "";

  let upstreamPath = "";
  if (type === "price") {
    if (!/^\d{8}$/.test(date)) return NextResponse.json({ message: "날짜는 YYYYMMDD 형식이어야 합니다." }, { status: 400 });
    if (!/^\d+$/.test(price) || Number(price) > 2_147_483_647) return NextResponse.json({ message: "가격은 허용 범위의 정수여야 합니다." }, { status: 400 });
    if (!/^[0-7]$/.test(filter) || filter === "0") return NextResponse.json({ message: "가격 조건을 선택해 주세요." }, { status: 400 });
    upstreamPath = `/search-by-date-and-price?date=${date}&price=${price}&filter=${filter}`;
  } else if (type === "profit") {
    if (!/^\d{8}$/.test(date)) return NextResponse.json({ message: "날짜는 YYYYMMDD 형식이어야 합니다." }, { status: 400 });
    upstreamPath = `/search-by-bojong-profit-rate?date=${date}`;
  } else if (type === "have") {
    if (!/^\d{8}$/.test(datebegin) || !/^\d{8}$/.test(dateend)) return NextResponse.json({ message: "시작일과 종료일은 YYYYMMDD 형식이어야 합니다." }, { status: 400 });
    if (datebegin > dateend) return NextResponse.json({ message: "시작일은 종료일보다 늦을 수 없습니다." }, { status: 400 });
    if (!/^\d+$/.test(investors) || Number(investors) < 1 || Number(investors) > 8191) return NextResponse.json({ message: "한 명 이상의 투자자 유형을 선택해 주세요." }, { status: 400 });
    upstreamPath = `/search-by-have?datebegin=${datebegin}&dateend=${dateend}&investors=${investors}`;
  } else {
    return NextResponse.json({ message: "지원하지 않는 검색 유형입니다." }, { status: 400 });
  }

  try {
    const response = await request(upstreamPath);
    if (response.errno !== 0) throw new Error("검색 결과를 반환하지 못했습니다.");
    return NextResponse.json({ result: response.result });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "검색에 실패했습니다." }, { status: 502 });
  }
}
