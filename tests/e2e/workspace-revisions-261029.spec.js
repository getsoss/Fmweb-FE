const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");
const { changeFromResult } = require("./helpers/watchlist-ui");

const row = (page, name) => page.locator(".results-panel tbody tr").filter({ hasText: name });
const star = (page, name) => row(page, name).getByRole("button", { name: /북마크/ });
async function enter(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".watch-panel").getByRole("button", { name: "현재 종목 추가", exact: true })).toBeEnabled();
}
async function folderMenu(page, name, slot) {
  await row(page, name).click({ button: "right" });
  const menu = page.getByRole("menu", { name: `${name} 관심종목 관리`, exact: true });
  await menu.getByRole("menuitem", { name: new RegExp(`^관심 ${slot}`) }).hover();
  return page.getByRole("menu", { name: `관심 ${slot} 종목 관리`, exact: true });
}

test("자료45~50: 행의 종목을 폴더에 넣고 빼며 전체 폴더 기준 네 가지 별 색상을 표시한다", async ({ page }) => {
  const server = await mockStockData(page);
  const writes = [];
  page.on("request", request => { if (request.url().endsWith("/api/watchlist") && request.method() === "PUT") writes.push(request.postDataJSON()); });
  await enter(page);
  await expect(star(page, "동화약품")).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(star(page, "동화약품").locator("svg path")).toHaveAttribute("stroke", "#000000");
  await expect(star(page, "삼성전자")).toHaveCSS("color", "rgb(0, 176, 240)");
  await star(page, "동화약품").click();
  await expect(star(page, "동화약품")).toHaveCSS("color", "rgb(255, 255, 0)");

  const beforeChart = await page.locator(".chart-identity").textContent();
  const actions = await folderMenu(page, "동화약품", 5);
  const menu = page.getByRole("menu", { name: "동화약품 관심종목 관리", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await expect(menu.getByRole("menuitem", { name: /^관심 1/ })).toContainText("1/50");
  await actions.getByRole("menuitem", { name: "넣기", exact: true }).click();
  await expect(menu.getByRole("menuitem", { name: /^관심 5/ })).toContainText("1/50");
  await expect(star(page, "동화약품")).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(page.locator(".chart-identity")).toHaveText(beforeChart);
  expect(writes).toEqual([{ slot: 5, jmcodes: ["000020"], mode: "add" }]);

  // Repeated add is silent and does not send a redundant request.
  await actions.getByRole("menuitem", { name: "넣기", exact: true }).click();
  await page.keyboard.press("Escape");
  await star(page, "동화약품").click();
  await expect(star(page, "동화약품")).toHaveCSS("color", "rgb(0, 176, 240)");
  expect(writes).toHaveLength(1);
  await changeFromResult(page, "동화약품", 1, "add");
  await expect.poll(() => server.watchlists["1"]).toContain("000020");
  await changeFromResult(page, "동화약품", 5, "delete");
  await expect.poll(() => server.watchlists["5"]).toEqual([]);
  await expect(star(page, "동화약품")).toHaveCSS("color", "rgb(0, 176, 240)");
  await changeFromResult(page, "동화약품", 1, "delete");
  await expect(star(page, "동화약품")).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  const count = writes.length;
  await changeFromResult(page, "동화약품", 1, "delete");
  await expect(page.locator(".workspace-feedback").getByRole("alert")).toHaveCount(0);
  expect(writes).toHaveLength(count);
});

test("자료50: 용량 초과와 저장 실패를 처리하고 키보드로 메뉴를 닫는다", async ({ page }) => {
  const server = await mockStockData(page);
  server.limit = 1;
  let fail = true;
  await page.route("**/api/watchlist", route => route.request().method() === "PUT" && fail
    ? route.fulfill({ status: 503, json: { message: "관심종목 저장 실패" } }) : route.fallback());
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".watch-panel")).toHaveAttribute("aria-busy", "false");
  let actions = await folderMenu(page, "동화약품", 1);
  await expect(actions.getByRole("menuitem", { name: "넣기", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  actions = await folderMenu(page, "동화약품", 3);
  await actions.getByRole("menuitem", { name: "넣기", exact: true }).click();
  await expect(page.locator(".workspace-feedback").getByRole("alert")).toContainText("관심종목 저장 실패");
  await expect(star(page, "동화약품")).toHaveAttribute("data-watched", "false");
  await expect(page.locator(".watch-panel").getByRole("alert")).toHaveCount(0);
  fail = false;
  await actions.getByRole("menuitem", { name: "넣기", exact: true }).click();
  await expect.poll(() => server.watchlists["3"]).toEqual(["000020"]);
  await expect(star(page, "동화약품")).toHaveAttribute("data-watched", "true");
  await expect(page.locator(".workspace-feedback").getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(star(page, "동화약품")).toBeFocused();
  await star(page, "동화약품").press("Shift+F10");
  const menu = page.getByRole("menu", { name: "동화약품 관심종목 관리", exact: true });
  await expect(menu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menu", { name: "관심 2 종목 관리", exact: true })).toBeVisible();
  await expect(page.getByRole("menu", { name: "관심 2 종목 관리", exact: true }).getByRole("menuitem", { name: "빼기", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

for (const width of [1440, 1100]) {
  test(`자료46·47·49: ${width}px에서 관심창은 버튼만 표시하고 상태 공간 없이 검색·뉴스 영역을 확보한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 720 });
    await mockStockData(page);
    await enter(page);
    const watch = page.locator(".watch-panel");
    await expect(watch.locator(".watch-list, .watch-empty, .portfolio-message, [role=status], [role=alert]")).toHaveCount(0);
    expect((await watch.boundingBox()).height).toBeLessThan(150);
    if (width === 1440) await expect(watch.getByRole("button", { name: /^관심 5/ })).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".search-api-message")).toHaveCount(0);
    await expect(page.getByLabel("종목 및 저장 검색").getByRole("button", { name: "검색조건 만들기" })).toBeInViewport();
    await watch.getByRole("button", { name: "검색창에서 보기", exact: true }).click();
    await expect(page.locator(".results-panel tbody tr")).toHaveCount(1);
    await expect(row(page, "삼성전자")).toBeVisible();
    await page.locator(".results-panel").getByRole("button", { name: "전종목 보기", exact: true }).click();
    await expect(page.locator(".workspace-feedback").getByRole("status")).toHaveCount(0);
    await expect(page.locator(".news-panel")).toBeVisible();
    await folderMenu(page, "삼성전자", 5);
    const bounds = await page.getByRole("menu", { name: "관심 5 종목 관리", exact: true }).boundingBox();
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(width === 1440 ? 1000 : 720);
    await page.keyboard.press("Escape");
    const screenshot = testInfo.outputPath(`workspace-${width}.png`);
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`workspace-${width}.png`, { path: screenshot, contentType: "image/png" });
  });
}

// Inspect the actual rendered horizontal line, rather than a production test hook.
async function redLine(page) {
  return page.locator(".chart-engine table tr").first().evaluate(pane => {
    for (const canvas of pane.querySelectorAll("canvas")) {
      if (canvas.width < 200 || canvas.height < 40) continue;
      const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y++) {
        let red = 0;
        for (let x = 0; x < canvas.width; x++) {
          const offset = (y * canvas.width + x) * 4;
          if (data[offset] >= 250 && data[offset + 1] <= 5 && data[offset + 2] <= 5 && data[offset + 3] > 0) red++;
        }
        if (red > canvas.width * .6) return y / canvas.height;
      }
    }
    return null;
  });
}
async function alarmMenu(page, fraction = .4) {
  const pane = await page.locator(".chart-engine table tr").first().boundingBox();
  await page.mouse.click(pane.x + pane.width * .5, pane.y + pane.height * fraction, { button: "right" });
  return page.getByRole("menu", { name: "알람가격 메뉴", exact: true });
}
test("자료52: 서버 알람선을 빨간 실선으로 복원·갱신·삭제하고 차트 범위와 다른 종목을 유지한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.alarmPrices = { "005930": 72000 };
  let fail = false;
  await page.route("**/api/alarm-price", route => fail && route.request().method() === "PUT"
    ? route.fulfill({ status: 503, json: { message: "알람선 저장 실패" } }) : route.fallback());
  await enter(page);
  await expect.poll(() => redLine(page)).not.toBeNull();
  const initial = await redLine(page);
  const table = await page.locator(".chart-engine table").elementHandle();
  let menu = await alarmMenu(page, .25);
  await menu.getByRole("menuitem", { name: "알람가격 넣기", exact: true }).click();
  await expect.poll(async () => { const line = await redLine(page); return line !== null && Math.abs(line - initial) > .03; }).toBe(true);
  expect(await table.evaluate(element => element.isConnected)).toBe(true);
  const changed = await redLine(page);
  fail = true;
  menu = await alarmMenu(page, .65);
  await menu.getByRole("menuitem", { name: "알람가격 넣기", exact: true }).click();
  await expect(page.locator(".workspace-feedback").getByRole("alert")).toContainText("알람선 저장 실패");
  await expect.poll(() => redLine(page)).toBe(changed);
  fail = false;
  await page.getByLabel("차트 표시 지표").getByRole("checkbox", { name: "60 이평선", exact: true }).uncheck();
  await expect.poll(() => redLine(page)).not.toBeNull();
  await page.locator(".intervals").getByRole("button", { name: "주", exact: true }).click();
  await expect.poll(() => redLine(page)).not.toBeNull();
  await row(page, "SK하이닉스").click();
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await expect.poll(() => redLine(page)).toBeNull();
  await row(page, "삼성전자").click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
  await expect.poll(() => redLine(page)).not.toBeNull();
  menu = await alarmMenu(page);
  await menu.getByRole("menuitem", { name: "알람가격 삭제", exact: true }).click();
  await expect.poll(() => redLine(page)).toBeNull();
  expect(server.alarmPrices).not.toHaveProperty("005930");
});
