"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ResultWatchMenu.module.css";

export type WatchMenuTarget = { ticker: string; name: string; x: number; y: number; opener: HTMLElement | null };
type Props = {
  target: WatchMenuTarget; watchlists: string[][]; limit: number | null; ready: boolean;
  onChange: (slot: number, codes: string[], mode: "add" | "delete") => Promise<boolean>;
  onClose: () => void;
};

export default function ResultWatchMenu({ target, watchlists, limit, ready, onChange, onClose }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>("[data-folder]")?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) onClose(); };
    const scroll = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); onClose(); target.opener?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    // Ignore layout-driven scroll adjustments immediately after opening.
    window.addEventListener("wheel", scroll, { capture: true, passive: true });
    window.addEventListener("touchmove", scroll, { capture: true, passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("wheel", scroll, true);
      window.removeEventListener("touchmove", scroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, target]);
  const openActions = (index: number) => {
    setActive(index);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("[data-action]:not(:disabled)")?.focus());
  };

  const left = Math.max(8, Math.min(target.x, window.innerWidth - 278));
  const top = Math.max(8, Math.min(target.y, window.innerHeight - 232));
  return createPortal(<div ref={menuRef} className={styles.container} style={{ left, top }}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const selector = (event.target as HTMLElement).hasAttribute("data-folder") ? "[data-folder]" : "[data-action]";
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(selector) ?? []).filter(item => !item.disabled);
        const current = items.indexOf(event.target as HTMLButtonElement);
        items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
      if (event.key === "ArrowLeft" && active !== null) {
        event.preventDefault(); menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-folder]")[active]?.focus(); setActive(null);
      }
    }}>
    <div role="menu" aria-label={`${target.name} 관심종목 관리`} className={styles.folders}>
      {watchlists.map((list, index) => <button key={index} type="button" role="menuitem" data-folder
        aria-haspopup="menu" aria-expanded={active === index} className={active === index ? styles.active : ""}
        onPointerEnter={() => setActive(index)}
        onClick={() => openActions(index)}
        onKeyDown={event => { if (event.key === "ArrowRight") { event.preventDefault(); openActions(index); } }}>
        <span>관심 {index + 1}</span><small>{list.length}/{limit ?? "—"}</small>
      </button>)}
    </div>
    {active !== null && <div role="menu" aria-label={`관심 ${active + 1} 종목 관리`} className={styles.actions} style={{ top: active * 36 }}>
      <button type="button" role="menuitem" data-action
        disabled={!ready || (!watchlists[active].includes(target.ticker) && watchlists[active].length >= (limit ?? 0))}
        onClick={() => void onChange(active, [target.ticker], "add")}>넣기</button>
      <button type="button" role="menuitem" data-action disabled={!ready}
        onClick={() => void onChange(active, [target.ticker], "delete")}>빼기</button>
    </div>}
  </div>, document.body);
}
