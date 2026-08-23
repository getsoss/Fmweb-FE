const { expect, test } = require("@playwright/test");

test("핵심 차트와 기간·지표 제어를 제공한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".pro-chart")).toBeVisible();
  await expect(page.locator(".chart-engine canvas").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "일", exact: true })).toHaveClass(/active/);
  await page.getByRole("button", { name: "지표", exact: true }).click();
  await expect(page.getByText("20일 이동평균")).toBeVisible();
  await expect(page.getByText("60일 이동평균")).toBeVisible();
  await expect(page.locator(".vertical-tools")).toHaveCount(0);
  await expect(page.locator(".drawing-canvas")).toHaveCount(0);
});

test("API v09 조건 검색 모드를 제공한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "조건 검색", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "종목 조건 검색" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "종가" })).toHaveClass(/active/);
  await dialog.getByRole("button", { name: "수익률" }).click();
  await expect(dialog.getByRole("heading", { name: "보유종목 수익률" })).toBeVisible();
  await dialog.getByRole("button", { name: "보유비중" }).click();
  await expect(dialog.getByLabel("시작일")).toBeVisible();
  await expect(dialog.getByLabel("종료일")).toBeVisible();
});
