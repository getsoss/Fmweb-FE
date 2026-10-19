import { NextRequest } from "next/server";
import { isRecord, isStockCode, proxyUserData } from "../user-data";

export function GET(request: NextRequest) {
  return proxyUserData(request, "/alarm-price", "GET");
}

export function PUT(request: NextRequest) {
  return proxyUserData(request, "/alarm-price", "PUT", value => {
    if (!isRecord(value) || !isRecord(value.alarm_prices) || !["add", "delete"].includes(String(value.mode))) return false;
    const entries = Object.entries(value.alarm_prices);
    return entries.length > 0 && entries.every(([code, price]) =>
      isStockCode(code) && typeof price === "number" && Number.isFinite(price) &&
      (value.mode === "delete" ? price === 0 : price > 0),
    );
  });
}
