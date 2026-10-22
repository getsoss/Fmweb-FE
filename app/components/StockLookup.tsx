"use client";

import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { indexStocks, normalizeStockName, suggestStocks, type LookupStock } from "./stockSearch";
import styles from "./StockLookup.module.css";

type Props = { stocks: LookupStock[]; ticker: string; onSelect: (ticker: string) => void; onMessage: (message: string) => void };

export default memo(function StockLookup({ stocks, ticker, onSelect, onMessage }: Props) {
  const [name, setName] = useState(stocks.find(stock => stock.ticker === ticker)?.name ?? "");
  const [code, setCode] = useState(ticker);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const index = useMemo(() => indexStocks(stocks), [stocks]);
  const suggestions = useMemo(() => suggestStocks(index, name), [index, name]);
  const expanded = open && suggestions.length > 0;
  const visible = expanded && position !== null;

  useEffect(() => {
    setCode(ticker);
    setName(stocks.find(stock => stock.ticker === ticker)?.name ?? "");
    setOpen(false);
    setActive(-1);
  }, [ticker, stocks]);

  useLayoutEffect(() => {
    if (!expanded || !inputRef.current) return;
    const input = inputRef.current;
    const update = () => {
      const bounds = input.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) { setPosition(null); return; }
      const below = window.innerHeight - bounds.bottom - 12;
      const above = bounds.top - 12;
      const upwards = below < Math.min(suggestions.length * 44 + 8, 200) && above > below;
      const width = Math.min(Math.max(bounds.width, 260), window.innerWidth - 16);
      setPosition({
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)), width,
        ...(upwards ? { bottom: window.innerHeight - bounds.top + 6 } : { top: bounds.bottom + 6 }),
        maxHeight: Math.max(0, Math.min(320, upwards ? above : below)),
      });
    };
    const onScroll = (event: Event) => { if (!listRef.current?.contains(event.target as Node)) update(); };
    const observer = new ResizeObserver(update);
    observer.observe(input);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", onScroll, true); };
  }, [expanded, suggestions.length]);

  useEffect(() => {
    if (!expanded) return;
    const onOutside = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node) && !listRef.current?.contains(event.target as Node)) {
        setOpen(false); setActive(-1);
      }
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [expanded]);

  useEffect(() => {
    if (visible && active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);

  function select(stock: LookupStock) {
    setCode(stock.ticker); setName(stock.name); setOpen(false); setActive(-1);
    onSelect(stock.ticker);
    onMessage(`${stock.name} 차트를 표시했습니다.`);
  }

  function submit() {
    const stock = suggestions[active] ?? (code.trim()
      ? stocks.find(item => item.ticker.toUpperCase() === code.trim().toUpperCase())
      : stocks.find(item => normalizeStockName(item.name) === normalizeStockName(name)) ?? suggestions[0]);
    if (stock) select(stock);
    else onMessage("종목명 또는 영문·숫자 6자리 종목코드를 확인해 주세요.");
  }

  return <>
    <form ref={formRef} className="stock-lookup" aria-label="종목 조회"
      onSubmit={event => { event.preventDefault(); submit(); }}
      onKeyDown={event => {
        if (event.key === "Enter" && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault();
      }}>
      <label>종목이름<input ref={inputRef} role="combobox" aria-autocomplete="list" aria-expanded={visible}
        aria-controls={visible ? listId : undefined} aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off" value={name} placeholder="삼성전자"
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onChange={event => { setName(event.target.value); setCode(""); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
            event.preventDefault(); setOpen(true);
            setActive(current => current < 0 ? event.key === "ArrowDown" ? 0 : suggestions.length - 1
              : (current + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
          } else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
        }} /></label>
      <label>종목코드<input inputMode="text" maxLength={6} value={code} placeholder="005930"
        onFocus={() => { setOpen(false); setActive(-1); }}
        onChange={event => { setCode(event.target.value.replace(/[^a-zA-Z0-9]/g, "")); setName(""); setOpen(false); setActive(-1); }} /></label>
      <button type="submit">차트보기</button>
    </form>
    {visible && createPortal(<ul ref={listRef} id={listId} role="listbox" aria-label="종목 자동완성" className={styles.suggestions} style={position}>
      {suggestions.map((stock, item) => <li key={stock.ticker} id={`${listId}-${item}`} role="option" aria-selected={active === item}
        className={styles.option} onMouseDown={event => event.preventDefault()}
        onPointerMove={() => setActive(item)} onClick={() => select(stock)}>
        <span>{stock.name}</span><small>{stock.ticker}</small>
      </li>)}
    </ul>, document.body)}
  </>;
});
