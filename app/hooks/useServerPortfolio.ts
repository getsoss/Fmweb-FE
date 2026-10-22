"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PriceMap = Record<string, number>;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const isCode = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9]{6}$/.test(value);
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? `${fallback} ${error.message}` : fallback;

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(isRecord(body) && typeof body.message === "string" ? body.message : `서버 응답 오류 (${response.status})`);
  return body;
}

function priceMap(body: unknown): PriceMap {
  if (!isRecord(body) || !isRecord(body.result)) throw new Error("가격 응답 형식이 올바르지 않습니다.");
  const entries = Object.entries(body.result);
  if (!entries.every(([code, price]) => isCode(code) && typeof price === "number" && Number.isFinite(price) && price >= 0)) {
    throw new Error("가격 응답 형식이 올바르지 않습니다.");
  }
  return Object.fromEntries(entries) as PriceMap;
}

// Current prices change daily. Share one attempt for this document, including
// in-flight requests and failures, across retries and workspace remounts.
let currentPricesRequest: Promise<PriceMap> | undefined;
function loadCurrentPrices() {
  return currentPricesRequest ??= request("/api/current-price").then(priceMap);
}

export function useServerPortfolio() {
  const [watchlists, setWatchlists] = useState<string[][]>([[], [], [], [], []]);
  const [watchLimit, setWatchLimit] = useState<number | null>(null);
  const [watchLoaded, setWatchLoaded] = useState(false);
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchError, setWatchError] = useState("");
  const [savedAlarmPrices, setSavedAlarmPrices] = useState<PriceMap>({});
  // Search-only alarms belong to this mounted workspace, never browser storage.
  const [sessionAlarmPrices, setSessionAlarmPrices] = useState<PriceMap>({});
  const [currentPrices, setCurrentPrices] = useState<PriceMap>({});
  const [alarmsLoaded, setAlarmsLoaded] = useState(false);
  const [alarmSaving, setAlarmSaving] = useState(false);
  const [alarmError, setAlarmError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const mutationPending = useRef(false);
  const mounted = useRef(false);
  const watchedCodes = useMemo(() => new Set(watchlists.flat()), [watchlists]);
  const alarmPrices = useMemo(() => {
    // Ignore old server alarms for codes outside all five watch folders.
    const prices = Object.fromEntries(Object.entries(savedAlarmPrices).filter(([code]) => watchedCodes.has(code)));
    for (const [code, price] of Object.entries(sessionAlarmPrices)) {
      if (watchedCodes.has(code)) continue;
      if (price > 0) prices[code] = price;
      else delete prices[code];
    }
    return prices;
  }, [savedAlarmPrices, sessionAlarmPrices, watchedCodes]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    loadCurrentPrices().then(prices => {
      if (active) { setCurrentPrices(prices); setPriceError(""); }
    }).catch(error => {
      if (active) setPriceError(`${errorMessage(error, "현재가를 불러오지 못했습니다.")} 페이지를 새로고침해 주세요.`);
    });
    // Keep the shared request alive for a subsequent mount (also in Strict Mode).
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setWatchLoaded(false);
    setWatchLimit(null);
    setAlarmsLoaded(false);
    setWatchError("");
    setAlarmError("");

    request("/api/watchlist", options).then(body => {
      if (!isRecord(body) || !isRecord(body.result)) throw new Error("관심종목 응답 형식이 올바르지 않습니다.");
      const result = body.result;
      const lists = Array.from({ length: 5 }, (_, index) => {
        const codes = result[String(index + 1)] ?? [];
        if (!Array.isArray(codes) || !codes.every(isCode)) throw new Error("관심종목 응답 형식이 올바르지 않습니다.");
        return [...new Set(codes)];
      });
      if (!controller.signal.aborted) { setWatchlists(lists); setWatchLoaded(true); }
    }).catch(error => {
      if (!controller.signal.aborted) setWatchError(errorMessage(error, "관심종목을 불러오지 못했습니다."));
    });
    request("/api/watchlist-max", options).then(body => {
      if (!isRecord(body) || !Number.isInteger(body.result) || Number(body.result) < 0) throw new Error("관심종목 최대 개수 응답이 올바르지 않습니다.");
      if (!controller.signal.aborted) setWatchLimit(Number(body.result));
    }).catch(error => {
      if (!controller.signal.aborted) setWatchError(errorMessage(error, "관심종목 최대 개수를 불러오지 못했습니다."));
    });
    request("/api/alarm-price", options).then(body => {
      const prices = priceMap(body);
      if (!controller.signal.aborted) { setSavedAlarmPrices(prices); setAlarmsLoaded(true); }
    }).catch(error => {
      if (!controller.signal.aborted) setAlarmError(errorMessage(error, "알람가격을 불러오지 못했습니다."));
    });
    return () => controller.abort();
  }, [reloadKey]);

  const changeWatchlist = useCallback(async (slot: number, codes: string[], mode: "add" | "delete") => {
    if (mutationPending.current) return false;
    if (!watchLoaded || watchLimit === null || !alarmsLoaded) { setWatchError("관심종목과 알람가격을 불러온 뒤 다시 시도해 주세요."); return false; }
    const current = watchlists[slot];
    const changed = mode === "add" ? codes.filter(code => !current.includes(code)) : codes.filter(code => current.includes(code));
    if (!changed.length) { setWatchError(mode === "add" ? "동일 종목이 이미 있습니다." : "삭제할 관심종목이 없습니다."); return false; }
    if (mode === "add" && new Set([...current, ...changed]).size > watchLimit) {
      setWatchError(`관심종목은 폴더당 ${watchLimit}개까지 저장할 수 있습니다.`); return false;
    }
    mutationPending.current = true;
    setWatchSaving(true);
    setWatchError("");
    let savingAlarms = false;
    try {
      const promotions = mode === "add" ? Object.fromEntries(changed
        .filter(code => !watchedCodes.has(code) && alarmPrices[code] > 0)
        .map(code => [code, alarmPrices[code]])) : {};
      const deletions = mode === "add" ? Object.fromEntries(changed
        .filter(code => !watchedCodes.has(code) && sessionAlarmPrices[code] === 0 && savedAlarmPrices[code] > 0)
        .map(code => [code, 0])) : {};
      if (Object.keys(deletions).length) {
        // Carry an explicit session deletion into the newly permanent watch item.
        savingAlarms = true;
        await request("/api/alarm-price", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alarm_prices: deletions, mode: "delete" }) });
        if (!mounted.current) return false;
        setSavedAlarmPrices(prices => Object.fromEntries(Object.entries(prices).filter(([code]) => !(code in deletions))));
        savingAlarms = false;
      }
      if (Object.keys(promotions).length) {
        // Save first so a failed promotion never leaves an unprotected watch item.
        // If adding the watch item then fails, its alarm stays session-only in
        // this UI; the unreferenced server value is ignored on the next login.
        savingAlarms = true;
        await request("/api/alarm-price", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alarm_prices: promotions, mode: "add" }) });
        if (!mounted.current) return false;
        setSavedAlarmPrices(prices => ({ ...prices, ...promotions }));
        savingAlarms = false;
      }
      await request("/api/watchlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot: slot + 1, jmcodes: changed, mode }) });
      if (!mounted.current) return false;
      const nextLists = watchlists.map((list, index) => index !== slot ? list : mode === "add" ? [...new Set([...list, ...changed])] : list.filter(code => !changed.includes(code)));
      if (mode === "delete") {
        const remainingCodes = new Set(nextLists.flat());
        const demotions = Object.fromEntries(changed.filter(code => !remainingCodes.has(code) && alarmPrices[code] > 0).map(code => [code, alarmPrices[code]]));
        // Keep the current workspace value when the final watch reference is removed.
        // No server alarm deletion: another device may still be using that value.
        setSessionAlarmPrices(prices => ({ ...prices, ...demotions }));
      } else {
        setSessionAlarmPrices(prices => Object.fromEntries(Object.entries(prices).filter(([code]) => !changed.includes(code))));
      }
      setWatchlists(nextLists);
      return true;
    } catch (error) {
      if (mounted.current) setWatchError(errorMessage(error, savingAlarms ? "알람가격을 저장하지 못해 관심종목을 추가하지 못했습니다." : "관심종목을 저장하지 못했습니다."));
      return false;
    } finally {
      mutationPending.current = false;
      if (mounted.current) setWatchSaving(false);
    }
  }, [watchLoaded, watchLimit, alarmsLoaded, watchlists, watchedCodes, alarmPrices, savedAlarmPrices, sessionAlarmPrices]);

  const changeAlarmPrice = useCallback(async (ticker: string, price: number) => {
    if (mutationPending.current) return false;
    if (!alarmsLoaded || !watchLoaded) { setAlarmError("관심종목과 알람가격을 불러온 뒤 다시 시도해 주세요."); return false; }
    if (!isCode(ticker) || !Number.isFinite(price) || price < 0) { setAlarmError("알람가격을 확인해 주세요."); return false; }
    setAlarmError("");
    if (!watchedCodes.has(ticker)) {
      setSessionAlarmPrices(prices => ({ ...prices, [ticker]: price }));
      return true;
    }
    mutationPending.current = true;
    setAlarmSaving(true);
    try {
      await request("/api/alarm-price", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alarm_prices: { [ticker]: price }, mode: price > 0 ? "add" : "delete" }) });
      if (!mounted.current) return false;
      setSavedAlarmPrices(prices => {
        const next = { ...prices };
        if (price > 0) next[ticker] = price;
        else delete next[ticker];
        return next;
      });
      setSessionAlarmPrices(prices => Object.fromEntries(Object.entries(prices).filter(([code]) => code !== ticker)));
      return true;
    } catch (error) {
      if (mounted.current) setAlarmError(errorMessage(error, "알람가격을 저장하지 못했습니다."));
      return false;
    } finally {
      mutationPending.current = false;
      if (mounted.current) setAlarmSaving(false);
    }
  }, [alarmsLoaded, watchLoaded, watchedCodes]);

  const reload = useCallback(() => setReloadKey(key => key + 1), []);
  return { watchlists, watchLimit, watchLoaded, watchSaving, watchError, alarmPrices, currentPrices, alarmsLoaded, alarmSaving, alarmError, priceError, changeWatchlist, changeAlarmPrice, reload };
}
