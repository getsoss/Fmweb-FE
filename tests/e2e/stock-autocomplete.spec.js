const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

async function enter(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
  return page.getByRole("form", { name: "종목 조회", exact: true });
}

function info(name) {
  return { name, ma20_up: false, bojong_profit_rate: 0, trading_value: 1, _5d_avg_trading_value: 1, ibdrs: 1, n_top_acc: 0 };
}

async function customStocks(page, result) {
  await page.route("**/api/stock-info", route => route.fulfill({ json: { count: Object.keys(result).length, result } }));
}

test("종목명 일부를 입력하면 후보를 표시하고 마우스로 선택해 차트를 조회한다", async ({ page }) => {
  await mockStockData(page);
  const lookup = await enter(page);
  await lookup.getByLabel("종목코드", { exact: true }).fill("000660");
  await lookup.getByLabel("종목코드", { exact: true }).press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("000660");
  const requests = [];
  page.on("request", request => requests.push(new URL(request.url()).pathname));
  const input = lookup.getByRole("combobox", { name: "종목이름" });
  await input.fill("삼성전");
  const list = page.getByRole("listbox", { name: "종목 자동완성" });
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(list.getByRole("option")).toHaveText("삼성전자005930");
  expect(requests).not.toContain("/api/stocks/005930");
  expect(requests).not.toContain("/api/stock-info");
  await list.getByRole("option", { name: /삼성전자/ }).click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
  await expect(lookup.getByLabel("종목코드", { exact: true })).toHaveValue("005930");
  await expect(input).toHaveValue("삼성전자");
  await expect(list).toHaveCount(0);
  expect(requests.filter(path => path === "/api/stocks/005930")).toHaveLength(1);
});

test("초성·한글 혼합·영문 대소문자 입력으로 일치하는 종목을 제안한다", async ({ page }) => {
  await mockStockData(page);
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  const options = page.getByRole("listbox", { name: "종목 자동완성" }).getByRole("option");
  for (const query of ["ㅅㅅㅈ", "삼성ㅈ", "ᄉᄉᄌ"]) {
    await input.fill(query);
    await expect(options).toHaveText(["삼성전자005930", "삼성중공업010140"]);
  }
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("010140");
  await input.fill("skㅎ");
  await expect(options).toHaveText(["SK하이닉스000660"]);
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("000660");
});

test("초성검색은 전체 후보에서 짧은 종목명 10개를 먼저 골라 한섬을 표시하고 선택한 차트를 조회한다", async ({ page }) => {
  await mockStockData(page);
  const result = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(100000 + i), info(`화승엔터프라이즈${i}`)]));
  Object.assign(result, {
    "005930": info("삼성전자"), "100500": info("화승엔터프라이즈"), "100501": info("한솔제지"),
    "100502": info("해성디에스"), "100503": info("힘스"), "020000": info("한섬"),
  });
  await customStocks(page, result);
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  const options = page.getByRole("listbox", { name: "종목 자동완성" }).getByRole("option");
  for (const query of ["ㅎㅅ", "ᄒᄉ"]) {
    await input.fill(query);
    await expect(options).toHaveText([
      "힘스100503", "한섬020000", "한솔제지100501", "해성디에스100502", "화승엔터프라이즈100500",
      ...Array.from({ length: 5 }, (_, i) => `화승엔터프라이즈${i}${100000 + i}`),
    ]);
  }
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("100503");
  await input.fill("ㅎㅅ");
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("020000");
  await expect(input).toHaveValue("한섬");
  await expect(lookup.getByLabel("종목코드", { exact: true })).toHaveValue("020000");
});

test("초성 혼합 검색도 길이를 우선하고 같은 길이의 응답 순서와 일반 검색 순위를 유지한다", async ({ page }) => {
  await mockStockData(page);
  await customStocks(page, {
    "005930": info("삼성전자"), "100000": info("한솔제지"), "100001": info("대한섬"),
    "100002": info("한성"), "100003": info("한섬"), "100004": info("한성디에스"),
  });
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  const options = page.getByRole("listbox", { name: "종목 자동완성" }).getByRole("option");
  for (const query of ["ㅎㅅ", "한ㅅ"]) {
    await input.fill(query);
    await expect(options).toHaveText(["한성100002", "한섬100003", "대한섬100001", "한솔제지100000", "한성디에스100004"]);
  }
  await input.fill("한");
  await expect(options).toHaveText(["한솔제지100000", "한성100002", "한섬100003", "한성디에스100004", "대한섬100001"]);
});

test("방향키·Escape·Tab·바깥 클릭으로 후보를 조작하고 입력 변경 시 선택을 초기화한다", async ({ page }) => {
  await mockStockData(page);
  const lookup = await enter(page);
  const input = lookup.getByRole("combobox", { name: "종목이름" });
  const list = page.getByRole("listbox", { name: "종목 자동완성" });
  await input.fill("삼성");
  await input.press("ArrowUp");
  await expect(list.getByRole("option", { name: /삼성중공업/ })).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute("aria-activedescendant", await list.getByRole("option", { name: /삼성중공업/ }).getAttribute("id"));
  await input.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await input.press("ArrowDown");
  await expect(list.getByRole("option", { name: /삼성전자/ })).toHaveAttribute("aria-selected", "true");
  await input.fill("하이");
  await expect(list.getByRole("option")).toHaveText("SK하이닉스000660");
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await input.fill("삼성");
  await input.press("Tab");
  await expect(lookup.getByLabel("종목코드", { exact: true })).toBeFocused();
  await expect(list).toHaveCount(0);
  await input.focus();
  await expect(list).toBeVisible();
  await page.locator(".chart-identity").click();
  await expect(list).toHaveCount(0);
  await input.fill("없는종목");
  await expect(list).toHaveCount(0);
});

test("특수문자를 검색식으로 해석하지 않고 정확한 종목명을 후보 맨 앞에 둔다", async ({ page }) => {
  await mockStockData(page);
  const result = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [String(200000 + i), info(`삼성전자우${i}`)]));
  Object.assign(result, { "300001": info("테스트(주)"), "300002": info("테스트.주"), "005930": info("삼성전자") });
  await customStocks(page, result);
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  const options = page.getByRole("listbox", { name: "종목 자동완성" }).getByRole("option");
  await input.fill("삼성전자");
  await expect(options).toHaveCount(10);
  await expect(options.first()).toHaveText("삼성전자005930");
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("200000");
  await expect(lookup.getByLabel("종목코드", { exact: true })).toHaveValue("200000");
  await input.fill("(");
  await expect(options).toHaveText(["테스트(주)300001"]);
  await input.fill(".");
  await expect(options).toHaveText(["테스트.주300002"]);
  await input.fill("[");
  await expect(options).toHaveCount(0);
  await input.fill("*");
  await expect(options).toHaveCount(0);
});

test("2556개 종목의 자동완성·초성검색은 입력 지연 50ms 미만으로 10개만 표시하고 화면 안에 배치한다", async ({ page }, testInfo) => {
  await mockStockData(page);
  await customStocks(page, Object.fromEntries(Array.from({ length: 2556 }, (_, i) => [String(100000 + i), info(`test종목${String(i).padStart(4, "0")}`)])));
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  await input.fill("");
  await input.focus();
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    window.__autocompleteTimings = [];
    const started = performance.now(), input = document.activeElement;
    window.__autocompleteObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.startTime >= started && entry.target === input && entry.interactionId && ["keydown", "keypress", "keyup"].includes(entry.name)) window.__autocompleteTimings.push(entry.duration);
      }
    });
    window.__autocompleteObserver.observe({ type: "event", durationThreshold: 16 });
  });
  await input.pressSequentially("test", { delay: 60 });
  const list = page.getByRole("listbox", { name: "종목 자동완성" });
  await expect(list.getByRole("option")).toHaveCount(10);
  await input.fill("testㅈㅁ");
  // A real Backspace interaction exercises the initial-consonant ranking path.
  await input.press("Backspace");
  await expect(input).toHaveValue("testㅈ");
  await expect(list.getByRole("option")).toHaveCount(10);
  await page.waitForTimeout(250);
  const timings = await page.evaluate(() => { window.__autocompleteObserver.disconnect(); return window.__autocompleteTimings; });
  await testInfo.attach("autocomplete-event-timing.json", { body: JSON.stringify(timings), contentType: "application/json" });
  expect(Math.max(0, ...timings)).toBeLessThan(50);
  await input.press("ArrowUp");
  await expect(list.getByRole("option").last()).toHaveAttribute("aria-selected", "true");
  await expect(list.getByRole("option").last()).toBeInViewport();
  await page.setViewportSize({ width: 1100, height: 720 });
  await expect.poll(async () => {
    const box = await list.boundingBox();
    return box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1101 && box.y + box.height <= 721;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("autocomplete.png") });
});
