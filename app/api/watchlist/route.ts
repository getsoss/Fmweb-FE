import { NextRequest } from "next/server";
import { isRecord, isStockCode, proxyUserData } from "../user-data";

export function GET(request: NextRequest) {
  return proxyUserData(request, "/watchlist", "GET");
}

export function PUT(request: NextRequest) {
  return proxyUserData(request, "/watchlist", "PUT", value =>
    isRecord(value) && Number.isInteger(value.slot) && Number(value.slot) >= 1 && Number(value.slot) <= 5 &&
    (value.mode === "add" || value.mode === "delete") &&
    Array.isArray(value.jmcodes) && value.jmcodes.length > 0 && value.jmcodes.every(isStockCode),
  );
}
