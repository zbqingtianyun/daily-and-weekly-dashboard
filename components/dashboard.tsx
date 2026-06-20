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
type Grain = "day" | "week";

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

function StackedRevenue({ rows }: { rows: DashboardRow[] }) {
  const keys = ["付费金额_训练营", "付费金额_专栏", "付费金额_会员"];
  const colors = [COLORS.blue, COLORS.violet, COLORS.gold];
  const option: EChartsOption = {
    ...baseChart(),
    xAxis: { type: "category", data: rows.map((row) => row.period.slice(5)), axisTick: { show: false }, axisLine: { lineStyle: { color: COLORS.grid } } },
    series: keys.map((key, index) => ({
      name: key.replace("付费金额_", ""),
      type: "bar",
      stack: "revenue",
      barMaxWidth: 24,
      itemStyle: { color: colors[index], borderRadius: index === 2 ? [5, 5, 0, 0] : 0 },
      data: rows.map((row) => Number(row[key] ?? 0))
    }))
  };
  return <Chart option={option} />;
}

function SectionCard({ title, subtitle, action, className = "", children }: { title: string; subtitle: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        {action}
      </header>
      {children}
    </section>
  );
}

function KpiCard({ metric, current, previous, weekly, mature = true }: { metric: MetricDefinition; current: unknown; previous: unknown; weekly: boolean; mature?: boolean }) {
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
        <span>{weekly && metric.aggregation === "weekly_daily_average" ? "周内日均" : "较上一周期"}</span>
      </div>
    </motion.article>
  );
}

function ConversionFunnel({ current, latest, grain }: { current: DashboardRow; latest: string; grain: Grain }) {
  const retentionMature = isMature(current, latest, 14, grain);
  const toNumber = (value: unknown) => value === null || value === undefined || value === "" ? null : Number(value);
  const dau = toNumber(current.DAU);
  const retained = retentionMature ? toNumber(current["活跃用户14日留存人数"]) : null;
  const paid = toNumber(current["总付费人数"]);
  const retentionRate = conversionRate(retained, dau);
  const paymentRate = conversionRate(paid, retained);
  const overallRate = conversionRate(paid, dau);
  const stages = [
    { key: "dau", label: "DAU", value: dau, width: 100 },
    { key: "retained", label: "活跃用户 14 日留存人数", value: retained, width: 78 },
    { key: "paid", label: "总付费人数", value: paid, width: 56 }
  ];
  const rates = [retentionRate, paymentRate];

  return (
    <section className="panel conversion-funnel" aria-labelledby="conversion-funnel-title">
      <header className="panel-header">
        <div>
          <h2 id="conversion-funnel-title">核心经营转化漏斗</h2>
          <p>按所选周期观察活跃、14 日留存与付费规模；阶段统计口径可能不严格包含</p>
        </div>
        <div className="funnel-overall">
          <span>整体转化率</span>
          <strong>{overallRate === null ? "暂无数据" : `${(overallRate * 100).toFixed(1)}%`}</strong>
        </div>
      </header>
      <div className="funnel-body">
        {stages.map((stage, index) => (
          <div className="funnel-step" key={stage.key}>
            <div className={`funnel-stage funnel-stage-${index + 1}`} style={{ width: `${stage.width}%` }}>
              <span>{stage.label}</span>
              <strong>{stage.value === null || !Number.isFinite(stage.value) ? "待成熟" : formatMetric(stage.value, "integer")}</strong>
            </div>
            {index < rates.length && (
              <div className="funnel-rate" aria-label={`${stages[index].label}到${stages[index + 1].label}转化率`}>
                <span>↓</span>
                <strong>{rates[index] === null ? "待成熟" : `${(rates[index]! * 100).toFixed(1)}%`}</strong>
                <small>阶段转化</small>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ChangeRanking({ current, previous, catalog }: { current: DashboardRow; previous?: DashboardRow; catalog: MetricDefinition[] }) {
  const keys = ["DAU", "激活人数", "总付费金额", "总付费人数", "平均单日使用时长（分）"];
  const items = keys.map((key) => {
    const metric = catalog.find((item) => item.key === key)!;
    return { metric, value: delta(current[key], previous?.[key]) };
  }).filter((item) => item.value !== null).sort((a, b) => Math.abs(b.value!) - Math.abs(a.value!));
  return (
    <div className="ranking">
      {items.map(({ metric, value }, index) => (
        <div className="ranking-row" key={metric.key}>
          <span className="rank">{String(index + 1).padStart(2, "0")}</span>
          <span className="ranking-label">{metric.label}</span>
          <div className="ranking-track"><i style={{ width: `${Math.min(Math.abs(value!) * 100, 100)}%` }} /></div>
          <strong className={value! >= 0 ? "positive" : ""}>{value! >= 0 ? "+" : ""}{(value! * 100).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
}

function RetentionGrid({ current, latest, grain, definitions }: { current: DashboardRow; latest: string; grain: Grain; definitions: MetricDefinition[] }) {
  const groups = [
    { title: "新用户留存", keys: ["新用户次日留存率", "新用户7日留存率", "新用户14日留存率"] },
    { title: "活跃用户留存", keys: ["活跃用户次日留存率", "活跃用户7日留存率", "活跃用户14日留存率"] }
  ];
  return (
    <div className="retention-groups">
      {groups.map((group) => (
        <div className="retention-group" key={group.title}>
          <h3>{group.title}</h3>
          {group.keys.map((key) => {
            const metric = definitions.find((item) => item.key === key)!;
            const mature = isMature(current, latest, metric.maturityDays, grain);
            const value = Number(current[key] ?? 0);
            const subject = group.title.replace("留存", "");
            return (
              <div className="retention-item" key={key}>
                <div><span>{metric.label.replace(subject, "")}</span><strong>{mature ? formatMetric(value, "percent") : "待成熟"}</strong></div>
                <div className="retention-track"><i style={{ width: mature ? `${Math.min(value * 100, 100)}%` : "0%" }} /></div>
              </div>
            );
          })}
        </div>
      ))}
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

export default function Dashboard({ daily, weekly, catalog, metadata }: { daily: DashboardDataset; weekly: DashboardDataset; catalog: MetricDefinition[]; metadata: SnapshotMetadata }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<View>((params.get("view") as View) || "overview");
  const [grain, setGrain] = useState<Grain>(params.get("grain") === "week" ? "week" : "day");
  const sourceRows = grain === "day" ? daily.rows : weekly.rows;
  const firstPeriod = sourceRows[0].period;
  const lastPeriod = sourceRows.at(-1)!.period;
  const initialDailyPeriod = parseQueryDate(params.get("to") ?? params.get("from"), lastPeriod);
  const [start, setStart] = useState(grain === "day"
    ? initialDailyPeriod
    : parseQueryDate(params.get("from"), sourceRows[Math.max(0, sourceRows.length - 10)].period));
  const [end, setEnd] = useState(grain === "day" ? initialDailyPeriod : parseQueryDate(params.get("to"), lastPeriod));
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

  const rows = useMemo(() => sourceRows.filter((row) => row.period >= start && row.period <= end), [end, sourceRows, start]);
  const current = rows.at(-1) ?? sourceRows.at(-1)!;
  const currentIndex = sourceRows.findIndex((row) => row.period === current.period);
  const previous = currentIndex > 0 ? sourceRows[currentIndex - 1] : undefined;
  const latest = sourceRows.at(-1)!.period;
  const weeklyMode = grain === "week";
  const searched = catalog.filter((metric) => `${metric.label}${metric.key}${metric.description}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12);

  const switchView = (next: View) => {
    setView(next);
    updateUrl({ view: next, grain, from: start, to: end });
  };

  const switchGrain = (next: Grain) => {
    const nextRows = next === "day" ? daily.rows : weekly.rows;
    const nextEnd = nextRows.at(-1)!.period;
    const nextStart = next === "day" ? nextEnd : nextRows[Math.max(0, nextRows.length - 10)].period;
    setGrain(next);
    setStart(nextStart);
    setEnd(nextEnd);
    updateUrl({ view, grain: next, from: nextStart, to: nextEnd });
  };

  const setRange = (from: string, to: string) => {
    setStart(from); setEnd(to);
    updateUrl({ view, grain, from, to });
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
          <div><span>数据快照</span><strong>{metadata.sources.daily.rowCount + metadata.sources.weekly.rowCount} 个周期</strong></div>
        </div>
        <footer><span className="status-dot" /> 已通过数据校验</footer>
      </aside>

      <main>
        <header className="topbar">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={17} /><span>搜索指标</span><kbd><Command size={12} />K</kbd></button>
          <div className="top-controls">
            <div className="grain-switch" aria-label="日报周报切换">
              <button className={grain === "day" ? "active" : ""} onClick={() => switchGrain("day")}>日报</button>
              <button className={grain === "week" ? "active" : ""} onClick={() => switchGrain("week")}>周报</button>
            </div>
            {grain === "day" ? (
              <label className="date-control single-date">
                <CalendarDays size={16} />
                <span>查看日期</span>
                <input aria-label="日报日期" type="date" min={firstPeriod} max={lastPeriod} value={end} onChange={(event) => setRange(event.target.value, event.target.value)} />
              </label>
            ) : (
              <label className="date-control range-date">
                <CalendarDays size={16} />
                <input aria-label="周报开始日期" type="date" min={firstPeriod} max={end} value={start} onChange={(event) => setRange(event.target.value, end)} />
                <span>—</span>
                <input aria-label="周报结束日期" type="date" min={start} max={lastPeriod} value={end} onChange={(event) => setRange(start, event.target.value)} />
              </label>
            )}
          </div>
        </header>

        <div className="content">
          <motion.header className="page-heading" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div><p className="eyebrow">{VIEWS[view].eyebrow}</p><h1>{VIEWS[view].title}</h1><p>{VIEWS[view].description}</p></div>
            <div className="freshness">
              <span>{weeklyMode ? "所选周期截至" : "当前查看日期"}</span>
              <strong>{weeklyMode ? end : formatChineseDate(current.period)}</strong>
              <small>{weeklyMode ? "周内日均口径" : `自然日口径 · 数据最新至 ${latest}`} · 快照生成于 {new Date(metadata.generatedAt).toLocaleString("zh-CN")}</small>
            </div>
          </motion.header>

          <AnimatePresence mode="wait">
            <motion.div key={`${view}-${grain}`} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
              {view === "overview" && (
                <>
                  <div className="kpi-grid">
                    {KPI_KEYS.map((key) => {
                      const metric = definitions.get(key)!;
                      return <KpiCard key={key} metric={metric} current={current[key]} previous={previous?.[key]} weekly={weeklyMode} mature={isMature(current, latest, metric.maturityDays, grain)} />;
                    })}
                  </div>
                  <ConversionFunnel current={current} latest={latest} grain={grain} />
                  <div className="dashboard-grid">
                    <SectionCard className="span-8" title="活跃与新增趋势" subtitle={`${rows.length} 个${weeklyMode ? "周" : "自然日"} · 鼠标滚轮配合 Shift 可缩放`}>
                      <LineChart rows={rows} keys={["DAU", "激活人数", "首次活跃人数"]} secondaryKey="DAU" />
                    </SectionCard>
                    <SectionCard className="span-4" title="变化雷达" subtitle="按绝对变化幅度排序">
                      <ChangeRanking current={current} previous={previous} catalog={catalog} />
                    </SectionCard>
                    <SectionCard className="span-7" title="产品收入结构" subtitle={weeklyMode ? "人民币 · 周内日均" : "人民币 · 自然日"}>
                      <StackedRevenue rows={rows} />
                    </SectionCard>
                    <SectionCard className="span-5" title="留存快照" subtitle="未达到观察窗口的数据标记为待成熟">
                      <RetentionGrid current={current} latest={latest} grain={grain} definitions={catalog} />
                    </SectionCard>
                  </div>
                </>
              )}

              {view === "growth" && (
                <div className="dashboard-grid">
                  <SectionCard className="span-8" title="用户增长趋势" subtitle={weeklyMode ? "人数均为周内日均" : "激活、首次活跃与活跃规模"}>
                    <LineChart rows={rows} keys={["激活人数", "首次活跃人数", "DAU"]} secondaryKey="DAU" />
                  </SectionCard>
                  <SectionCard className="span-4" title="当前留存状态" subtitle={`观察周期截至 ${latest}`}>
                    <RetentionGrid current={current} latest={latest} grain={grain} definitions={catalog} />
                  </SectionCard>
                  <SectionCard className="span-6" title="新用户留存趋势" subtitle="次日 / 7 日 / 14 日；尾部未成熟数据自动隐藏">
                    <LineChart rows={rows.map((row) => ({ ...row,
                      新用户次日留存率: isMature(row, latest, 1, grain) ? row["新用户次日留存率"] : null,
                      新用户7日留存率: isMature(row, latest, 7, grain) ? row["新用户7日留存率"] : null,
                      新用户14日留存率: isMature(row, latest, 14, grain) ? row["新用户14日留存率"] : null
                    }))} keys={["新用户次日留存率", "新用户7日留存率", "新用户14日留存率"]} percentKeys={["新用户次日留存率", "新用户7日留存率", "新用户14日留存率"]} />
                  </SectionCard>
                  <SectionCard className="span-6" title="活跃用户留存趋势" subtitle="次日 / 7 日 / 14 日；仅展示成熟周期">
                    <LineChart rows={rows.map((row) => ({ ...row,
                      活跃用户次日留存率: isMature(row, latest, 1, grain) ? row["活跃用户次日留存率"] : null,
                      活跃用户7日留存率: isMature(row, latest, 7, grain) ? row["活跃用户7日留存率"] : null,
                      活跃用户14日留存率: isMature(row, latest, 14, grain) ? row["活跃用户14日留存率"] : null
                    }))} keys={["活跃用户次日留存率", "活跃用户7日留存率", "活跃用户14日留存率"]} percentKeys={["活跃用户次日留存率", "活跃用户7日留存率", "活跃用户14日留存率"]} />
                  </SectionCard>
                </div>
              )}

              {view === "revenue" && (
                <>
                  <div className="kpi-grid revenue-kpis">
                    {["总付费金额", "总付费人数", "客单价", "付费金额_训练营", "付费金额_专栏", "付费金额_会员"].map((key) => <KpiCard key={key} metric={definitions.get(key)!} current={current[key]} previous={previous?.[key]} weekly={weeklyMode} />)}
                  </div>
                  <div className="dashboard-grid">
                    <SectionCard className="span-8" title="收入走势" subtitle={weeklyMode ? "总收入与各产品收入 · 周内日均" : "总收入与各产品收入"}>
                      <LineChart rows={rows} keys={["总付费金额", "付费金额_训练营", "付费金额_专栏"]} labels={["总收入", "训练营", "专栏"]} />
                    </SectionCard>
                    <SectionCard className="span-4" title="产品收入结构" subtitle="训练营 / 专栏 / 会员">
                      <StackedRevenue rows={rows} />
                    </SectionCard>
                    <SectionCard className="span-6" title="付费人数" subtitle={weeklyMode ? "周内日均付费人数" : "按产品拆分"}>
                      <LineChart rows={rows} keys={["总付费人数", "付费人数_训练营", "付费人数_专栏"]} />
                    </SectionCard>
                    <SectionCard className="span-6" title="客单价" subtitle="独立量纲展示，避免与收入双轴混用">
                      <LineChart rows={rows} keys={["客单价", "客单价_训练营", "客单价_专栏"]} />
                    </SectionCard>
                  </div>
                </>
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
