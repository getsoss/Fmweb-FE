import { NextRequest } from "next/server";
import { proxyUserData } from "../user-data";

export function GET(request: NextRequest) {
  return proxyUserData(request, "/watchlist-max", "GET");
}
