import { expect, test } from "@playwright/test";

test("仪表盘可切换业务页面", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "经营总览" })).toBeVisible();
  await page.getByRole("button", { name: "收入与付费" }).click();
  await expect(page.getByRole("heading", { name: "收入与付费" })).toBeVisible();
});

test("增长与收入页面不再展示旧图表", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "增长与留存" }).click();
  await expect(page.getByRole("heading", { name: "用户增长趋势" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "当前留存状态" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "新用户留存趋势" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "活跃用户留存趋势" })).toHaveCount(0);

  await page.getByRole("button", { name: "收入与付费" }).click();
  await expect(page.getByRole("article")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "收入走势" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "产品收入结构" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "付费人数" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "客单价" })).toHaveCount(0);
});

test("指标搜索可通过键盘打开", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "移动端不提供 Ctrl+K 键盘入口");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "经营总览" })).toBeVisible();
  await page.keyboard.press("Control+K");
  await expect(page.getByPlaceholder("搜索指标、口径或业务模块…")).toBeVisible();
});

test("日报可选择指定日期并展示该日数据", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("日报日期").fill("2020-10-05");

  await expect(page.getByText("2020年10月5日")).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "DAU" }).getByText("564", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/from=2020-10-05/);
  await expect(page).toHaveURL(/to=2020-10-05/);
});

test("经营总览展示活跃留存与活跃付费转化漏斗", async ({ page }) => {
  await page.goto("/?from=2020-09-28&to=2020-09-28");

  await expect(page.getByRole("article")).toHaveCount(6);
  const retentionFunnel = page.getByRole("region", { name: "活跃留存转化漏斗" });
  await expect(retentionFunnel).toBeVisible();
  await expect(retentionFunnel.getByText("DAU", { exact: true })).toBeVisible();
  await expect(retentionFunnel.getByText("活跃用户 7 日留存人数", { exact: true })).toBeVisible();
  await expect(retentionFunnel.getByText("活跃用户 14 日留存人数", { exact: true })).toBeVisible();
  await expect(retentionFunnel.getByText("整体转化率")).toBeVisible();

  const paymentFunnel = page.getByRole("region", { name: "活跃付费转化漏斗" });
  await expect(paymentFunnel).toBeVisible();
  await expect(paymentFunnel.getByText("DAU", { exact: true })).toBeVisible();
  await expect(paymentFunnel.getByText("总付费人数", { exact: true })).toBeVisible();
  await expect(paymentFunnel.getByText("整体转化率")).toBeVisible();

  await expect(page.getByRole("heading", { name: "活跃与新增趋势" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "变化雷达" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "产品收入结构" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "留存快照" })).toHaveCount(0);
});

test("日报经营总览展示新用户和活跃用户留存趋势图", async ({ page }) => {
  await page.goto("/?from=2020-09-28&to=2020-09-28");

  const newUserTrend = page.getByRole("region", { name: "新用户留存趋势图" });
  await expect(newUserTrend).toBeVisible();
  await expect(newUserTrend.getByRole("heading", { name: "新用户留存趋势图" })).toBeVisible();
  await expect(newUserTrend.getByText(/2020-08-01 至 2020-09-28/)).toBeVisible();
  await expect(newUserTrend.getByText(/激活人数 \/ 新用户 14 日留存人数 \/ 新用户 14 日留存率/)).toBeVisible();

  const activeUserTrend = page.getByRole("region", { name: "活跃用户留存趋势图" });
  await expect(activeUserTrend).toBeVisible();
  await expect(activeUserTrend.getByRole("heading", { name: "活跃用户留存趋势图" })).toBeVisible();
  await expect(activeUserTrend.getByText(/2020-08-01 至 2020-09-28/)).toBeVisible();
  await expect(activeUserTrend.getByText(/DAU \/ 活跃用户 14 日留存人数 \/ 活跃用户 14 日留存率/)).toBeVisible();
});

test("日报经营总览展示活跃用户付费趋势图", async ({ page }) => {
  await page.goto("/?from=2020-09-28&to=2020-09-28");

  const paymentTrend = page.getByRole("region", { name: "活跃用户付费趋势图" });
  await expect(paymentTrend).toBeVisible();
  await expect(paymentTrend.getByRole("heading", { name: "活跃用户付费趋势图" })).toBeVisible();
  await expect(paymentTrend.getByText(/2020-08-01 至 2020-09-28/)).toBeVisible();
  await expect(paymentTrend.getByText(/DAU \/ 总付费人数 \/ 活跃用户付费率/)).toBeVisible();
});

