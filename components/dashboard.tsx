"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, ChevronDown,
  CircleDollarSign, Clock3, Command, Database, LayoutDashboard, Search, Sparkles,
  Target, TrendingUp, UsersRound, WalletCards, X
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EChartsOption, SeriesOption } from "echarts";
import Chart from "./chart";
import type { DashboardDataset, DashboardRow, MetricDefinition, SnapshotMetadata } from "@/lib/types";
import { conversionRate, delta, formatMetric, isMature, KPI_KEYS, metricMap, parseQueryDate } from "@/lib/metrics";

type View = "overview" | "growth" | "revenue" | "conversion";

const COLORS = {
  blue: "#2f6bff",
  violet: "#7c5cfc",
  gold: "#d89b31",
  ink: "#1d1d1f",
  slate: "#69707d",
  grid: "#e9e9e5",
  pale: "#edf3ff"
};

const NAV = [
  { id: "overview" as const, label: "经营总览", icon: LayoutDashboard },
  { id: "growth" as const, label: "增长与留存", icon: UsersRound },
  { id: "revenue" as const, label: "收入与付费", icon: WalletCards },
  { id: "conversion" as const, label: "业务转化", icon: Target }
];

const VIEWS: Record<View, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "EXECUTIVE PULSE", title: "经营总览", description: "从活跃、增长与收入三个角度，读取当前经营脉搏。" },
  growth: { eyebrow: "AUDIENCE HEALTH", title: "增长与留存", description: "观察新用户质量、活跃深度，以及留存指标的成熟状态。" },
  revenue: { eyebrow: "COMMERCIAL SIGNAL", title: "收入与付费", description: "拆解收入结构、付费规模与客单价的周期变化。" },
  conversion: { eyebrow: "JOURNEY SIGNAL", title: "业务转化", description: "按真实字段查看业务阶段与转化率，不制造虚假的严格漏斗。" }
};

function formatChineseDate(period: string) {
  const [year, month, day] = period.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function baseChart(): EChartsOption {
  return {
    animationDuration: 650,
    animationEasing: "cubicOut",
    textStyle: { fontFamily: "Manrope Variable, sans-serif", color: COLORS.slate },
    grid: { left: 12, right: 18, top: 42, bottom: 30, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(29,29,31,.94)",
      borderWidth: 0,
      padding: [10, 12],
      textStyle: { color: "#fff", fontSize: 12 },
      axisPointer: { type: "cross", lineStyle: { color: "#a7b5d4", type: "dashed" } }
    },
    legend: { top: 0, right: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: COLORS.slate } },
    xAxis: {
      type: "category",
      boundaryGap: false,
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisTick: { show: false },
      axisLabel: { color: "#8d929b", fontSize: 11, hideOverlap: true }
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#8d929b", fontSize: 11 },
      splitLine: { lineStyle: { color: COLORS.grid, type: "dashed" } }
    },
    dataZoom: [{ type: "inside", zoomOnMouseWheel: "shift", moveOnMouseMove: true }]
  };
}

function LineChart({ rows, keys, labels, percentKeys = [], secondaryKey }: { rows: DashboardRow[]; keys: string[]; labels?: string[]; percentKeys?: string[]; secondaryKey?: string }) {
  const option = useMemo<EChartsOption>(() => {
    const base = baseChart();
    const series = keys.map((key, index): SeriesOption => ({
      name: labels?.[index] ?? key,
      type: "line",
      smooth: 0.28,
      showSymbol: false,
      symbolSize: 6,
      lineStyle: { width: index === 0 ? 3 : 2, type: index > 1 ? "dashed" : "solid" },
      itemStyle: { color: [COLORS.blue, COLORS.violet, COLORS.gold][index] },
      areaStyle: index === 0 ? { color: "rgba(47,107,255,.08)" } : undefined,
      yAxisIndex: secondaryKey === key ? 1 : 0,
      connectNulls: false,
      data: rows.map((row) => {
        const raw = row[key];
        return raw === null ? null : Number(raw) * (percentKeys.includes(key) ? 100 : 1);
      })
    }));
    return {
      ...base,
      xAxis: { ...(base.xAxis as object), data: rows.map((row) => row.period.slice(5)) },
      yAxis: secondaryKey ? [
        {
          type: "value",
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "#8d929b", fontSize: 11 },
          splitLine: { lineStyle: { color: COLORS.grid, type: "dashed" } }
        },
        {
          type: "value",
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "#8d929b", fontSize: 11 },
          splitLine: { show: false }
        }
      ] : base.yAxis,
      series
    };
  }, [keys, labels, percentKeys, rows, secondaryKey]);
  return <Chart option={option} />;
}

function DailyDualAxisTrendChart({
  title,
  rows,
  latest,
  volumeKey,
  volumeLabel,
  comparisonKey,
  comparisonLabel,
  rateLabel,
  rateKey,
  rateNumeratorKey,
  rateDenominatorKey,
  maturityDays = 0,
  primaryAxisName = "人数",
  secondaryAxisName = rateLabel,
  volumeAxisIndex = 0,
  comparisonAxisIndex = 0,
  rateAxisIndex = 1,
  rateMultiplier = 100,
  rateAxisSuffix = "%"
}: {
  title: string;
  rows: DashboardRow[];
  latest: string;
  volumeKey: string;
  volumeLabel: string;
  comparisonKey: string;
  comparisonLabel: string;
  rateLabel: string;
  rateKey?: string;
  rateNumeratorKey?: string;
  rateDenominatorKey?: string;
  maturityDays?: number;
  primaryAxisName?: string;
  secondaryAxisName?: string;
  volumeAxisIndex?: number;
  comparisonAxisIndex?: number;
  rateAxisIndex?: number;
  rateMultiplier?: number;
  rateAxisSuffix?: string;
}) {
  const option = useMemo<EChartsOption>(() => {
    const base = baseChart();
    const rateValue = (row: DashboardRow) => {
      if (rateNumeratorKey && rateDenominatorKey) {
        return conversionRate(row[rateNumeratorKey], row[rateDenominatorKey]);
      }
      if (!rateKey || row[rateKey] === null) return null;
      return Number(row[rateKey]);
    };
    return {
      ...base,
      grid: { left: 20, right: 24, top: 48, bottom: 54, containLabel: true },
      legend: {
        top: 0,
        right: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: COLORS.slate }
      },
      xAxis: {
        type: "category",
        boundaryGap: true,
        data: rows.map((row) => row.period),
        axisLine: { lineStyle: { color: COLORS.grid } },
        axisTick: { show: false },
        axisLabel: {
          color: "#8d929b",
          fontSize: 10,
          hideOverlap: true,
          formatter: (value: string) => value.slice(5)
        }
      },
      yAxis: [
        {
          type: "value",
          name: primaryAxisName,
          position: "left",
          min: 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "#8d929b", fontSize: 10 },
          nameTextStyle: { color: "#8d929b", fontSize: 10 },
          splitLine: { lineStyle: { color: COLORS.grid, type: "dashed" } }
        },
        {
          type: "value",
          name: secondaryAxisName,
          position: "right",
          min: 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "#8d929b", fontSize: 10, formatter: `{value}${rateAxisSuffix}` },
          nameTextStyle: { color: "#8d929b", fontSize: 10 },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        { type: "inside", start: 0, end: 100, zoomOnMouseWheel: "shift", moveOnMouseMove: true },
        { type: "slider", start: 0, end: 100, height: 16, bottom: 6, borderColor: "transparent", backgroundColor: "#efefeb", fillerColor: "rgba(47,107,255,.16)", handleStyle: { color: COLORS.blue }, textStyle: { color: "#8d929b", fontSize: 9 } }
      ],
      series: [
        {
          name: volumeLabel,
          type: "bar",
          yAxisIndex: volumeAxisIndex,
          barMaxWidth: 18,
          itemStyle: { color: "rgba(47,107,255,.72)", borderRadius: [4, 4, 0, 0] },
          data: rows.map((row) => row[volumeKey] === null ? null : Number(row[volumeKey]))
        },
        {
          name: comparisonLabel,
          type: "line",
          yAxisIndex: comparisonAxisIndex,
          smooth: 0.25,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2.5, color: COLORS.violet },
          itemStyle: { color: COLORS.violet },
          data: rows.map((row) => isMature(row, latest, maturityDays) && row[comparisonKey] !== null ? Number(row[comparisonKey]) : null)
        },
        {
          name: rateLabel,
          type: "line",
          yAxisIndex: rateAxisIndex,
          smooth: 0.25,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, type: "dashed", color: COLORS.gold },
          itemStyle: { color: COLORS.gold },
          data: rows.map((row) => {
            if (!isMature(row, latest, maturityDays)) return null;
            const value = rateValue(row);
            return value === null ? null : value * rateMultiplier;
          })
        }
      ]
    };
  }, [comparisonAxisIndex, comparisonKey, comparisonLabel, latest, maturityDays, primaryAxisName, rateAxisIndex, rateAxisSuffix, rateDenominatorKey, rateKey, rateLabel, rateMultiplier, rateNumeratorKey, rows, secondaryAxisName, volumeAxisIndex, volumeKey, volumeLabel]);

  return (
    <section className="panel new-user-trend" aria-label={title}>
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{rows[0]?.period} 至 {rows.at(-1)?.period} · {volumeLabel} / {comparisonLabel} / {rateLabel}</p>
        </div>
      </header>
      <Chart option={option} height={380} />
    </section>
  );
}

function KpiCard({ metric, current, previous, mature = true, comparisonLabel = "上一周期" }: { metric: MetricDefinition; current: unknown; previous: unknown; mature?: boolean; comparisonLabel?: string }) {
  const change = mature ? delta(current, previous) : null;
  return (
    <motion.article className="kpi-card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <div className="kpi-top">
        <span>{metric.label}</span>
        <span className="metric-dot" />
      </div>
      <strong>{mature ? formatMetric(current, metric.format, true) : "待成熟"}</strong>
      <div className="kpi-foot">
        {change === null ? <span className="muted">{mature ? "暂无可比周期" : `${metric.maturityDays} 日成熟窗口`}</span> : (
          <span className={change >= 0 ? "delta up" : "delta down"}>
            {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(change * 100).toFixed(1)}%
          </span>
        )}
        <span>较 {comparisonLabel}</span>
      </div>
    </motion.article>
  );
}

function FunnelCard({
  title,
  stages,
  comparisonStages,
  currentLabel,
  comparisonLabel
}: {
  title: string;
  stages: { key: string; label: string; value: number | null }[];
  comparisonStages: { key: string; label: string; value: number | null }[];
  currentLabel: string;
  comparisonLabel: string;
}) {
  const rates = stages.slice(1).map((stage, index) => conversionRate(stage.value, stages[index].value));
  const comparisonRates = comparisonStages.slice(1).map((stage, index) => conversionRate(stage.value, comparisonStages[index].value));
  const overallRate = conversionRate(stages.at(-1)?.value, stages[0].value);
  const comparisonOverallRate = conversionRate(comparisonStages.at(-1)?.value, comparisonStages[0].value);
  const formatFunnelValue = (value: number | null) => value === null || !Number.isFinite(value) ? "待成熟" : formatMetric(value, "integer");
  const formatFunnelRate = (value: number | null) => value === null ? "待成熟" : `${(value * 100).toFixed(1)}%`;
  return (
    <section className="panel conversion-funnel" aria-label={title}>
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>阶段统计口径可能不严格包含</p>
        </div>
        <div className="funnel-overall">
          <span>整体转化率</span>
          <strong>{formatFunnelRate(overallRate)}</strong>
          <small>{comparisonLabel}：{formatFunnelRate(comparisonOverallRate)}</small>
        </div>
      </header>
      <div className="funnel-body">
        {stages.map((stage, index) => (
          <div className="funnel-step" key={stage.key}>
            <div className={`funnel-stage funnel-stage-${index + 1}`} style={{ width: `${100 - index * (stages.length === 2 ? 32 : 22)}%` }}>
              <span>{stage.label}</span>
              <div className="funnel-stage-values">
                <strong>{formatFunnelValue(stage.value)}</strong>
                <small>{comparisonLabel}：{formatFunnelValue(comparisonStages[index]?.value ?? null)}</small>
              </div>
            </div>
            {index < rates.length && (
              <div className="funnel-rate" aria-label={`${stages[index].label}到${stages[index + 1].label}转化率`}>
                <span>↓</span>
                <strong>{formatFunnelRate(rates[index])}</strong>
                <small>{currentLabel} · 对比 {formatFunnelRate(comparisonRates[index])}</small>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ConversionFunnels({ current, comparison, latest }: { current: DashboardRow; comparison: DashboardRow; latest: string }) {
  const toNumber = (value: unknown) => value === null || value === undefined || value === "" ? null : Number(value);
  const retentionStages = (row: DashboardRow) => [
    { key: "retention-dau", label: "DAU", value: toNumber(row.DAU) },
    { key: "retention-7d", label: "活跃用户 7 日留存人数", value: isMature(row, latest, 7) ? toNumber(row["活跃用户7日留存人数"]) : null },
    { key: "retention-14d", label: "活跃用户 14 日留存人数", value: isMature(row, latest, 14) ? toNumber(row["活跃用户14日留存人数"]) : null }
  ];
  const paymentStages = (row: DashboardRow) => [
    { key: "payment-dau", label: "DAU", value: toNumber(row.DAU) },
    { key: "payment-total", label: "总付费人数", value: toNumber(row["总付费人数"]) }
  ];

  return (
    <div className="conversion-funnel-grid">
      <FunnelCard
        title="活跃留存转化漏斗"
        stages={retentionStages(current)}
        comparisonStages={retentionStages(comparison)}
        currentLabel={current.period}
        comparisonLabel={comparison.period}
      />
      <FunnelCard
        title="活跃付费转化漏斗"
        stages={paymentStages(current)}
        comparisonStages={paymentStages(comparison)}
        currentLabel={current.period}
        comparisonLabel={comparison.period}
      />
    </div>
  );
}

function StageCard({ title, icon, rows, stages, rates }: { title: string; icon: React.ReactNode; rows: DashboardRow[]; stages: string[]; rates: string[] }) {
  const current = rows.at(-1)!;
  const max = Math.max(...stages.map((key) => Number(current[key] ?? 0)), 1);
  return (
    <section className="stage-card">
      <header><span className="stage-icon">{icon}</span><div><h2>{title}</h2><p>各阶段统计范围可能不同，不作为严格包含漏斗</p></div></header>
      <div className="stage-list">
        {stages.map((key) => {
          const value = current[key];
          return (
            <div className="stage-row" key={key}>
              <span>{key.replace(/_.*$/, "").replace("app", "")}</span>
              <div><i style={{ width: value === null ? "0%" : `${Math.max((Number(value) / max) * 100, 2)}%` }} /></div>
              <strong>{formatMetric(value, "integer", true)}</strong>
            </div>
          );
        })}
      </div>
      <div className="rate-grid">
        {rates.map((key) => <div key={key}><span>{key.replace(/_.*$/, "")}</span><strong>{formatMetric(current[key], "percent")}</strong></div>)}
      </div>
      <div className="mini-trend"><LineChart rows={rows.slice(-14)} keys={[stages.at(-1)!]} /></div>
    </section>
  );
}

export default function Dashboard({ daily, catalog, metadata }: { daily: DashboardDataset; catalog: MetricDefinition[]; metadata: SnapshotMetadata }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<View>((params.get("view") as View) || "overview");
  const sourceRows = daily.rows;
  const firstPeriod = sourceRows[0].period;
  const lastPeriod = sourceRows.at(-1)!.period;
  const initialSelectedDate = parseQueryDate(params.get("to") ?? params.get("from"), lastPeriod);
  const initialSelectedIndex = sourceRows.findIndex((row) => row.period === initialSelectedDate);
  const defaultComparisonDate = sourceRows[Math.max(0, initialSelectedIndex - 1)]?.period ?? firstPeriod;
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [comparisonDate, setComparisonDate] = useState(parseQueryDate(params.get("compare"), defaultComparisonDate));
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const definitions = useMemo(() => metricMap(catalog), [catalog]);

  const updateUrl = useCallback((updates: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, value]) => next.set(key, value));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = sourceRows.find((row) => row.period === selectedDate) ?? sourceRows.at(-1)!;
  const comparison = sourceRows.find((row) => row.period === comparisonDate) ?? sourceRows[0];
  const rows = [current];
  const dailyTrendRows = useMemo(() => daily.rows.filter((row) => row.period <= current.period), [current.period, daily.rows]);
  const currentIndex = sourceRows.findIndex((row) => row.period === current.period);
  const previous = currentIndex > 0 ? sourceRows[currentIndex - 1] : undefined;
  const latest = sourceRows.at(-1)!.period;
  const searched = catalog.filter((metric) => `${metric.label}${metric.key}${metric.description}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12);

  const switchView = (next: View) => {
    setView(next);
    updateUrl({ view: next, from: selectedDate, to: selectedDate, compare: comparisonDate });
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    updateUrl({ view, from: date, to: date, compare: comparisonDate });
  };

  const selectComparisonDate = (date: string) => {
    setComparisonDate(date);
    updateUrl({ view, from: selectedDate, to: selectedDate, compare: date });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><span>脉</span><div><strong>工作数据中心</strong><small>Daily intelligence</small></div></div>
        <nav aria-label="主导航">
          {NAV.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} aria-label={item.label} className={view === item.id ? "active" : ""} onClick={() => switchView(item.id)}><Icon size={18} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="sidebar-note">
          <Database size={17} />
          <div><span>数据快照</span><strong>{metadata.sources.daily.rowCount} 个自然日</strong></div>
        </div>
        <footer><span className="status-dot" /> 已通过数据校验</footer>
      </aside>

      <main>
        <header className="topbar">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={17} /><span>搜索指标</span><kbd><Command size={12} />K</kbd></button>
          <div className="top-controls">
            <label className="date-control single-date">
              <CalendarDays size={16} />
              <span>查看日期</span>
              <input aria-label="日报日期" type="date" min={firstPeriod} max={lastPeriod} value={selectedDate} onChange={(event) => selectDate(event.target.value)} />
            </label>
            {view === "overview" && (
              <label className="date-control comparison-date">
                <CalendarDays size={16} />
                <span>对比日期</span>
                <input aria-label="对比日期" type="date" min={firstPeriod} max={lastPeriod} value={comparisonDate} onChange={(event) => selectComparisonDate(event.target.value)} />
              </label>
            )}
          </div>
        </header>

        <div className="content">
          <motion.header className="page-heading" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div><p className="eyebrow">{VIEWS[view].eyebrow}</p><h1>{VIEWS[view].title}</h1><p>{VIEWS[view].description}</p></div>
            <div className="freshness">
              <span>当前查看日期</span>
              <strong>{formatChineseDate(current.period)}</strong>
              <small>自然日口径 · 数据最新至 {latest} · 快照生成于 {new Date(metadata.generatedAt).toLocaleString("zh-CN")}</small>
            </div>
          </motion.header>

          <AnimatePresence mode="wait">
            <motion.div key={`${view}-${selectedDate}`} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
              {view === "overview" && (
                <>
                  <div className="kpi-grid">
                    {KPI_KEYS.map((key) => {
                      const metric = definitions.get(key)!;
                      return <KpiCard key={key} metric={metric} current={current[key]} previous={comparison[key]} comparisonLabel={comparison.period} mature={isMature(current, latest, metric.maturityDays)} />;
                    })}
                  </div>
                  <ConversionFunnels current={current} comparison={comparison} latest={latest} />
                  <DailyDualAxisTrendChart
                    title="新用户留存趋势图"
                    rows={dailyTrendRows}
                    latest={daily.rows.at(-1)!.period}
                    volumeKey="激活人数"
                    volumeLabel="激活人数"
                    comparisonKey="新用户14日留存人数"
                    comparisonLabel="新用户 14 日留存人数"
                    rateKey="新用户14日留存率"
                    rateLabel="新用户 14 日留存率"
                    maturityDays={14}
                  />
                  <DailyDualAxisTrendChart
                    title="活跃用户留存趋势图"
                    rows={dailyTrendRows}
                    latest={daily.rows.at(-1)!.period}
                    volumeKey="DAU"
                    volumeLabel="DAU"
                    comparisonKey="活跃用户14日留存人数"
                    comparisonLabel="活跃用户 14 日留存人数"
                    rateKey="活跃用户14日留存率"
                    rateLabel="活跃用户 14 日留存率"
                    maturityDays={14}
                  />
                  <DailyDualAxisTrendChart
                    title="活跃用户付费趋势图"
                    rows={dailyTrendRows}
                    latest={daily.rows.at(-1)!.period}
                    volumeKey="DAU"
                    volumeLabel="DAU"
                    comparisonKey="总付费人数"
                    comparisonLabel="总付费人数"
                    rateNumeratorKey="总付费人数"
                    rateDenominatorKey="DAU"
                    rateLabel="活跃用户付费率"
                  />
                  <DailyDualAxisTrendChart
                    title="客单价趋势图"
                    rows={dailyTrendRows}
                    latest={daily.rows.at(-1)!.period}
                    volumeKey="总付费人数"
                    volumeLabel="总付费人数"
                    comparisonKey="总付费金额"
                    comparisonLabel="总付费金额"
                    rateKey="客单价"
                    rateLabel="客单价"
                    primaryAxisName="金额（元）"
                    secondaryAxisName="人数"
                    volumeAxisIndex={1}
                    comparisonAxisIndex={0}
                    rateAxisIndex={0}
                    rateMultiplier={1}
                    rateAxisSuffix=""
                  />
                </>
              )}

              {view === "revenue" && (
                <div className="kpi-grid revenue-kpis">
                  {["总付费金额", "总付费人数", "客单价", "付费金额_训练营", "付费金额_专栏", "付费金额_会员"].map((key) => <KpiCard key={key} metric={definitions.get(key)!} current={current[key]} previous={previous?.[key]} />)}
                </div>
              )}

              {view === "conversion" && (
                <div className="stage-grid">
                  <StageCard title="训练营" icon={<Sparkles size={19} />} rows={rows} stages={["曝光人数_训练营", "点击人数_训练营_app", "浏览商详人数_训练营", "预约人数_训练营", "付费人数_训练营"]} rates={["点击率_训练营_uv", "浏览商详-预约转化率_训练营", "预约-付费转化率_训练营"]} />
                  <StageCard title="专栏" icon={<BarChart3 size={19} />} rows={rows} stages={["曝光人数_专栏", "点击人数_专栏", "浏览商详人数_专栏", "下单人数_专栏", "付费人数_专栏"]} rates={["点击率_专栏_uv", "浏览商详-下单转化率_专栏", "下单-付费转化率_专栏"]} />
                  <StageCard title="会员" icon={<CircleDollarSign size={19} />} rows={rows} stages={["浏览商详人数_会员", "领取会员人数", "点击支付人数_会员", "付费人数_会员"]} rates={["浏览商详-领取会员转化率_会员"]} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {searchOpen && (
          <motion.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setSearchOpen(false)}>
            <motion.div className="command-menu" initial={{ scale: 0.98, y: -12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: -8 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="command-input"><Search size={19} /><input autoFocus placeholder="搜索指标、口径或业务模块…" value={search} onChange={(event) => setSearch(event.target.value)} /><button onClick={() => setSearchOpen(false)}><X size={17} /></button></div>
              <div className="command-results">
                {searched.map((metric) => (
                  <button key={metric.key} onClick={() => {
                    const target: View = metric.group === "growth" || metric.group === "retention" ? "growth" : metric.group === "revenue" ? "revenue" : "conversion";
                    switchView(target); setSearchOpen(false); setSearch("");
                  }}>
                    <span className="result-icon">{metric.group === "revenue" ? <WalletCards size={16} /> : metric.group === "retention" ? <TrendingUp size={16} /> : metric.group === "engagement" ? <Clock3 size={16} /> : <Activity size={16} />}</span>
                    <span><strong>{metric.label}</strong><small>{metric.description}</small></span>
                    <ChevronDown size={15} />
                  </button>
                ))}
              </div>
              <footer><span>↑↓ 浏览</span><span>Enter 跳转</span><span>Esc 关闭</span></footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
