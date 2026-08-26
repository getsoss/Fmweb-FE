"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type LegalDocument = "terms" | "privacy" | null;
function sanitizeTerms(html:string){const document=new DOMParser().parseFromString(html,"text/html");document.querySelectorAll("script,style,iframe,object,embed").forEach(node=>node.remove());document.querySelectorAll("*").forEach(node=>[...node.attributes].forEach(attribute=>{if(attribute.name.startsWith("on")||attribute.name==="style")node.removeAttribute(attribute.name);}));return document.body.innerHTML;}

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [signupOpen, setSignupOpen] = useState(false);
  const [legal, setLegal] = useState<LegalDocument>(null);

  return <main className="landing-page">
    <header className="landing-nav">
      <a className="landing-brand" href="#intro" aria-label="세력모니터 홈"><Image src="/assets/brand/motrader-symbol.png" alt="" width={34} height={40} priority/><b>세력모니터</b></a>
      <div><button className="landing-enter" onClick={onEnter}>세력모니터 창으로 가기</button><button className="landing-signup" onClick={() => setSignupOpen(true)}>회원가입</button></div>
    </header>

    <section className="landing-hero" id="intro">
      <span className="eyebrow">주식투자의 나침반</span>
      <h1>세력의 움직임을 읽고,<br/>좋은 종목을 고릅니다</h1>
      <p>세력모니터는 주가에 영향을 주는 세력 움직임을 정확하고 빠르게 알려줍니다.<br/>개인 큰손, 사모펀드, 투신, 연기금 움직임까지 상세하게 볼 수 있습니다.</p>
      <button onClick={onEnter}>세력모니터 시작하기 <span aria-hidden="true">→</span></button>
    </section>

    <section className="landing-features" aria-label="세력모니터 주요 기능">
      <article><span>01</span><h2>핀셋 종목선정</h2><p>다양한 검색 조합을 사용하여 좋은 종목을 정확하게 고를 수 있습니다.</p></article>
      <article><span>02</span><h2>관심종목 가격 알람</h2><p>수많은 관심종목을 하나하나 추적하지 않고도 적정가격에 왔는지 알 수 있습니다.</p></article>
    </section>

    <section className="trading-products">
      <div><span className="eyebrow">자동매매 프로그램</span><h2>좋은 종목일지라도<br/>매매 방법이 좋아야 합니다</h2><p>세력모니터로 고른 종목으로 수익을 극대화하려면 매매 방법이 좋아야 합니다. 감정에 치우치지 않고 기계적 매매를 할 수 있도록 도와주는 자동매매 프로그램도 있습니다.</p></div>
      <div className="product-list"><article><b>모트레이더</b><p>그리드 매매를 비롯한 다양한 매매법으로 자동매매를 할 수 있습니다. 미리 정한 매매 원칙을 자동으로 실행해 감정에 흔들리지 않는 일관된 거래를 돕습니다.</p></article><article><b>돈카피</b><p>모트레이더보다 기능과 운용 편의성을 강화한 자동매매 프로그램입니다. 보다 체계적으로 매매 전략을 실행하고 관리할 수 있도록 설계되었습니다.</p></article></div>
    </section>

    <section className="pricing-section" id="pricing">
      <div><span className="eyebrow">프로그램 구독료</span><h2>필요한 프로그램을<br/>합리적으로 시작하세요</h2></div>
      <div className="price-cards"><article><span>PACKAGE</span><h3>세력모니터 &amp; 모트레이더</h3><strong>월 1만원부터</strong><p>추가 옵션에 따라 가격이 달라질 수 있습니다.</p></article><article><span>AUTOMATION</span><h3>돈카피</h3><strong>월 6만원부터</strong><p>추가 옵션에 따라 가격이 달라질 수 있습니다.</p></article></div>
    </section>

    <footer className="landing-footer">
      <div className="footer-channels">
        <a href="https://cafe.naver.com/motrader" target="_blank" rel="noreferrer">네이버 카페 바로가기 <span aria-hidden="true">↗</span></a>
        <a href="https://www.youtube.com/@motrader-morangs" target="_blank" rel="noreferrer">유튜브 바로가기 <span aria-hidden="true">↗</span></a>
      </div>
      <div className="footer-bottom">
        <div className="company-info"><b>모랑스</b><p>대표 나기운 · 경기도 성남시 중원구 둔촌대로111 거명빌딩 2층</p><p>morangs@morangs.com · 사업자번호 796-87-01469</p><p>통신판매신고번호 제2021-성남중원-0827호</p></div>
        <nav><button onClick={() => setLegal("terms")}>이용약관</button><button onClick={() => setLegal("privacy")}>개인정보처리방침</button></nav>
      </div>
    </footer>

    {signupOpen && <SignupDialog onClose={() => setSignupOpen(false)} onLegal={setLegal}/>} 
    {legal && <LegalDialog type={legal} onClose={() => setLegal(null)}/>} 
  </main>;
}

function SignupDialog({ onClose, onLegal }: { onClose: () => void; onLegal: (type: Exclude<LegalDocument,null>) => void }) {
  const [step,setStep] = useState<1|2>(1); const [email,setEmail] = useState(""); const [name,setName] = useState(""); const [password,setPassword] = useState(""); const [confirm,setConfirm] = useState(""); const [privacy,setPrivacy] = useState(false); const [terms,setTerms] = useState(false); const [verified,setVerified] = useState(false); const [done,setDone] = useState(false); const [certKey,setCertKey]=useState(""); const [pending,setPending]=useState(false); const [message,setMessage]=useState("");
  const valid = verified && Boolean(name) && password.length >= 8 && password === confirm && privacy && terms;
  async function sendEmail(){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return setMessage("올바른 이메일 주소를 입력해 주세요.");setPending(true);setMessage("");try{const response=await fetch("/api/auth/cert/mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,type:"join"})});const body=await response.json();if(!response.ok)throw new Error(body.message);if(body.status===201)return setMessage("인증 메일은 1분 후 다시 발송할 수 있습니다.");if(body.status!==200||!body.certKey)throw new Error("인증 메일을 발송하지 못했습니다.");setCertKey(body.certKey);setStep(2);}catch(error){setMessage(error instanceof Error?error.message:"인증 메일을 발송하지 못했습니다.");}finally{setPending(false)}}
  async function verifyEmail(){setPending(true);setMessage("");try{const response=await fetch("/api/auth/cert/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({certKey})});const body=await response.json();if(!response.ok)throw new Error(body.message);if(body.status===201)return setMessage("메일에 포함된 인증 링크를 먼저 눌러 주세요.");if(body.status===202){setStep(1);setCertKey("");return setMessage("인증 시간이 지났습니다. 인증 메일을 다시 발송해 주세요.");}if(body.status!==200)throw new Error("이메일 인증을 확인하지 못했습니다.");setVerified(true);setMessage("이메일 인증이 완료되었습니다.");}catch(error){setMessage(error instanceof Error?error.message:"이메일 인증을 확인하지 못했습니다.");}finally{setPending(false)}}
  async function submit(event:FormEvent){event.preventDefault();if(!valid)return;setPending(true);setMessage("");try{const response=await fetch("/api/auth/join",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,password})});const body=await response.json();if(!response.ok)throw new Error(body.message);const errors:Record<number,string>={201:"이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해 주세요.",202:"인증 메일을 먼저 발송해 주세요.",203:"이메일 인증 확인을 먼저 완료해 주세요."};if(body.status!==200)return setMessage(errors[body.status]??"회원가입을 완료하지 못했습니다.");const login=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const loginBody=await login.json();if(loginBody.status===200){await Promise.all([1,2].map(termsId=>fetch("/api/auth/agree",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({termsId,agreeYn:"Y"})})));}setDone(true);}catch(error){setMessage(error instanceof Error?error.message:"회원가입을 완료하지 못했습니다.");}finally{setPending(false)}}
  return <div className="landing-modal-backdrop" onMouseDown={onClose}><section className="signup-dialog" role="dialog" aria-modal="true" aria-label="세력모니터 회원가입" onMouseDown={event => event.stopPropagation()}><header><div><Image src="/assets/brand/motrader-symbol.png" alt="" width={28} height={33}/><b>세력모니터 회원가입</b></div><button onClick={onClose} aria-label="닫기">×</button></header>{done?<div className="signup-complete"><span>✓</span><h2>회원가입을 완료했습니다</h2><p>가입한 계정으로 바로 세력모니터를 이용할 수 있습니다.</p><button onClick={onClose}>확인</button></div>:<form onSubmit={submit}><div className="signup-heading"><span>STEP {step} / 2</span><h2>{step===1?"회원 정보를 입력해 주세요":"이메일을 인증해 주세요"}</h2>{step===2&&<p>인증 메일을 발송했습니다. 메일의 인증 링크를 누른 다음 인증 확인을 진행해 주세요.</p>}</div><label>이메일<div className="email-row"><input type="email" required readOnly={step===2} value={email} onChange={event=>setEmail(event.target.value)}/>{step===1?<button type="button" disabled={pending} onClick={sendEmail}>{pending?"발송 중":"인증 메일 발송"}</button>:<><button type="button" disabled={pending||verified} className={verified?"verified":""} onClick={verifyEmail}>{verified?"인증 완료":pending?"확인 중":"인증 확인"}</button><button type="button" className="email-edit" onClick={()=>{setStep(1);setVerified(false);setCertKey("");setMessage("")}}>이메일 수정</button></>}</div></label><label>실명<input required value={name} onChange={event=>setName(event.target.value)}/></label><label>비밀번호<input type="password" required minLength={8} value={password} onChange={event=>setPassword(event.target.value)}/></label><label>비밀번호 확인<input type="password" required minLength={8} value={confirm} onChange={event=>setConfirm(event.target.value)}/>{confirm&&password!==confirm&&<small>비밀번호가 일치하지 않습니다.</small>}</label><div className="signup-consents"><label><input type="checkbox" checked={privacy} onChange={event=>setPrivacy(event.target.checked)}/><span><button type="button" onClick={()=>onLegal("privacy")}>개인정보 수집 및 이용 동의</button>에 동의합니다.</span></label><label><input type="checkbox" checked={terms} onChange={event=>setTerms(event.target.checked)}/><span><button type="button" onClick={()=>onLegal("terms")}>이용약관</button>에 동의합니다.</span></label></div>{message&&<div className={verified?"signup-message success":"signup-message"} role="status">{message}</div>}{step===2&&<button className="signup-submit" disabled={!valid||pending}>{pending?"처리 중":"회원가입"}</button>}</form>}</section></div>;
}

function LegalDialog({type,onClose}:{type:Exclude<LegalDocument,null>;onClose:()=>void}){const[content,setContent]=useState("");const[title,setTitle]=useState(type==="terms"?"이용약관":"개인정보처리방침");const[error,setError]=useState("");useEffect(()=>{fetch(`/api/auth/terms/${type==="terms"?2:1}`).then(response=>response.json()).then(body=>{if(body.status!==200||!body.info)throw new Error(body.message);setTitle(body.info.title);setContent(sanitizeTerms(body.info.context));}).catch(reason=>setError(reason instanceof Error?reason.message:"약관을 불러오지 못했습니다."));},[type]);return <div className="landing-modal-backdrop legal-backdrop" onMouseDown={onClose}><section className="legal-dialog" role="dialog" aria-modal="true" aria-label={type==="terms"?"이용약관":"개인정보처리방침"} onMouseDown={event=>event.stopPropagation()}><header><h2>{title}</h2><button onClick={onClose} aria-label="닫기">×</button></header><div className="legal-content">{error?<p>{error}</p>:content?<div dangerouslySetInnerHTML={{__html:content}}/>:<p>약관을 불러오고 있습니다.</p>}</div><button className="legal-confirm" onClick={onClose}>확인</button></section></div>;}
