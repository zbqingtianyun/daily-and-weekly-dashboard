import { expect, test } from "@playwright/test";

test("仪表盘可切换日报、周报与业务页面", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "经营总览" })).toBeVisible();
  await page.getByRole("button", { name: "周报" }).click();
  await expect(page.getByText("周内日均口径")).toBeVisible();
  await page.getByRole("button", { name: "收入与付费" }).click();
  await expect(page.getByRole("heading", { name: "收入与付费" })).toBeVisible();
});

test("指标搜索可通过键盘打开", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+K");
  await expect(page.getByPlaceholder("搜索指标、口径或业务模块…")).toBeVisible();
});

