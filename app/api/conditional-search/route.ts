import { NextRequest, NextResponse } from "next/server";
import { createBackendSession, parseJson } from "../backend";

async function body(request: NextRequest) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") >= 8192) throw new Error("검색 조건은 8,192바이트 미만이어야 합니다.");
  return JSON.parse(text) as unknown;
}

async function proxy(request: NextRequest, method: "GET" | "POST" | "PUT" | "DELETE") {
  try {
    const origin = request.headers.get("origin");
    if (method !== "GET" && origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "허용되지 않은 출처입니다." }, { status: 403 });
    const session = await createBackendSession(request);
    const slot = request.nextUrl.searchParams.get("slot");
    if (method === "DELETE" && (!slot || !/^[0-4]$/.test(slot))) return NextResponse.json({ message: "삭제할 검색 슬롯이 올바르지 않습니다." }, { status: 400 });
    const value = method === "POST" || method === "PUT" ? await body(request) : undefined;
    const upstream = await session.call(`/conditional-search${method === "DELETE" ? `?slot=${slot}` : ""}`, method, value);
    if (upstream.status === 204) return session.finish(new NextResponse(null, { status: 204 }));
    const payload = upstream.body ? parseJson<Record<string, unknown>>(upstream) : {};
    return session.finish(NextResponse.json(payload, { status: upstream.status }));
  } catch (error) {
    const message = error instanceof SyntaxError ? "요청 형식이 올바르지 않습니다." : error instanceof Error ? error.message : "조건검색 API에 연결하지 못했습니다.";
    return NextResponse.json({ message }, { status: error instanceof SyntaxError ? 400 : 502 });
  }
}

export function GET(request: NextRequest) { return proxy(request, "GET"); }
export function POST(request: NextRequest) { return proxy(request, "POST"); }
export function PUT(request: NextRequest) { return proxy(request, "PUT"); }
export function DELETE(request: NextRequest) { return proxy(request, "DELETE"); }
