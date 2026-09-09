const { expect, test } = require("@playwright/test");

async function mockStockData(page) {
  await page.route("**/api/stocks/*", route => {
    const ticker = new URL(route.request().url()).pathname.split("/").at(-1);
    const investors = (date, base) => [date, ...Array.from({ length: 13 }, (_, index) => base + index)];
    return route.fulfill({
      json: {
        ticker,
        candles: [[20260831, 74200, 1200000, 0, 73500, 74800, 73000], [20260830, 73500, 980000, 0, 72800, 74000, 72400]],
        holdings: [[20260831, 0, 1413177, 69800], [20260830, 0, 1400000, 69400]],
        holdingChanges: [investors(20260831, 1), investors(20260830, 0)],
        power: [investors(20260831, 2), investors(20260830, 1)],
        direction: [investors(20260831, 1), investors(20260830, -1)],
        rs: [[20260831, 94], [20260830, 92]],
      },
    });
  });
  await page.route("**/api/news?*", route => {
    const query = new URL(route.request().url()).searchParams.get("query");
    return route.fulfill({
      json: { result: [[`${query} 뉴스 제목`, "3일 전", "https://example.com/news"]] },
    });
  });
}

test("와이어프레임 기반 랜딩과 외부 링크를 제공한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /세력의 움직임을 읽고/ })).toBeVisible();
  await expect(page.getByText("핀셋 종목선정")).toBeVisible();
  await expect(page.getByText("세력모니터 & 모트레이더")).toBeVisible();
  await expect(page.getByRole("link", { name: "네이버 카페 바로가기", exact: true })).toHaveAttribute("href", "https://cafe.naver.com/motrader");
  await expect(page.getByRole("link", { name: "유튜브 바로가기", exact: true })).toHaveAttribute("href", "https://www.youtube.com/@motrader-morangs");
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
  await expect(indicators.getByText("20 이평선", { exact: true })).toBeVisible();
  await expect(indicators.getByText("60 이평선", { exact: true })).toBeVisible();
  const alwaysVisible = page.getByLabel("항상 표시 지표");
  await expect(alwaysVisible).toContainText("주가 · 거래량");
  await expect(alwaysVisible).toContainText("개미지수");
  await expect(alwaysVisible).toContainText("RS");
  await expect(page.getByLabel("차트 종류")).toBeVisible();
  await expect(page.getByLabel("가격 스케일")).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 구간" })).toBeVisible();
  const holdingControls = page.locator(".chart-holding-controls");
  await expect(holdingControls.getByText("보유비중", { exact: true })).toBeVisible();
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

test("차트 크기와 보유비중 레전드 설정을 지표 변경 뒤에도 유지한다", async ({ page }) => {
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
  previousTable = await chartTable.elementHandle();
  await holdingControls.getByRole("checkbox", { name: "외국인", exact: true }).check();
  await expect.poll(() => previousTable.evaluate(element => element.isConnected)).toBe(false);
  await expect(chartRows).toHaveCount(8);
  const holdingHeight = await chartRows.nth(0).evaluate(element => element.getBoundingClientRect().height);
  previousTable = await chartTable.elementHandle();
  await holdingControls.getByRole("checkbox", { name: "기관계", exact: true }).check();
  await expect.poll(() => previousTable.evaluate(element => element.isConnected)).toBe(false);
  await expect.poll(() => chartRows.nth(0).evaluate(element => element.getBoundingClientRect().height)).toBe(holdingHeight);

  const legend = page.getByLabel("선택 세력 차트 레전드");
  await expect(legend).toContainText("외국인");
  await expect(legend).toContainText("기관계");
  await expect(legend).not.toContainText("보유비중");
  await expect(legend).not.toContainText("증감");
  const legendLayout = await page.evaluate(() => {
    const stage = document.querySelector(".chart-stage")?.getBoundingClientRect();
    const surface = document.querySelector(".chart-surface")?.getBoundingClientRect();
    const legend = document.querySelector(".chart-holding-legend")?.getBoundingClientRect();
    const readout = document.querySelector(".ohlcv-strip")?.getBoundingClientRect();
    const firstPane = document.querySelector(".chart-engine table tr");
    const rightAxis = firstPane?.lastElementChild?.getBoundingClientRect();
    return {
      stageWidth: stage?.width ?? 0,
      surfaceWidth: surface?.width ?? -1,
      surfaceTop: surface?.top ?? -1,
      legendBottom: legend?.bottom ?? 0,
      legendRight: legend?.right ?? 0,
      readoutRight: readout?.right ?? -1,
      rightAxisWidth: rightAxis?.width ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(Math.abs(legendLayout.stageWidth - legendLayout.surfaceWidth)).toBeLessThanOrEqual(1);
  expect(legendLayout.legendBottom).toBeLessThanOrEqual(legendLayout.surfaceTop + 1);
  expect(legendLayout.legendRight).toBeLessThanOrEqual(legendLayout.readoutRight + 1);
  expect(legendLayout.rightAxisWidth).toBeLessThanOrEqual(70);
});

test("검색 결과의 기본 4열과 창 설정 모달을 제공한다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();

  const table = page.locator(".result-table-alerts");
  await expect(table.locator("thead th")).toHaveCount(4);
  await expect(table.locator("thead")).toContainText("번호");
  await expect(table.locator("thead")).toContainText("종목");
  await expect(table.locator("thead")).toContainText("상태");
  await expect(table.locator("thead")).toContainText("알람 가격");
  await expect(table.locator(".alert-status-warning")).toHaveText("U-20%");
  await expect(table.locator(".alert-status-caution")).toHaveText("U-12%");
  await expect(table.locator(".alert-status-low")).toHaveText("-50%");

  await page.getByRole("button", { name: "창 설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "검색창 설정 하기" });
  await expect(dialog).toBeVisible();
  for (const label of ["알람가격", "현재상황", "계좌수익률", "거래액(백만)", "5일평균 거래액", "IBD RS", "고수 계좌"]) {
    await expect(dialog.getByRole("checkbox", { name: label, exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole("checkbox")).toHaveCount(7);
  await dialog.getByRole("checkbox", { name: "계좌수익률", exact: true }).check();
  await expect(table.locator("thead")).toContainText("계좌 수익률");
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
  await settings.getByRole("button", { name: "임시 검색" }).first().click();
  const alert = page.getByRole("status");
  await expect(alert).toContainText("검색기간을 선택해 주세요");
  await alert.getByRole("button", { name: "알림 닫기" }).click();
  await settings.getByRole("button", { name: /^검색 1/ }).click();
  await settings.getByText("1주", { exact: true }).click();
  await settings.getByLabel("검색 제목").fill("급등주 위주");
  await settings.getByRole("button", { name: "검색조건 저장" }).click();
  await expect(settings).toHaveCount(0);
  await expect(launcher.locator(".preset-description")).toContainText("급등주 위주");
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
  await page.getByRole("button", { name: "계정", exact: true }).click();
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
  await page.getByRole("button", { name: "계정", exact: true }).click();
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
