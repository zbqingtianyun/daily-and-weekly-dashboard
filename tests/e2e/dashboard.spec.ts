import { expect, test } from "@playwright/test";

test("仪表盘可切换日报、周报与业务页面", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "经营总览" })).toBeVisible();
  await page.getByRole("button", { name: "周报" }).click();
  await expect(page.getByText("周内日均口径")).toBeVisible();
  await page.getByRole("button", { name: "收入与付费" }).click();
  await expect(page.getByRole("heading", { name: "收入与付费" })).toBeVisible();
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
  await expect(page).toHaveURL(/grain=day/);
  await expect(page).toHaveURL(/from=2020-10-05/);
  await expect(page).toHaveURL(/to=2020-10-05/);
});

test("经营总览展示核心经营转化漏斗", async ({ page }) => {
  await page.goto("/?grain=day&from=2020-09-28&to=2020-09-28");

  const funnel = page.getByRole("region", { name: "核心经营转化漏斗" });
  await expect(funnel).toBeVisible();
  await expect(funnel.getByText("DAU", { exact: true })).toBeVisible();
  await expect(funnel.getByText("活跃用户 14 日留存人数", { exact: true })).toBeVisible();
  await expect(funnel.getByText("总付费人数", { exact: true })).toBeVisible();
  await expect(funnel.getByText("整体转化率")).toBeVisible();
});

