const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

// Workbook '알람색': drops use alarm price as their denominator; upper edges are inclusive.
const bands = [
  [-50, "#FF0000"], [-9, "#FF0000"], [-6, "#FF0000"], [-3, "#FF0000"], [0, "#FF0000"],
  [2.99, "#FF0000"], [3, "#FF0000"], [3.01, "#EB781E"], [6, "#EB781E"],
  [6.01, "#FFC107"], [9, "#FFC107"], [9.01, "#E5E622"], [12, "#E5E622"],
  [12.01, "#FFFF00"], [15, "#FFFF00"], [15.01, "#D5EAD6"], [18, "#D5EAD6"],
  [18.01, "#7CE57C"], [21, "#7CE57C"], [21.01, "#00B050"], [24, "#00B050"],
  [24.01, "#66A3FF"], [27, "#66A3FF"], [27.01, "#3366FF"], [30, "#3366FF"],
  [33, "#3366FF"], [36, "#3366FF"], [39, "#3366FF"], [80, "#3366FF"],
];
const rgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(", ")})`;

async function refreshPrices(page) {
  const response = page.waitForResponse("**/api/current-price");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await response;
}

test("알람 상태는 최신 엑셀의 10단계 색과 모든 3% 경계를 반영한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.alarmPrices = {};
  server.currentPrices = {};
  const result = Object.fromEntries(bands.map(([drop], index) => {
    const ticker = String(200000 + index);
    server.alarmPrices[ticker] = 100000;
    server.currentPrices[ticker] = 100000 - drop * 1000;
    return [ticker, { name: `알람검증${String(index).padStart(2, "0")}`, ma20_up: index % 2 === 0,
      bojong_profit_rate: 0, trading_value: 1, _5d_avg_trading_value: 1, ibdrs: 1, n_top_acc: 0 }];
  }));
  await page.route("**/api/stock-info", route => route.fulfill({ json: { count: bands.length, result } }));
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const rows = page.locator(".results-panel tbody tr");
  await expect(rows).toHaveCount(bands.length);
  for (const [index, [drop, color]] of bands.entries()) {
    const row = rows.filter({ hasText: `알람검증${String(index).padStart(2, "0")}` });
    const change = Math.round(-drop * 10) / 10;
    await expect(row.locator(".alert-status")).toHaveText(`${index % 2 === 0 ? "U" : ""}${change > 0 ? "+" : ""}${change}%`);
    await expect(row.locator(".alert-status")).toHaveCSS("background-color", rgb(color));
  }
  const orangeRow = rows.filter({ hasText: "알람검증07" });
  await orangeRow.hover();
  await expect(orangeRow.locator(".alert-status")).toHaveCSS("background-color", rgb("#EB781E"));
  await orangeRow.click();
  await page.locator(".panel-toolbar").first().hover();
  await expect(orangeRow.locator(".alert-status")).toHaveCSS("background-color", rgb("#EB781E"));
});

test("현재가 갱신은 알람 색만 바꾸고 가격 미수신·알람 삭제 시 색을 지운다", async ({ page }) => {
  const server = await mockStockData(page);
  server.alarmPrices = { "005930": 100000 };
  server.currentPrices = { "005930": 80000 };
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const row = page.locator(".results-panel tbody tr").filter({ hasText: "삼성전자" });
  const status = row.locator(".alert-status");
  await expect(status).toHaveText("U-20%");
  await expect(status).toHaveCSS("background-color", rgb("#7CE57C"));
  server.currentPrices["005930"] = 96990;
  await refreshPrices(page);
  await expect(status).toHaveText("U-3%");
  await expect(status).toHaveCSS("background-color", rgb("#EB781E"));
  server.currentPrices["005930"] = 97000;
  await refreshPrices(page);
  await expect(status).toHaveCSS("background-color", rgb("#FF0000"));
  server.currentPrices = {};
  await refreshPrices(page);
  await expect(status).toHaveText("U");
  await expect(status).not.toHaveAttribute("style", /background-color:/);
  server.currentPrices["005930"] = 80000;
  await refreshPrices(page);
  await expect(status).toHaveCSS("background-color", rgb("#7CE57C"));
  const pricePane = page.locator(".chart-engine table tr").first();
  await page.locator(".chart-engine canvas").first().waitFor();
  const box = await pricePane.boundingBox();
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4, { button: "right" });
  await page.getByRole("menuitem", { name: "알람가격 삭제" }).click();
  await expect(row.locator("td").nth(4)).toHaveText("");
  await expect(status).toHaveText("U");
  await expect(status).not.toHaveAttribute("style", /background-color:/);
  await expect(page.locator(".watch-list")).not.toContainText(/U|%/);
});
