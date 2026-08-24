"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import ChartWorkspace from "./components/chart/ChartWorkspace";
import MarketWorkspace from "./components/MarketWorkspace";
import LandingPage from "./components/LandingPage";

type StockData = { ticker: string; candles: number[][]; holdings: number[][]; averageTradePrices: number[][]; holdingChanges: number[][]; power: number[][]; direction: number[][]; rs: number[][] };
const format = new Intl.NumberFormat("ko-KR");
const stocks = [{ name: "삼성전자", ticker: "005930" }, { name: "SK하이닉스", ticker: "000660" }, { name: "현대차", ticker: "005380" }, { name: "삼성중공업", ticker: "010140" }];

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [input, setInput] = useState("005930"); const [ticker, setTicker] = useState("005930"); const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [showScreener, setShowScreener] = useState(false);
  const [showLogin, setShowLogin] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [memberId, setMemberId] = useState(""); const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setMemberId(localStorage.getItem("forcemonitor:member-id") ?? ""); }, []);
  useEffect(() => { if (!entered) return; const controller = new AbortController(); setLoading(true); setError(""); fetch(`/api/stocks/${ticker}`, { signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.message); return body as StockData; }).then(setData).catch(reason => { if (reason.name !== "AbortError") setError(reason.message); }).finally(() => setLoading(false)); return () => controller.abort(); }, [ticker, entered]);
  const latest = data?.candles[0]; const previous = data?.candles[1]; const holding = data?.holdings[0]; const name = stocks.find(stock => stock.ticker === ticker)?.name ?? ticker;
  const change = useMemo(() => latest && previous ? ((latest[1] - previous[1]) / previous[1]) * 100 : 0, [latest, previous]);
  function search(event: FormEvent) { event.preventDefault(); if (!/^\d{6}$/.test(input)) return setError("종목코드를 숫자 6자리로 입력해 주세요."); setTicker(input); }
  function selectTicker(next: string) { setInput(next); setTicker(next); }

  if (!entered) return <LandingPage onEnter={() => setEntered(true)}/>;

  return <main className="app-shell">
    <header className="app-bar"><div className="app-bar-inner"><a className="wordmark" href="#top" aria-label="세력모니터 홈" onClick={event => { event.preventDefault(); setEntered(false); }}><Image className="brand-symbol" src="/assets/brand/motrader-symbol.png" alt="" width={30} height={35} priority/>세력모니터</a><nav className="service-links" aria-label="서비스 링크"><button onClick={() => setEntered(false)}>홈</button><a href="https://cafe.naver.com/motrader" target="_blank" rel="noreferrer" aria-label="모트레이더 네이버카페 새 창에서 열기">네이버카페</a><a href="https://gemini.google.com" target="_blank" rel="noreferrer">제미나이</a><a href="https://chatgpt.com" target="_blank" rel="noreferrer">ChatGPT</a></nav><form className="global-search" onSubmit={search}><span aria-hidden="true">⌕</span><input aria-label="종목코드 검색" placeholder="종목코드 6자리를 입력해 주세요" value={input} maxLength={6} onChange={event => setInput(event.target.value.replace(/\D/g, ""))}/><button disabled={loading}>{loading ? "조회 중" : "조회하기"}</button></form><button className="app-search-button" onClick={() => setShowScreener(true)}>조건 검색</button><div className="account-wrap"><button className="account-button" aria-label="계정" onClick={() => signedIn ? setAccountOpen(!accountOpen) : setShowLogin(true)}>{signedIn ? memberId.slice(0,1).toUpperCase() : "계정"}</button>{accountOpen && <div className="account-menu"><button onClick={() => { setSignedIn(false); setAccountOpen(false); }}>로그아웃</button><span>{memberId}</span><small>세력모니터 회원</small></div>}</div></div></header>
    <div className="page" id="top">
      <section className="welcome"><div><span className="eyebrow">오늘의 주식 데이터</span><h1>복잡한 수급 흐름을<br/>한눈에 확인해요</h1><p>가격과 보유 현황, 투자자 영향력을 한곳에서 살펴볼 수 있어요.</p></div><button className="welcome-action" onClick={() => setShowScreener(true)}><span>⌕</span><div><b>조건으로 종목 찾기</b><small>가격·수익률·보유비중 변화로 검색해요</small></div><i>›</i></button></section>
      <section className="quick-section"><div className="section-heading quick-heading"><div><h2>자주 보는 종목</h2><p>관심 종목을 선택해 흐름을 빠르게 비교하세요</p></div></div><div className="stock-chips">{stocks.map(stock => <button key={stock.ticker} className={ticker === stock.ticker ? "active" : ""} onClick={() => selectTicker(stock.ticker)}><b>{stock.name}</b><span>{stock.ticker}</span></button>)}</div></section>
      {error && <div className="notice error"><span>!</span><div><b>데이터를 불러오지 못했어요</b><p>{error} 종목코드를 확인하고 다시 조회해 주세요.</p></div></div>}
      {loading && !data && <div className="loading-card"><span/><span/><span/><p>시장 데이터를 가져오고 있어요</p></div>}
      {data && <>
        <section className="stock-overview"><div className="stock-title"><div className="stock-symbol">{name.slice(0, 1)}</div><div><span>{ticker} · 국내주식</span><h2>{name}</h2></div></div><div className="price-block"><span>최근 종가</span><strong>{latest ? `${format.format(latest[1])}원` : "—"}</strong><em className={change >= 0 ? "up" : "down"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</em></div></section>
        <section className="chart-workspace-wrap" id="workspace"><ChartWorkspace rows={data.candles} ticker={ticker} name={name}/></section>
        <MarketWorkspace stocks={stocks} ticker={ticker} onSelect={selectTicker}/>
        <section className="overview-grid"><aside className="card summary-card"><div className="card-head"><div><span className="eyebrow">보유 데이터</span><h2>투자자 현황</h2></div></div><div className="hero-metric"><span>평균 매수가</span><strong>{holding ? `${format.format(holding[3])}원` : "—"}</strong><small className={(holding?.[4] ?? 0) >= 0 ? "up" : "down"}>계좌 수익률 {holding ? `${holding[4].toFixed(2)}%` : "—"}</small></div><div className="summary-list"><Metric label="보유 순위" value={holding ? `${format.format(holding[1])}위` : "—"}/><Metric label="보유 계좌" value={holding ? `${format.format(holding[2])}개` : "—"}/><Metric label="거래량" value={latest ? format.format(latest[2]) : "—"}/><Metric label="거래대금" value={latest ? format.format(latest[3]) : "—"}/></div></aside><div className="card chart-help"><span className="eyebrow">핵심 지표</span><h2>수급의 흐름을 함께 보세요</h2><p>가격만으로 보이지 않는 투자자 움직임을 세력모니터 지표로 확인할 수 있습니다.</p><div className="indicator-guide"><div><b>평균매수단가</b><span>현재 가격과 주요 투자자의 매수 기준을 비교합니다.</span></div><div><b>보유비중 · 영향력</b><span>투자자 보유 변화와 매수·매도 강도를 살펴봅니다.</span></div><div><b>RS · IBD RS</b><span>시장 대비 상대강도와 종목의 순위를 확인합니다.</span></div></div></div></section>
      </>}
      <footer className="site-footer"><div className="footer-brand"><Image className="brand-symbol" src="/assets/brand/motrader-symbol.png" alt="" width={34} height={39}/><div><b>세력모니터</b><small>데이터로 더 선명해지는 투자 흐름</small></div></div><div className="footer-note"><p>제공되는 정보는 투자 판단을 돕는 참고 자료이며,<br/>투자 결과를 보장하지 않습니다.</p><a href="#top">맨 위로 <span aria-hidden="true">↑</span></a></div></footer>
    </div>
    {showScreener && <Screener
      onClose={() => setShowScreener(false)}
      onSelect={value => { selectTicker(value); setShowScreener(false); }}
    />}
    {showLogin && <LoginDialog initialId={memberId} onClose={() => setShowLogin(false)} onEnter={(id, remember) => { setMemberId(id); setSignedIn(true); setShowLogin(false); if (remember) localStorage.setItem("forcemonitor:member-id", id); else localStorage.removeItem("forcemonitor:member-id"); }}/>} 
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }

function LoginDialog({ initialId, onClose, onEnter }: { initialId: string; onClose: () => void; onEnter: (id: string, remember: boolean) => void }) {
  const [id, setId] = useState(initialId); const [password, setPassword] = useState(""); const [remember, setRemember] = useState(Boolean(initialId)); const [showPassword, setShowPassword] = useState(false);
  return <div className="sheet-backdrop login-backdrop" onMouseDown={onClose}><form className="login-dialog" role="dialog" aria-modal="true" aria-label="세력모니터 입장" onMouseDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); if (id && password) onEnter(id, remember); }}><Image src="/assets/brand/motrader-symbol.png" alt="" width={54} height={63}/><span className="eyebrow">FORCE MONITOR</span><h2>세력모니터 입장하기</h2><p>프로그램 인증에 사용하는 계정 정보를 입력해 주세요.</p><label>ID<input autoFocus autoComplete="username" required value={id} onChange={event => setId(event.target.value)}/></label><label>PW<input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/></label><div className="login-options"><label><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)}/> ID 기억하기</label><label><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)}/> 비밀번호 보이기</label></div><button className="primary-button">입장하기</button><small>비밀번호는 이 기기에 저장하지 않습니다.</small><button type="button" className="login-close" onClick={onClose} aria-label="닫기">×</button></form></div>;
}

function Screener({ onClose, onSelect }: { onClose: () => void; onSelect: (ticker: string) => void }) {
  type SearchType = "price" | "profit" | "have";
  const today = new Date();
  const initialDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const [type, setType] = useState<SearchType>("price");
  const [date, setDate] = useState(initialDate); const [datebegin, setDatebegin] = useState(initialDate); const [dateend, setDateend] = useState(initialDate);
  const [price, setPrice] = useState("10000"); const [filter, setFilter] = useState("3"); const [investors, setInvestors] = useState(3);
  const [results, setResults] = useState<[string,number][]>([]); const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false);
  const investorOptions = [[1,"개인"],[2,"외국인"],[4,"기관계"],[8,"금융투자"],[16,"보험"],[32,"투신"],[64,"기타금융"],[128,"은행"],[256,"연기금"],[512,"사모펀드"],[1024,"국가"],[2048,"기타법인"],[4096,"내외국인"]] as const;
  const typeCopy = { price: ["가격으로 찾기", "특정 거래일의 종가를 기준으로 검색해요."], profit: ["보유종목 수익률", "선택한 날짜의 보유종목 수익률을 비교해요."], have: ["보유비중 변화", "기간 동안 선택한 투자자들의 보유비중 변화를 계산해요."] } as const;
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setMessage("");setResults([]);try{const params=new URLSearchParams({type});if(type==="price"){params.set("date",date.replaceAll("-",""));params.set("price",price);params.set("filter",filter);}else if(type==="profit"){params.set("date",date.replaceAll("-",""));}else{params.set("datebegin",datebegin.replaceAll("-",""));params.set("dateend",dateend.replaceAll("-",""));params.set("investors",String(investors));}const response=await fetch(`/api/search?${params}`);const body=await response.json();if(!response.ok)throw new Error(body.message);setResults(body.result);if(!body.result.length)setMessage("조건에 맞는 종목이 없어요. 날짜나 조건을 바꿔보세요.");}catch(error){setMessage(error instanceof Error?error.message:"검색하지 못했어요. 잠시 후 다시 시도해 주세요.");}finally{setLoading(false)}}
  function changeType(next:SearchType){setType(next);setResults([]);setMessage("");}
  function toggleInvestor(value:number){setInvestors(current=>current&value?current&~value:current|value);}
  const suffix = type === "price" ? "원" : "%";
  return <div className="sheet-backdrop" onMouseDown={onClose}><section className="search-sheet" role="dialog" aria-modal="true" aria-label="종목 조건 검색" onMouseDown={event=>event.stopPropagation()}><header><div><span className="eyebrow">종목 조건 검색</span><h2>{typeCopy[type][0]}</h2><p>{typeCopy[type][1]}</p></div><button onClick={onClose} aria-label="닫기">×</button></header><nav className="search-types" aria-label="검색 기준">{[["price","종가"],["profit","수익률"],["have","보유비중"]].map(([value,label])=><button key={value} className={type===value?"active":""} onClick={()=>changeType(value as SearchType)}>{label}</button>)}</nav><form onSubmit={submit}>{type!=="have"&&<label>거래일<input type="date" required value={date} onChange={event=>setDate(event.target.value)}/></label>}{type==="price"&&<><label>기준 가격<input type="number" min="0" max="2147483647" required value={price} onChange={event=>setPrice(event.target.value)}/></label><div className="condition-group"><span>가격 조건</span><div>{[["1","미만"],["3","이하"],["2","같음"],["6","이상"],["4","초과"]].map(([value,label])=><button type="button" key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div></div></>}{type==="profit"&&<div className="search-description">수익률이 낮은 종목부터 높은 종목 순서로 보여드려요.</div>}{type==="have"&&<><label>시작일<input type="date" required value={datebegin} max={dateend} onChange={event=>setDatebegin(event.target.value)}/></label><label>종료일<input type="date" required value={dateend} min={datebegin} onChange={event=>setDateend(event.target.value)}/></label><div className="condition-group investor-options"><span>투자자 유형 · 복수 선택</span><div>{investorOptions.map(([value,label])=><button type="button" key={value} className={investors&value?"active":""} onClick={()=>toggleInvestor(value)}>{label}</button>)}</div></div></>}<button className="primary-button" disabled={loading||type==="have"&&!investors}>{loading?"찾고 있어요":"종목 찾기"}</button></form>{message&&<div className="sheet-message">{message}</div>}<div className="result-list">{results.map(([code,value])=><button key={code} onClick={()=>onSelect(code)}><span><b>{code}</b><small>이 종목 자세히 보기</small></span><strong className={type!=="price"?(value>=0?"up":"down"):""}>{type!=="price"&&value>0?"+":""}{format.format(value)}{suffix}</strong><i>›</i></button>)}</div></section></div>;
}
