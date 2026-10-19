const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

async function openChart(page) {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".chart-engine table tr")).toHaveCount(6);
}

async function chartFrame(page) {
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}

test("개미지수·RS를 숨기면 주가 공간을 확보하고 다시 표시하면 패널 크기와 시간축을 복원한다", async ({ page }) => {
  await openChart(page);
  const rows = page.locator(".chart-engine table tr");
  const controls = page.getByLabel("차트 표시 지표");
  const ant = controls.getByRole("checkbox", { name: "개미지수", exact: true });
  const rs = controls.getByRole("checkbox", { name: "RS", exact: true });
  await expect(ant).toBeChecked();
  await expect(rs).toBeChecked();

  const separator = await rows.nth(1).locator("div").last().boundingBox();
  expect(separator).not.toBeNull();
  await page.mouse.move(separator.x + separator.width / 2, separator.y + separator.height / 2);
  await page.mouse.down();
  await page.mouse.move(separator.x + separator.width / 2, separator.y + separator.height / 2 + 25, { steps: 6 });
  await page.mouse.up();
  const heights = await rows.evaluateAll(elements => [0, 2, 4].map(index => elements[index].getBoundingClientRect().height));
  const fittedAxis = await rows.last().screenshot();

  const surface = await page.locator(".chart-surface").boundingBox();
  await page.mouse.move(surface.x + surface.width / 2, surface.y + 30);
  await page.mouse.down();
  await page.mouse.move(surface.x + surface.width / 2 - 130, surface.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.mouse.move(surface.x + 10, surface.y + surface.height + 10);
  const scrolledAxis = await rows.last().screenshot();
  expect(scrolledAxis.equals(fittedAxis)).toBe(false);

  await ant.uncheck();
  await expect(rows).toHaveCount(4);
  await chartFrame(page);
  expect(await rows.first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(heights[0]);
  expect((await rows.last().screenshot()).equals(scrolledAxis)).toBe(true);
  const withoutAntHeight = await rows.first().evaluate(element => element.getBoundingClientRect().height);

  await rs.uncheck();
  await expect(rows).toHaveCount(2);
  await chartFrame(page);
  expect(await rows.first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(withoutAntHeight);
  expect((await rows.last().screenshot()).equals(scrolledAxis)).toBe(true);

  // New candle data must keep both panels hidden and still anchor the newest candle.
  await page.locator(".result-table tbody tr").filter({ hasText: "SK하이닉스" }).click();
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await expect(rows).toHaveCount(2);
  await expect(ant).not.toBeChecked();
  await expect(rs).not.toBeChecked();
  await ant.check();
  await expect(rows).toHaveCount(4);
  await rs.check();
  await expect(rows).toHaveCount(6);
  await expect.poll(() => rows.evaluateAll(elements => [0, 2, 4].map(index => elements[index].getBoundingClientRect().height))).toEqual(heights);
  expect((await rows.last().screenshot()).equals(fittedAxis)).toBe(true);
});

test("보조 패널 숨김은 투자자·보조선 선택을 보존하고 영향력 축은 0~50%로 표시한다", async ({ page }) => {
  await page.addInitScript(() => {
    window.__chartAxisTexts = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.__chartAxisTexts.push({ text: String(text), canvas: this.canvas });
      return fillText.call(this, text, ...args);
    };
  });
  await openChart(page);
  const rows = page.locator(".chart-engine table tr");
  const controls = page.getByLabel("차트 표시 지표");
  await controls.getByRole("checkbox", { name: "평균매수단가", exact: true }).uncheck();
  await page.locator(".chart-holding-controls").getByRole("checkbox", { name: "외국인", exact: true }).check();
  await page.locator(".chart-power-controls").getByRole("checkbox", { name: "개인", exact: true }).check();
  await expect(rows).toHaveCount(10);
  await controls.getByRole("checkbox", { name: "개미지수", exact: true }).uncheck();
  await controls.getByRole("checkbox", { name: "RS", exact: true }).uncheck();
  await expect(rows).toHaveCount(6);
  await expect(controls.getByRole("checkbox", { name: "평균매수단가", exact: true })).not.toBeChecked();
  await expect(page.locator(".chart-holding-controls").getByRole("checkbox", { name: "외국인", exact: true })).toBeChecked();
  await expect(page.locator(".chart-power-controls").getByRole("checkbox", { name: "개인", exact: true })).toBeChecked();

  await expect.poll(() => rows.nth(4).evaluate(pane => window.__chartAxisTexts
    .filter(entry => entry.canvas.isConnected && pane.contains(entry.canvas) && /^\d+(?:\.\d+)?%$/.test(entry.text))
    .map(entry => Number(entry.text.slice(0, -1))))).toEqual(expect.arrayContaining([0]));
  const values = await rows.nth(4).evaluate(pane => window.__chartAxisTexts
    .filter(entry => entry.canvas.isConnected && pane.contains(entry.canvas) && /^\d+(?:\.\d+)?%$/.test(entry.text))
    .map(entry => Number(entry.text.slice(0, -1))));
  // Tick spacing adapts to pane height: a short pane can show 0, 20, 40
  // without a 50 label. The previous 0~100 scale must still fail this check.
  expect(Math.max(...values)).toBeGreaterThanOrEqual(40);
  expect(Math.max(...values)).toBeLessThanOrEqual(50);
  await controls.getByRole("checkbox", { name: "개미지수", exact: true }).check();
  await controls.getByRole("checkbox", { name: "RS", exact: true }).check();
  await expect(rows).toHaveCount(10);
  await expect(controls.getByRole("checkbox", { name: "평균매수단가", exact: true })).not.toBeChecked();
});

for (const interval of ["주", "월"]) {
  test(`${interval}봉에서 마지막 일봉 보조패널까지 숨겨도 확대·스크롤한 날짜 범위를 유지한다`, async ({ page }) => {
    await openChart(page);
    const rows = page.locator(".chart-engine table tr");
    const controls = page.getByLabel("차트 표시 지표");
    await controls.getByRole("checkbox", { name: "평균매수단가", exact: true }).uncheck();
    await controls.getByRole("checkbox", { name: "20 이평선", exact: true }).uncheck();
    await controls.getByRole("checkbox", { name: "60 이평선", exact: true }).uncheck();
    await page.locator(".intervals").getByRole("button", { name: interval, exact: true }).click();
    await chartFrame(page);

    const surface = await page.locator(".chart-surface").boundingBox();
    await page.mouse.move(surface.x + surface.width / 2, surface.y + 30);
    await page.mouse.wheel(0, -250);
    await chartFrame(page);
    await page.mouse.down();
    await page.mouse.move(surface.x + surface.width / 2 - 110, surface.y + 30, { steps: 8 });
    await page.mouse.up();
    await page.mouse.move(surface.x + 10, surface.y + surface.height + 10);
    const adjustedAxis = await rows.last().screenshot();

    const ant = controls.getByRole("checkbox", { name: "개미지수", exact: true });
    const rs = controls.getByRole("checkbox", { name: "RS", exact: true });
    await ant.uncheck();
    await expect(rows).toHaveCount(4);
    await rs.uncheck();
    await expect(rows).toHaveCount(2);
    await chartFrame(page);
    expect((await rows.last().screenshot()).equals(adjustedAxis)).toBe(true);
    await ant.check();
    await rs.check();
    await expect(rows).toHaveCount(6);
    await chartFrame(page);
    expect((await rows.last().screenshot()).equals(adjustedAxis)).toBe(true);
  });
}
