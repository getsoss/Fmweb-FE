import { NextRequest, NextResponse } from "next/server";
import { request as httpsRequest } from "node:https";
import { rootCertificates } from "node:tls";
import { LETS_ENCRYPT_YR_CHAIN } from "../letsencrypt-yr-chain";

function requiredEnv(name:string){const value=process.env[name];if(!value)throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);return value;}
const AUTH_API_BASE_URL = requiredEnv("AUTH_API_BASE_URL");
const ACCESS_COOKIE = requiredEnv("AUTH_COOKIE_ACCESS_NAME");
const REFRESH_COOKIE = requiredEnv("AUTH_COOKIE_REFRESH_NAME");

type RouteConfig = { method: "GET" | "POST"; upstream: string; upstreamMethod?: "GET" | "POST"; protected?: boolean };
const routes: Record<string, RouteConfig> = {
  login: { method: "POST", upstream: requiredEnv("AUTH_PATH_LOGIN") },
  logout: { method: "POST", upstream: requiredEnv("AUTH_PATH_LOGOUT"), upstreamMethod: "GET", protected: true },
  "cert/mail": { method: "POST", upstream: requiredEnv("AUTH_PATH_CERT_MAIL") },
  "cert/check": { method: "POST", upstream: requiredEnv("AUTH_PATH_CERT_CHECK") },
  join: { method: "POST", upstream: requiredEnv("AUTH_PATH_JOIN") },
  me: { method: "GET", upstream: requiredEnv("AUTH_PATH_USER_INFO"), protected: true },
  subscription: { method: "GET", upstream: requiredEnv("AUTH_PATH_SUBSCRIPTION"), protected: true },
  withdraw: { method: "POST", upstream: requiredEnv("AUTH_PATH_WITHDRAW"), upstreamMethod: "GET", protected: true },
  password: { method: "POST", upstream: requiredEnv("AUTH_PATH_PASSWORD") },
  terms: { method: "GET", upstream: requiredEnv("AUTH_PATH_TERMS_LIST") },
  agreements: { method: "GET", upstream: requiredEnv("AUTH_PATH_AGREEMENTS"), protected: true },
  agree: { method: "POST", upstream: requiredEnv("AUTH_PATH_AGREE"), protected: true },
};

function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge, priority: "high" as const };
}

type UpstreamResponse = { status: number; ok: boolean; text: () => Promise<string> };
function requestAuthServer(path: string, method: "GET" | "POST", body?: string, headers: Record<string,string> = {}): Promise<UpstreamResponse> {
  return new Promise((resolve,reject)=>{
    const url=new URL(path,AUTH_API_BASE_URL);
    const call=httpsRequest(url,{method,rejectUnauthorized:true,ca:[...rootCertificates,LETS_ENCRYPT_YR_CHAIN],headers:{Accept:"application/json","User-Agent":"ForceMonitor-Web/1.0",...headers}},response=>{
      let responseBody="";response.setEncoding("utf8");response.on("data",chunk=>{responseBody+=chunk});response.on("end",()=>{const status=response.statusCode??502;resolve({status,ok:status>=200&&status<300,text:async()=>responseBody});});
    });
    call.setTimeout(10_000,()=>call.destroy(new Error("인증 서버 요청 시간이 초과되었습니다.")));call.on("error",reject);if(body)call.write(body);call.end();
  });
}

async function upstream(path: string, method: "GET" | "POST", body?: unknown, accessToken?: string) {
  const headers:Record<string,string>={};
  if(body!==undefined)headers["Content-Type"]="application/json";
  if(accessToken)headers.Authorization=`Bearer ${accessToken}`;
  return requestAuthServer(path,method,body===undefined?undefined:JSON.stringify(body),headers);
}

async function refreshAccessToken(refreshToken: string) {
  const response = await requestAuthServer(requiredEnv("AUTH_PATH_TOKEN"),"POST",refreshToken,{"Content-Type":"text/plain",Accept:"text/plain"});
  if (!response.ok) return null;
  const token = (await response.text()).trim().replace(/^"|"$/g, "");
  return token || null;
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }, method: "GET" | "POST") {
  const { path } = await context.params;
  const key = path.join("/");
  const termsMatch = key.match(/^terms\/(\d+)$/);
  const config = termsMatch ? { method: "GET" as const, upstream: `${requiredEnv("AUTH_PATH_TERMS_INFO")}?termsId=${termsMatch[1]}` } : routes[key];
  if (!config || config.method !== method) return NextResponse.json({ message: "지원하지 않는 인증 요청입니다." }, { status: 404 });
  const origin=request.headers.get("origin");
  if(method==="POST"&&origin&&origin!==request.nextUrl.origin)return NextResponse.json({message:"허용되지 않은 출처입니다."},{status:403});

  let body: unknown;
  if (method === "POST" && request.headers.get("content-type")?.includes("application/json")) {
    try { body = await request.json(); } catch { return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  }

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (config.protected && !accessToken && refreshToken) accessToken = await refreshAccessToken(refreshToken) ?? undefined;
  if (config.protected && !accessToken) return NextResponse.json({ status: 401, message: "로그인이 필요합니다." }, { status: 401 });

  try {
    const upstreamMethod=config.upstreamMethod??method;
    let response = await upstream(config.upstream, upstreamMethod, body, accessToken);
    if (config.protected && response.status === 401 && refreshToken) {
      accessToken = await refreshAccessToken(refreshToken) ?? undefined;
      if (accessToken) response = await upstream(config.upstream, upstreamMethod, body, accessToken);
    }
    const text = await response.text();
    let payload: Record<string, unknown> | string;
    try { payload = JSON.parse(text) as Record<string, unknown>; } catch { payload = text; }

    if (key === "login" && typeof payload === "object" && payload !== null && payload.status === 200) {
      const user = payload.user as Record<string, unknown> | undefined;
      const token = typeof user?.token === "string" ? user.token : "";
      const nextRefresh = typeof user?.refreshToken === "string" ? user.refreshToken : "";
      const safeUser = user ? { ...user, token: undefined, refreshToken: undefined } : undefined;
      const result = NextResponse.json({ ...payload, user: safeUser });
      if (token) result.cookies.set(ACCESS_COOKIE, token, cookieOptions(10 * 60));
      if (nextRefresh) result.cookies.set(REFRESH_COOKIE, nextRefresh, cookieOptions(240 * 60 * 60));
      return result;
    }

    const result = typeof payload === "string"
      ? new NextResponse(payload, { status: response.status, headers: { "Content-Type": "text/plain; charset=utf-8" } })
      : NextResponse.json(payload, { status: response.status });
    if (accessToken && accessToken !== request.cookies.get(ACCESS_COOKIE)?.value) result.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(10 * 60));
    if (key === "logout" || (key === "withdraw" && typeof payload === "object" && payload.status === 200)) {
      result.cookies.delete(ACCESS_COOKIE); result.cookies.delete(REFRESH_COOKIE);
    }
    return result;
  } catch {
    return NextResponse.json({ message: "인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return handle(request, context, "GET"); }
export function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return handle(request, context, "POST"); }
