"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";

type Interval = "1D" | "1W" | "1M";
type ChartKind = "candles" | "bars" | "line";
type OHLC = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
type Props = {
  rows: number[][];
  holdings: number[][];
  holdingChanges: number[][];
  power: number[][];
  direction: number[][];
  rs: number[][];
  ticker: string;
  name: string;
  onAlertPriceChange: (price: number) => void;
};

type InvestorIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

const holdingInvestorOptions = [
  { key: "personal", label: "개인", columns: [1], color: "#0000FF" },
  { key: "foreign", label: "외국인", columns: [2], color: "#2EC03F" },
  { key: "institution", label: "기관계", columns: [3], color: "#FF0000" },
  { key: "finance", label: "금투", columns: [4], color: "#61CBF3" },
  { key: "insurance", label: "보험", columns: [5], color: "#DAE9F8" },
  { key: "trust", label: "투신", columns: [6], color: "#BE5014" },
  { key: "other-finance", label: "기금", columns: [7], color: "#595959" },
  { key: "bank", label: "은행", columns: [8], color: "#CC9900" },
  { key: "pension", label: "연기", columns: [9], color: "#FFFF00" },
  { key: "private-fund", label: "사모", columns: [10], color: "#CC00FF" },
  { key: "other-corporation", label: "기법", columns: [12], color: "#BFBFBF" },
  { key: "domestic-foreign", label: "내외국", columns: [13], color: "#00FF99" },
  { key: "private-pension", label: "사연", columns: [10, 9], color: "#B5E6A2" },
  { key: "private-trust", label: "사투", columns: [10, 6], color: "#F7C7AC" },
  { key: "trust-pension", label: "투연", columns: [6, 9], color: "#FFC000" },
  { key: "private-trust-pension", label: "사투연", columns: [10, 6, 9], color: "#FF66FF" },
] as const satisfies readonly {
  key: string;
  label: string;
  columns: readonly InvestorIndex[];
  color: string;
}[];
type HoldingInvestorKey = (typeof holdingInvestorOptions)[number]["key"];

const powerInvestorOptions = [
  { key: 1, label: "개인" },
  { key: 2, label: "외국인" },
  { key: 3, label: "기관계" },
  { key: 4, label: "금투" },
  { key: 5, label: "보험" },
  { key: 6, label: "투신" },
  { key: 7, label: "기금" },
  { key: 8, label: "은행" },
  { key: 9, label: "연기" },
  { key: 10, label: "사모" },
  { key: 12, label: "기법" },
  { key: 13, label: "내외국" },
] as const satisfies readonly { key: InvestorIndex; label: string }[];
type PaneKey = "price" | "ant" | "holding" | "power" | "rs";
type SavedChartView = {
  key: string;
  paneStretch: Partial<Record<PaneKey, number>>;
  visibleLogicalRange: LogicalRange | null;
};

function trimChartDecimals(value: number) {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function compactChartNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${trimChartDecimals(value / 1_000_000_000)}B`;
  if (absolute >= 1_000_000) return `${trimChartDecimals(value / 1_000_000)}M`;
  if (absolute >= 1_000) return `${trimChartDecimals(value / 1_000)}K`;
  return trimChartDecimals(value);
}

const compactPriceFormat = {
  type: "custom" as const,
  minMove: 0.01,
  formatter: compactChartNumber,
};

const percentPriceFormat = {
  type: "custom" as const,
  minMove: 0.01,
  formatter: (value: number) => `${trimChartDecimals(value)}%`,
};

function timestamp(value: number): UTCTimestamp {
  const text = String(value);
  return Math.floor(
    Date.UTC(
      Number(text.slice(0, 4)),
      Number(text.slice(4, 6)) - 1,
      Number(text.slice(6, 8)),
    ) / 1000,
  ) as UTCTimestamp;
}

function aggregate(source: OHLC[], interval: Interval) {
  if (interval === "1D") return source;

  const groups = new Map<string, OHLC[]>();
  source.forEach((row) => {
    const date = new Date(row.time * 1000);
    const key =
      interval === "1M"
        ? `${date.getUTCFullYear()}-${date.getUTCMonth()}`
        : (() => {
            const monday = new Date(date);
            monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
            return monday.toISOString().slice(0, 10);
          })();
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return [...groups.values()].map((group) => ({
    time: group[0].time,
    open: group[0].open,
    high: Math.max(...group.map((row) => row.high)),
    low: Math.min(...group.map((row) => row.low)),
    close: group.at(-1)!.close,
    volume: group.reduce((sum, row) => sum + row.volume, 0),
  }));
}

function movingAverage(data: OHLC[], length: number) {
  return data.flatMap((row, index) =>
    index < length - 1
      ? []
      : [
          {
            time: row.time,
            value:
              data
                .slice(index - length + 1, index + 1)
                .reduce((sum, item) => sum + item.close, 0) / length,
          },
        ],
  );
}

function lineData(rows: number[][], column: number) {
  return rows
    .slice()
    .reverse()
    .flatMap((row) =>
      Number.isFinite(Number(row[column]))
        ? [{ time: timestamp(row[0]), value: Number(row[column]) }]
        : [],
    );
}

function combinedLineData(rows: number[][], columns: readonly InvestorIndex[]) {
  return rows
    .slice()
    .reverse()
    .flatMap((row) => {
      const values = columns.map((column) => Number(row[column]));
      return values.every(Number.isFinite)
        ? [
            {
              time: timestamp(row[0]),
              value: values.reduce((sum, value) => sum + value, 0),
            },
          ]
        : [];
    });
}

function toggleSelection<T>(selected: T[], value: T, order: readonly T[]): T[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : order.filter((item) => [...selected, value].includes(item));
}

function scaleMode(scale: "normal" | "log" | "percent") {
  if (scale === "log") return PriceScaleMode.Logarithmic;
  if (scale === "percent") return PriceScaleMode.Percentage;
  return PriceScaleMode.Normal;
}

export default function ChartWorkspace({
  rows,
  holdings,
  holdingChanges,
  power,
  direction,
  rs,
  ticker,
  name,
  onAlertPriceChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const savedViewRef = useRef<SavedChartView | null>(null);
  const [interval, setInterval] = useState<Interval>("1D");
  const [chartType, setChartType] = useState<ChartKind>("candles");
  const [scale, setScale] = useState<"normal" | "log" | "percent">("normal");
  const [averagePrice, setAveragePrice] = useState(true);
  const [ma20, setMa20] = useState(true);
  const [ma60, setMa60] = useState(true);
  const [holdingInvestors, setHoldingInvestors] = useState<HoldingInvestorKey[]>([]);
  const [powerInvestors, setPowerInvestors] = useState<InvestorIndex[]>([]);
  const [hovered, setHovered] = useState<OHLC | null>(null);
  const [alertMenu, setAlertMenu] = useState<{
    left: number;
    top: number;
    price: number;
  } | null>(null);

  const base = useMemo<OHLC[]>(
    () =>
      rows
        .slice()
        .reverse()
        .map((row) => ({
          time: timestamp(row[0]),
          close: Number(row[1]),
          volume: Number(row[2] ?? 0),
          open: Number(row[4] ?? row[1]),
          high: Number(row[5] ?? row[1]),
          low: Number(row[6] ?? row[1]),
        }))
        .filter((row) => Number.isFinite(row.close)),
    [rows],
  );
  const data = useMemo(() => aggregate(base, interval), [base, interval]);
  const viewKey = `${ticker}:${interval}:${rows.length}:${rows[0]?.[0] ?? ""}`;
  const latest = hovered ?? data.at(-1) ?? null;
  const previous = latest
    ? data[Math.max(0, data.findIndex((row) => row.time === latest.time) - 1)]
    : null;
  const change =
    latest && previous ? ((latest.close - previous.close) / previous.close) * 100 : 0;

  useEffect(() => {
    if (!alertMenu) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setAlertMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAlertMenu(null);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [alertMenu]);

  useEffect(() => setAlertMenu(null), [ticker]);

  function openAlertMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const chart = chartRef.current;
    const priceSeries = priceRef.current;
    const pricePane = chart?.panes()[0]?.getHTMLElement();
    if (!chart || !priceSeries || !pricePane) return;

    const paneBounds = pricePane.getBoundingClientRect();
    const insidePricePane =
      event.clientX >= paneBounds.left &&
      event.clientX <= paneBounds.right &&
      event.clientY >= paneBounds.top &&
      event.clientY <= paneBounds.bottom;
    if (!insidePricePane) {
      setAlertMenu(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const price = Number(priceSeries.coordinateToPrice(event.clientY - paneBounds.top));
    if (!Number.isFinite(price)) return;

    const surfaceBounds = event.currentTarget.getBoundingClientRect();
    const menuWidth = 148;
    const menuHeight = 72;
    setAlertMenu({
      left: Math.max(0, Math.min(event.clientX - surfaceBounds.left, surfaceBounds.width - menuWidth)),
      top: Math.max(0, Math.min(event.clientY - surfaceBounds.top, surfaceBounds.height - menuHeight)),
      price: Math.round(price),
    });
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !data.length) return;

    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#fff" },
        textColor: "#7c828a",
        fontFamily: "Inter,system-ui,sans-serif",
        fontSize: 11,
        panes: {
          enableResize: true,
          separatorColor: "#dee1e6",
          separatorHoverColor: "rgba(0,82,255,.08)",
        },
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#eef0f3" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      leftPriceScale: { visible: false, borderColor: "#dee1e6" },
      rightPriceScale: {
        borderColor: "#dee1e6",
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: { borderColor: "#dee1e6", rightOffset: 0, barSpacing: 8 },
    });
    chartRef.current = chart;

    let price: ISeriesApi<SeriesType>;
    if (chartType === "candles") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#cf202f",
        downColor: "#2563eb",
        borderVisible: false,
        wickUpColor: "#cf202f",
        wickDownColor: "#2563eb",
        priceFormat: compactPriceFormat,
      });
      series.setData(data);
      price = series;
    } else if (chartType === "bars") {
      const series = chart.addSeries(BarSeries, {
        upColor: "#cf202f",
        downColor: "#2563eb",
        priceFormat: compactPriceFormat,
      });
      series.setData(data);
      price = series;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: "#0052ff",
        lineWidth: 2,
        priceFormat: compactPriceFormat,
      });
      series.setData(data.map((row) => ({ time: row.time, value: row.close })));
      price = series;
    }
    price.priceScale().applyOptions({ mode: scaleMode(scale) });
    priceRef.current = price;

    if (averagePrice) {
      const series = chart.addSeries(LineSeries, {
        color: "#168a5b",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "",
        priceFormat: compactPriceFormat,
      });
      series.setData(lineData(holdings, 3));
    }
    if (ma20) {
      const series = chart.addSeries(LineSeries, {
        color: "#f4b000",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "",
        priceFormat: compactPriceFormat,
      });
      series.setData(movingAverage(data, 20));
    }
    if (ma60) {
      const series = chart.addSeries(LineSeries, {
        color: "#8b5cf6",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "",
        priceFormat: compactPriceFormat,
      });
      series.setData(movingAverage(data, 60));
    }

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
      title: "거래량",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
    volume.setData(
      data.map((row) => ({
        time: row.time,
        value: row.volume,
        color:
          row.close >= row.open ? "rgba(207,32,47,.25)" : "rgba(37,99,235,.25)",
      })),
    );

    let paneIndex = 1;
    const paneKeys: PaneKey[] = ["price"];
    const stretchFactors = [6];

    const antIndex = chart.addSeries(LineSeries, {
      color: "#f4b000",
      lineWidth: 2,
      priceScaleId: "ant-index",
      priceLineVisible: false,
      title: "",
      priceFormat: compactPriceFormat,
    });
    antIndex.setData(lineData(holdings, 2));
    antIndex.moveToPane(paneIndex++);
    antIndex.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
    paneKeys.push("ant");
    stretchFactors.push(1.5);

    if (holdingInvestors.length) {
      const holdingPane = paneIndex++;
      holdingInvestors.forEach((key) => {
        const investor = holdingInvestorOptions.find((option) => option.key === key);
        if (!investor) return;
        const series = chart.addSeries(LineSeries, {
          color: investor.color,
          lineWidth: 2,
          priceScaleId: "right",
          priceFormat: percentPriceFormat,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "",
        });
        series.setData(combinedLineData(holdingChanges, investor.columns));
        series.moveToPane(holdingPane);
        series.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
      });
      paneKeys.push("holding");
      stretchFactors.push(2);
    }

    if (powerInvestors.length) {
      const powerPane = paneIndex++;
      powerInvestors.forEach((investor) => {
        const label = powerInvestorOptions.find((option) => option.key === investor)?.label ?? "";
        const directions = new Map(
          direction.map((row) => [row[0], Number(row[investor])]),
        );
        const series = chart.addSeries(HistogramSeries, {
          priceScaleId: "right",
          priceFormat: percentPriceFormat,
          priceLineVisible: false,
          lastValueVisible: false,
          title: label,
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        });
        series.setData(
          power
            .slice()
            .reverse()
            .flatMap((row) => {
              const value = Number(row[investor]);
              if (!Number.isFinite(value)) return [];
              return [
                {
                  time: timestamp(row[0]),
                  value,
                  color:
                    (directions.get(row[0]) ?? 0) >= 0
                      ? "rgba(207,32,47,.3)"
                      : "rgba(37,99,235,.3)",
                },
              ];
            }),
        );
        series.moveToPane(powerPane);
        series.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.08 } });
      });
      paneKeys.push("power");
      stretchFactors.push(2);
    }

    const rsSeries = chart.addSeries(LineSeries, {
      color: "#0d88c7",
      lineWidth: 2,
      priceScaleId: "rs",
      priceFormat: percentPriceFormat,
      priceLineVisible: false,
      title: "RS",
    });
    rsSeries.setData(lineData(rs, 1));
    rsSeries.moveToPane(paneIndex);
    rsSeries.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
    paneKeys.push("rs");
    stretchFactors.push(1.5);

    const savedView = savedViewRef.current?.key === viewKey ? savedViewRef.current : null;
    chart.panes().forEach((pane, index) => {
      pane.setStretchFactor(
        savedView?.paneStretch[paneKeys[index]] ?? stretchFactors[index] ?? 1,
      );
    });

    chart.subscribeCrosshairMove((param) =>
      setHovered(param.time ? data.find((row) => row.time === param.time) ?? null : null),
    );
    if (savedView?.visibleLogicalRange) {
      chart.timeScale().setVisibleLogicalRange(savedView.visibleLogicalRange);
    } else {
      chart.timeScale().fitContent();
    }

    return () => {
      savedViewRef.current = {
        key: viewKey,
        visibleLogicalRange: chart.timeScale().getVisibleLogicalRange(),
        paneStretch: Object.fromEntries(
          chart
            .panes()
            .map((pane, index) => [paneKeys[index], pane.getStretchFactor()]),
        ),
      };
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
    };
  }, [
    data,
    chartType,
    scale,
    averagePrice,
    ma20,
    ma60,
    holdingInvestors,
    powerInvestors,
    holdings,
    holdingChanges,
    power,
    direction,
    rs,
  ]);

  useEffect(() => {
    priceRef.current?.priceScale().applyOptions({ mode: scaleMode(scale) });
  }, [scale]);

  return (
    <section className="pro-chart" aria-label={`${name} 주가 차트`}>
      <header className="pro-chart-top">
        <div className="chart-identity">
          <b>{name}</b>
          <span>{ticker}</span>
        </div>
        <div className="intervals">
          {(["1D", "1W", "1M"] as Interval[]).map((value) => (
            <button
              key={value}
              className={interval === value ? "active" : ""}
              onClick={() => setInterval(value)}
            >
              {({ "1D": "일", "1W": "주", "1M": "월" } as const)[value]}
            </button>
          ))}
        </div>
        <select
          value={chartType}
          onChange={(event) => setChartType(event.target.value as ChartKind)}
          aria-label="차트 종류"
        >
          <option value="candles">캔들</option>
          <option value="bars">바</option>
          <option value="line">라인</option>
        </select>
        <select
          value={scale}
          onChange={(event) => setScale(event.target.value as typeof scale)}
          aria-label="가격 스케일"
        >
          <option value="normal">일반</option>
          <option value="log">로그</option>
          <option value="percent">%</option>
        </select>
        <button onClick={() => chartRef.current?.timeScale().fitContent()}>전체 구간</button>
      </header>

      <div className="ohlcv-strip">
        <div className="ohlcv-values">
          <span>
            {latest ? new Date(latest.time * 1000).toLocaleDateString("ko-KR") : "—"}
          </span>
          {latest && (
            <>
              <span>
                시 <b>{latest.open.toLocaleString()}</b>
              </span>
              <span>
                고 <b>{latest.high.toLocaleString()}</b>
              </span>
              <span>
                저 <b>{latest.low.toLocaleString()}</b>
              </span>
              <span>
                종 <b>{latest.close.toLocaleString()}</b>
              </span>
              <span className={change >= 0 ? "up" : "down"}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
              <span>
                거래량 <b>{latest.volume.toLocaleString()}</b>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="chart-stage chart-stage--multi-pane">
        <div className="chart-surface" onContextMenu={openAlertMenu}>
          <div ref={hostRef} className="chart-engine" />
          {alertMenu && (
            <div
              ref={menuRef}
              className="chart-alert-menu"
              role="menu"
              aria-label="알람가격 메뉴"
              style={{ left: alertMenu.left, top: alertMenu.top }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                role="menuitem"
                onClick={() => {
                  onAlertPriceChange(alertMenu.price);
                  setAlertMenu(null);
                }}
              >
                알람가격 넣기
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onAlertPriceChange(0);
                  setAlertMenu(null);
                }}
              >
                알람가격 삭제
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="indicator-selector chart-indicator-controls"
        aria-label="차트 표시 지표"
      >
        <div className="chart-indicator-group chart-overlay-controls">
          <strong className="chart-indicator-label">주가 보조선</strong>
          <div className="indicator-checks chart-overlay-options">
            <Indicator
              checked={averagePrice}
              set={setAveragePrice}
              label="평균매수단가"
            />
            <Indicator checked={ma20} set={setMa20} label="20 이평선" />
            <Indicator checked={ma60} set={setMa60} label="60 이평선" />
          </div>
        </div>

        <InvestorControls
          className="chart-holding-controls"
          label="보유비중"
          options={holdingInvestorOptions}
          selected={holdingInvestors}
          setSelected={setHoldingInvestors}
        />
        <InvestorControls
          className="chart-power-controls"
          label="영향력"
          options={powerInvestorOptions}
          selected={powerInvestors}
          setSelected={setPowerInvestors}
        />
      </div>
    </section>
  );
}

function InvestorControls<T extends string | number>({
  className,
  label,
  options,
  selected,
  setSelected,
}: {
  className: string;
  label: string;
  options: readonly { key: T; label: string; color?: string }[];
  selected: T[];
  setSelected: (value: T[]) => void;
}) {
  return (
    <div className={`chart-indicator-group chart-investor-controls ${className}`}>
      <strong className="chart-indicator-label">{label}</strong>
      <div className="indicator-checks chart-investor-options">
        {options.map((option) => (
          <Indicator
            key={option.key}
            checked={selected.includes(option.key)}
            set={() =>
              setSelected(
                toggleSelection(
                  selected,
                  option.key,
                  options.map((item) => item.key),
                ),
              )
            }
            label={option.label}
            color={option.color}
          />
        ))}
      </div>
    </div>
  );
}

function Indicator({
  checked,
  set,
  label,
  color,
}: {
  checked: boolean;
  set: (value: boolean) => void;
  label: string;
  color?: string;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => set(event.target.checked)}
      />
      <span style={color ? { color } : undefined}>{label}</span>
    </label>
  );
}
