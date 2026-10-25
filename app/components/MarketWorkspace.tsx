"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { useServerPortfolio } from "../hooks/useServerPortfolio";
import StockLookup from "./StockLookup";

type AlarmPriceChange = (ticker: string, price: number) => Promise<boolean>;
type Stock = { name: string; ticker: string };
export type StockInfo = { name: string; ma20_up: boolean; bojong_profit_rate: number; trading_value: number; _5d_avg_trading_value: number; ibdrs: number; n_top_acc: number };
export type StockInfoMap = Record<string, StockInfo>;
type SearchPreset = { title: string; period: string; limit: number; perLimit: number; ant: boolean; holding: boolean; influence: boolean; rs: string; ibd: string; ma: number; volume: string; detailVolumeEnabled: boolean; detailVolumePeriod: string; detailVolume: string[]; value: string; priceCorrection: number; netProfitMargin: number; dividend: number; filter5dAvgTrdValue: number; filterRs: number };
type ResultRow = Stock & { price: number; change: number; alertPrice: number | null; alertChange: number | null; value: number; average: number; ibd: number; rank: number; ma20Up?: boolean; score?: number };
type ResultSort = { key: keyof ResultRow; asc: boolean } | null;
type NewsItem = [string, string, string];
type ConditionalSearch = Record<string, unknown> & { time?: number; result_max?: number; each_result_max?: number; ant_analysis_filter?: Record<string, number>; have?: Record<string, number>; power?: Record<string, number>; moving_average?: string; moving_average2?: number; rs?: number; ibdrs?: string; all_special_volume?: number; specific_special_volume?: Record<string, number>; recent_five_days_average_trading_value?: string; price_correction?: number; net_profit_margin?: number; dividend?: number; filter_5davgtrdvalue?: number; filter_rs?: number };

const emptyPreset: SearchPreset = { title: "", period: "1주", limit: 20, perLimit: 100, ant: false, holding: false, influence: false, rs: "any", ibd: "any", ma: 0, volume: "any", detailVolumeEnabled: false, detailVolumePeriod: "any", detailVolume: [], value: "any", priceCorrection: 0, netProfitMargin: 0, dividend: 0, filter5dAvgTrdValue: 0, filterRs: 0 };
const priceCorrectionOptions = [["무관", 0], ["3일", 3], ["1주", 5], ["2주", 10], ["3주", 15], ["4주", 20]] as const;
const netProfitMarginOptions = [["무관", 0], ["최근 결산 기준", 1], ["3년 평균 기준", 2]] as const;
const dividendOptions = [["무관", 0], ["배제", 1]] as const;
const filter5dAvgTrdValueOptions = [["무관", 0], ["10억 이하", -1000], ["10억 이상", 1000], ["50억 이상", 5000], ["100억 이상", 10000], ["500억 이상", 50000]] as const;
const filterRsOptions = [["무관", 0], ["100% 이하", -100], ["100% 이상", 100]] as const;
const movingAverageOptions = [["정배열 (20이평 > 60이평)", 1], ["20이평 상승", 2], ["60이평 상승", 4], ["20이평 하락", 8], ["60이평 하락", 16]] as const;
const antFilterGroups = [
  ["주가", "price"],
  ["개미지수(모양 우선)", "ant_index_shape_first"],
  ["개미지수(크기 우선)", "ant_index_size_first"],
  ["평균매입단가(모양 우선)", "average_buy_price_shape_first"],
  ["평균매입단가(크기 우선)", "average_buy_price_size_first"],
  ["수익률", "profit_rate"],
  ["고수관심도", "n_top_account"],
] as const;
const investorGroups = ["개인투자", "외국인", "기타법인", "내외국인", "기관계", "금융기관", "보험", "투신", "기타금융", "은행", "연기금등", "사모펀드", "사모펀드+투신", "사모펀드+연기금", "투신+연기금", "투신+사모+연기금"];
const investorKeys = ["individual", "foreigner", "othercorp", "inout", "organization", "finance", "insurance", "investtrust", "otherfinance", "bank", "pension", "privatefund", "privatefund_investtrust", "privatefund_pension", "investtrust_pension", "investtrust_privatefund_pension"];
const sample: ResultRow[] = [
  { name: "삼성전자", ticker: "005930", price: 74200, change: 1.42, alertPrice: null, alertChange: null, value: 456700, average: 543000, ibd: 99, rank: 33 },
  { name: "SK하이닉스", ticker: "000660", price: 186300, change: -0.31, alertPrice: null, alertChange: null, value: 345300, average: 363400, ibd: 98, rank: 27 },
  { name: "현대차", ticker: "005380", price: 247500, change: 2.16, alertPrice: null, alertChange: null, value: 212300, average: 197400, ibd: 97, rank: 14 },
  { name: "삼성중공업", ticker: "010140", price: 12680, change: 0.48, alertPrice: null, alertChange: null, value: 97800, average: 88400, ibd: 95, rank: 45 },
];

function stockInfoRow(ticker: string, info: StockInfo): ResultRow {
  return {
    name: info.name,
    ticker,
    price: 0,
    change: info.bojong_profit_rate,
    alertPrice: null,
    alertChange: null,
    value: info.trading_value,
    average: info._5d_avg_trading_value,
    ibd: info.ibdrs,
    rank: info.n_top_acc,
    ma20Up: info.ma20_up,
  };
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const oneDecimal = (value: number) => value.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = (value: number) => Math.round(value).toLocaleString("ko-KR");
function alarmStatusText(row: ResultRow) {
  const rounded = row.alertChange === null ? null : Math.round(row.alertChange * 10) / 10;
  const change = rounded === null ? "" : `${rounded > 0 ? "+" : ""}${rounded}%`;
  return `${row.ma20Up === true ? "U" : ""}${change}`;
}
// 261019 workbook, 알람색: each 3% drop band includes its upper boundary.
const alarmDropColors = ["#FF0000", "#EB781E", "#FFC107", "#E5E622", "#FFFF00", "#D5EAD6", "#7CE57C", "#00B050", "#66A3FF", "#3366FF"];
function alarmStatusStyle(change: number | null): CSSProperties | undefined {
  if (change === null) return undefined;
  // Classify the unrounded change; absorb only floating point boundary noise.
  const band = clamp(Math.ceil(-change / 3 - 1e-10) - 1, 0, alarmDropColors.length - 1);
  const backgroundColor = alarmDropColors[band];
  return { backgroundColor, color: backgroundColor === "#3366FF" ? "#fff" : "#111" };
}
const periodToTime: Record<string, number> = { "1주": 5, "2주": 10, "1달": 20, "2달": 40, "3달": 60 };
const timeToPeriod: Record<number, string> = { 5: "1주", 10: "2주", 20: "1달", 40: "2달", 60: "3달" };
const volumeToTime: Record<string, number> = { any: 0, "3m": 60, "6m": 120, "1y": 240 };
const timeToVolume: Record<number, string> = { 0: "any", 60: "3m", 120: "6m", 240: "1y" };
const valueToApi: Record<string, string> = { any: "0", "10": ">=1b", "50": ">=5b", "100": ">=10b", "500": ">=50b" };
const valueFromApi: Record<string, string> = { "0": "any", ">=1b": "10", ">=5b": "50", ">=10b": "100", ">=50b": "500" };

function filterOptionValue(value: unknown, options: readonly (readonly [string, number])[]) {
  return options.find(([, option]) => option === value)?.[1] ?? 0;
}

function investorObject(mode: "holding" | "power", enabled: boolean, selections: Record<string, string>) {
  return Object.fromEntries([["disabled", enabled ? 0 : 1], ...investorGroups.map((name, index) => {
    const selected = selections[`${mode}-${name}`];
    return [investorKeys[index], selected === (mode === "holding" ? "증가" : "매수력") ? 1 : selected === (mode === "holding" ? "감소" : "매도력") ? 2 : 0];
  })]);
}

function toCondition(preset: SearchPreset, selections: Record<string, string>): ConditionalSearch {
  const ant = Object.fromEntries([["disabled", preset.ant ? 0 : 1], ...antFilterGroups.map(([name, key]) => {
    const selected = selections[`ant-${name}`];
    return [key, selected === "증가" ? 1 : selected === "감소" ? 2 : 0];
  })]);
  const detail = Object.fromEntries([["time", preset.detailVolumeEnabled ? volumeToTime[preset.detailVolumePeriod] ?? 0 : 0], ...investorGroups.map((name, index) => [investorKeys[index], preset.detailVolumeEnabled && preset.detailVolume.includes(name) ? 1 : 0])]);
  return {
    time: periodToTime[preset.period] ?? 5,
    result_max: preset.limit,
    each_result_max: preset.perLimit,
    ant_analysis_filter: ant,
    have: investorObject("holding", preset.holding, selections),
    power: investorObject("power", preset.influence, selections),
    moving_average2: preset.ma,
    rs: preset.rs === "상승" ? 1 : preset.rs === "하락" ? 2 : 0,
    ibdrs: preset.ibd === "80" ? ">80" : preset.ibd === "90" ? ">90" : "0",
    all_special_volume: volumeToTime[preset.volume] ?? 0,
    specific_special_volume: detail,
    recent_five_days_average_trading_value: valueToApi[preset.value] ?? "0",
    price_correction: preset.priceCorrection,
    net_profit_margin: preset.netProfitMargin,
    dividend: preset.dividend,
    filter_5davgtrdvalue: preset.filter5dAvgTrdValue,
    filter_rs: preset.filterRs,
    result_sort: 0,
  };
}

function fromCondition(condition: ConditionalSearch, index: number, title?: string): SearchPreset {
  const ant = condition.ant_analysis_filter ?? {};
  const detail = condition.specific_special_volume ?? {};
  const legacyMoving: Record<string, number> = { "20>60": 1, u20: 2, u60: 4 };
  const moving = condition.moving_average2 ?? legacyMoving[condition.moving_average ?? "0"] ?? 0;
  return {
    ...emptyPreset,
    title: title || `검색 ${index + 1}`,
    period: timeToPeriod[condition.time ?? 5] ?? "1주",
    limit: condition.result_max ?? 20,
    perLimit: condition.each_result_max ?? 100,
    ant: ant.disabled !== 1,
    holding: condition.have?.disabled !== 1,
    influence: condition.power?.disabled !== 1,
    rs: condition.rs === 1 ? "상승" : condition.rs === 2 ? "하락" : "any",
    ibd: condition.ibdrs === ">80" ? "80" : condition.ibdrs === ">90" ? "90" : "any",
    ma: Number.isInteger(moving) && moving >= 0 && moving <= 31 ? moving : 0,
    volume: timeToVolume[condition.all_special_volume ?? 0] ?? "any",
    detailVolumeEnabled: (detail.time ?? 0) !== 0 || investorKeys.some(key => detail[key] === 1),
    detailVolumePeriod: timeToVolume[detail.time ?? 0] ?? "any",
    detailVolume: investorGroups.filter((_, investorIndex) => detail[investorKeys[investorIndex]] === 1),
    value: valueFromApi[condition.recent_five_days_average_trading_value ?? "0"] ?? "any",
    priceCorrection: filterOptionValue(condition.price_correction, priceCorrectionOptions),
    netProfitMargin: filterOptionValue(condition.net_profit_margin, netProfitMarginOptions),
    dividend: filterOptionValue(condition.dividend, dividendOptions),
    filter5dAvgTrdValue: filterOptionValue(condition.filter_5davgtrdvalue, filter5dAvgTrdValueOptions),
    filterRs: filterOptionValue(condition.filter_rs, filterRsOptions),
  };
}

function selectionsFromCondition(condition: ConditionalSearch) {
  const selections: Record<string, string> = {};
  antFilterGroups.forEach(([name, key]) => {
    const selected = condition.ant_analysis_filter?.[key];
    if (selected === 1 || selected === 2) selections[`ant-${name}`] = selected === 1 ? "증가" : "감소";
  });
  investorGroups.forEach((name, index) => {
    const holding = condition.have?.[investorKeys[index]];
    const power = condition.power?.[investorKeys[index]];
    if (holding === 1 || holding === 2) selections[`holding-${name}`] = holding === 1 ? "증가" : "감소";
    if (power === 1 || power === 2) selections[`power-${name}`] = power === 1 ? "매수력" : "매도력";
  });
  return selections;
}

function describePreset(preset: SearchPreset) {
  const filters = [preset.period, `최대 ${preset.limit}개`];
  if (preset.ant) filters.push("개미 분석");
  if (preset.holding) filters.push("보유비중 증감");
  if (preset.influence) filters.push("영향력");
  if (preset.rs !== "any") filters.push(`RS ${preset.rs}`);
  if (preset.ma !== 0) filters.push("이동평균선");
  if (preset.value !== "any") filters.push(`거래대금 ${preset.value}억 이상`);
  for (const [title, value, options] of [
    ["주가조정", preset.priceCorrection, priceCorrectionOptions],
    ["5일 평균 거래대금", preset.filter5dAvgTrdValue, filter5dAvgTrdValueOptions],
    ["RS 필터", preset.filterRs, filterRsOptions],
    ["순이익률 1% 이상", preset.netProfitMargin, netProfitMarginOptions],
    ["이번 달 배당 예정 종목", preset.dividend, dividendOptions],
  ] as const) {
    const selected = options.find(([, option]) => option === value);
    if (selected && value !== 0) filters.push(`${title} ${selected[0]}`);
  }
  return `${preset.title} · ${filters.join(" · ")}`;
}

export default function MarketWorkspace({ stocks, stockInfo, ticker, onSelect, chart, menu }: { stocks: Stock[]; stockInfo: StockInfoMap; ticker: string; onSelect: (ticker: string) => void; chart: (onAlertPriceChange: AlarmPriceChange) => React.ReactNode; menu: React.ReactNode }) {
  const marketRows = useMemo(() => {
    const rows = Object.entries(stockInfo).map(([code, info]) => stockInfoRow(code, info));
    return rows.length ? rows : sample;
  }, [stockInfo]);
  const marketByTicker = useMemo(() => new Map(marketRows.map(row => [row.ticker, row])), [marketRows]);
  const [preset, setPreset] = useState<SearchPreset>(emptyPreset);
  const [slots, setSlots] = useState<(SearchPreset | null)[]>([null, null, null, null, null]);
  const [slotInvestors, setSlotInvestors] = useState<Record<string, string>[]>([{},{},{},{},{}]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [results, setResults] = useState<ResultRow[]>(marketRows);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [watchTab, setWatchTab] = useState(0);
  const [legacyWatchlists, setLegacyWatchlists] = useState<string[][]>([[], [], [], [], []]);
  const portfolio = useServerPortfolio();
  const { watchlists, watchLimit, watchLoaded, watchSaving, watchError, alarmPrices, currentPrices, alarmsLoaded, alarmSaving, alarmError, priceError, changeWatchlist, changeAlarmPrice, reload } = portfolio;
  const [gather, setGather] = useState(false);
  const [sort, setSort] = useState<ResultSort>({ key: "ibd", asc: false });
  const [hidden, setHidden] = useState<string[]>(["profit", "value", "average", "ibd", "rank"]);
  const [message, setMessage] = useState("");
  const [investors, setInvestors] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columnSplit, setColumnSplit] = useState(66);
  const [dockHeight, setDockHeight] = useState(224);
  const [rightTop, setRightTop] = useState(47);
  const [rightMiddle, setRightMiddle] = useState(28);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forcemonitor:workspace");
      const value = saved ? JSON.parse(saved) : {};
      if (value.bookmarks) setBookmarks(value.bookmarks);
      const legacy = value.legacyWatchlists ?? value.watchlists;
      if (Array.isArray(legacy)) setLegacyWatchlists(Array.from({ length: 5 }, (_, index) =>
        Array.isArray(legacy[index]) ? [...new Set<string>(legacy[index].filter((code: unknown): code is string => typeof code === "string" && /^[a-zA-Z0-9]{6}$/.test(code)))] : [],
      ));
      if (Array.isArray(value.hidden)) setHidden(value.hidden);
      if (Number.isFinite(value.columnSplit)) setColumnSplit(value.columnSplit);
      if (Number.isFinite(value.dockHeight)) setDockHeight(value.dockHeight);
      if (Number.isFinite(value.rightTop)) setRightTop(value.rightTop);
      if (Number.isFinite(value.rightMiddle)) setRightMiddle(value.rightMiddle);
      const titles = Array.isArray(value.searchTitles) ? value.searchTitles : [];
      fetch("/api/conditional-search").then(async response => {
        const responseBody = await response.json();
        if (!response.ok) throw new Error(responseBody.message);
        const nextSlots: (SearchPreset | null)[] = [null, null, null, null, null];
        const nextInvestors: Record<string, string>[] = [{},{},{},{},{}];
        for (const savedSearch of responseBody.result ?? []) {
          if (!Number.isInteger(savedSearch.slot) || savedSearch.slot < 0 || savedSearch.slot > 4) continue;
          const savedTitle = typeof savedSearch.title === "string" ? savedSearch.title : titles[savedSearch.slot];
          nextSlots[savedSearch.slot] = fromCondition(savedSearch.condition ?? {}, savedSearch.slot, savedTitle);
          nextInvestors[savedSearch.slot] = selectionsFromCondition(savedSearch.condition ?? {});
        }
        setSlots(nextSlots);
        setSlotInvestors(nextInvestors);
      }).catch(error => setMessage(error instanceof Error ? error.message : "저장된 검색조건을 불러오지 못했습니다."));
    } catch { setMessage("저장된 화면 설정을 불러오지 못했습니다."); }
    finally { setPreferencesLoaded(true); }
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    let previous;
    try { previous = JSON.parse(localStorage.getItem("forcemonitor:workspace") ?? "{}"); }
    catch { previous = {}; }
    // Retain old local lists as a backup; active lists are loaded only from the server.
    const legacyWatchlists = previous?.legacyWatchlists ?? previous?.watchlists;
    localStorage.setItem("forcemonitor:workspace", JSON.stringify({ ...(legacyWatchlists ? { legacyWatchlists } : {}), searchTitles: slots.map(slot => slot?.title ?? ""), bookmarks, hidden, columnSplit, dockHeight, rightTop, rightMiddle }));
  }, [preferencesLoaded, slots, bookmarks, hidden, columnSplit, dockHeight, rightTop, rightMiddle]);
  useEffect(() => {
    if (!settingsOpen) return;
    requestAnimationFrame(() => document.getElementById("search-settings-panel")?.scrollIntoView({ block: "start" }));
  }, [settingsOpen]);

  const withAlarm = useCallback((row: ResultRow): ResultRow => {
    const price = currentPrices[row.ticker] ?? 0;
    const alertPrice = alarmPrices[row.ticker] > 0 ? alarmPrices[row.ticker] : null;
    return {
      ...row, price, alertPrice,
      alertChange: alertPrice !== null && price > 0 ? (price - alertPrice) / alertPrice * 100 : null,
    };
  }, [alarmPrices, currentPrices]);
  const resultRows = useMemo(() => results.map(withAlarm), [results, withAlarm]);
  const ordered = useMemo(() => {
    if (!sort && !gather) return resultRows;
    const bookmarked = new Set(bookmarks);
    return [...resultRows].sort((a, b) => {
      const bookmarkOrder = gather ? Number(bookmarked.has(b.ticker)) - Number(bookmarked.has(a.ticker)) : 0;
      if (bookmarkOrder || !sort) return bookmarkOrder;
      const av = a[sort.key], bv = b[sort.key];
      const direction = typeof av === "string" ? av.localeCompare(String(bv), "ko") : Number(av) - Number(bv);
      return sort.asc ? direction : -direction;
    });
  }, [resultRows, sort, gather, bookmarks]);
  const watchRows = useMemo(() => watchlists[watchTab].map(code => marketByTicker.get(code) ?? {
    name: stocks.find(stock => stock.ticker === code)?.name ?? code, ticker: code,
    price: 0, change: 0, alertPrice: null, alertChange: null, value: 0, average: 0, ibd: 0, rank: 0,
  }), [watchlists, watchTab, marketByTicker, stocks]);
  const selectedWatch = useMemo(() => watchRows.map(withAlarm), [watchRows, withAlarm]);
  const activeDescription = activeSlot === null ? "검색조건을 선택하거나 새 조건을 만들어 주세요." : slots[activeSlot] ? describePreset(slots[activeSlot]) : "검색조건이 설정되지 않았습니다.";

  function chooseSlot(index: number) {
    setActiveSlot(index);
    const saved = slots[index];
    setPreset(saved ? { ...emptyPreset, ...saved } : emptyPreset);
    setInvestors(slotInvestors[index] ?? {});
    if (!saved) return setMessage(`검색 ${index + 1}에는 저장된 조건이 없습니다.`);
    void runSearch(saved, slotInvestors[index] ?? {}, `검색 ${index + 1}`);
  }
  async function savePreset(title = preset.title) {
    const savedPreset = { ...preset, title: title.trim() };
    if (!preset.period) return setMessage("필수 항목인 검색기간을 선택해 주세요.");
    if (!savedPreset.title) return setMessage("검색 제목을 입력해 주세요.");
    if (activeSlot === null) return setMessage("저장 위치(검색1~검색5)를 먼저 선택해 주세요.");
    const index = activeSlot;
    try {
      const response = await fetch("/api/conditional-search", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot: index, condition: toCondition(savedPreset, investors), title: savedPreset.title }) });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.message);
      const next = [...slots]; next[index] = savedPreset; setSlots(next);
      const nextInvestors = [...slotInvestors]; nextInvestors[index] = { ...investors }; setSlotInvestors(nextInvestors);
      setMessage(`검색 ${index + 1}에 조건을 저장했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "검색조건을 저장하지 못했습니다."); }
  }
  async function deletePreset() {
    if (activeSlot === null || !slots[activeSlot]) { setMessage("삭제할 저장 검색을 선택해 주세요."); return false; }
    try {
      const response = await fetch(`/api/conditional-search?slot=${activeSlot}`, { method: "DELETE" });
      if (!response.ok) { const responseBody = await response.json(); throw new Error(responseBody.message); }
      const next = [...slots]; next[activeSlot] = null; setSlots(next);
      const nextInvestors = [...slotInvestors]; nextInvestors[activeSlot] = {}; setSlotInvestors(nextInvestors);
      setPreset(emptyPreset); setInvestors({}); setMessage(`검색 ${activeSlot + 1}의 저장 조건을 삭제했습니다.`);
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "검색조건을 삭제하지 못했습니다."); return false; }
  }
  async function runSearch(nextPreset = preset, nextInvestors = investors, label = "임시 검색") {
    if (!nextPreset.period) return setMessage("필수 항목인 검색기간을 선택해 주세요.");
    try {
      const response = await fetch("/api/conditional-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toCondition(nextPreset, nextInvestors)) });
      const responseBody = await response.json();
      if (!response.ok || responseBody.errno !== 0) throw new Error(responseBody.message ?? "검색 결과를 반환하지 못했습니다.");
      const nextRows = (responseBody.result as [string, number][]).map(([code, score], index) => {
        const known = marketByTicker.get(code);
        return known ? { ...known, score } : { name: stocks.find(stock => stock.ticker === code)?.name ?? code, ticker: code, price: 0, change: 0, alertPrice: null, alertChange: null, value: 0, average: 0, ibd: 0, rank: index + 1, score };
      });
      setSort(null); setGather(false); setResults(nextRows); setMessage(`${label} 결과 · ${nextRows.length}개 종목`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "조건검색을 실행하지 못했습니다."); }
  }
  const setSortKey = useCallback((key: keyof ResultRow) => { setSort(current => ({ key, asc: current?.key === key ? !current.asc : true })); }, []);
  const toggleBookmark = useCallback((code: string) => { setBookmarks(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]); }, []);
  async function addWatch(code: string) {
    if (await changeWatchlist(watchTab, [code], "add")) setMessage(`관심 ${watchTab + 1}에 추가했습니다.`);
  }
  async function aiCopy() {
    const body = ordered.slice(0, 100).map(row => `${row.name}(${row.ticker}) IBD RS ${row.ibd}, 등락률 ${row.change}%`).join("\n") + "\n\n위 종목들을 분석해서, 현재 주식시장의 주도 섹터와 주도주가 무엇인지 설명해줘. 가장 좋은 종목도 추천해줘.";
    try { await navigator.clipboard.writeText(body); setMessage("종목과 AI 분석 프롬프트를 복사했습니다."); }
    catch { setMessage("클립보드 권한을 확인해 주세요."); }
  }

  function capture(event: ReactPointerEvent<HTMLDivElement>) { event.currentTarget.setPointerCapture(event.pointerId); }
  function resizeColumns(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (bounds) setColumnSplit(clamp(((event.clientX - bounds.left) / bounds.width) * 100, 48, 76));
  }
  function resizeRightTop(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (bounds) setRightTop(clamp(((event.clientY - bounds.top) / bounds.height) * 100, 30, 82 - rightMiddle));
  }
  function resizeDock(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (bounds) setDockHeight(clamp(bounds.bottom - event.clientY, 206, Math.min(300, bounds.height * .45)));
  }
  function resizeRightMiddle(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (bounds) setRightMiddle(clamp(((event.clientY - bounds.top) / bounds.height) * 100 - rightTop, 18, 82 - rightTop));
  }

  const workspaceStyle = { "--workspace-left": `${columnSplit}%` } as CSSProperties;
  const rightStyle = { gridTemplateRows: `48px ${rightTop}fr 8px ${rightMiddle}fr 8px ${100 - rightTop - rightMiddle}fr` };

  return <div className={`market-workspace-shell ${settingsOpen ? "settings-open" : ""}`}>
  <section className="market-workspace" style={workspaceStyle} aria-label="세력모니터 워크스페이스">
    <div className="workspace-primary">
      <div className="workspace-chart-slot"><WorkspaceChart chart={chart} onAlertPriceChange={changeAlarmPrice} /></div>
      <div className="workspace-resizer workspace-resizer-row" role="separator" aria-label="차트와 검색 영역 높이 조절" aria-orientation="horizontal" aria-valuemin={206} aria-valuemax={300} aria-valuenow={dockHeight} tabIndex={0} onPointerDown={capture} onPointerMove={resizeDock} onDoubleClick={() => setDockHeight(224)} onKeyDown={event => { if (event.key === "ArrowUp") setDockHeight(value => clamp(value + 8, 206, 300)); if (event.key === "ArrowDown") setDockHeight(value => clamp(value - 8, 206, 300)); }} />
      <section className="workspace-panel search-dock" style={{ flexBasis: dockHeight }} aria-label="종목 및 저장 검색">
        <StockLookup stocks={stocks} ticker={ticker} onSelect={onSelect} onMessage={setMessage} />
        <div className="quick-presets" aria-label="저장 검색">{slots.map((slot, index) => <button key={index} className={`${activeSlot === index ? "active" : ""} ${slot ? "saved" : "empty"}`} onClick={() => chooseSlot(index)}>검색{index + 1}</button>)}</div>
        <p className="preset-description"><span>검색조건</span>{activeDescription}</p>{message && <p className="search-api-message" role="status">{message}</p>}
        <div className="search-settings-entry"><button className="open-search-settings" aria-expanded={settingsOpen} aria-controls="search-settings-panel" onClick={() => setSettingsOpen(value => !value)}>{settingsOpen ? "검색조건 접기" : "검색조건 만들기"}</button></div>
      </section>
    </div>

    <div className="workspace-resizer workspace-resizer-column" role="separator" aria-label="차트와 데이터 창 너비 조절" aria-orientation="vertical" aria-valuemin={48} aria-valuemax={76} aria-valuenow={columnSplit} tabIndex={0} onPointerDown={capture} onPointerMove={resizeColumns} onDoubleClick={() => setColumnSplit(66)} onKeyDown={event => { if (event.key === "ArrowLeft") setColumnSplit(value => clamp(value - 2, 48, 76)); if (event.key === "ArrowRight") setColumnSplit(value => clamp(value + 2, 48, 76)); }} />

    <aside className="workspace-secondary" style={rightStyle}>
      <div className="workspace-menu">{menu}</div>
      <ResultsPanel serverMessage={alarmError} priceMessage={priceError} loading={!alarmsLoaded && !alarmError} retryDisabled={watchSaving || alarmSaving} onReload={reload} ordered={ordered} ticker={ticker} sort={sort} hidden={hidden} bookmarks={bookmarks} gather={gather} onSelect={onSelect} onSort={setSortKey} onToggleBookmark={toggleBookmark} onShowAll={() => { setResults(marketRows); setMessage("전체 종목을 표시합니다."); }} onClearBookmarks={() => setBookmarks([])} onToggleGather={() => setGather(!gather)} onToggleColumn={key => setHidden(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])} onAiCopy={aiCopy} />
      <div className="workspace-resizer workspace-resizer-row" role="separator" aria-label="검색 결과와 관심종목 높이 조절" aria-orientation="horizontal" aria-valuemin={30} aria-valuemax={82 - rightMiddle} aria-valuenow={rightTop} tabIndex={0} onPointerDown={capture} onPointerMove={resizeRightTop} onDoubleClick={() => setRightTop(47)} onKeyDown={event => { if (event.key === "ArrowUp") setRightTop(value => clamp(value - 2, 30, 82 - rightMiddle)); if (event.key === "ArrowDown") setRightTop(value => clamp(value + 2, 30, 82 - rightMiddle)); }} />
      <WatchPanel legacyCodes={legacyWatchlists[watchTab]} onImport={() => void changeWatchlist(watchTab, legacyWatchlists[watchTab], "add")} alarmReady={alarmsLoaded} watchlists={watchlists} watchTab={watchTab} selectedWatch={selectedWatch} ticker={ticker} limit={watchLimit} loaded={watchLoaded} saving={watchSaving} error={watchError} onReload={reload} retryDisabled={watchSaving || alarmSaving} onTab={setWatchTab} onSelect={onSelect} onAdd={addWatch} onClear={() => void changeWatchlist(watchTab, watchlists[watchTab], "delete")} onRemove={code => void changeWatchlist(watchTab, [code], "delete")} onMoveToResults={() => { setResults(watchRows); setMessage(`관심 ${watchTab + 1} 종목을 검색 결과로 옮겼습니다.`); }} />
      <div className="workspace-resizer workspace-resizer-row" role="separator" aria-label="관심종목과 뉴스 높이 조절" aria-orientation="horizontal" aria-valuemin={18} aria-valuemax={82 - rightTop} aria-valuenow={rightMiddle} tabIndex={0} onPointerDown={capture} onPointerMove={resizeRightMiddle} onDoubleClick={() => setRightMiddle(28)} onKeyDown={event => { if (event.key === "ArrowUp") setRightMiddle(value => clamp(value - 2, 18, 82 - rightTop)); if (event.key === "ArrowDown") setRightMiddle(value => clamp(value + 2, 18, 82 - rightTop)); }} />
      <NewsPanel name={stocks.find(row => row.ticker === ticker)?.name ?? ticker}/>
    </aside>
  </section>
  {settingsOpen && <SearchSettingsPanel slots={slots} activeSlot={activeSlot} preset={preset} investors={investors} onClose={() => setSettingsOpen(false)} onSelectSlot={(index, slot) => { setActiveSlot(index); setPreset(slot ? { ...emptyPreset, ...slot } : emptyPreset); setInvestors(slotInvestors[index] ?? {}); }} setPreset={setPreset} setActiveSlot={setActiveSlot} setInvestors={setInvestors} onSave={savePreset} onDelete={deletePreset} onSearch={() => void runSearch()} />}
  </div>;
}

const WorkspaceChart = memo(function WorkspaceChart({ chart, onAlertPriceChange }: { chart: (onAlertPriceChange: AlarmPriceChange) => React.ReactNode; onAlertPriceChange: AlarmPriceChange }) {
  return chart(onAlertPriceChange);
});

function NewsPanel({ name }: { name: string }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [message, setMessage] = useState("뉴스를 불러오고 있습니다.");

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setMessage("뉴스를 불러오고 있습니다.");
    fetch(`/api/news?query=${encodeURIComponent(name)}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        return body.result as NewsItem[];
      })
      .then(result => {
        setItems(result);
        setMessage(result.length ? "" : "뉴스가 없습니다.");
      })
      .catch(error => {
        if (error.name !== "AbortError") setMessage(error instanceof Error ? error.message : "뉴스를 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [name]);

  return <div className="workspace-panel news-panel api-news-panel">
    <div><span className="panel-kicker">종목 뉴스</span><h2>{name} 관련 뉴스</h2></div>
    <div className="news-list">{message&&<p>{message}</p>}{items.map(([title, time, url], index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer"><span>{title}</span><small>{time}</small></a>)}</div>
  </div>;
}

function SearchSettingsPanel({ slots, activeSlot, preset, investors, onClose, onSelectSlot, setPreset, setActiveSlot, setInvestors, onSave, onDelete, onSearch }: { slots: (SearchPreset | null)[]; activeSlot: number | null; preset: SearchPreset; investors: Record<string, string>; onClose: () => void; onSelectSlot: (index: number, slot: SearchPreset | null) => void; setPreset: (value: SearchPreset) => void; setActiveSlot: (value: number | null) => void; setInvestors: (value: Record<string, string>) => void; onSave: (title: string) => void; onDelete: () => Promise<boolean>; onSearch: () => void }) {
  const [title, setTitle] = useState(preset.title);
  const draft = useRef({ preset, title, setPreset });
  draft.current = { preset, title, setPreset };
  useEffect(() => setTitle(preset.title), [preset.title, activeSlot]);
  // Keep unfinished titles when the settings panel closes, without updating
  // the entire workspace on every keystroke.
  useEffect(() => () => {
    const current = draft.current;
    current.setPreset({ ...current.preset, title: current.title });
  }, []);
  const conditions = useMemo(() => (
    <div className="condition-scroll"><div className="condition-title"><div><span className="panel-kicker">검색 설정창</span><h2 id="search-settings-title">{activeSlot === null ? "새 검색 만들기" : `검색 ${activeSlot + 1}`}</h2><p>검색조건은 임시 검색으로 먼저 확인한 뒤 원하는 위치에 저장할 수 있습니다.</p></div><div className="builder-actions"><button onClick={() => { setTitle(""); setPreset(emptyPreset); setInvestors({}); setActiveSlot(null); }}>초기화</button><button className="primary-action" onClick={onSearch}>임시 검색</button></div></div>
      <Condition title="기간 설정 *" required><Radio values={["1주", "2주", "1달", "2달", "3달"]} value={preset.period} set={period => setPreset({ ...preset, period: String(period) })} /></Condition>
      <Condition title="최종 검색 결과 최대치 *" required><Radio values={[20, 50, 100, 200, 300]} value={preset.limit} set={limit => setPreset({ ...preset, limit: Number(limit) })} prefix="상위 " /></Condition>
      <Condition title="개별 검색결과 허용 종목수 *" required><Radio values={[100, 200, 400]} value={preset.perLimit} set={perLimit => setPreset({ ...preset, perLimit: Number(perLimit) })} prefix="상위 " /></Condition>
      <Condition title="개미 분석 필터"><Toggle checked={preset.ant} label="사용" onChange={ant => setPreset({ ...preset, ant })} />{preset.ant && <AntFilterMatrix value={investors} set={setInvestors} />}</Condition>
      <Condition title="보유비중 증감"><Toggle checked={preset.holding} label="사용" onChange={holding => setPreset({ ...preset, holding })} />{preset.holding && <InvestorMatrix mode="holding" value={investors} set={setInvestors} />}</Condition>
      <Condition title="영향력"><Toggle checked={preset.influence} label="사용" onChange={influence => setPreset({ ...preset, influence })} />{preset.influence && <InvestorMatrix mode="power" value={investors} set={setInvestors} />}</Condition>
      <div className="condition-columns"><Condition title="RS 증감"><Radio values={["any", "상승", "하락"]} labels={["무관", "상승", "하락"]} value={preset.rs} set={rs => setPreset({ ...preset, rs: String(rs) })} /></Condition><Condition title="IBD RS"><Radio values={["any", "80", "90"]} labels={["무관", ">80점", ">90점"]} value={preset.ibd} set={ibd => setPreset({ ...preset, ibd: String(ibd) })} /></Condition></div>
      <Condition title="이동평균선"><div className="radio-row">{movingAverageOptions.map(([label, bit]) => <Toggle key={bit} label={label} checked={Boolean(preset.ma & bit)} onChange={checked => setPreset({ ...preset, ma: checked ? preset.ma | bit : preset.ma & ~bit })} />)}</div></Condition>
      <div className="condition-columns"><Condition title="전체 특이 거래량"><Radio values={["any", "3m", "6m", "1y"]} labels={["무관", "3개월", "6개월", "1년"]} value={preset.volume} set={volume => setPreset({ ...preset, volume: String(volume) })} /></Condition><Condition title="최근 5일 평균 거래대금"><Radio values={["any", "10", "50", "100", "500"]} labels={["무관", "10억 이상", "50억 이상", "100억 이상", "500억 이상"]} value={preset.value} set={value => setPreset({ ...preset, value: String(value) })} /></Condition></div>
      <Condition title="세부 특이 거래량"><Toggle checked={preset.detailVolumeEnabled} label="사용" onChange={detailVolumeEnabled => setPreset({ ...preset, detailVolumeEnabled })} />{preset.detailVolumeEnabled && <div className="specific-volume-controls"><Radio values={["any", "3m", "6m", "1y"]} labels={["무관", "3개월", "6개월", "1년"]} value={preset.detailVolumePeriod} set={detailVolumePeriod => setPreset({ ...preset, detailVolumePeriod: String(detailVolumePeriod) })} /><div className="detail-volume-options">{investorGroups.slice(1).map(name => <Toggle key={name} checked={preset.detailVolume.includes(name)} label={name} onChange={checked => setPreset({ ...preset, detailVolume: checked ? [...preset.detailVolume, name] : preset.detailVolume.filter(item => item !== name) })} />)}</div></div>}</Condition>
      <Condition title="필터: 주가조정"><Radio name="price-correction" values={priceCorrectionOptions.map(([, value]) => value)} labels={priceCorrectionOptions.map(([label]) => label)} value={preset.priceCorrection} set={priceCorrection => setPreset({ ...preset, priceCorrection: Number(priceCorrection) })} /></Condition>
      <Condition title="필터: 5일 평균 거래대금"><Radio name="filter-5davgtrdvalue" values={filter5dAvgTrdValueOptions.map(([, value]) => value)} labels={filter5dAvgTrdValueOptions.map(([label]) => label)} value={preset.filter5dAvgTrdValue} set={filter5dAvgTrdValue => setPreset({ ...preset, filter5dAvgTrdValue: Number(filter5dAvgTrdValue) })} /></Condition>
      <div className="condition-columns"><Condition title="필터: RS"><Radio name="filter-rs" values={filterRsOptions.map(([, value]) => value)} labels={filterRsOptions.map(([label]) => label)} value={preset.filterRs} set={filterRs => setPreset({ ...preset, filterRs: Number(filterRs) })} /></Condition><Condition title="필터: 순이익률 1% 이상"><Radio name="net-profit-margin" values={netProfitMarginOptions.map(([, value]) => value)} labels={netProfitMarginOptions.map(([label]) => label)} value={preset.netProfitMargin} set={netProfitMargin => setPreset({ ...preset, netProfitMargin: Number(netProfitMargin) })} /></Condition></div>
      <Condition title="필터: 이번 달 배당 예정 종목"><Radio name="dividend" values={dividendOptions.map(([, value]) => value)} labels={dividendOptions.map(([label]) => label)} value={preset.dividend} set={dividend => setPreset({ ...preset, dividend: Number(dividend) })} /></Condition>
      <div className="temporary-search"><div><b>저장하지 않고 결과 확인</b><p>위에서 설정한 조건으로 검색 결과를 먼저 확인합니다.</p></div><button onClick={onSearch}>임시 검색</button></div>
    </div>
  ), [preset, activeSlot, investors, setPreset, setActiveSlot, setInvestors, onSearch]);
  return <section id="search-settings-panel" className="workspace-panel search-builder search-settings-panel search-settings-page" aria-label="검색 설정창">
    <aside><div className="settings-panel-heading"><span className="panel-kicker">저장 위치</span><button onClick={onClose} aria-label="검색 설정 접기">×</button></div><div className="preset-slots">{slots.map((slot, index) => <button key={index} className={`${activeSlot === index ? "active" : ""} ${slot ? "saved" : "empty"}`} onClick={() => onSelectSlot(index, slot)}><b>검색 {index + 1}</b><small>{slot?.title || "설정되지 않음"}</small></button>)}</div><label>검색 제목<input required value={title} placeholder="예: 급등주 위주" onChange={event => setTitle(event.target.value)} /></label><button className="secondary-action" onClick={() => onSave(title)}>검색조건 저장</button><button className="secondary-action delete-search" disabled={activeSlot === null || !slots[activeSlot]} onClick={async () => { if (await onDelete()) setTitle(""); }}>저장조건 삭제</button></aside>
    {conditions}
  </section>;
}

function ResultsPanel({ serverMessage, priceMessage, loading, retryDisabled, onReload, ordered, ticker, sort, hidden, bookmarks, gather, onSelect, onSort, onToggleBookmark, onShowAll, onClearBookmarks, onToggleGather, onToggleColumn, onAiCopy }: { serverMessage: string; priceMessage: string; loading: boolean; retryDisabled: boolean; onReload: () => void; ordered: ResultRow[]; ticker: string; sort: ResultSort; hidden: string[]; bookmarks: string[]; gather: boolean; onSelect: (ticker: string) => void; onSort: (key: keyof ResultRow) => void; onToggleBookmark: (ticker: string) => void; onShowAll: () => void; onClearBookmarks: () => void; onToggleGather: () => void; onToggleColumn: (key: string) => void; onAiCopy: () => void }) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columns = [
    ["alertPrice", "알람가격"],
    ["alertChange", "상태"],
    ["profit", "계좌수익률"],
    ["value", "거래액(백만)"],
    ["average", "5일평균 거래액"],
    ["ibd", "IBD RS"],
    ["rank", "고수 계좌"],
  ] as const;
  return <div className="workspace-panel results-panel">
    <div className="panel-toolbar"><div><span className="panel-kicker">검색 결과</span><b>{ordered.length}개 종목</b></div><div><button onClick={onShowAll}>전종목 보기</button><button onClick={onClearBookmarks}>북마크 전체 삭제</button><button className={gather ? "active" : ""} onClick={onToggleGather}>★ 모아보기</button><button onClick={() => setColumnsOpen(true)}>창 설정</button><button className="ai-copy" onClick={onAiCopy}>AI 복사</button></div></div>
    {serverMessage && <div className="portfolio-message" role="alert">{serverMessage}<button disabled={retryDisabled} onClick={onReload}>다시 불러오기</button></div>}
    {priceMessage && <div className="portfolio-message" role="alert">{priceMessage}</div>}
    {loading && <p className="portfolio-message" role="status">알람가격을 불러오고 있습니다.</p>}
    <ResultTable ordered={ordered} ticker={ticker} sort={sort} hidden={hidden} bookmarks={bookmarks} onSelect={onSelect} onSort={onSort} onToggleBookmark={onToggleBookmark} />
    {columnsOpen && <div className="column-modal-backdrop" onMouseDown={() => setColumnsOpen(false)}><section className="column-modal" role="dialog" aria-modal="true" aria-label="검색창 설정 하기" onMouseDown={event => event.stopPropagation()}><header><h2>검색창 설정 하기</h2><button onClick={() => setColumnsOpen(false)} aria-label="닫기">×</button></header><div>{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={() => onToggleColumn(key)}/><span>{label}</span></label>)}</div></section></div>}
  </div>;
}

// Each result row is 54px high with 2px table spacing. Keep only the viewport
// and a small scroll buffer mounted so input work stays independent of result count.
const resultRowHeight = 56;
const resultHeaderHeight = 52;
const resultOverscan = 5;
const ResultTable = memo(function ResultTable({ ordered, ticker, sort, hidden, bookmarks, onSelect, onSort, onToggleBookmark }: { ordered: ResultRow[]; ticker: string; sort: ResultSort; hidden: string[]; bookmarks: string[]; onSelect: (ticker: string) => void; onSort: (key: keyof ResultRow) => void; onToggleBookmark: (ticker: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);
  const virtual = ordered.length > 100;
  const firstVisible = Math.floor(Math.max(0, scrollTop - resultHeaderHeight) / resultRowHeight);
  const start = virtual ? Math.max(0, Math.min(firstVisible - resultOverscan, ordered.length - Math.ceil(viewportHeight / resultRowHeight) - resultOverscan)) : 0;
  const end = virtual ? Math.min(ordered.length, start + Math.ceil(viewportHeight / resultRowHeight) + resultOverscan * 2 + 1) : ordered.length;
  const columnCount = 3 + ["alertChange", "alertPrice", "profit", "value", "average", "ibd", "rank"].filter(key => !hidden.includes(key)).length;
  return (
    <div className="result-table-wrap" ref={scrollRef} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
      <table className="result-table result-table-alerts" aria-rowcount={ordered.length + 1}>
        <thead><tr>
          <th>번호</th><th>북마크</th>
          <Sortable label="종목" field="name" sort={sort} onClick={onSort} />
          {!hidden.includes("alertChange") && <Sortable label="상태" field="alertChange" sort={sort} onClick={onSort} />}
          {!hidden.includes("alertPrice") && <Sortable label="알람 가격" field="alertPrice" sort={sort} onClick={onSort} />}
          {!hidden.includes("profit") && <Sortable label="계좌 수익률" field="change" sort={sort} onClick={onSort} />}
          {!hidden.includes("value") && <Sortable label="거래액(백만)" field="value" sort={sort} onClick={onSort} />}
          {!hidden.includes("average") && <Sortable label="5일평균 거래액" field="average" sort={sort} onClick={onSort} />}
          {!hidden.includes("ibd") && <Sortable label="IBD RS" field="ibd" sort={sort} onClick={onSort} />}
          {!hidden.includes("rank") && <Sortable label="고수 계좌" field="rank" sort={sort} onClick={onSort} />}
        </tr></thead>
        <tbody>
          {start > 0 && <tr aria-hidden="true" className="result-spacer"><td colSpan={columnCount} style={{ height: start * resultRowHeight - 2 }} /></tr>}
          {ordered.slice(start, end).map((row, offset) => {
            const index = start + offset;
            const bookmarked = bookmarkSet.has(row.ticker);
            return <tr key={row.ticker} aria-rowindex={index + 2} className={`${index % 2 === 0 ? "result-row-odd" : "result-row-even"} ${ticker === row.ticker ? "selected" : ""} ${bookmarked ? "bookmarked" : ""}`} onClick={() => onSelect(row.ticker)}>
              <td>{index + 1}</td>
              <td><button type="button" className="bookmark-star" aria-label={`${row.name} 북마크 ${bookmarked ? "해제" : "추가"}`} aria-pressed={bookmarked} onClick={event => { event.stopPropagation(); onToggleBookmark(row.ticker); }}>{bookmarked ? "★" : "☆"}</button></td>
              <td><b>{row.name}</b></td>
              {!hidden.includes("alertChange") && <td className="alert-status" style={alarmStatusStyle(row.alertChange)}>{alarmStatusText(row)}</td>}
              {!hidden.includes("alertPrice") && <td>{row.alertPrice?.toLocaleString() ?? ""}</td>}
              {!hidden.includes("profit") && <td>{oneDecimal(row.change)}%</td>}
              {!hidden.includes("value") && <td>{integer(row.value)}</td>}
              {!hidden.includes("average") && <td>{integer(row.average)}</td>}
              {!hidden.includes("ibd") && <td>{oneDecimal(row.ibd)}</td>}
              {!hidden.includes("rank") && <td>{row.rank}</td>}
            </tr>;
          })}
          {end < ordered.length && <tr aria-hidden="true" className="result-spacer"><td colSpan={columnCount} style={{ height: (ordered.length - end) * resultRowHeight - 2 }} /></tr>}
        </tbody>
      </table>
    </div>
  );
});

function WatchPanel({ legacyCodes, onImport, alarmReady, watchlists, watchTab, selectedWatch, ticker, limit, loaded, saving, error, onReload, retryDisabled, onTab, onSelect, onAdd, onClear, onRemove, onMoveToResults }: { legacyCodes: string[]; onImport: () => void; alarmReady: boolean; watchlists: string[][]; watchTab: number; selectedWatch: ResultRow[]; ticker: string; limit: number | null; loaded: boolean; saving: boolean; error: string; onReload: () => void; retryDisabled: boolean; onTab: (index: number) => void; onSelect: (ticker: string) => void; onAdd: (ticker: string) => void; onClear: () => void; onRemove: (ticker: string) => void; onMoveToResults: () => void }) {
  const ready = loaded && alarmReady && limit !== null && !saving && !retryDisabled;
  const importCount = legacyCodes.filter(code => !watchlists[watchTab].includes(code)).length;
  return <div className="workspace-panel watch-panel">
    <div className="watch-toolbar"><div className="watch-tabs">{watchlists.map((list, index) => <button className={watchTab === index ? "active" : ""} key={index} onClick={() => onTab(index)}>관심 {index + 1}<span>{list.length}/{limit ?? "—"}</span></button>)}</div><div className="watch-actions"><button disabled={!ready || !selectedWatch.length} onClick={onClear}>전체 삭제</button><button disabled={!ready || watchlists[watchTab].length >= (limit ?? 0)} onClick={() => onAdd(ticker)}>현재 종목 추가</button><button className="watch-to-results" disabled={!loaded || !selectedWatch.length} onClick={onMoveToResults}>검색창에서 보기</button></div></div>
    {error && <div className="portfolio-message" role="alert">{error}<button disabled={retryDisabled} onClick={onReload}>다시 불러오기</button></div>}
    {!loaded && !error && <p className="portfolio-message" role="status">관심종목을 불러오고 있습니다.</p>}
    {saving && <p className="portfolio-message" role="status">관심종목을 저장하고 있습니다.</p>}
    {loaded && importCount > 0 && <div className="portfolio-message"><button disabled={!ready} onClick={onImport}>이 폴더의 이전 관심종목 가져오기 ({importCount})</button></div>}
    {selectedWatch.length ? <ol className="watch-list">{[...selectedWatch].sort((a, b) => a.name.localeCompare(b.name, "ko")).map(stock => <li key={stock.ticker}><button onClick={() => onSelect(stock.ticker)}><span><b>{stock.name}</b><small>{stock.ticker}</small></span>{stock.alertPrice !== null && <span className="watch-alarm"><small>알람가격 {stock.alertPrice.toLocaleString()}</small></span>}</button><button disabled={!ready} aria-label={`${stock.name} 관심종목 제외`} onClick={() => onRemove(stock.ticker)}>×</button></li>)}</ol> : loaded && <div className="panel-empty">관심종목이 없습니다. 검색 결과에서 종목을 추가해 보세요.</div>}
  </div>;
}

function Condition({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) { return <fieldset className="condition-card"><legend className={required ? "required" : ""}>{title}</legend><div>{children}</div></fieldset>; }
function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) { return <label className="check-control"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>; }
function Radio({ values, labels, value, set, name, prefix = "", disabled = false }: { values: (string | number)[]; labels?: string[]; value: string | number; set: (value: string | number) => void; name?: string; prefix?: string; disabled?: boolean }) { return <div className="radio-row">{values.map((item, index) => <label key={item} className={disabled ? "disabled" : ""}><input type="radio" name={name} disabled={disabled} checked={value === item} onChange={() => set(item)} /><span>{prefix}{labels?.[index] ?? item}</span></label>)}</div>; }
function AntFilterMatrix({ value, set }: { value: Record<string, string>; set: (value: Record<string, string>) => void }) { return <div className="investor-matrix ant-filter-matrix">{antFilterGroups.map(([name]) => <div key={name}><span>{name}</span>{["증가", "감소"].map(option => { const key = `ant-${name}`; return <label key={option}><input type="checkbox" aria-label={`${name} ${option}`} checked={value[key] === option} onChange={event => { const next = { ...value }; if (event.target.checked) next[key] = option; else delete next[key]; set(next); }} />{option}</label>; })}</div>)}</div>; }
function InvestorMatrix({ mode, value, set }: { mode: "holding" | "power"; value: Record<string, string>; set: (value: Record<string, string>) => void }) { return <div className="investor-matrix">{investorGroups.map(name => <div key={name}><span>{name}</span>{(mode === "holding" ? ["증가", "감소"] : ["매수력", "매도력"]).map(option => { const key = `${mode}-${name}`; return <label key={option}><input type="checkbox" aria-label={`${name} ${option}`} checked={value[key] === option} onChange={event => { const next = { ...value }; if (event.target.checked) next[key] = option; else delete next[key]; set(next); }} />{option}</label>; })}</div>)}</div>; }
function Sortable({ label, field, sort, onClick }: { label: string; field: keyof ResultRow; sort: ResultSort; onClick: (key: keyof ResultRow) => void }) { return <th><button onClick={() => onClick(field)}>{label} {sort?.key === field ? (sort.asc ? "↑" : "↓") : "↕"}</button></th>; }
