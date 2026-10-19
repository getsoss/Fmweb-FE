import { NextRequest } from "next/server";
import { proxyUserData } from "../user-data";

export function GET(request: NextRequest) {
  return proxyUserData(request, "/current-price", "GET");
}
