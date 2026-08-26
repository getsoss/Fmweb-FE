"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [directStock, setDirectStock] = useState(ticker);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forcemonitor:workspace");
      if (!saved) return;
      const value = JSON.parse(saved);
      if (value.slots) setSlots(value.slots); if (value.bookmarks) setBookmarks(value.bookmarks); if (value.watchlists) setWatchlists(value.watchlists);
    } catch { /* Ignore damaged local preferences. */ }
  }, []);
  useEffect(() => { localStorage.setItem("forcemonitor:workspace", JSON.stringify({ slots, bookmarks, watchlists })); }, [slots, bookmarks, watchlists]);

  const ordered = useMemo(() => [...results].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key]; const direction = typeof av === "string" ? av.localeCompare(String(bv), "ko") : Number(av) - Number(bv);
    const sorted = sort.asc ? direction : -direction;
    return gather ? (Number(bookmarks.includes(b.ticker)) - Number(bookmarks.includes(a.ticker)) || sorted) : sorted;
  }), [results, sort, gather, bookmarks]);
  const selectedWatch = watchlists[watchTab].map(code => sample.find(row => row.ticker === code) ?? stocks.find(stock => stock.ticker === code)).filter(Boolean) as Stock[];

  function chooseSlot(index: number) { setActiveSlot(index); const saved = slots[index]; setPreset(saved ? { ...emptyPreset, ...saved } : emptyPreset); setMessage(saved ? `검색${index + 1} · ${saved.title}` : "검색조건이 설정되지 않았습니다."); }
  function savePreset() { if (!preset.period) return setMessage("필수 항목인 검색기간을 선택해 주세요."); const index = activeSlot ?? slots.findIndex(slot => !slot); if (index < 0) return setMessage("저장 위치(검색1~검색5)를 먼저 선택해 주세요."); const next = [...slots]; next[index] = { ...preset, title: preset.title || `검색 ${index + 1}` }; setSlots(next); setActiveSlot(index); setMessage(`검색${index + 1}에 조건을 저장했습니다.`); }
  function runSearch(source: "saved" | "temporary" = "temporary") { if (!preset.period) return setMessage("필수 항목인 검색기간을 선택해 주세요."); if (source === "saved" && (activeSlot === null || !slots[activeSlot])) return setMessage("실행할 저장 검색을 먼저 선택해 주세요."); const next=sample.slice(0,Math.min(preset.limit,preset.perLimit,sample.length));setResults(next);setMessage(`${source === "saved" ? `검색${activeSlot! + 1}` : "임시 검색"} 결과 · ${next.length}개 종목`); }
  function showDirectStock() { const query=directStock.trim(); const stock=stocks.find(item=>item.ticker===query||item.name===query); if(!stock)return setMessage("종목명 또는 6자리 종목코드를 확인해 주세요."); onSelect(stock.ticker); setMessage(`${stock.name} 차트를 표시했습니다.`); }
  function setSortKey(key: keyof ResultRow) { setSort(current => ({ key, asc: current.key === key ? !current.asc : true })); }
  function toggleBookmark(code: string) { setBookmarks(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]); }
  function addWatch(code: string) { setWatchlists(current => { const next = current.map(list => [...list]); if (next[watchTab].includes(code)) { setMessage("동일 종목이 이미 있습니다."); return current; } if (next[watchTab].length >= 50) { setMessage("관심종목 추가 공간이 없습니다."); return current; } next[watchTab].push(code); setMessage(`관심${watchTab + 1}에 추가했습니다.`); return next; }); }
  async function aiCopy() { const body = ordered.slice(0, 100).map(row => `${row.name}(${row.ticker}) IBD RS ${row.ibd}, 등락률 ${row.change}%`).join("\n") + "\n\n위 종목들을 분석해서, 현재 주식시장의 주도 섹터와 주도주가 무엇인지 설명해줘. 가장 좋은 종목도 추천해줘."; try { await navigator.clipboard.writeText(body); setMessage("종목과 AI 분석 프롬프트를 복사했습니다."); } catch { setMessage("클립보드 권한을 확인해 주세요."); } }

  return <section className="market-workspace" aria-label="세력모니터 워크스페이스">
    <div className="workspace-primary">
      <div className="workspace-chart-slot">{chart}</div>
      <div className="workspace-panel search-builder">
      <aside><span className="panel-kicker">저장 검색</span><div className="preset-slots">{slots.map((slot,index) => <button key={index} className={`${activeSlot === index ? "active" : ""} ${slot ? "saved" : "empty"}`} onClick={() => chooseSlot(index)}><b>검색 {index + 1}</b><small>{slot?.title || "설정되지 않음"}</small></button>)}</div><button className="preset-run" disabled={activeSlot===null||!slots[activeSlot]} onClick={()=>runSearch("saved")}>선택한 검색 실행</button><label>검색 제목<input value={preset.title} placeholder="예: 급등주 위주" onChange={event => setPreset({...preset,title:event.target.value})}/></label><button className="secondary-action" onClick={savePreset}>검색조건 저장</button></aside>
      <div className="condition-scroll"><div className="condition-title"><div><span className="panel-kicker">검색조건 세팅</span><h2>{activeSlot === null ? "새 검색 만들기" : `검색 ${activeSlot + 1}`}</h2></div><div className="builder-actions"><button onClick={() => { setPreset(emptyPreset); setActiveSlot(null); }}>초기화</button><button className="primary-action" onClick={()=>runSearch("temporary")}>임시 검색</button></div></div>
        <div className="direct-stock-search"><label>종목명 또는 종목코드<input value={directStock} onChange={event=>setDirectStock(event.target.value)} placeholder="예: 삼성전자 또는 005930"/></label><button onClick={showDirectStock}>차트보기</button><p>종목을 직접 조회하며 저장 검색 조건에는 영향을 주지 않습니다.</p></div>
        <Condition title="기간 설정 *" required><Radio values={["1주","2주","1달","2달"]} value={preset.period} set={period => setPreset({...preset,period:String(period)})}/></Condition>
        <Condition title="최종 검색 결과 최대치"><Radio values={[20,50,100,200,300]} value={preset.limit} set={limit => setPreset({...preset,limit:Number(limit)})} prefix="상위 "/></Condition>
        <Condition title="개별 검색결과 허용 종목수 *" required><Radio values={[100,200,400]} value={preset.perLimit} set={perLimit => setPreset({...preset,perLimit:Number(perLimit)})} prefix="상위 "/></Condition>
        <Condition title="개미 분석 필터"><Toggle checked={preset.ant} label="사용" onChange={ant => setPreset({...preset,ant})}/><Radio disabled={!preset.ant} values={["모양 우선","크기차 우선"]} value={preset.antPriority} set={antPriority => setPreset({...preset,antPriority:String(antPriority)})}/></Condition>
        <Condition title="보유비중 증감"><Toggle checked={preset.holding} label="사용" onChange={holding => setPreset({...preset,holding})}/>{preset.holding && <InvestorMatrix mode="holding" value={investors} set={setInvestors}/>}</Condition>
        <Condition title="영향력"><Toggle checked={preset.influence} label="사용" onChange={influence => setPreset({...preset,influence})}/>{preset.influence && <InvestorMatrix mode="power" value={investors} set={setInvestors}/>}</Condition>
        <div className="condition-columns"><Condition title="RS 증감"><Radio values={["any","상승","하락"]} labels={["무관","상승","하락"]} value={preset.rs} set={rs => setPreset({...preset,rs:String(rs)})}/></Condition><Condition title="IBD RS"><Radio values={["any","80","90"]} labels={["무관",">80점",">90점"]} value={preset.ibd} set={ibd => setPreset({...preset,ibd:String(ibd)})}/></Condition></div>
        <Condition title="이동평균선"><Radio values={["any","regular"]} labels={["무관","정배열 (20이평 > 60이평)"]} value={preset.ma} set={ma => setPreset({...preset,ma:String(ma)})}/><Toggle checked={preset.ma20} label="20이평 상승" onChange={ma20 => setPreset({...preset,ma20})}/><Toggle checked={preset.ma60} label="60이평 상승" onChange={ma60 => setPreset({...preset,ma60})}/></Condition>
        <div className="condition-columns"><Condition title="전체 특이 거래량"><Radio values={["any","3m","6m","1y"]} labels={["무관","3개월","6개월","1년"]} value={preset.volume} set={volume => setPreset({...preset,volume:String(volume)})}/></Condition><Condition title="최근 5일 평균 거래대금"><Radio values={["any","10","50","100","500"]} labels={["무관","10억 이상","50억 이상","100억 이상","500억 이상"]} value={preset.value} set={value => setPreset({...preset,value:String(value)})}/></Condition></div>
        <Condition title="세부 특이 거래량"><div className="detail-volume-options">{investorGroups.slice(1).map(name=><Toggle key={name} checked={preset.detailVolume.includes(name)} label={name} onChange={checked=>setPreset({...preset,detailVolume:checked?[...preset.detailVolume,name]:preset.detailVolume.filter(item=>item!==name)})}/>)}</div></Condition>
        <div className="temporary-search"><div><b>저장하지 않고 결과 확인</b><p>현재 설정한 조건으로만 검색하며 저장된 검색은 변경하지 않습니다.</p></div><button onClick={()=>runSearch("temporary")}>임시 검색</button></div>
      </div>
      </div>
    </div>

    <aside className="workspace-secondary">
      {message && <div className="workspace-message" role="status">{message}<button onClick={() => setMessage("")} aria-label="알림 닫기">×</button></div>}
      <div className="workspace-panel results-panel"><div className="panel-toolbar"><div><span className="panel-kicker">검색 결과</span><b>{ordered.length}개 종목</b></div><div><button onClick={()=>{setResults(sample);setMessage("전체 종목을 표시합니다.")}}>전종목 보기</button><button onClick={() => setBookmarks([])}>북마크 전체 삭제</button><button className={gather ? "active" : ""} onClick={() => setGather(!gather)}>★ 모아보기</button><details><summary>창 설정</summary><div className="column-settings">{["alarm","change","value","average","ibd","rank"].map(key => <label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={() => setHidden(current => current.includes(key) ? current.filter(item => item !== key) : [...current,key])}/>{({alarm:"알람",change:"상태",value:"거래액",average:"5일평균",ibd:"IBD RS",rank:"고수계좌"} as Record<string,string>)[key]}</label>)}</div></details><button className="ai-copy" onClick={aiCopy}>AI 복사</button></div></div>
        <div className="result-table-wrap"><table className="result-table"><thead><tr><th>★</th><Sortable label="종목" field="name" sort={sort} onClick={setSortKey}/>{!hidden.includes("alarm")&&<th>알람</th>}<Sortable label="가격" field="price" sort={sort} onClick={setSortKey}/>{!hidden.includes("change")&&<Sortable label="상태" field="change" sort={sort} onClick={setSortKey}/>}<>{!hidden.includes("value")&&<Sortable label="거래액(백만)" field="value" sort={sort} onClick={setSortKey}/>}</><>{!hidden.includes("average")&&<Sortable label="5일 평균" field="average" sort={sort} onClick={setSortKey}/>}</><>{!hidden.includes("ibd")&&<Sortable label="IBD RS" field="ibd" sort={sort} onClick={setSortKey}/>}</><>{!hidden.includes("rank")&&<Sortable label="고수계좌 순위" field="rank" sort={sort} onClick={setSortKey}/>}</><th>관리</th></tr></thead><tbody>{ordered.map(row => <tr key={row.ticker} className={ticker === row.ticker ? "selected" : ""} onClick={() => onSelect(row.ticker)}><td><button className="star" onClick={event => { event.stopPropagation(); toggleBookmark(row.ticker); }}>{bookmarks.includes(row.ticker) ? "★" : "☆"}</button></td><td><b>{row.name}</b><small>{row.ticker}</small></td>{!hidden.includes("alarm")&&<td>—</td>}<td>{row.price.toLocaleString()}</td>{!hidden.includes("change")&&<td><span className={row.change >= 0 ? "up" : "down"}>{row.change >= 0 ? "U " : ""}{row.change > 0 ? "+" : ""}{row.change}%</span></td>}{!hidden.includes("value")&&<td>{row.value.toLocaleString()}</td>}{!hidden.includes("average")&&<td>{row.average.toLocaleString()}</td>}{!hidden.includes("ibd")&&<td>{row.ibd}</td>}{!hidden.includes("rank")&&<td>{row.rank}</td>}<td><button onClick={event => { event.stopPropagation(); addWatch(row.ticker); }}>관심 +</button></td></tr>)}</tbody></table></div></div>

      <div className="workspace-panel watch-panel"><div className="watch-tabs">{watchlists.map((list,index) => <button className={watchTab === index ? "active" : ""} key={index} onClick={() => setWatchTab(index)}>관심 {index + 1}<span>{list.length}/50</span></button>)}</div><div className="watch-actions"><button onClick={() => setWatchlists(current => current.map((list,index) => index === watchTab ? [] : list))}>전체 삭제</button><button onClick={() => addWatch(ticker)}>현재 종목 추가</button><button className="watch-to-results" disabled={!selectedWatch.length} onClick={()=>{const codes=new Set(selectedWatch.map(item=>item.ticker));setResults(sample.filter(row=>codes.has(row.ticker)));setMessage(`관심 ${watchTab+1} 종목을 검색 결과로 옮겼습니다.`)}}>검색창에서 보기</button></div>{selectedWatch.length ? <ol className="watch-list">{selectedWatch.sort((a,b) => a.name.localeCompare(b.name,"ko")).map(stock => <li key={stock.ticker}><button onClick={() => onSelect(stock.ticker)}><span><b>{stock.name}</b><small>{stock.ticker}</small></span></button><button aria-label={`${stock.name} 관심종목 제외`} onClick={() => setWatchlists(current => current.map((list,index) => index === watchTab ? list.filter(code => code !== stock.ticker) : list))}>×</button></li>)}</ol> : <div className="panel-empty">관심종목이 없습니다. 검색 결과에서 종목을 추가해 보세요.</div>}</div>

      <div className="workspace-panel news-panel"><div><span className="panel-kicker">종목 뉴스</span><h2>{sample.find(row => row.ticker === ticker)?.name ?? ticker} 관련 뉴스</h2><p>최신 기사는 새 브라우저 탭에서 확인합니다.</p></div><a target="_blank" rel="noreferrer" href={`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent((sample.find(row => row.ticker === ticker)?.name ?? ticker) + " 주식")}`}>네이버 뉴스에서 보기 <span>↗</span></a></div>
    </aside>
  </section>;
}

function Condition({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) { return <fieldset className="condition-card"><legend className={required ? "required" : ""}>{title}</legend><div>{children}</div></fieldset>; }
function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) { return <label className="check-control"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/><span>{label}</span></label>; }
function Radio({ values, labels, value, set, prefix="", disabled=false }: { values:(string|number)[]; labels?:string[]; value:string|number; set:(value:string|number)=>void; prefix?:string; disabled?:boolean }) { return <div className="radio-row">{values.map((item,index)=><label key={item} className={disabled ? "disabled" : ""}><input type="radio" disabled={disabled} checked={value===item} onChange={()=>set(item)}/><span>{prefix}{labels?.[index] ?? item}</span></label>)}</div>; }
function InvestorMatrix({ mode, value, set }: { mode:"holding"|"power"; value:Record<string,string>; set:(value:Record<string,string>)=>void }) { return <div className="investor-matrix">{investorGroups.map(name => <div key={name}><span>{name}</span>{(mode === "holding" ? ["증가","감소"] : ["매수력","매도력"]).map(option => <label key={option}><input type="radio" name={`${mode}-${name}`} checked={value[`${mode}-${name}`]===option} onChange={()=>set({...value,[`${mode}-${name}`]:option})}/>{option}</label>)}</div>)}</div>; }
function Sortable({ label, field, sort, onClick }: { label:string; field:keyof ResultRow; sort:{key:keyof ResultRow;asc:boolean}; onClick:(key:keyof ResultRow)=>void }) { return <th><button onClick={()=>onClick(field)}>{label} {sort.key===field?(sort.asc?"↑":"↓"):"↕"}</button></th>; }
