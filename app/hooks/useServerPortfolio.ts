"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function useServerPortfolio() {
  const [watchlists, setWatchlists] = useState<string[][]>([[], [], [], [], []]);
  const [watchLimit, setWatchLimit] = useState<number | null>(null);
  const [watchLoaded, setWatchLoaded] = useState(false);
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchError, setWatchError] = useState("");
  const [alarmPrices, setAlarmPrices] = useState<PriceMap>({});
  const [currentPrices, setCurrentPrices] = useState<PriceMap>({});
  const [alarmsLoaded, setAlarmsLoaded] = useState(false);
  const [alarmSaving, setAlarmSaving] = useState(false);
  const [alarmError, setAlarmError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const watchPending = useRef(false);
  const alarmPending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setWatchLoaded(false);
    setWatchLimit(null);
    setAlarmsLoaded(false);
    setWatchError("");
    setAlarmError("");
    let refreshingPrices = false;

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
      if (!controller.signal.aborted) { setAlarmPrices(prices); setAlarmsLoaded(true); }
    }).catch(error => {
      if (!controller.signal.aborted) setAlarmError(errorMessage(error, "알람가격을 불러오지 못했습니다."));
    });
    async function refreshPrices() {
      if (refreshingPrices || document.visibilityState === "hidden") return;
      refreshingPrices = true;
      try {
        const prices = priceMap(await request("/api/current-price", options));
        if (!controller.signal.aborted) { setCurrentPrices(prices); setPriceError(""); }
      } catch (error) {
        if (!controller.signal.aborted) setPriceError(errorMessage(error, "현재가를 불러오지 못했습니다."));
      } finally { refreshingPrices = false; }
    }
    void refreshPrices();
    const timer = window.setInterval(() => void refreshPrices(), 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refreshPrices(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reloadKey]);

  const changeWatchlist = useCallback(async (slot: number, codes: string[], mode: "add" | "delete") => {
    if (watchPending.current) return false;
    if (!watchLoaded || watchLimit === null) { setWatchError("관심종목과 최대 개수를 불러온 뒤 다시 시도해 주세요."); return false; }
    const current = watchlists[slot];
    const changed = mode === "add" ? codes.filter(code => !current.includes(code)) : codes.filter(code => current.includes(code));
    if (!changed.length) { setWatchError(mode === "add" ? "동일 종목이 이미 있습니다." : "삭제할 관심종목이 없습니다."); return false; }
    if (mode === "add" && new Set([...current, ...changed]).size > watchLimit) {
      setWatchError(`관심종목은 폴더당 ${watchLimit}개까지 저장할 수 있습니다.`); return false;
    }
    watchPending.current = true;
    setWatchSaving(true);
    setWatchError("");
    try {
      await request("/api/watchlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot: slot + 1, jmcodes: changed, mode }) });
      if (!mounted.current) return false;
      setWatchlists(lists => lists.map((list, index) => index !== slot ? list : mode === "add" ? [...new Set([...list, ...changed])] : list.filter(code => !changed.includes(code))));
      return true;
    } catch (error) {
      if (mounted.current) setWatchError(errorMessage(error, "관심종목을 저장하지 못했습니다."));
      return false;
    } finally {
      watchPending.current = false;
      if (mounted.current) setWatchSaving(false);
    }
  }, [watchLoaded, watchLimit, watchlists]);

  const changeAlarmPrice = useCallback(async (ticker: string, price: number) => {
    if (alarmPending.current) return false;
    if (!alarmsLoaded) { setAlarmError("알람가격을 불러온 뒤 다시 시도해 주세요."); return false; }
    if (!isCode(ticker) || !Number.isFinite(price) || price < 0) { setAlarmError("알람가격을 확인해 주세요."); return false; }
    alarmPending.current = true;
    setAlarmSaving(true);
    setAlarmError("");
    try {
      await request("/api/alarm-price", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alarm_prices: { [ticker]: price }, mode: price > 0 ? "add" : "delete" }) });
      if (!mounted.current) return false;
      setAlarmPrices(prices => {
        const next = { ...prices };
        if (price > 0) next[ticker] = price;
        else delete next[ticker];
        return next;
      });
      return true;
    } catch (error) {
      if (mounted.current) setAlarmError(errorMessage(error, "알람가격을 저장하지 못했습니다."));
      return false;
    } finally {
      alarmPending.current = false;
      if (mounted.current) setAlarmSaving(false);
    }
  }, [alarmsLoaded]);

  const reload = useCallback(() => setReloadKey(key => key + 1), []);
  return { watchlists, watchLimit, watchLoaded, watchSaving, watchError, alarmPrices, currentPrices, alarmsLoaded, alarmSaving, alarmError, priceError, changeWatchlist, changeAlarmPrice, reload };
}
