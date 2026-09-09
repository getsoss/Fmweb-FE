"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
};

const investorOptions = [
  [1, "개인투자자"],
  [2, "외국인"],
  [3, "기관계"],
  [4, "금융투자"],
  [5, "보험"],
  [6, "투신"],
  [7, "기타금융"],
  [8, "은행"],
  [9, "연기금등"],
  [10, "사모펀드"],
  [11, "국가"],
  [12, "기타법인"],
  [13, "내외국인"],
] as const;
type InvestorIndex = (typeof investorOptions)[number][0];
type PaneKey = "price" | "ant" | "holding" | "power" | "rs";
type SavedChartView = {
  key: string;
  paneStretch: Partial<Record<PaneKey, number>>;
};

const investorColors = [
  "#0052ff",
  "#ef6c00",
  "#7c3aed",
  "#00897b",
  "#d81b60",
  "#6d4c41",
  "#3949ab",
  "#43a047",
  "#c0a000",
  "#8e24aa",
  "#00acc1",
  "#f4511e",
  "#546e7a",
] as const;

const plainPriceFormat = {
  type: "custom" as const,
  minMove: 0.01,
  formatter: (value: number) => {
    const rounded = Number(value.toFixed(2));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  },
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

function toggleSelection(
  selected: InvestorIndex[],
  value: InvestorIndex,
): InvestorIndex[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : investorOptions
        .map(([index]) => index)
        .filter((index) => [...selected, value].includes(index));
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
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const savedViewRef = useRef<SavedChartView | null>(null);
  const [interval, setInterval] = useState<Interval>("1D");
  const [chartType, setChartType] = useState<ChartKind>("candles");
  const [scale, setScale] = useState<"normal" | "log" | "percent">("normal");
  const [averagePrice, setAveragePrice] = useState(true);
  const [ma20, setMa20] = useState(true);
  const [ma60, setMa60] = useState(true);
  const [holdingInvestors, setHoldingInvestors] = useState<InvestorIndex[]>([]);
  const [powerInvestors, setPowerInvestors] = useState<InvestorIndex[]>([]);
  const [hovered, setHovered] = useState<OHLC | null>(null);

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
    const host = hostRef.current;
    if (!host || !data.length) return;

    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#fff" },
        textColor: "#7c828a",
        fontFamily: "Inter,system-ui,sans-serif",
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
      timeScale: { borderColor: "#dee1e6", rightOffset: 4, barSpacing: 8 },
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
        priceFormat: plainPriceFormat,
      });
      series.setData(data);
      price = series;
    } else if (chartType === "bars") {
      const series = chart.addSeries(BarSeries, {
        upColor: "#cf202f",
        downColor: "#2563eb",
        priceFormat: plainPriceFormat,
      });
      series.setData(data);
      price = series;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: "#0052ff",
        lineWidth: 2,
        priceFormat: plainPriceFormat,
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
        title: "평균 매입 단가",
        priceFormat: plainPriceFormat,
      });
      series.setData(lineData(holdings, 3));
    }
    if (ma20) {
      const series = chart.addSeries(LineSeries, {
        color: "#f4b000",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "20 이평선",
        priceFormat: plainPriceFormat,
      });
      series.setData(movingAverage(data, 20));
    }
    if (ma60) {
      const series = chart.addSeries(LineSeries, {
        color: "#8b5cf6",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "60 이평선",
        priceFormat: plainPriceFormat,
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
      title: "개미지수",
      priceFormat: plainPriceFormat,
    });
    antIndex.setData(lineData(holdings, 2));
    antIndex.moveToPane(paneIndex++);
    antIndex.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
    paneKeys.push("ant");
    stretchFactors.push(1.5);

    if (holdingInvestors.length) {
      const holdingPane = paneIndex++;
      holdingInvestors.forEach((investor) => {
        const series = chart.addSeries(LineSeries, {
          color: investorColors[investor - 1],
          lineWidth: 2,
          priceScaleId: "right",
          priceFormat: { type: "percent" },
          priceLineVisible: false,
          lastValueVisible: false,
          title: "",
        });
        series.setData(lineData(holdingChanges, investor));
        series.moveToPane(holdingPane);
        series.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
      });
      paneKeys.push("holding");
      stretchFactors.push(2);
    }

    if (powerInvestors.length) {
      const powerPane = paneIndex++;
      powerInvestors.forEach((investor) => {
        const label = investorOptions.find(([value]) => value === investor)?.[1] ?? "";
        const directions = new Map(
          direction.map((row) => [row[0], Number(row[investor])]),
        );
        const series = chart.addSeries(HistogramSeries, {
          priceScaleId: "power",
          priceFormat: { type: "percent" },
          priceLineVisible: false,
          lastValueVisible: false,
          title: label,
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
      priceFormat: { type: "percent" },
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
    chart.timeScale().fitContent();

    return () => {
      savedViewRef.current = {
        key: viewKey,
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

      <div className="chart-stage chart-stage--multi-pane">
        <div className="chart-surface">
          <div ref={hostRef} className="chart-engine" />
        </div>
        {holdingInvestors.length > 0 && (
          <aside className="chart-holding-legend" aria-label="선택 세력 차트 레전드">
            {holdingInvestors.map((investor) => {
              const label = investorOptions.find(([value]) => value === investor)?.[1] ?? "";
              const value = Number(holdingChanges[0]?.[investor]);
              return (
                <div key={investor}>
                  <i style={{ background: investorColors[investor - 1] }} />
                  <span>{label}</span>
                  <b>{Number.isFinite(value) ? `${value.toFixed(2)}%` : "—"}</b>
                </div>
              );
            })}
          </aside>
        )}
      </div>

      <div
        className="indicator-selector chart-indicator-controls"
        aria-label="차트 표시 지표"
      >
        <div className="chart-always-visible" aria-label="항상 표시 지표">
          <strong>항상 표시</strong><span>주가 · 거래량</span><span>개미지수</span><span>RS</span>
        </div>
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
          selected={holdingInvestors}
          setSelected={setHoldingInvestors}
        />
        <InvestorControls
          className="chart-power-controls"
          label="영향력"
          selected={powerInvestors}
          setSelected={setPowerInvestors}
        />
      </div>
    </section>
  );
}

function InvestorControls({
  className,
  label,
  selected,
  setSelected,
}: {
  className: string;
  label: string;
  selected: InvestorIndex[];
  setSelected: (value: InvestorIndex[]) => void;
}) {
  return (
    <div className={`chart-indicator-group chart-investor-controls ${className}`}>
      <strong className="chart-indicator-label">{label}</strong>
      <div className="indicator-checks chart-investor-options">
        {investorOptions.map(([value, investorLabel]) => (
          <Indicator
            key={value}
            checked={selected.includes(value)}
            set={() => setSelected(toggleSelection(selected, value))}
            label={investorLabel}
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
}: {
  checked: boolean;
  set: (value: boolean) => void;
  label: string;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => set(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
