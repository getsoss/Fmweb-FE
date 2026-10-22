const { expect, test } = require("@playwright/test");

const { mockStockData } = require("./helpers/stock-data");

test("와이어프레임 기반 랜딩과 외부 링크를 제공한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /세력의 움직임을 읽고/ })).toBeVisible();
  await expect(page.getByText("핀셋 종목선정")).toBeVisible();
  await expect(page.getByText("세력모니터 & 모트레이더")).toBeVisible();
  await expect(page.getByRole("link", { name: "네이버 카페 바로가기", exact: true })).toHaveAttribute("href", "https://cafe.naver.com/motrader");
  await expect(page.getByRole("link", { name: "유튜브 바로가기", exact: true })).toHaveAttribute("href", "https://www.youtube.com/@motrader-morangs");
});

test("v11.6.0 종목 정보로 전종목 검색결과와 종목명 조회를 제공한다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  const stockInfoResponse = page.waitForResponse(response => response.url().includes("/api/stock-info"));
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  expect((await stockInfoResponse).status()).toBe(200);

  const results = page.locator(".results-panel");
  await expect(results.getByText("5개 종목", { exact: true })).toBeVisible();
  await results.getByRole("button", { name: "창 설정", exact: true }).click();
  const columns = page.getByRole("dialog", { name: "검색창 설정 하기" });
  for (const label of ["계좌수익률", "거래액(백만)", "5일평균 거래액", "IBD RS", "고수 계좌"]) {
    await columns.getByRole("checkbox", { name: label, exact: true }).check();
  }
  await columns.getByRole("button", { name: "닫기" }).click();
  const dongwha = results.locator("tbody tr").filter({ hasText: "동화약품" });
  await expect(dongwha).toContainText("-49.0%");
  await expect(dongwha).toContainText("353");
  await expect(dongwha).toContainText("37.7");

  const launcher = page.getByLabel("종목 및 저장 검색");
  await launcher.getByLabel("종목이름").fill("동화약품");
  await launcher.getByRole("button", { name: "차트보기", exact: true }).click();
  await expect(page.locator(".chart-identity")).toContainText("동화약품");
  await expect(page.locator(".chart-identity")).toContainText("000020");
});

test("조건검색은 이전 컬럼 정렬과 북마크 모아보기를 초기화하고 서버 응답 순서를 유지한다", async ({ page }) => {
  await mockStockData(page, [{ slot: 0, title: "저장 검색", condition: { time: 5 } }]);
  const backendOrder = ["현대차", "삼성중공업", "SK하이닉스", "삼성전자"];
  await page.route("**/api/conditional-search", route => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({ json: { errno: 0, count: 4, result: [["005380", 1], ["010140", 8], ["000660", 3], ["005930", 2]] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const results = page.locator(".results-panel");
  const names = results.locator("tbody tr td:nth-child(3) b");
  const launcher = page.getByLabel("종목 및 저장 검색");
  await expect(launcher.locator(".quick-presets .saved")).toHaveCount(1);
  await results.getByRole("button", { name: "삼성전자 북마크 추가" }).click();
  await results.getByRole("button", { name: "★ 모아보기", exact: true }).click();
  await results.getByRole("button", { name: /^종목 / }).click();
  await launcher.getByRole("button", { name: "검색1", exact: true }).click();
  await expect(names).toHaveText(backendOrder);
  await expect(results.getByRole("button", { name: /^종목 / })).toHaveText("종목 ↕");
  await expect(results.getByRole("button", { name: "★ 모아보기", exact: true })).not.toHaveClass(/active/);
  await results.getByRole("button", { name: "삼성전자 북마크 해제" }).click();
  await expect(names).toHaveText(backendOrder);

  await results.getByRole("button", { name: /^종목 / }).click();
  await expect(names).not.toHaveText(backendOrder);
  await launcher.getByRole("button", { name: "검색조건 만들기" }).click();
  await page.getByLabel("검색 설정창").locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click();
  await expect(names).toHaveText(backendOrder);
});

test("종목코드는 영문과 숫자를 입력하고 대소문자와 관계없이 조회한다", async ({ page }) => {
  await mockStockData(page);
  await page.route("**/api/stock-info", route => route.fulfill({ json: { count: 1, result: {
    "00AB12": { name: "영문코드 종목", ma20_up: true, bojong_profit_rate: 0, trading_value: 1, _5d_avg_trading_value: 1, ibdrs: 1, n_top_acc: 0 },
  } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const launcher = page.getByLabel("종목 및 저장 검색");
  const code = launcher.getByLabel("종목코드");
  await code.fill("");
  await code.pressSequentially("00ab12");
  await expect(code).toHaveValue("00ab12");
  await expect(launcher.getByLabel("종목이름")).toHaveValue("");
  const request = page.waitForRequest("**/api/stocks/00AB12");
  await launcher.getByRole("button", { name: "차트보기", exact: true }).click();
  await request;
  await expect(page.locator(".chart-identity")).toContainText("00AB12");
  await expect(page.locator(".chart-identity")).toContainText("영문코드 종목");
  await code.fill("AB12CD");
  await expect(code).toHaveValue("AB12CD");
  await code.pressSequentially("34");
  await expect(code).toHaveValue("AB12CD");
});

test("2556개 결과에서도 입력 지연은 50ms 미만이며 마지막 종목까지 스크롤할 수 있다", async ({ page }, testInfo) => {
  await mockStockData(page);
  const stockInfo = Object.fromEntries(Array.from({ length: 2556 }, (_, index) => [String(100000 + index), {
    name: `테스트종목${String(index).padStart(4, "0")}`, ma20_up: true, bojong_profit_rate: 0, trading_value: index,
    _5d_avg_trading_value: index, ibdrs: 100 - index / 100, n_top_acc: index,
  }]));
  await page.route("**/api/stock-info", route => route.fulfill({ json: { count: 2556, result: stockInfo } }));
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const results = page.locator(".results-panel");
  await results.getByRole("button", { name: "전종목 보기", exact: true }).click();
  await expect(results.getByText("2556개 종목", { exact: true })).toBeVisible();
  await results.getByRole("button", { name: "창 설정", exact: true }).click();
  const columns = page.getByRole("dialog", { name: "검색창 설정 하기" });
  for (const checkbox of await columns.getByRole("checkbox").all()) await checkbox.check();
  await columns.getByRole("button", { name: "닫기" }).click();
  const mountedRows = results.locator("tbody tr:not(.result-spacer)");
  expect(await mountedRows.count()).toBeLessThan(40);
  expect(await mountedRows.first().evaluate(element => element.getBoundingClientRect().height)).toBe(54);

  const measurements = [];
  const launcher = page.getByLabel("종목 및 저장 검색");
  for (const [label, value] of [["종목이름", "asdf1234"], ["종목코드", "ab1234"], ["검색 제목", "asdf1234"]]) {
    if (label === "검색 제목") await launcher.getByRole("button", { name: "검색조건 만들기" }).click();
    const input = page.getByLabel(label, { exact: true });
    await input.fill("");
    await input.focus();
    await page.evaluate(async () => {
      if (!PerformanceObserver.supportedEntryTypes.includes("event")) throw new Error("Event Timing API is required");
      // Finish opening, focusing, and scrolling the panel before measuring typing.
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      window.__inputTimings = [];
      const started = performance.now();
      const input = document.activeElement;
      window.__inputObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.startTime >= started && entry.target === input && entry.interactionId && ["keydown", "keypress", "keyup"].includes(entry.name)) {
            window.__inputTimings.push({ name: entry.name, duration: entry.duration, interactionId: entry.interactionId,
              inputDelay: entry.processingStart - entry.startTime, processingDuration: entry.processingEnd - entry.processingStart });
          }
        }
      });
      window.__inputObserver.observe({ type: "event", durationThreshold: 16 });
    });
    await input.pressSequentially(value, { delay: 60 });
    await expect(input).toHaveValue(value);
    // Allow the browser to deliver buffered Event Timing entries after painting.
    await page.waitForTimeout(250);
    const entries = await page.evaluate(() => {
      window.__inputObserver.disconnect();
      return window.__inputTimings;
    });
    // Interactions below the API's minimum reporting threshold are under 16ms.
    const maxReportedMs = Math.max(0, ...entries.map(entry => entry.duration));
    measurements.push({ label, maxReportedMs, reportingThresholdMs: 16, entries });
    expect(maxReportedMs, `${label}: ${JSON.stringify(entries)}`).toBeLessThan(50);
  }
  await testInfo.attach("input-event-timing.json", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  console.log("2556개 종목 입력 Event Timing:", measurements.map(({ label, maxReportedMs }) => ({ label, maxReportedMs })));
  await launcher.getByRole("button", { name: "검색조건 접기" }).click();
  await launcher.getByRole("button", { name: "검색조건 만들기" }).click();
  await expect(page.getByLabel("검색 제목", { exact: true })).toHaveValue("asdf1234");
  await launcher.getByRole("button", { name: "검색조건 접기" }).click();
  const scroll = results.locator(".result-table-wrap");
  await scroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const last = mountedRows.filter({ hasText: "테스트종목2555" });
  await expect(last).toBeVisible();
  await expect(last.locator("td").first()).toHaveText("2556");
  await last.getByRole("button", { name: "테스트종목2555 북마크 추가" }).click();
  await expect(last.getByRole("button", { name: "테스트종목2555 북마크 해제" })).toHaveAttribute("aria-pressed", "true");
  await last.click();
  await expect(page.locator(".chart-identity")).toContainText("102555");
  await launcher.getByRole("button", { name: "검색조건 만들기" }).click();
  await page.getByLabel("검색 설정창").locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click();
  await expect(results.getByText("4개 종목", { exact: true })).toBeAttached();
  await expect(mountedRows).toHaveCount(4);
});

test("회원가입 이메일 인증 단계를 제공한다", async ({ page }) => {
  await page.route("**/api/auth/cert/mail", route => route.fulfill({ json: { status: 200, certKey: "test-cert-key" } }));
  await page.route("**/api/auth/cert/check", route => route.fulfill({ json: { status: 200 } }));
  await page.goto("/");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "세력모니터 회원가입" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("이메일").fill("user@example.com");
  await dialog.getByRole("button", { name: "인증 메일 발송" }).click();
  await expect(dialog.getByText("이메일을 인증해 주세요")).toBeVisible();
  await dialog.getByRole("button", { name: "인증 확인" }).click();
  await expect(dialog.getByRole("button", { name: "인증 완료" })).toBeVisible();
  await dialog.getByRole("button", { name: "이메일 수정" }).click();
  await expect(dialog.getByText("회원 정보를 입력해 주세요")).toBeVisible();
});

test("v2 워크스페이스에서 복수 차트와 크기 조절 패널을 동시에 제공한다", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".pro-chart")).toBeVisible();
  await expect(page.locator(".chart-engine canvas").first()).toBeVisible();
  await expect(page.locator(".app-bar")).toHaveCount(0);
  const workspaceMenu = page.locator(".workspace-menu");
  await expect(workspaceMenu.getByRole("link", { name: "모트레이더 네이버카페 새 창에서 열기" })).toBeVisible();
  await expect(workspaceMenu.getByRole("link", { name: "제미나이" })).toBeVisible();
  await expect(workspaceMenu.getByRole("link", { name: "ChatGPT" })).toBeVisible();
  await expect(workspaceMenu.getByRole("button", { name: "계정", exact: true })).toBeVisible();
  const workspaceTops = await page.evaluate(() => ({
    workspace: document.querySelector(".market-workspace")?.getBoundingClientRect().top ?? -1,
    chart: document.querySelector(".workspace-chart-slot")?.getBoundingClientRect().top ?? -2,
    menu: document.querySelector(".workspace-menu")?.getBoundingClientRect().top ?? -3,
  }));
  expect(Math.abs(workspaceTops.chart - workspaceTops.workspace)).toBeLessThanOrEqual(1);
  expect(Math.abs(workspaceTops.menu - workspaceTops.workspace)).toBeLessThanOrEqual(1);
  await expect(page.locator(".search-dock")).toBeVisible();
  await expect(page.locator(".results-panel")).toBeVisible();
  await expect(page.locator(".watch-panel")).toBeVisible();
  const watchLayout = await page.locator(".watch-toolbar").evaluate(element => {
    const tabs = element.querySelector(".watch-tabs")?.getBoundingClientRect();
    const actions = element.querySelector(".watch-actions")?.getBoundingClientRect();
    return { tabsCenter: (tabs?.top ?? 0) + (tabs?.height ?? 0) / 2, actionsCenter: (actions?.top ?? 0) + (actions?.height ?? 0) / 2 };
  });
  expect(Math.abs(watchLayout.tabsCenter - watchLayout.actionsCenter)).toBeLessThanOrEqual(1);
  await expect(page.locator(".news-panel")).toBeVisible();
  await expect(page.locator(".news-panel").getByRole("link", { name: "삼성전자 뉴스 제목 3일 전" })).toHaveAttribute("href", "https://example.com/news");
  await expect(page.getByRole("separator")).toHaveCount(4);
  const viewport = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    workspaceBottom: document.querySelector(".workspace-page")?.getBoundingClientRect().bottom ?? 0,
    documentOverflow: getComputedStyle(document.documentElement).overflow,
    bodyOverflow: getComputedStyle(document.body).overflow,
  }));
  expect(viewport.workspaceBottom).toBeLessThanOrEqual(viewport.clientHeight + 1);
  expect(viewport.documentOverflow).toBe("hidden");
  expect(viewport.bodyOverflow).toBe("hidden");
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("button", { name: "홈", exact: true })).toHaveCount(0);
  const indicators = page.getByLabel("차트 표시 지표");
  await expect(indicators.getByText("평균매수단가", { exact: true })).toBeVisible();
  await expect(indicators.getByText("평균거래단가", { exact: true })).toHaveCount(0);
  await expect(indicators.getByText("20 이평선", { exact: true })).toBeVisible();
  await expect(indicators.getByText("60 이평선", { exact: true })).toBeVisible();
  expect(await page.locator(".chart-overlay-controls input:checked + span").evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).color === "rgb(91, 97, 110)"),
  )).toBe(true);
  await expect(page.getByLabel("항상 표시 지표")).toHaveCount(0);
  await expect(page.getByLabel("차트 종류")).toBeVisible();
  await expect(page.getByLabel("가격 스케일")).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 구간" })).toBeVisible();
  const holdingControls = page.locator(".chart-holding-controls");
  await expect(holdingControls.getByText("보유비중", { exact: true })).toBeVisible();
  expect(await holdingControls.locator("label span").allTextContents()).toEqual([
    "개인", "외국인", "기관계", "금투", "보험", "투신", "기금", "은행",
    "연기", "사모", "기법", "내외국", "사연", "사투", "투연", "사투연",
  ]);
  expect(await holdingControls.locator("label span").evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).color),
  )).toEqual([
    "rgb(255, 0, 0)", "rgb(0, 0, 255)", "rgb(3, 87, 3)", "rgb(255, 153, 28)",
    "rgb(128, 0, 128)", "rgb(54, 191, 5)", "rgb(108, 105, 34)", "rgb(139, 69, 19)",
    "rgb(253, 11, 228)", "rgb(0, 0, 0)", "rgb(97, 104, 104)", "rgb(220, 20, 60)",
    "rgb(153, 50, 204)", "rgb(32, 178, 170)", "rgb(255, 69, 0)", "rgb(16, 79, 131)",
  ]);
  const powerControls = page.locator(".chart-power-controls");
  expect(await powerControls.locator("label span").allTextContents()).toEqual([
    "개인", "외국인", "기관계", "금투", "보험", "투신",
    "기금", "은행", "연기", "사모", "기법", "내외국",
  ]);
  expect(await powerControls.locator("label span").evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).color),
  )).toEqual(await holdingControls.locator("label span").evaluateAll(elements =>
    elements.slice(0, 12).map(element => getComputedStyle(element).color),
  ));
  await expect(holdingControls.getByText("국가", { exact: true })).toHaveCount(0);
  await expect(powerControls.getByText("국가", { exact: true })).toHaveCount(0);
  await holdingControls.getByRole("checkbox", { name: "외국인", exact: true }).check();
  await holdingControls.getByRole("checkbox", { name: "기관계", exact: true }).check();
  await expect(holdingControls.locator("input:checked")).toHaveCount(2);

  const primaryBefore = await page.locator(".workspace-primary").evaluate(element => element.getBoundingClientRect().width);
  await page.getByRole("separator", { name: "차트와 데이터 창 너비 조절" }).focus();
  await page.keyboard.press("ArrowLeft");
  const primaryAfter = await page.locator(".workspace-primary").evaluate(element => element.getBoundingClientRect().width);
  expect(primaryAfter).toBeLessThan(primaryBefore);

  await page.locator(".result-table tbody tr").filter({ hasText: "SK하이닉스" }).click();
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await expect(page.locator(".news-panel")).toContainText("SK하이닉스 뉴스 제목");
  expect(await page.locator("tr").evaluateAll(rows => rows.some(row => [...row.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === "" && node.textContent.length > 0)))).toBe(false);
  expect(consoleErrors.filter(message => message.includes("whitespace text nodes") || message.includes("hydration"))).toEqual([]);
});

test("지표 변경 뒤에도 차트 크기와 시간축을 유지하고 불필요한 레전드를 표시하지 않는다", async ({ page }) => {
  await page.addInitScript(() => {
    window.__chartCanvasTexts = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
      window.__chartCanvasTexts.push(String(value));
      return fillText.call(this, value, ...args);
    };
  });
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.locator(".chart-engine canvas").first().waitFor();

  const chartRows = page.locator(".chart-engine table tr");
  const chartTable = page.locator(".chart-engine table");
  const ma60 = page.getByLabel("차트 표시 지표").getByRole("checkbox", { name: "60 이평선" });
  let previousTable = await chartTable.elementHandle();
  await ma60.uncheck();
  await expect.poll(() => previousTable.evaluate(element => element.isConnected)).toBe(false);
  const firstSeparator = chartRows.nth(1).locator("div").last();
  const separatorBox = await firstSeparator.boundingBox();
  expect(separatorBox).not.toBeNull();
  await page.mouse.move(separatorBox.x + separatorBox.width / 2, separatorBox.y + separatorBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(separatorBox.x + separatorBox.width / 2, separatorBox.y + separatorBox.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  const resizedHeight = await chartRows.nth(0).evaluate(element => element.getBoundingClientRect().height);
  previousTable = await chartTable.elementHandle();
  await ma60.check();
  await expect.poll(() => previousTable.evaluate(element => element.isConnected)).toBe(false);
  await expect.poll(() => chartRows.nth(0).evaluate(element => element.getBoundingClientRect().height)).toBe(resizedHeight);

  const holdingControls = page.locator(".chart-holding-controls");
  const chartSurface = page.locator(".chart-surface");
  const surfaceBox = await chartSurface.boundingBox();
  expect(surfaceBox).not.toBeNull();
  const timeAxis = chartRows.last();
  const fittedTimeAxis = await timeAxis.screenshot();
  await page.mouse.move(surfaceBox.x + surfaceBox.width / 2, surfaceBox.y + 80);
  await page.mouse.down();
  await page.mouse.move(surfaceBox.x + surfaceBox.width / 2 - 180, surfaceBox.y + 80, { steps: 8 });
  await page.mouse.up();
  await page.mouse.move(surfaceBox.x + 20, surfaceBox.y + surfaceBox.height + 20);
  const adjustedTimeAxis = await timeAxis.screenshot();
  expect(adjustedTimeAxis.equals(fittedTimeAxis)).toBe(false);

  previousTable = await chartTable.elementHandle();
  await holdingControls.getByRole("checkbox", { name: "외국인", exact: true }).check();
  await expect.poll(() => previousTable.evaluate(element => element.isConnected)).toBe(false);
  await expect(chartRows).toHaveCount(8);
  expect((await chartRows.last().screenshot()).equals(adjustedTimeAxis)).toBe(true);
  const holdingHeight = await chartRows.nth(0).evaluate(element => element.getBoundingClientRect().height);
  previousTable = await chartTable.elementHandle();
  await holdingControls.getByRole("checkbox", { name: "기관계", exact: true }).check();
  await expect.poll(() => previousTable.evaluate(element => element.isConnected)).toBe(false);
  await expect.poll(() => chartRows.nth(0).evaluate(element => element.getBoundingClientRect().height)).toBe(holdingHeight);

  previousTable = await chartTable.elementHandle();
  await page.locator(".result-table tbody tr").filter({ hasText: "SK하이닉스" }).click();
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await expect.poll(() => previousTable.evaluate(element => element.isConnected)).toBe(false);
  await expect.poll(() => chartRows.nth(0).evaluate(element => element.getBoundingClientRect().height)).toBe(holdingHeight);
  // A different stock retains zoom and pane sizes, but returns to its latest candle.
  expect((await chartRows.last().screenshot()).equals(fittedTimeAxis)).toBe(true);
  await expect(holdingControls.locator("input:checked")).toHaveCount(2);

  await expect(page.getByLabel("선택 세력 차트 레전드")).toHaveCount(0);
  await expect(page.locator(".chart-holding-legend")).toHaveCount(0);
  await expect(page.locator(".chart-always-visible")).toHaveCount(0);

  const powerControls = page.locator(".chart-power-controls");
  await powerControls.getByRole("checkbox", { name: "개인", exact: true }).check();
  await expect.poll(async () => {
    const texts = await page.evaluate(() => window.__chartCanvasTexts);
    return texts.includes("0%") && texts.includes("50%");
  }).toBe(true);
  const canvasTexts = await page.evaluate(() => window.__chartCanvasTexts);
  expect(canvasTexts).not.toContain("평균 매입 단가");
  expect(canvasTexts).not.toContain("20 이평선");
  expect(canvasTexts).not.toContain("60 이평선");
  expect(canvasTexts).not.toContain("개미지수");
  expect(canvasTexts).toContain("69.8K");
  expect(canvasTexts).toContain("73.72K");
  expect(canvasTexts).toContain("72.72K");
  expect(canvasTexts).toContain("1.41M");

  const legendLayout = await page.evaluate(() => {
    const stage = document.querySelector(".chart-stage")?.getBoundingClientRect();
    const surface = document.querySelector(".chart-surface")?.getBoundingClientRect();
    const firstPane = document.querySelector(".chart-engine table tr");
    const rightAxis = firstPane?.lastElementChild?.getBoundingClientRect();
    const overlayOptions = document.querySelector(".chart-overlay-options")?.getBoundingClientRect();
    const overlayLast = document.querySelector(".chart-overlay-options label:last-child")?.getBoundingClientRect();
    const investorRows = [...document.querySelectorAll(".chart-investor-options")].map(row => {
      const rowRect = row.getBoundingClientRect();
      const labels = [...row.querySelectorAll("label")].map(label => label.getBoundingClientRect());
      return {
        display: getComputedStyle(row).display,
        justifyContent: getComputedStyle(row).justifyContent,
        startGap: (labels[0]?.left ?? Number.POSITIVE_INFINITY) - rowRect.left,
        gaps: labels.slice(1).map((label, index) => label.left - labels[index].right),
      };
    });
    return {
      stageWidth: stage?.width ?? 0,
      surfaceWidth: surface?.width ?? -1,
      rightAxisWidth: rightAxis?.width ?? Number.POSITIVE_INFINITY,
      overlayGap: (overlayOptions?.right ?? 0) - (overlayLast?.right ?? Number.NEGATIVE_INFINITY),
      investorRows,
    };
  });
  expect(Math.abs(legendLayout.stageWidth - legendLayout.surfaceWidth)).toBeLessThanOrEqual(1);
  expect(legendLayout.rightAxisWidth).toBeLessThanOrEqual(70);
  expect(Math.abs(legendLayout.overlayGap)).toBeLessThanOrEqual(1);
  expect(legendLayout.investorRows).toHaveLength(2);
  expect(legendLayout.investorRows.every(row => row.display === "flex" && row.justifyContent === "flex-start")).toBe(true);
  expect(legendLayout.investorRows.every(row => Math.abs(row.startGap) <= 1)).toBe(true);
  expect(legendLayout.investorRows.every(row => row.gaps.every(gap => Math.abs(gap - 12) <= 1))).toBe(true);
});

test("신규상장주와 영문 코드 조회 뒤에도 최신 캔들과 시간축을 우측에 표시한다", async ({ page }) => {
  await page.addInitScript(() => {
    window.__candleRects = [];
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (x === 0 && y === 0 && width >= this.canvas.width && height >= this.canvas.height) {
        window.__candleRects = window.__candleRects.filter(rect => rect.canvas !== this.canvas && rect.canvas.isConnected);
      }
      if (["#cf202f", "#2563eb"].includes(this.fillStyle) && width > 1 && height > 1) {
        window.__candleRects.push({ canvas: this.canvas, x, y, width, height });
      }
      return fillRect.call(this, x, y, width, height);
    };
  });
  await mockStockData(page);
  await page.route("**/api/stock-info", route => route.fulfill({ json: { count: 4, result: Object.fromEntries([
    ["005930", "삼성전자"], ["00AB12", "신규상장주"], ["00CD34", "다른 기간 종목"], ["00EF56", "첫 거래 종목"],
  ].map(([ticker, name]) => [ticker, { name, ma20_up: true, bojong_profit_rate: 0, trading_value: 1, _5d_avg_trading_value: 1, ibdrs: 1, n_top_acc: 0 }])) } }));
  let releaseShort;
  const shortReady = new Promise(resolve => { releaseShort = resolve; });
  await page.route("**/api/stocks/*", async route => {
    const ticker = new URL(route.request().url()).pathname.split("/").at(-1);
    if (ticker === "00AB12") await shortReady;
    const count = ticker === "00AB12" ? 5 : ticker === "00CD34" ? 12 : ticker === "00EF56" ? 1 : 160;
    const month = ticker === "00CD34" ? 2 : 9;
    const candles = Array.from({ length: count }, (_, index) => {
      const date = Number(new Date(Date.UTC(2026, month, 12 - index)).toISOString().slice(0, 10).replaceAll("-", ""));
      const close = 74200 - index * 50;
      return [date, close, 1000000, 0, close - 500, close + 1000, close - 1000];
    });
    const holdings = candles.map(([date], index) => [date, 0, 1000000 + index, 69000 + index]);
    const investors = candles.map(([date]) => [date, ...Array.from({ length: 13 }, () => 1)]);
    // Indicator-only dates must not expand the candle period or change alignment.
    holdings.push([20200101, 0, 1, 60000]);
    holdings.unshift([20271231, 0, 1, 80000]);
    return route.fulfill({ json: {
      ticker, candles, holdings, holdingChanges: investors, power: investors, direction: investors,
      rs: candles.map(([date]) => [date, 95]),
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const identity = page.locator(".chart-identity");
  const launcher = page.getByLabel("종목 및 저장 검색");
  const code = launcher.getByLabel("종목코드");
  async function rightmostCandle() {
    return page.evaluate(() => {
      const pane = document.querySelector(".chart-engine table tr:first-child td:nth-child(2)");
      const rectangles = window.__candleRects.filter(rect => rect.canvas.isConnected && pane?.contains(rect.canvas));
      const last = rectangles.sort((a, b) => b.x - a.x)[0];
      if (!last) return null;
      const bounds = last.canvas.getBoundingClientRect();
      return {
        rightGap: last.canvas.width - last.x - last.width, barWidth: last.width,
        x: bounds.left + (last.x + last.width / 2) * bounds.width / last.canvas.width,
        y: bounds.top + (last.y + last.height / 2) * bounds.height / last.canvas.height,
      };
    });
  }
  async function expectLatest(date) {
    // Range changes paint asynchronously on the same canvas; read the new frame.
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    await expect.poll(async () => {
      const last = await rightmostCandle();
      return last !== null && last.rightGap <= Math.max(5, last.barWidth);
    }).toBe(true);
    const last = await rightmostCandle();
    await page.mouse.move(last.x, last.y);
    await expect(page.locator(".ohlcv-values > span").first()).toHaveText(date);
  }
  await expectLatest("2026. 10. 12.");
  const originalWidth = (await rightmostCandle()).barWidth;
  const shortRequest = page.waitForRequest("**/api/stocks/00AB12");
  await code.fill("00ab12");
  await launcher.getByRole("button", { name: "차트보기", exact: true }).click();
  await shortRequest;
  // Pending data keeps the previous chart's identity and period together.
  await expect(identity).toContainText("005930");
  releaseShort();
  await expect(identity).toContainText("00AB12");
  await expectLatest("2026. 10. 12.");
  expect(Math.abs((await rightmostCandle()).barWidth - originalWidth)).toBeLessThanOrEqual(1);

  const oldTable = await page.locator(".chart-engine table").elementHandle();
  await page.getByLabel("차트 표시 지표").getByRole("checkbox", { name: "60 이평선", exact: true }).uncheck();
  await expect.poll(() => oldTable.evaluate(element => element.isConnected)).toBe(false);
  await expectLatest("2026. 10. 12.");
  await page.getByRole("button", { name: "전체 구간", exact: true }).click();
  await expectLatest("2026. 10. 12.");
  for (const [ticker, date] of [["00EF56", "2026. 10. 12."], ["00CD34", "2026. 3. 12."], ["005930", "2026. 10. 12."]]) {
    await code.fill(ticker);
    await launcher.getByRole("button", { name: "차트보기", exact: true }).click();
    await expect(identity).toContainText(ticker);
    await expectLatest(date);
  }
  await page.getByRole("button", { name: "전체 구간", exact: true }).click();
  await expectLatest("2026. 10. 12.");
  for (const [interval, date] of [["월", "2026. 10. 1."], ["주", "2026. 10. 12."], ["일", "2026. 10. 12."]]) {
    const previous = await page.locator(".chart-engine table").elementHandle();
    await page.getByRole("button", { name: interval, exact: true }).click();
    await expect.poll(() => previous.evaluate(element => element.isConnected)).toBe(false);
    await expectLatest(date);
  }
});

test("주가 차트 우클릭으로 현재 종목의 알람가격을 넣고 삭제한다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.locator(".chart-engine canvas").first().waitFor();

  const dongwhaRow = page.locator(".result-table-alerts tbody tr").filter({ hasText: "동화약품" });
  const statusCell = dongwhaRow.locator("td").nth(3);
  const alertPriceCell = dongwhaRow.locator("td").nth(4);
  await expect(statusCell).toHaveText("U");
  await expect(alertPriceCell).toHaveText("");
  await dongwhaRow.click();
  await expect(page.locator(".chart-identity")).toContainText("000020");
  await page.locator(".chart-engine canvas").first().waitFor();

  const chartRows = page.locator(".chart-engine table tr");
  const pricePane = chartRows.nth(0);
  await expect(pricePane).toBeVisible();
  const pricePaneBox = await pricePane.boundingBox();
  expect(pricePaneBox).not.toBeNull();

  await page.mouse.click(
    pricePaneBox.x + pricePaneBox.width * 0.6,
    pricePaneBox.y + pricePaneBox.height * 0.4,
    { button: "right" },
  );
  const alertMenu = page.getByRole("menu", { name: "알람가격 메뉴" });
  await expect(alertMenu).toBeVisible();
  await expect(alertMenu.getByRole("menuitem", { name: "알람가격 넣기" })).toBeVisible();
  await expect(alertMenu.getByRole("menuitem", { name: "알람가격 삭제" })).toBeVisible();
  await alertMenu.getByRole("menuitem", { name: "알람가격 넣기" }).click();
  await expect(alertPriceCell).not.toHaveText("");
  expect(Number((await alertPriceCell.textContent()).replaceAll(",", ""))).toBeGreaterThan(0);
  await expect(statusCell).toHaveText(/^(U)?[+-]?\d+(\.\d+)?%$/);
  await expect(statusCell).toHaveAttribute("style", /background-color:/);

  await page.mouse.click(
    pricePaneBox.x + pricePaneBox.width * 0.6,
    pricePaneBox.y + pricePaneBox.height * 0.4,
    { button: "right" },
  );
  await alertMenu.getByRole("menuitem", { name: "알람가격 삭제" }).click();
  await expect(alertPriceCell).toHaveText("");
  await expect(statusCell).toHaveText("U");

  const antPaneBox = await chartRows.nth(2).boundingBox();
  expect(antPaneBox).not.toBeNull();
  await page.mouse.click(
    antPaneBox.x + antPaneBox.width * 0.6,
    antPaneBox.y + antPaneBox.height * 0.5,
    { button: "right" },
  );
  await expect(alertMenu).toHaveCount(0);
});

test("검색 결과 행 상태, 북마크, 창 설정을 유지한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.watchlists["3"] = ["005380"];
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();

  const table = page.locator(".result-table-alerts");
  await expect(table.locator("thead th")).toHaveCount(5);
  await expect(table.locator("thead")).toContainText("번호");
  await expect(table.locator("thead")).toContainText("북마크");
  await expect(table.locator("thead")).toContainText("종목");
  await expect(table.locator("thead")).toContainText("상태");
  await expect(table.locator("thead")).toContainText("알람 가격");
  for (const [name, status, color] of [["현대차", "U-20%", "rgb(124, 229, 124)"], ["삼성전자", "U-12%", "rgb(229, 230, 34)"], ["SK하이닉스", "+50%", "rgb(255, 0, 0)"]]) {
    const cell = table.locator("tbody tr").filter({ hasText: name }).locator(".alert-status");
    await expect(cell).toHaveText(status);
    await expect(cell).toHaveCSS("background-color", color);
  }
  const skRow = table.locator("tbody tr").filter({ hasText: "SK하이닉스" });
  expect(await skRow.locator("td").first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  await skRow.hover();
  expect(await skRow.locator("td").first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(167, 224, 227)");
  await skRow.click();
  await page.locator(".panel-toolbar").hover();
  expect(await skRow.locator("td").first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(167, 224, 227)");
  const bookmark = table.getByRole("button", { name: "삼성전자 북마크 추가" });
  await bookmark.click();
  await expect(table.getByRole("button", { name: "삼성전자 북마크 해제" })).toHaveAttribute("aria-pressed", "true");
  expect(await table.getByRole("button", { name: "삼성전자 북마크 해제" }).evaluate(element => getComputedStyle(element).color)).toBe("rgb(255, 192, 0)");
  await page.getByRole("button", { name: "전종목 보기", exact: true }).click();
  await expect(page.locator(".workspace-message")).toHaveCount(0);

  await page.getByRole("button", { name: "창 설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "검색창 설정 하기" });
  await expect(dialog).toBeVisible();
  for (const label of ["알람가격", "상태", "계좌수익률", "거래액(백만)", "5일평균 거래액", "IBD RS", "고수 계좌"]) {
    await expect(dialog.getByRole("checkbox", { name: label, exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole("checkbox")).toHaveCount(7);
  await dialog.getByRole("checkbox", { name: "계좌수익률", exact: true }).check();
  await expect(table.locator("thead")).toContainText("계좌 수익률");
  await page.reload();
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const restoredTable = page.locator(".result-table-alerts");
  await expect(restoredTable.locator("thead")).toContainText("계좌 수익률");
  await expect(restoredTable.getByRole("button", { name: "삼성전자 북마크 해제" })).toHaveAttribute("aria-pressed", "true");
});

test("검색조건 만들기는 워크스페이스 아래 논모달 설정 영역을 연다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const launcher = page.getByLabel("종목 및 저장 검색");
  const nameInput = launcher.getByLabel("종목이름");
  const tickerInput = launcher.getByLabel("종목코드");
  await expect(nameInput).toBeVisible();
  await expect(tickerInput).toBeVisible();
  await nameInput.fill("현대차");
  await expect(tickerInput).toHaveValue("");
  await tickerInput.fill("000660");
  await expect(nameInput).toHaveValue("");
  await expect(launcher.getByRole("button", { name: /^검색\d$/ })).toHaveCount(5);
  const openSettings = launcher.getByRole("button", { name: "검색조건 만들기" });
  await expect(openSettings).toHaveAttribute("aria-expanded", "false");
  await openSettings.click();

  const settings = page.getByLabel("검색 설정창");
  await expect(settings).toBeVisible();
  await expect(settings).not.toHaveAttribute("aria-modal");
  await expect(page.getByRole("dialog", { name: "새 검색 만들기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "검색조건 접기" })).toHaveAttribute("aria-expanded", "true");
  const layout = await page.evaluate(() => {
    const workspace = document.querySelector(".market-workspace").getBoundingClientRect();
    const settings = document.querySelector(".search-settings-page").getBoundingClientRect();
    return {
      settingsBelowWorkspace: settings.top >= workspace.bottom,
      leftGap: Math.abs(settings.left - workspace.left),
      widthGap: Math.abs(settings.width - workspace.width),
    };
  });
  expect(layout.settingsBelowWorkspace).toBe(true);
  expect(layout.leftGap).toBeLessThanOrEqual(1);
  expect(layout.widthGap).toBeLessThanOrEqual(1);
  await expect(page.locator(".pro-chart")).toBeVisible();
  await expect(page.locator(".results-panel")).toBeVisible();
  await page.locator(".result-table tbody tr").filter({ hasText: "SK하이닉스" }).click();
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await expect(settings).toHaveCount(1);
  await expect(settings.getByRole("radio", { name: "1주", exact: true })).toBeChecked();
  await expect(settings.getByRole("radio", { name: "상위 20", exact: true })).toBeChecked();
  await expect(settings.getByRole("radio", { name: "3달", exact: true })).toBeVisible();
  await settings.getByRole("radio", { name: "3달", exact: true }).check();
  await settings.getByRole("radio", { name: "상위 50", exact: true }).check();
  await settings.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(settings.getByRole("radio", { name: "1주", exact: true })).toBeChecked();
  await expect(settings.getByRole("radio", { name: "상위 20", exact: true })).toBeChecked();
  await settings.getByRole("button", { name: /^검색 1/ }).click();
  await settings.getByLabel("검색 제목").fill("급등주 위주");
  const saveRequest = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "PUT");
  await settings.getByRole("button", { name: "검색조건 저장" }).click();
  expect((await saveRequest).postDataJSON()).toMatchObject({ slot: 0, title: "급등주 위주", condition: { result_sort: 0 } });
  await expect(settings).toBeVisible();
  await expect(page.locator(".workspace-message")).toHaveCount(0);
  await expect(launcher.locator(".preset-description")).toContainText("급등주 위주");
  await expect(settings.getByRole("button", { name: "저장조건 삭제" })).toBeEnabled();
  await settings.getByRole("button", { name: "저장조건 삭제" }).click();
  await expect(settings.getByRole("button", { name: "저장조건 삭제" })).toBeDisabled();
  await expect(settings.getByLabel("검색 제목")).toHaveValue("");
  await launcher.getByRole("button", { name: "검색조건 접기" }).click();
  await expect(settings).toHaveCount(0);
});

const movingAverageOptions = [
  ["무관", "0", 0],
  ["정배열 (20이평 > 60이평)", "20>60", 1],
  ["20이평 상승", "u20", 2],
  ["60이평 상승", "u60", 4],
];

for (const [index, [label, legacy, bits]] of movingAverageOptions.entries()) {
  test(`기존 ${label} 조건을 복원하고 새 이동평균 비트 값과 result_sort 0을 전송한다`, async ({ page }) => {
    await mockStockData(page, [{ slot: 0, title: "기존 저장 검색", condition: {
      time: 5, moving_average: legacy, result_sort: index % 2 + 1,
    } }]);
    await page.goto("/");
    await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
    const launcher = page.getByLabel("종목 및 저장 검색");
    await expect(launcher.locator(".quick-presets .saved")).toHaveCount(1);
    const savedSearch = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "POST");
    await launcher.getByRole("button", { name: "검색1", exact: true }).click();
    const initial = (await savedSearch).postDataJSON();
    expect(initial).toMatchObject({ result_sort: 0, moving_average2: bits });
    expect(initial).not.toHaveProperty("moving_average");
    await expect(launcher.locator(".preset-description")).not.toContainText(/점수 오름차순|점수 내림차순/);
    await launcher.getByRole("button", { name: "검색조건 만들기" }).click();
    const settings = page.getByLabel("검색 설정창");
    await expect(settings.getByRole("group", { name: "최종 검색 결과 정렬", exact: true })).toHaveCount(0);
    const moving = settings.getByRole("group", { name: "이동평균선", exact: true });
    await expect(moving.locator("input:checked")).toHaveCount(bits ? 1 : 0);
    if (bits) await expect(moving.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
    const search = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "POST");
    await settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click();
    expect((await search).postDataJSON()).toMatchObject({ result_sort: 0, moving_average2: bits });
    const save = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "PUT");
    await settings.getByRole("button", { name: "검색조건 저장" }).click();
    const body = (await save).postDataJSON();
    expect(body).toMatchObject({ slot: 0, condition: { result_sort: 0, moving_average2: bits } });
    expect(body.condition).not.toHaveProperty("moving_average");
  });
}

for (const bits of [0, 1, 2, 4, 8, 16, 24, 31]) {
  test(`이동평균선 비트 ${bits}를 체크박스로 복원하고 저장한다`, async ({ page }) => {
    await mockStockData(page, [{ slot: 0, title: "비트 조건", condition: { time: 5, moving_average: "u60", moving_average2: bits } }]);
    await page.goto("/");
    await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
    await expect(page.locator(".quick-presets .saved")).toHaveCount(1);
    await page.getByLabel("종목 및 저장 검색").getByRole("button", { name: "검색1", exact: true }).click();
    await page.getByRole("button", { name: "검색조건 만들기" }).click();
    const settings = page.getByLabel("검색 설정창");
    const moving = settings.getByRole("group", { name: "이동평균선", exact: true });
    for (const [index, label] of ["정배열 (20이평 > 60이평)", "20이평 상승", "60이평 상승", "20이평 하락", "60이평 하락"].entries()) {
      await expect(moving.getByRole("checkbox", { name: label, exact: true })).toBeChecked({ checked: Boolean(bits & (1 << index)) });
    }
    const save = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "PUT");
    await settings.getByRole("button", { name: "검색조건 저장" }).click();
    expect((await save).postDataJSON().condition).toMatchObject({ moving_average2: bits, result_sort: 0 });
  });
}

test("이동평균선 다섯 체크박스를 독립적으로 선택하고 초기화한다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "검색조건 만들기" }).click();
  const settings = page.getByLabel("검색 설정창");
  const moving = settings.getByRole("group", { name: "이동평균선", exact: true });
  await expect(moving.getByRole("checkbox")).toHaveCount(5);
  await expect(moving.getByRole("radio")).toHaveCount(0);
  await expect(moving.getByText("무관", { exact: true })).toHaveCount(0);
  const steps = [["정배열 (20이평 > 60이평)", true, 1], ["20이평 상승", true, 3], ["60이평 상승", true, 7], ["20이평 하락", true, 15], ["60이평 하락", true, 31], ["정배열 (20이평 > 60이평)", false, 30], ["20이평 상승", false, 28], ["60이평 상승", false, 24]];
  for (const [label, checked, bits] of steps) {
    await moving.getByRole("checkbox", { name: label, exact: true }).setChecked(checked);
    const search = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "POST");
    await settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click();
    const body = (await search).postDataJSON();
    expect(body).toMatchObject({ moving_average2: bits, result_sort: 0 });
    expect(body).not.toHaveProperty("moving_average");
  }
  await settings.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(moving.locator("input:checked")).toHaveCount(0);
  const search = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "POST");
  await settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click();
  expect((await search).postDataJSON().moving_average2).toBe(0);
});

test("개미분석, 보유비중, 영향력, 세부 특이 거래량 조건을 API 형식으로 전송한다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "검색조건 만들기" }).click();

  const settings = page.getByLabel("검색 설정창");
  const ant = settings.getByRole("group", { name: "개미 분석 필터" });
  await ant.getByRole("checkbox", { name: "사용", exact: true }).check();
  await expect(ant.locator(".ant-filter-matrix > div")).toHaveCount(7);
  const antPriceUp = ant.getByRole("checkbox", { name: "주가 증가", exact: true });
  const antPriceDown = ant.getByRole("checkbox", { name: "주가 감소", exact: true });
  await antPriceUp.check();
  await antPriceDown.check();
  await expect(antPriceUp).not.toBeChecked();
  await antPriceDown.uncheck();
  await expect(antPriceUp).not.toBeChecked();
  await expect(antPriceDown).not.toBeChecked();
  await antPriceDown.check();
  await ant.getByRole("checkbox", { name: "개미지수(모양 우선) 증가", exact: true }).check();
  await ant.getByRole("checkbox", { name: "평균매입단가(크기 우선) 감소", exact: true }).check();
  await ant.getByRole("checkbox", { name: "고수관심도 증가", exact: true }).check();

  const holding = settings.getByRole("group", { name: "보유비중 증감" });
  await holding.getByRole("checkbox", { name: "사용", exact: true }).check();
  await expect(holding.locator(".investor-matrix > div")).toHaveCount(16);
  const holdingForeignerUp = holding.getByRole("checkbox", { name: "외국인 증가", exact: true });
  const holdingForeignerDown = holding.getByRole("checkbox", { name: "외국인 감소", exact: true });
  await holdingForeignerUp.check();
  await holdingForeignerDown.check();
  await expect(holdingForeignerUp).not.toBeChecked();
  await expect(holding.getByText("국가", { exact: true })).toHaveCount(0);

  const power = settings.getByRole("group", { name: "영향력" });
  await power.getByRole("checkbox", { name: "사용", exact: true }).check();
  await expect(power.locator(".investor-matrix > div")).toHaveCount(16);
  await power.getByRole("checkbox", { name: "기관계 매수력", exact: true }).check();
  await expect(power.getByText("국가", { exact: true })).toHaveCount(0);

  const detailVolume = settings.getByRole("group", { name: "세부 특이 거래량" });
  await detailVolume.getByRole("checkbox", { name: "사용", exact: true }).check();
  await detailVolume.getByRole("radio", { name: "6개월", exact: true }).check();
  await detailVolume.getByRole("checkbox", { name: "외국인", exact: true }).check();
  await expect(detailVolume.getByText("국가", { exact: true })).toHaveCount(0);
  await expect(settings.getByRole("group", { name: "최종 검색 결과 정렬", exact: true })).toHaveCount(0);

  const searchRequest = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "POST");
  await settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click();
  const condition = (await searchRequest).postDataJSON();
  expect(condition.ant_analysis_filter).toMatchObject({
    disabled: 0,
    price: 2,
    ant_index_shape_first: 1,
    average_buy_price_size_first: 2,
    n_top_account: 1,
  });
  expect(condition.have).toMatchObject({ disabled: 0, foreigner: 2 });
  expect(condition.have).not.toHaveProperty("nation");
  expect(condition.power).toMatchObject({ disabled: 0, organization: 1 });
  expect(condition.power).not.toHaveProperty("nation");
  expect(condition.all_special_volume).toBe(0);
  expect(condition.specific_special_volume).toMatchObject({ time: 120, foreigner: 1 });
  expect(condition.specific_special_volume).not.toHaveProperty("nation");
  expect(condition.result_sort).toBe(0);
});

test("v11.5.0 저장 검색 제목을 서버 응답에서 불러온다", async ({ page }) => {
  await mockStockData(page, [{
    slot: 0,
    last_updated: 1789531886,
    title: "서버 저장 제목",
    condition: {
      time: 60,
      result_max: 50,
      each_result_max: 100,
      result_sort: 1,
      ant_analysis_filter: { disabled: 0, price: 1 },
      have: { disabled: 0, foreigner: 2, nation: 1 },
      power: { disabled: 0, organization: 1, nation: 2 },
      specific_special_volume: { time: 120, foreigner: 1, nation: 1 },
    },
  }]);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();

  const launcher = page.getByLabel("종목 및 저장 검색");
  await launcher.getByRole("button", { name: "검색1", exact: true }).click();
  await expect(launcher.locator(".preset-description")).toContainText("서버 저장 제목");
  await launcher.getByRole("button", { name: "검색조건 만들기" }).click();
  const settings = page.getByLabel("검색 설정창");
  await expect(settings.getByLabel("검색 제목")).toHaveValue("서버 저장 제목");
  await expect(settings.getByRole("radio", { name: "3달", exact: true })).toBeChecked();
  await expect(settings.getByRole("radio", { name: "상위 50", exact: true })).toBeChecked();
  await expect(settings.getByRole("group", { name: "최종 검색 결과 정렬", exact: true })).toHaveCount(0);
  await expect(settings.getByRole("group", { name: "개미 분석 필터" }).getByRole("checkbox", { name: "주가 증가", exact: true })).toBeChecked();
  await expect(settings.getByRole("group", { name: "보유비중 증감" }).getByRole("checkbox", { name: "외국인 감소", exact: true })).toBeChecked();
  await expect(settings.getByRole("group", { name: "보유비중 증감" }).getByText("국가", { exact: true })).toHaveCount(0);
  await expect(settings.getByRole("group", { name: "영향력" }).getByRole("checkbox", { name: "기관계 매수력", exact: true })).toBeChecked();
  await expect(settings.getByRole("group", { name: "영향력" }).getByText("국가", { exact: true })).toHaveCount(0);
  const detailVolume = settings.getByRole("group", { name: "세부 특이 거래량" });
  await expect(detailVolume.getByRole("radio", { name: "6개월", exact: true })).toBeChecked();
  await expect(detailVolume.getByRole("checkbox", { name: "외국인", exact: true })).toBeChecked();
  await expect(detailVolume.getByText("국가", { exact: true })).toHaveCount(0);
});

test("관심종목 변경을 서버의 1~5번 폴더에 저장하고 새 브라우저에서도 복원한다", async ({ page, browser }) => {
  const server = await mockStockData(page);
  server.limit = 100;
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const watch = page.locator(".watch-panel");
  await expect(watch.getByRole("button", { name: "관심 1" })).toContainText("1/100");
  await watch.getByRole("button", { name: "관심 3" }).click();
  const add = page.waitForRequest(request => request.url().endsWith("/api/watchlist") && request.method() === "PUT");
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  expect((await add).postDataJSON()).toEqual({ slot: 3, jmcodes: ["005930"], mode: "add" });
  await expect(watch.locator(".watch-list")).toContainText("삼성전자");
  await watch.getByRole("button", { name: "관심 2" }).click();
  const remove = page.waitForRequest(request => request.url().endsWith("/api/watchlist") && request.method() === "PUT");
  await watch.getByRole("button", { name: "SK하이닉스 관심종목 제외" }).click();
  expect((await remove).postDataJSON()).toEqual({ slot: 2, jmcodes: ["000660"], mode: "delete" });
  await expect(watch.locator(".watch-list")).toHaveCount(0);
  await watch.getByRole("button", { name: "관심 1" }).click();
  const clear = page.waitForRequest(request => request.url().endsWith("/api/watchlist") && request.method() === "PUT");
  await watch.getByRole("button", { name: "전체 삭제", exact: true }).click();
  expect((await clear).postDataJSON()).toEqual({ slot: 1, jmcodes: ["005930"], mode: "delete" });
  await expect(watch.locator(".watch-list")).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("forcemonitor:workspace")));
  expect(stored).not.toHaveProperty("watchlists");

  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await mockStockData(other, [], server);
    await other.goto("/");
    await other.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
    const restored = other.locator(".watch-panel");
    await expect(restored.getByRole("button", { name: "관심 1" })).toContainText("0/100");
    await expect(restored.getByRole("button", { name: "관심 2" })).toContainText("0/100");
    await restored.getByRole("button", { name: "관심 3" }).click();
    await expect(restored.locator(".watch-list")).toContainText("삼성전자");
  } finally { await context.close(); }
});

test("로컬 관심종목을 서버 목록에 섞지 않고 백업만 보존한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.watchlists = { "5": ["00AB12"] };
  await page.addInitScript(() => localStorage.setItem("forcemonitor:workspace", JSON.stringify({ watchlists: [["005930", "000660"], [], [], [], []] })));
  let writes = 0;
  page.on("request", request => { if (request.url().endsWith("/api/watchlist") && request.method() === "PUT") writes++; });
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const watch = page.locator(".watch-panel");
  await expect(watch.getByRole("button", { name: "관심 1" })).toContainText("0/50");
  await watch.getByRole("button", { name: "관심 5" }).click();
  await expect(watch.locator(".watch-list")).toContainText("00AB12");
  await watch.getByRole("button", { name: "검색창에서 보기" }).click();
  await expect(page.locator(".results-panel tbody")).toContainText("00AB12");
  expect(writes).toBe(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("forcemonitor:workspace")));
  expect(stored.legacyWatchlists[0]).toEqual(["005930", "000660"]);
  expect(stored).not.toHaveProperty("watchlists");
});

test("이전 로컬 관심종목은 사용자가 가져오기를 선택하면 기존 서버 목록에 추가한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.watchlists = { "1": ["005380"] };
  await page.addInitScript(() => localStorage.setItem("forcemonitor:workspace", JSON.stringify({ watchlists: [["005930", "000660"], [], [], [], []] })));
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const watch = page.locator(".watch-panel");
  await expect(watch.locator(".watch-list li")).toHaveCount(1);
  const add = page.waitForRequest(request => request.url().endsWith("/api/watchlist") && request.method() === "PUT");
  await watch.getByRole("button", { name: "이 폴더의 이전 관심종목 가져오기 (2)", exact: true }).click();
  expect((await add).postDataJSON()).toEqual({ slot: 1, jmcodes: ["005930", "000660"], mode: "add" });
  await expect(watch.locator(".watch-list li")).toHaveCount(3);
  await expect(watch.locator(".watch-list")).toContainText("현대차");
  await expect(watch.getByRole("button", { name: /이전 관심종목 가져오기/ })).toHaveCount(0);
  expect(server.watchlists["1"]).toEqual(["005380", "005930", "000660"]);
});

test("관심종목 추가·삭제 실패 시 목록을 유지하고 성공 후에만 변경한다", async ({ page }) => {
  const server = await mockStockData(page);
  let fail = true;
  await page.route("**/api/watchlist", route => route.request().method() === "PUT" && fail
    ? route.fulfill({ status: 500, json: { message: "관심종목 저장 실패" } }) : route.fallback());
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const watch = page.locator(".watch-panel");
  await expect(watch.getByRole("button", { name: "현재 종목 추가", exact: true })).toBeEnabled();
  await watch.getByRole("button", { name: "관심 2" }).click();
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect(watch.getByRole("alert")).toContainText("관심종목 저장 실패");
  await expect(watch.locator(".watch-list li")).toHaveCount(1);
  await expect(watch.locator(".watch-list")).toContainText("SK하이닉스");
  await watch.getByRole("button", { name: "SK하이닉스 관심종목 제외" }).click();
  await expect(watch.getByRole("alert")).toContainText("관심종목 저장 실패");
  await expect(watch.locator(".watch-list li")).toHaveCount(1);
  await watch.getByRole("button", { name: "전체 삭제", exact: true }).click();
  await expect(watch.getByRole("alert")).toContainText("관심종목 저장 실패");
  expect(server.watchlists["2"]).toEqual(["000660"]);
  fail = false;
  await watch.getByRole("button", { name: "전체 삭제", exact: true }).click();
  await expect(watch.locator(".watch-list li")).toHaveCount(0);
  expect(server.watchlists["2"]).toEqual([]);
});

test("관심종목 로딩에 실패하면 저장을 막고 다시 불러온다", async ({ page }) => {
  await mockStockData(page);
  let fail = true;
  await page.route("**/api/watchlist", route => fail ? route.fulfill({ status: 503, json: { message: "목록을 읽지 못했습니다" } }) : route.fallback());
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const watch = page.locator(".watch-panel");
  await expect(watch.getByRole("alert")).toContainText("목록을 읽지 못했습니다");
  await expect(watch.getByRole("button", { name: "현재 종목 추가", exact: true })).toBeDisabled();
  fail = false;
  await watch.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(watch.locator(".watch-list")).toContainText("삼성전자");
  await expect(watch.getByRole("button", { name: "현재 종목 추가", exact: true })).toBeEnabled();
});

test("관심종목 최대 개수를 읽지 못하면 기존 목록은 표시하고 변경을 막는다", async ({ page }) => {
  const server = await mockStockData(page);
  server.limit = 100;
  let fail = true;
  await page.route("**/api/watchlist-max", route => fail ? route.fulfill({ status: 503, json: { message: "최대 개수 조회 실패" } }) : route.fallback());
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const watch = page.locator(".watch-panel");
  await expect(watch.locator(".watch-list")).toContainText("삼성전자");
  await expect(watch.getByRole("alert")).toContainText("최대 개수 조회 실패");
  await expect(watch.getByRole("button", { name: "현재 종목 추가", exact: true })).toBeDisabled();
  await expect(watch.getByRole("button", { name: "전체 삭제", exact: true })).toBeDisabled();
  fail = false;
  await watch.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(watch.getByRole("button", { name: "관심 1" })).toContainText("1/100");
  await expect(watch.getByRole("button", { name: "전체 삭제", exact: true })).toBeEnabled();
});

test("서버의 관심종목 최대 개수를 적용하고 저장 중 중복 요청을 막는다", async ({ page }) => {
  const server = await mockStockData(page);
  server.limit = 1;
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const watch = page.locator(".watch-panel");
  await expect(watch.getByRole("button", { name: "관심 1" })).toContainText("1/1");
  await expect(watch.getByRole("button", { name: "현재 종목 추가", exact: true })).toBeDisabled();
  await watch.getByRole("button", { name: "관심 3" }).click();
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  let writes = 0;
  await page.route("**/api/watchlist", async route => {
    if (route.request().method() !== "PUT") return route.fallback();
    writes++;
    await pending;
    return route.fallback();
  });
  const request = page.waitForRequest(request => request.url().endsWith("/api/watchlist") && request.method() === "PUT");
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await request;
  await expect(watch.getByRole("button", { name: "현재 종목 추가", exact: true })).toBeDisabled();
  await expect(watch.locator(".watch-list")).toHaveCount(0);
  await watch.getByRole("button", { name: "관심 4" }).click();
  complete();
  await expect(watch.getByRole("button", { name: "관심 3" })).toContainText("1/1");
  await expect(watch.getByRole("button", { name: "관심 4" })).toContainText("0/1");
  expect(server.watchlists["3"]).toEqual(["005930"]);
  expect(writes).toBe(1);
});

test("알람가격을 관심종목과 검색결과에서 공유하고 재로그인·새 브라우저에서도 복원한다", async ({ page, browser }) => {
  const server = await mockStockData(page);
  server.alarmPrices = { "005930": 100000.5 };
  server.currentPrices["005930"] = 110000.55;
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const results = page.locator(".results-panel");
  const watch = page.locator(".watch-panel");
  const samsung = results.locator("tbody tr").filter({ hasText: "삼성전자" });
  await expect(samsung.locator("td").nth(4)).toHaveText("100,000.5");
  await expect(samsung.locator("td").nth(3)).toHaveText("U+10%");
  await expect(watch.locator(".watch-list .alert-status")).toHaveCount(0);
  await expect(watch.locator(".watch-list")).toContainText("알람가격 100,000.5");
  await watch.getByRole("button", { name: "검색창에서 보기" }).click();
  await expect(samsung.locator("td").nth(4)).toHaveText("100,000.5");
  await results.getByRole("button", { name: "전종목 보기", exact: true }).click();
  await expect(samsung.locator("td").nth(3)).toHaveText("U+10%");
  server.currentPrices["005930"] = 80000.4;
  await page.reload();
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(samsung.locator("td").nth(3)).toHaveText("U-20%");
  await expect(watch.locator(".watch-list .alert-status")).toHaveCount(0);
  await page.getByRole("button", { name: "계정", exact: true }).click();
  await page.getByRole("dialog", { name: "마이페이지" }).getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".watch-list")).toContainText("알람가격 100,000.5");
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await mockStockData(other, [], server);
    await other.goto("/");
    await other.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
    await expect(other.locator(".watch-list")).toContainText("알람가격 100,000.5");
    await expect(other.locator(".watch-list .alert-status")).toHaveCount(0);
    await expect(other.locator(".results-panel tbody tr").filter({ hasText: "삼성전자" }).locator("td").nth(3)).toHaveText("U-20%");
  } finally { await context.close(); }
});

for (const ma20Up of [true, false, undefined]) {
  test(`U 표시는 ma20_up=${ma20Up}만 따르고 알람가격·현재가와 무관하다`, async ({ page }) => {
    const server = await mockStockData(page);
    server.watchlists = { "2": ["060310"] };
    server.alarmPrices = { "060310": 1600 };
    server.currentPrices = { "060310": 1320 };
    await page.route("**/api/stock-info", route => route.fulfill({ json: { count: 1, result: {
      "060310": { name: "3S", ...(ma20Up === undefined ? {} : { ma20_up: ma20Up }), bojong_profit_rate: 0,
        trading_value: 1, _5d_avg_trading_value: 1, ibdrs: 1, n_top_acc: 0 },
    } } }));
    await page.goto("/");
    await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
    const row = page.locator(".results-panel tbody tr").filter({ hasText: "3S" });
    const status = row.locator("td").nth(3);
    const prefix = ma20Up === true ? "U" : "";
    await expect(status).toHaveText(`${prefix}-17.5%`);
    await row.click();
    await page.locator(".watch-panel").getByRole("button", { name: "현재 종목 추가" }).click();
    await expect(page.locator(".watch-list li")).toHaveCount(1);
    await expect(page.locator(".watch-list li")).toHaveText("3S060310알람가격 1,600×");

    server.currentPrices["060310"] = 2000;
    await page.reload();
    await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
    await expect(status).toHaveText(`${prefix}+25%`);
    await row.click();
    await expect(page.locator(".chart-identity")).toContainText("060310");

    const pricePane = page.locator(".chart-engine table tr").first();
    await page.locator(".chart-engine canvas").first().waitFor();
    const box = await pricePane.boundingBox();
    const openMenu = () => page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4, { button: "right" });
    await openMenu();
    await page.getByRole("menuitem", { name: "알람가격 삭제" }).click();
    await expect(row.locator("td").nth(4)).toHaveText("");
    await expect(status).toHaveText(prefix);
    await expect(page.locator(".watch-list li")).toHaveText("3S060310×");
    await openMenu();
    await page.getByRole("menuitem", { name: "알람가격 넣기" }).click();
    await expect(row.locator("td").nth(4)).not.toHaveText("");
    await expect(status).toHaveText(new RegExp(`^${prefix}[+-]?\\d+(\\.\\d+)?%$`));
    await expect(page.locator(".watch-list")).not.toContainText(/U|%/);
  });
}

test("알람가격이나 현재가가 없어도 ma20_up으로 U만 표시한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.alarmPrices = {};
  server.currentPrices = {};
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const samsung = page.locator(".results-panel tbody tr").filter({ hasText: "삼성전자" });
  await expect(samsung.locator("td").nth(4)).toHaveText("");
  await expect(samsung.locator("td").nth(3)).toHaveText("U");
  server.alarmPrices["005930"] = 100000;
  await page.reload();
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(samsung.locator("td").nth(4)).toHaveText("100,000");
  await expect(samsung.locator("td").nth(3)).toHaveText("U");
});

test("알람가격 로딩 실패 중에는 서버 값을 덮어쓰지 않고 재시도한다", async ({ page }) => {
  const server = await mockStockData(page);
  let fail = true;
  let writes = 0;
  await page.route("**/api/alarm-price", route => route.request().method() === "GET" && fail
    ? route.fulfill({ status: 503, json: { message: "알람가격 조회 실패" } }) : route.fallback());
  page.on("request", request => { if (request.url().endsWith("/api/alarm-price") && request.method() === "PUT") writes++; });
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const results = page.locator(".results-panel");
  await expect(results.getByRole("alert")).toContainText("알람가격 조회 실패");
  const pane = page.locator(".chart-engine table tr").first();
  await expect(pane).toBeVisible();
  const bounds = await pane.boundingBox();
  await page.mouse.click(bounds.x + bounds.width * .6, bounds.y + bounds.height * .4, { button: "right" });
  await page.getByRole("menuitem", { name: "알람가격 넣기" }).click();
  await expect(results.getByRole("alert")).toContainText("알람가격을 불러온 뒤");
  expect(writes).toBe(0);
  expect(server.alarmPrices["005930"]).toBe(100000);
  fail = false;
  await results.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(results.locator("tbody tr").filter({ hasText: "삼성전자" }).locator("td").nth(4)).toHaveText("100,000");
});

test("알람가격 추가·삭제는 서버 성공 후 반영하며 실패 시 기존 값을 유지한다", async ({ page }) => {
  const server = await mockStockData(page);
  let fail = true;
  await page.route("**/api/alarm-price", route => route.request().method() === "PUT" && fail
    ? route.fulfill({ status: 500, json: { message: "알람가격 저장 실패" } }) : route.fallback());
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const samsung = page.locator(".results-panel tbody tr").filter({ hasText: "삼성전자" });
  await expect(samsung.locator("td").nth(4)).toHaveText("100,000");
  async function openMenu() {
    const pane = page.locator(".chart-engine table tr").first();
    await expect(pane).toBeVisible();
    const bounds = await pane.boundingBox();
    await page.mouse.click(bounds.x + bounds.width * .6, bounds.y + bounds.height * .4, { button: "right" });
    await expect(page.getByRole("menu", { name: "알람가격 메뉴" })).toBeVisible();
  }
  await openMenu();
  await page.getByRole("menuitem", { name: "알람가격 넣기" }).click();
  await expect(page.locator(".results-panel").getByRole("alert")).toContainText("알람가격 저장 실패");
  await expect(samsung.locator("td").nth(4)).toHaveText("100,000");
  fail = false;
  const add = page.waitForRequest(request => request.url().endsWith("/api/alarm-price") && request.method() === "PUT");
  await page.getByRole("menuitem", { name: "알람가격 넣기" }).click();
  const added = (await add).postDataJSON();
  expect(added.mode).toBe("add");
  expect(added.alarm_prices["005930"]).toBeGreaterThan(0);
  await expect(samsung.locator("td").nth(4)).toHaveText(added.alarm_prices["005930"].toLocaleString("en-US"));
  await expect(page.locator(".watch-list")).toContainText(`알람가격 ${added.alarm_prices["005930"].toLocaleString("en-US")}`);
  fail = true;
  await openMenu();
  await page.getByRole("menuitem", { name: "알람가격 삭제" }).click();
  await expect(page.locator(".results-panel").getByRole("alert")).toContainText("알람가격 저장 실패");
  expect(server.alarmPrices["005930"]).toBe(added.alarm_prices["005930"]);
  fail = false;
  const remove = page.waitForRequest(request => request.url().endsWith("/api/alarm-price") && request.method() === "PUT");
  await page.getByRole("menuitem", { name: "알람가격 삭제" }).click();
  expect((await remove).postDataJSON()).toEqual({ mode: "delete", alarm_prices: { "005930": 0 } });
  await expect(samsung.locator("td").nth(4)).toHaveText("");
  await expect(page.locator(".watch-list .watch-alarm")).toHaveCount(0);
});

test("로그아웃하면 워크스페이스를 닫고 랜딩 초기 화면으로 돌아간다", async ({ page }) => {
  await mockStockData(page);
  await page.route("**/api/auth/logout", route => route.fulfill({ json: { status: 200 } }));
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.getByLabel("세력모니터 워크스페이스")).toBeVisible();
  await page.getByRole("button", { name: "계정", exact: true }).click();
  await page.getByRole("dialog", { name: "마이페이지" }).getByRole("button", { name: "로그아웃", exact: true }).click();

  await expect(page.getByRole("heading", { name: /세력의 움직임을 읽고/ })).toBeVisible();
  await expect(page.getByLabel("세력모니터 워크스페이스")).toHaveCount(0);
});

test("계정에서 마이페이지와 비밀번호 재설정 및 회원 탈퇴 모달을 연다", async ({ page }) => {
  const user = { userId: 1, name: "나기윤", email: "nakwna@gmail.com", grade: "4(관측형)", certYn: "Y", joinDate: "2024-02-12 15:39:06", loginDate: "2026-09-01 17:19:05", withdraw: "N" };
  await mockStockData(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { status: 200, user } }));
  await page.route("**/api/auth/subscription", route => route.fulfill({ json: { status: 200, subscribe: { strStartDate: "2024-02-12 15:39:07", strEndDate: "2056-03-11 15:39:07", strPayExpectDate: "2056-10-11 00:00:00" } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "계정", exact: true }).click();

  const account = page.getByRole("dialog", { name: "마이페이지" });
  await expect(account).toBeVisible();
  for (const label of ["이메일", "실명", "등급", "인증 유무", "가입일", "최근 로그인 날짜", "구독 기간", "결제 예정일"]) {
    await expect(account.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(account).toContainText("구독 만료까지");
  await account.getByRole("button", { name: "비밀번호 변경", exact: true }).click();

  const password = page.getByRole("dialog", { name: "비밀번호 재설정" });
  await expect(password).toBeVisible();
  await expect(password.getByRole("button", { name: "인증 메일 발송" })).toBeVisible();
  await expect(password.getByLabel("새 비밀번호", { exact: true })).toBeVisible();
  await expect(password.getByLabel("새 비밀번호 확인")).toBeVisible();
  await password.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "계정", exact: true }).click();
  await page.getByRole("dialog", { name: "마이페이지" }).getByRole("button", { name: "회원탈퇴", exact: true }).click();
  const withdraw = page.getByRole("dialog", { name: "회원 탈퇴" });
  await expect(withdraw).toContainText("자동해지 및 구매기록이 소멸됩니다.");
  await expect(withdraw.getByRole("button", { name: "탈퇴하기" })).toBeDisabled();
  await withdraw.getByLabel("탈퇴 확인 이메일").fill(user.email);
  await expect(withdraw.getByRole("button", { name: "탈퇴하기" })).toBeEnabled();
});

test("차트 상단의 중복 메뉴를 제거한다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.getByRole("button", { name: "조건 검색", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("종목코드 검색")).toHaveCount(0);
});

test("로그인 옵션과 오류 상태를 제공한다", async ({ page }) => {
  await page.route("**/api/auth/login", async route => {
    const body = route.request().postDataJSON();
    await route.fulfill({ json: { status: body.email === "abc" ? 204 : 202 } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  const dialog = page.getByRole("dialog", { name: "세력모니터 입장" });
  await dialog.getByRole("textbox", { name: "ID", exact: true }).fill("abc");
  await dialog.getByLabel("PW", { exact: true }).fill("12345678");
  await dialog.getByRole("button", { name: "입장하기" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("존재하지 않는 아이디입니다. 회원가입을 진행해 주세요.");
  await dialog.getByRole("textbox", { name: "ID", exact: true }).fill("member@example.com");
  await dialog.getByLabel("PW", { exact: true }).fill("1234");
  await dialog.getByRole("button", { name: "입장하기" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("아이디 혹은 비밀번호가 올바르지 않습니다.");
});

test("비밀번호 재설정 인증 흐름을 제공한다", async ({ page }) => {
  await page.route("**/api/auth/cert/mail", route => route.fulfill({ json: { status: 200, certKey: "reset-cert-key" } }));
  await page.route("**/api/auth/cert/check", route => route.fulfill({ json: { status: 200 } }));
  await page.route("**/api/auth/password", route => route.fulfill({ json: { status: 200 } }));
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "비밀번호 찾기" }).click();
  const dialog = page.getByRole("dialog", { name: "비밀번호 찾기" });
  await dialog.getByLabel("이메일").fill("member@example.com");
  await dialog.getByRole("button", { name: "인증 메일 발송" }).click();
  await dialog.getByRole("button", { name: "인증 확인" }).click();
  await dialog.getByLabel("새 비밀번호", { exact: true }).fill("new-password");
  await dialog.getByLabel("새 비밀번호 확인").fill("new-password");
  await dialog.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(dialog.getByText("비밀번호를 변경했습니다.")).toBeVisible();
});
