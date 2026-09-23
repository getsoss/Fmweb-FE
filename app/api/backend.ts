import { NextRequest, NextResponse } from "next/server";
import { request as httpsRequest } from "node:https";
import { rootCertificates } from "node:tls";
import { LETS_ENCRYPT_YR_CHAIN } from "./auth/letsencrypt-yr-chain";

type Method = "GET" | "POST" | "PUT" | "DELETE";
export type BackendResponse = { status: number; body: string };

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  return value;
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge, priority: "high" as const };
}

function rawRequest(baseUrl: string, path: string, method: Method, body?: string, headers: Record<string, string> = {}): Promise<BackendResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`);
    const call = httpsRequest(url, {
      method,
      rejectUnauthorized: true,
      ca: [...rootCertificates, LETS_ENCRYPT_YR_CHAIN],
      headers: { Accept: "application/json", "User-Agent": "ForceMonitor-Web/1.0", ...headers },
    }, response => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { responseBody += chunk; });
      response.on("end", () => resolve({ status: response.statusCode ?? 502, body: responseBody }));
    });
    call.setTimeout(10_000, () => call.destroy(new Error("외부 API 요청 시간이 초과되었습니다.")));
    call.on("error", reject);
    if (body !== undefined) call.write(body);
    call.end();
  });
}

function expiresSoon(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp - Math.floor(Date.now() / 1000) <= 5 * 60;
  } catch {
    return true;
  }
}

async function refreshAccessToken(refreshToken: string) {
  const response = await rawRequest(env("AUTH_API_BASE_URL"), "/token", "POST", refreshToken, { "Content-Type": "text/plain", Accept: "text/plain" });
  if (response.status !== 200) return null;
  return response.body.trim().replace(/^"|"$/g, "") || null;
}

export async function createBackendSession(request: NextRequest) {
  const accessCookie = env("AUTH_COOKIE_ACCESS_NAME");
  const refreshCookie = env("AUTH_COOKIE_REFRESH_NAME");
  const originalAccessToken = request.cookies.get(accessCookie)?.value;
  const refreshToken = request.cookies.get(refreshCookie)?.value;
  let accessToken = originalAccessToken;

  if ((!accessToken || expiresSoon(accessToken)) && refreshToken) {
    accessToken = await refreshAccessToken(refreshToken) ?? undefined;
  }

  async function call(path: string, method: Method = "GET", value?: unknown) {
    if (!accessToken) return { status: 401, body: JSON.stringify({ message: "로그인이 필요합니다." }) };
    const body = value === undefined ? undefined : JSON.stringify(value);
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response = await rawRequest(env("API_BASE_URL"), path, method, body, headers);
    if (response.status === 401 && refreshToken) {
      accessToken = await refreshAccessToken(refreshToken) ?? undefined;
      if (accessToken) {
        response = await rawRequest(env("API_BASE_URL"), path, method, body, { ...headers, Authorization: `Bearer ${accessToken}` });
      }
    }
    return response;
  }

  function finish(response: NextResponse) {
    if (accessToken && accessToken !== originalAccessToken) response.cookies.set(accessCookie, accessToken, cookieOptions(10 * 60));
    return response;
  }

  return { call, finish };
}

export function parseJson<T>(response: BackendResponse): T {
  try { return JSON.parse(response.body) as T; }
  catch { throw new Error("외부 API 응답을 해석하지 못했습니다."); }
}
