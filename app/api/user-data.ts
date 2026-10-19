import { NextRequest, NextResponse } from "next/server";
import { createBackendSession, parseJson } from "./backend";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export const isStockCode = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9]{6}$/.test(value);

export async function proxyUserData(request: NextRequest, path: string, method: "GET" | "PUT", validate?: (value: unknown) => boolean) {
  try {
    const origin = request.headers.get("origin");
    if (method === "PUT" && origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ message: "허용되지 않은 출처입니다." }, { status: 403 });
    }
    let value: unknown;
    if (method === "PUT") {
      try { value = await request.json(); }
      catch { return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
    }
    if (validate && !validate(value)) return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    const session = await createBackendSession(request);
    const upstream = await session.call(path, method, value);
    let payload: unknown;
    // Mutation endpoints specify HTTP success, not a JSON response body.
    if (upstream.body.trim() && upstream.status !== 204 && (method === "GET" || upstream.status >= 400)) {
      try { payload = parseJson<unknown>(upstream); }
      catch (error) {
        if (upstream.status < 400) throw error;
        payload = { message: `서버 요청에 실패했습니다. (${upstream.status})` };
      }
    }
    const response = payload !== undefined
      ? NextResponse.json(payload, { status: upstream.status })
      : new NextResponse(null, { status: upstream.status });
    response.headers.set("Cache-Control", "private, no-store");
    return session.finish(response);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "서버에 연결하지 못했습니다." }, { status: 502 });
  }
}
