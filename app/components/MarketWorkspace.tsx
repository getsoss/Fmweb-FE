"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

type Stock = { name: string; ticker: string };
type SearchPreset = { title: string; period: string; limit: number; perLimit: number; ant: boolean; antPriority: string; holding: boolean; influence: boolean; rs: string; ibd: string; ma: string; ma20: boolean; ma60: boolean; volume: string; detailVolume: string[]; value: string };
type ResultRow = Stock & { price: number; change: number; value: number; average: number; ibd: number; rank: number };

const emptyPreset: SearchPreset = { title: "", period: "", limit: 50, perLimit: 100, ant: false, antPriority: "모양 우선", holding: false, influence: false, rs: "any", ibd: "any", ma: "any", ma20: false, ma60: false, volume: "any", detailVolume: [], value: "any" };
const investorGroups = ["개인투자", "외국인", "기타법인", "내외국인", "기관계", "금융기관", "보험", "투신", "기타금융", "은행", "연기금등", "사모펀드", "사모펀드+투신", "사모펀드+연기금", "투신+연기금", "투신+사모+연기금"];
const sample: ResultRow[] = [
  { name: "삼성전자", ticker: "005930", price: 74200, change: 1.42, value: 456700, average: 543000, ibd: 99, rank: 33 },
  { name: "SK하이닉스", ticker: "000660", price: 186300, change: -0.31, value: 345300, average: 363400, ibd: 98, rank: 27 },
  { name: "현대차", ticker: "005380", price: 247500, change: 2.16, value: 212300, average: 197400, ibd: 97, rank: 14 },
  { name: "삼성중공업", ticker: "010140", price: 12680, change: 0.48, value: 97800, average: 88400, ibd: 95, rank: 45 },
];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function describePreset(preset: SearchPreset) {
  const filters = [preset.period, `최대 ${preset.limit}개`];
  if (preset.ant) filters.push("개미 분석");
  if (preset.holding) filters.push("보유비중 증감");
  if (preset.influence) filters.push("영향력");
  if (preset.rs !== "any") filters.push(`RS ${preset.rs}`);
  if (preset.ma !== "any" || preset.ma20 || preset.ma60) filters.push("이동평균선");
  if (preset.value !== "any") filters.push(`거래대금 ${preset.value}억 이상`);
  return `${preset.title} · ${filters.join(" · ")}`;
}

export default function MarketWorkspace({ stocks, ticker, onSelect, chart }: { stocks: Stock[]; ticker: string; onSelect: (ticker: string) => void; chart: React.ReactNode }) {
  const [preset, setPreset] = useState<SearchPreset>(emptyPreset);
  const [slots, setSlots] = useState<(SearchPreset | null)[]>([null, null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [results, setResults] = useState<ResultRow[]>(sample);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [watchTab, setWatchTab] = useState(0);
  const [watchlists, setWatchlists] = useState<string[][]>([["005930"], ["000660"], [], [], []]);
  const [gather, setGather] = useState(false);
  const [sort, setSort] = useState<{ key: keyof ResultRow; asc: boolean }>({ key: "ibd", asc: false });
  const [hidden, setHidden] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [investors, setInvestors] = useState<Record<string, string>>({});
  const [directTicker, setDirectTicker] = useState(ticker);
  const [directName, setDirectName] = useState(stocks.find(stock => stock.ticker === ticker)?.name ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columnSplit, setColumnSplit] = useState(66);
  const [dockHeight, setDockHeight] = useState(184);
  const [rightTop, setRightTop] = useState(47);
  const [rightMiddle, setRightMiddle] = useState(28);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forcemonitor:workspace");
      if (!saved) return;
      const value = JSON.parse(saved);
      if (value.slots) setSlots(value.slots);
      if (value.bookmarks) setBookmarks(value.bookmarks);
      if (value.watchlists) setWatchlists(value.watchlists);
      if (Number.isFinite(value.columnSplit)) setColumnSplit(value.columnSplit);
      if (Number.isFinite(value.dockHeight)) setDockHeight(value.dockHeight);
      if (Number.isFinite(value.rightTop)) setRightTop(value.rightTop);
      if (Number.isFinite(value.rightMiddle)) setRightMiddle(value.rightMiddle);
    } catch { /* Ignore damaged local preferences. */ }
  }, []);
  useEffect(() => {
    localStorage.setItem("forcemonitor:workspace", JSON.stringify({ slots, bookmarks, watchlists, columnSplit, dockHeight, rightTop, rightMiddle }));
  }, [slots, bookmarks, watchlists, columnSplit, dockHeight, rightTop, rightMiddle]);
  useEffect(() => {
    setDirectTicker(ticker);
    setDirectName(stocks.find(stock => stock.ticker === ticker)?.name ?? "");
  }, [ticker, stocks]);

  const ordered = useMemo(() => [...results].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    const direction = typeof av === "string" ? av.localeCompare(String(bv), "ko") : Number(av) - Number(bv);
    const sorted = sort.asc ? direction : -direction;
    return gather ? (Number(bookmarks.includes(b.ticker)) - Number(bookmarks.includes(a.ticker)) || sorted) : sorted;
  }), [results, sort, gather, bookmarks]);
  const selectedWatch = watchlists[watchTab].map(code => sample.find(row => row.ticker === code) ?? stocks.find(stock => stock.ticker === code)).filter(Boolean) as Stock[];
  const activeDescription = activeSlot === null ? "검색조건을 선택하거나 새 조건을 만들어 주세요." : slots[activeSlot] ? describePreset(slots[activeSlot]) : "검색조건이 설정되지 않았습니다.";

  function chooseSlot(index: number) {
    setActiveSlot(index);
    const saved = slots[index];
    setPreset(saved ? { ...emptyPreset, ...saved } : emptyPreset);
    if (!saved) return setMessage(`검색 ${index + 1}에는 저장된 조건이 없습니다.`);
    const next = sample.slice(0, Math.min(saved.limit, saved.perLimit, sample.length));
    setResults(next);
    setMessage(`검색 ${index + 1} · ${saved.title} 결과 ${next.length}개 종목`);
  }
  function savePreset() {
    if (!preset.period) return setMessage("필수 항목인 검색기간을 선택해 주세요.");
    if (!preset.title.trim()) return setMessage("검색 제목을 입력해 주세요.");
    if (activeSlot === null) return setMessage("저장 위치(검색1~검색5)를 먼저 선택해 주세요.");
    const index = activeSlot;
    const next = [...slots];
    next[index] = { ...preset, title: preset.title || `검색 ${index + 1}` };
    setSlots(next);
    setActiveSlot(index);
    setMessage(`검색 ${index + 1}에 조건을 저장했습니다.`);
    setSettingsOpen(false);
  }
  function runSearch() {
    if (!preset.period) return setMessage("필수 항목인 검색기간을 선택해 주세요.");
    const next = sample.slice(0, Math.min(preset.limit, preset.perLimit, sample.length));
    setResults(next);
    setMessage(`임시 검색 결과 · ${next.length}개 종목`);
  }
  function showDirectStock() {
    const stock = directTicker.trim()
      ? stocks.find(item => item.ticker === directTicker.trim())
      : stocks.find(item => item.name === directName.trim());
    if (!stock) return setMessage("종목명 또는 6자리 종목코드를 확인해 주세요.");
    setDirectTicker(stock.ticker);
    setDirectName(stock.name);
    onSelect(stock.ticker);
    setMessage(`${stock.name} 차트를 표시했습니다.`);
  }
  function setSortKey(key: keyof ResultRow) { setSort(current => ({ key, asc: current.key === key ? !current.asc : true })); }
  function toggleBookmark(code: string) { setBookmarks(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]); }
  function addWatch(code: string) {
    setWatchlists(current => {
      const next = current.map(list => [...list]);
      if (next[watchTab].includes(code)) { setMessage("동일 종목이 이미 있습니다."); return current; }
      if (next[watchTab].length >= 50) { setMessage("관심종목 추가 공간이 없습니다."); return current; }
      next[watchTab].push(code);
      setMessage(`관심 ${watchTab + 1}에 추가했습니다.`);
      return next;
    });
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
    if (bounds) setDockHeight(clamp(bounds.bottom - event.clientY, 164, Math.min(300, bounds.height * .45)));
  }
  function resizeRightMiddle(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (bounds) setRightMiddle(clamp(((event.clientY - bounds.top) / bounds.height) * 100 - rightTop, 18, 82 - rightTop));
  }

  const workspaceStyle = { "--workspace-left": `${columnSplit}%` } as CSSProperties;
  const rightStyle = { gridTemplateRows: `${rightTop}fr 8px ${rightMiddle}fr 8px ${100 - rightTop - rightMiddle}fr` };

  return <section className="market-workspace" style={workspaceStyle} aria-label="세력모니터 워크스페이스">
    {message && !settingsOpen && <div className="workspace-message" role="status">{message}<button onClick={() => setMessage("")} aria-label="알림 닫기">×</button></div>}
    <div className="workspace-primary">
      <div className="workspace-chart-slot">{chart}</div>
      <div className="workspace-resizer workspace-resizer-row" role="separator" aria-label="차트와 검색 영역 높이 조절" aria-orientation="horizontal" aria-valuemin={164} aria-valuemax={300} aria-valuenow={dockHeight} tabIndex={0} onPointerDown={capture} onPointerMove={resizeDock} onDoubleClick={() => setDockHeight(184)} onKeyDown={event => { if (event.key === "ArrowUp") setDockHeight(value => clamp(value + 8, 164, 300)); if (event.key === "ArrowDown") setDockHeight(value => clamp(value - 8, 164, 300)); }} />
      <section className="workspace-panel search-dock" style={{ flexBasis: dockHeight }} aria-label="종목 및 저장 검색">
        <div className="stock-lookup">
          <label>종목이름<input value={directName} onChange={event => { setDirectName(event.target.value); setDirectTicker(""); }} placeholder="삼성전자" /></label>
          <label>종목코드<input inputMode="numeric" maxLength={6} value={directTicker} onChange={event => { setDirectTicker(event.target.value.replace(/\D/g, "")); setDirectName(""); }} placeholder="005930" /></label>
          <button onClick={showDirectStock}>차트보기</button>
        </div>
        <div className="quick-presets" aria-label="저장 검색">{slots.map((slot, index) => <button key={index} className={`${activeSlot === index ? "active" : ""} ${slot ? "saved" : "empty"}`} onClick={() => chooseSlot(index)}>검색 {index + 1}</button>)}</div>
        <p className="preset-description"><span>검색조건</span>{activeDescription}</p>
        <button className="open-search-settings" onClick={() => setSettingsOpen(true)}>검색조건 만들기</button>
      </section>
    </div>

    <div className="workspace-resizer workspace-resizer-column" role="separator" aria-label="차트와 데이터 창 너비 조절" aria-orientation="vertical" aria-valuemin={48} aria-valuemax={76} aria-valuenow={columnSplit} tabIndex={0} onPointerDown={capture} onPointerMove={resizeColumns} onDoubleClick={() => setColumnSplit(66)} onKeyDown={event => { if (event.key === "ArrowLeft") setColumnSplit(value => clamp(value - 2, 48, 76)); if (event.key === "ArrowRight") setColumnSplit(value => clamp(value + 2, 48, 76)); }} />

    <aside className="workspace-secondary" style={rightStyle}>
      <ResultsPanel ordered={ordered} ticker={ticker} sort={sort} hidden={hidden} gather={gather} bookmarks={bookmarks} onSelect={onSelect} onSort={setSortKey} onToggleBookmark={toggleBookmark} onAddWatch={addWatch} onShowAll={() => { setResults(sample); setMessage("전체 종목을 표시합니다."); }} onClearBookmarks={() => setBookmarks([])} onToggleGather={() => setGather(!gather)} onToggleColumn={key => setHidden(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])} onAiCopy={aiCopy} />
      <div className="workspace-resizer workspace-resizer-row" role="separator" aria-label="검색 결과와 관심종목 높이 조절" aria-orientation="horizontal" aria-valuemin={30} aria-valuemax={82 - rightMiddle} aria-valuenow={rightTop} tabIndex={0} onPointerDown={capture} onPointerMove={resizeRightTop} onDoubleClick={() => setRightTop(47)} onKeyDown={event => { if (event.key === "ArrowUp") setRightTop(value => clamp(value - 2, 30, 82 - rightMiddle)); if (event.key === "ArrowDown") setRightTop(value => clamp(value + 2, 30, 82 - rightMiddle)); }} />
      <WatchPanel watchlists={watchlists} watchTab={watchTab} selectedWatch={selectedWatch} ticker={ticker} onTab={setWatchTab} onSelect={onSelect} onAdd={addWatch} onClear={() => setWatchlists(current => current.map((list, index) => index === watchTab ? [] : list))} onRemove={code => setWatchlists(current => current.map((list, index) => index === watchTab ? list.filter(item => item !== code) : list))} onMoveToResults={() => { const codes = new Set(selectedWatch.map(item => item.ticker)); setResults(sample.filter(row => codes.has(row.ticker))); setMessage(`관심 ${watchTab + 1} 종목을 검색 결과로 옮겼습니다.`); }} />
      <div className="workspace-resizer workspace-resizer-row" role="separator" aria-label="관심종목과 뉴스 높이 조절" aria-orientation="horizontal" aria-valuemin={18} aria-valuemax={82 - rightTop} aria-valuenow={rightMiddle} tabIndex={0} onPointerDown={capture} onPointerMove={resizeRightMiddle} onDoubleClick={() => setRightMiddle(28)} onKeyDown={event => { if (event.key === "ArrowUp") setRightMiddle(value => clamp(value - 2, 18, 82 - rightTop)); if (event.key === "ArrowDown") setRightMiddle(value => clamp(value + 2, 18, 82 - rightTop)); }} />
      <div className="workspace-panel news-panel"><div><span className="panel-kicker">종목 뉴스</span><h2>{sample.find(row => row.ticker === ticker)?.name ?? ticker} 관련 뉴스</h2><p>최신 기사는 새 브라우저 탭에서 확인합니다.</p></div><a target="_blank" rel="noreferrer" href={`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent((sample.find(row => row.ticker === ticker)?.name ?? ticker) + " 주식")}`}>네이버 뉴스에서 보기 <span>↗</span></a></div>
    </aside>
    {settingsOpen && <SearchSettingsDialog message={message} slots={slots} activeSlot={activeSlot} preset={preset} investors={investors} onDismissMessage={() => setMessage("")} onClose={() => setSettingsOpen(false)} onSelectSlot={(index, slot) => { setActiveSlot(index); setPreset(slot ? { ...emptyPreset, ...slot } : emptyPreset); }} setPreset={setPreset} setActiveSlot={setActiveSlot} setInvestors={setInvestors} onSave={savePreset} onSearch={runSearch} />}
  </section>;
}

function SearchSettingsDialog({ message, slots, activeSlot, preset, investors, onDismissMessage, onClose, onSelectSlot, setPreset, setActiveSlot, setInvestors, onSave, onSearch }: { message: string; slots: (SearchPreset | null)[]; activeSlot: number | null; preset: SearchPreset; investors: Record<string, string>; onDismissMessage: () => void; onClose: () => void; onSelectSlot: (index: number, slot: SearchPreset | null) => void; setPreset: (value: SearchPreset) => void; setActiveSlot: (value: number | null) => void; setInvestors: (value: Record<string, string>) => void; onSave: () => void; onSearch: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  function closeFromBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (!inside) onClose();
  }

  return <dialog ref={dialogRef} className="workspace-panel search-builder search-settings-panel workspace-search-modal" aria-modal="true" aria-labelledby="search-settings-title" onCancel={event => { event.preventDefault(); onClose(); }} onMouseDown={closeFromBackdrop}>
    {message && <div className="workspace-message modal-workspace-message" role="status">{message}<button onClick={onDismissMessage} aria-label="알림 닫기">×</button></div>}
    <aside><div className="settings-panel-heading"><span className="panel-kicker">저장 위치</span><button autoFocus onClick={onClose} aria-label="검색 설정 닫기">×</button></div><div className="preset-slots">{slots.map((slot, index) => <button key={index} className={`${activeSlot === index ? "active" : ""} ${slot ? "saved" : "empty"}`} onClick={() => onSelectSlot(index, slot)}><b>검색 {index + 1}</b><small>{slot?.title || "설정되지 않음"}</small></button>)}</div><label>검색 제목<input required value={preset.title} placeholder="예: 급등주 위주" onChange={event => setPreset({ ...preset, title: event.target.value })} /></label><button className="secondary-action" onClick={onSave}>검색조건 저장</button></aside>
    <div className="condition-scroll"><div className="condition-title"><div><span className="panel-kicker">검색 설정창</span><h2 id="search-settings-title">{activeSlot === null ? "새 검색 만들기" : `검색 ${activeSlot + 1}`}</h2><p>검색조건은 임시 검색으로 먼저 확인한 뒤 원하는 위치에 저장할 수 있습니다.</p></div><div className="builder-actions"><button onClick={() => { setPreset(emptyPreset); setActiveSlot(null); }}>초기화</button><button className="primary-action" onClick={onSearch}>임시 검색</button></div></div>
      <Condition title="기간 설정 *" required><Radio values={["1주", "2주", "1달", "2달"]} value={preset.period} set={period => setPreset({ ...preset, period: String(period) })} /></Condition>
      <Condition title="최종 검색 결과 최대치 *" required><Radio values={[20, 50, 100, 200, 300]} value={preset.limit} set={limit => setPreset({ ...preset, limit: Number(limit) })} prefix="상위 " /></Condition>
      <Condition title="개별 검색결과 허용 종목수 *" required><Radio values={[100, 200, 400]} value={preset.perLimit} set={perLimit => setPreset({ ...preset, perLimit: Number(perLimit) })} prefix="상위 " /></Condition>
      <Condition title="개미 분석 필터"><Toggle checked={preset.ant} label="사용" onChange={ant => setPreset({ ...preset, ant })} /><Radio disabled={!preset.ant} values={["모양 우선", "크기차 우선"]} value={preset.antPriority} set={antPriority => setPreset({ ...preset, antPriority: String(antPriority) })} /></Condition>
      <Condition title="보유비중 증감"><Toggle checked={preset.holding} label="사용" onChange={holding => setPreset({ ...preset, holding })} />{preset.holding && <InvestorMatrix mode="holding" value={investors} set={setInvestors} />}</Condition>
      <Condition title="영향력"><Toggle checked={preset.influence} label="사용" onChange={influence => setPreset({ ...preset, influence })} />{preset.influence && <InvestorMatrix mode="power" value={investors} set={setInvestors} />}</Condition>
      <div className="condition-columns"><Condition title="RS 증감"><Radio values={["any", "상승", "하락"]} labels={["무관", "상승", "하락"]} value={preset.rs} set={rs => setPreset({ ...preset, rs: String(rs) })} /></Condition><Condition title="IBD RS"><Radio values={["any", "80", "90"]} labels={["무관", ">80점", ">90점"]} value={preset.ibd} set={ibd => setPreset({ ...preset, ibd: String(ibd) })} /></Condition></div>
      <Condition title="이동평균선"><Radio values={["any", "regular"]} labels={["무관", "정배열 (20이평 > 60이평)"]} value={preset.ma} set={ma => setPreset({ ...preset, ma: String(ma) })} /><Toggle checked={preset.ma20} label="20이평 상승" onChange={ma20 => setPreset({ ...preset, ma20 })} /><Toggle checked={preset.ma60} label="60이평 상승" onChange={ma60 => setPreset({ ...preset, ma60 })} /></Condition>
      <div className="condition-columns"><Condition title="전체 특이 거래량"><Radio values={["any", "3m", "6m", "1y"]} labels={["무관", "3개월", "6개월", "1년"]} value={preset.volume} set={volume => setPreset({ ...preset, volume: String(volume) })} /></Condition><Condition title="최근 5일 평균 거래대금"><Radio values={["any", "10", "50", "100", "500"]} labels={["무관", "10억 이상", "50억 이상", "100억 이상", "500억 이상"]} value={preset.value} set={value => setPreset({ ...preset, value: String(value) })} /></Condition></div>
      <Condition title="세부 특이 거래량"><div className="detail-volume-options">{investorGroups.slice(1).map(name => <Toggle key={name} checked={preset.detailVolume.includes(name)} label={name} onChange={checked => setPreset({ ...preset, detailVolume: checked ? [...preset.detailVolume, name] : preset.detailVolume.filter(item => item !== name) })} />)}</div></Condition>
      <div className="temporary-search"><div><b>저장하지 않고 결과 확인</b><p>위에서 설정한 조건으로 검색 결과를 먼저 확인합니다.</p></div><button onClick={onSearch}>임시 검색</button></div>
    </div>
  </dialog>;
}

function ResultsPanel({ ordered, ticker, sort, hidden, gather, bookmarks, onSelect, onSort, onToggleBookmark, onAddWatch, onShowAll, onClearBookmarks, onToggleGather, onToggleColumn, onAiCopy }: { ordered: ResultRow[]; ticker: string; sort: { key: keyof ResultRow; asc: boolean }; hidden: string[]; gather: boolean; bookmarks: string[]; onSelect: (ticker: string) => void; onSort: (key: keyof ResultRow) => void; onToggleBookmark: (ticker: string) => void; onAddWatch: (ticker: string) => void; onShowAll: () => void; onClearBookmarks: () => void; onToggleGather: () => void; onToggleColumn: (key: string) => void; onAiCopy: () => void }) {
  return <div className="workspace-panel results-panel"><div className="panel-toolbar"><div><span className="panel-kicker">검색 결과</span><b>{ordered.length}개 종목</b></div><div><button onClick={onShowAll}>전종목 보기</button><button onClick={onClearBookmarks}>북마크 전체 삭제</button><button className={gather ? "active" : ""} onClick={onToggleGather}>★ 모아보기</button><details><summary>창 설정</summary><div className="column-settings">{["alarm", "change", "value", "average", "ibd", "rank"].map(key => <label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={() => onToggleColumn(key)} />{({ alarm: "알람", change: "상태", value: "거래액", average: "5일평균", ibd: "IBD RS", rank: "고수계좌" } as Record<string, string>)[key]}</label>)}</div></details><button className="ai-copy" onClick={onAiCopy}>AI 복사</button></div></div><div className="result-table-wrap"><table className="result-table"><thead><tr><th>★</th><Sortable label="종목" field="name" sort={sort} onClick={onSort} />{!hidden.includes("alarm") && <th>알람</th>}<Sortable label="가격" field="price" sort={sort} onClick={onSort} />{!hidden.includes("change") && <Sortable label="상태" field="change" sort={sort} onClick={onSort} />}{!hidden.includes("value") && <Sortable label="거래액(백만)" field="value" sort={sort} onClick={onSort} />}{!hidden.includes("average") && <Sortable label="5일 평균" field="average" sort={sort} onClick={onSort} />}{!hidden.includes("ibd") && <Sortable label="IBD RS" field="ibd" sort={sort} onClick={onSort} />}{!hidden.includes("rank") && <Sortable label="고수계좌 순위" field="rank" sort={sort} onClick={onSort} />}<th>관리</th></tr></thead><tbody>{ordered.map(row => <tr key={row.ticker} className={ticker === row.ticker ? "selected" : ""} onClick={() => onSelect(row.ticker)}><td><button className="star" onClick={event => { event.stopPropagation(); onToggleBookmark(row.ticker); }}>{bookmarks.includes(row.ticker) ? "★" : "☆"}</button></td><td><b>{row.name}</b><small>{row.ticker}</small></td>{!hidden.includes("alarm") && <td>—</td>}<td>{row.price.toLocaleString()}</td>{!hidden.includes("change") && <td><span className={row.change >= 0 ? "up" : "down"}>{row.change >= 0 ? "U " : ""}{row.change > 0 ? "+" : ""}{row.change}%</span></td>}{!hidden.includes("value") && <td>{row.value.toLocaleString()}</td>}{!hidden.includes("average") && <td>{row.average.toLocaleString()}</td>}{!hidden.includes("ibd") && <td>{row.ibd}</td>}{!hidden.includes("rank") && <td>{row.rank}</td>}<td><button onClick={event => { event.stopPropagation(); onAddWatch(row.ticker); }}>관심 +</button></td></tr>)}</tbody></table></div></div>;
}

function WatchPanel({ watchlists, watchTab, selectedWatch, ticker, onTab, onSelect, onAdd, onClear, onRemove, onMoveToResults }: { watchlists: string[][]; watchTab: number; selectedWatch: Stock[]; ticker: string; onTab: (index: number) => void; onSelect: (ticker: string) => void; onAdd: (ticker: string) => void; onClear: () => void; onRemove: (ticker: string) => void; onMoveToResults: () => void }) {
  return <div className="workspace-panel watch-panel"><div className="watch-tabs">{watchlists.map((list, index) => <button className={watchTab === index ? "active" : ""} key={index} onClick={() => onTab(index)}>관심 {index + 1}<span>{list.length}/50</span></button>)}</div><div className="watch-actions"><button onClick={onClear}>전체 삭제</button><button onClick={() => onAdd(ticker)}>현재 종목 추가</button><button className="watch-to-results" disabled={!selectedWatch.length} onClick={onMoveToResults}>검색창에서 보기</button></div>{selectedWatch.length ? <ol className="watch-list">{selectedWatch.sort((a, b) => a.name.localeCompare(b.name, "ko")).map(stock => <li key={stock.ticker}><button onClick={() => onSelect(stock.ticker)}><span><b>{stock.name}</b><small>{stock.ticker}</small></span></button><button aria-label={`${stock.name} 관심종목 제외`} onClick={() => onRemove(stock.ticker)}>×</button></li>)}</ol> : <div className="panel-empty">관심종목이 없습니다. 검색 결과에서 종목을 추가해 보세요.</div>}</div>;
}

function Condition({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) { return <fieldset className="condition-card"><legend className={required ? "required" : ""}>{title}</legend><div>{children}</div></fieldset>; }
function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) { return <label className="check-control"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>; }
function Radio({ values, labels, value, set, prefix = "", disabled = false }: { values: (string | number)[]; labels?: string[]; value: string | number; set: (value: string | number) => void; prefix?: string; disabled?: boolean }) { return <div className="radio-row">{values.map((item, index) => <label key={item} className={disabled ? "disabled" : ""}><input type="radio" disabled={disabled} checked={value === item} onChange={() => set(item)} /><span>{prefix}{labels?.[index] ?? item}</span></label>)}</div>; }
function InvestorMatrix({ mode, value, set }: { mode: "holding" | "power"; value: Record<string, string>; set: (value: Record<string, string>) => void }) { return <div className="investor-matrix">{investorGroups.map(name => <div key={name}><span>{name}</span>{(mode === "holding" ? ["증가", "감소"] : ["매수력", "매도력"]).map(option => <label key={option}><input type="radio" name={`${mode}-${name}`} checked={value[`${mode}-${name}`] === option} onChange={() => set({ ...value, [`${mode}-${name}`]: option })} />{option}</label>)}</div>)}</div>; }
function Sortable({ label, field, sort, onClick }: { label: string; field: keyof ResultRow; sort: { key: keyof ResultRow; asc: boolean }; onClick: (key: keyof ResultRow) => void }) { return <th><button onClick={() => onClick(field)}>{label} {sort.key === field ? (sort.asc ? "↑" : "↓") : "↕"}</button></th>; }
