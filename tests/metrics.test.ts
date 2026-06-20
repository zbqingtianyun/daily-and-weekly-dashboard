import { describe, expect, it } from "vitest";
import { delta, formatMetric, isMature, KPI_KEYS } from "@/lib/metrics";

describe("指标工具", () => {
  it("正确格式化百分比与货币", () => {
    expect(formatMetric(0.126, "percent")).toBe("12.6%");
    expect(formatMetric(1250, "currency")).toContain("1,250");
  });

  it("计算周期变化", () => {
    expect(delta(120, 100)).toBeCloseTo(0.2);
    expect(delta(100, 0)).toBeNull();
  });

  it("留存成熟窗口不会把尾部补零当成真实值", () => {
    const row = { period: "2020-10-10" };
    expect(isMature(row, "2020-10-12", 7, "day")).toBe(false);
    expect(isMature({ period: "2020-10-01" }, "2020-10-12", 7, "day")).toBe(true);
  });

  it("经营总览展示指定的六个核心指标", () => {
    expect(KPI_KEYS).toEqual([
      "DAU",
      "活跃用户14日留存率",
      "平均单日使用时长（分）",
      "总付费人数",
      "总付费金额",
      "客单价"
    ]);
  });
});

