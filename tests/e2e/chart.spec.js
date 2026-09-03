const { expect, test } = require("@playwright/test");

async function mockStockData(page) {
  await page.route("**/api/stocks/*", route => {
    const ticker = new URL(route.request().url()).pathname.split("/").at(-1);
    const investors = (date, base) => [date, ...Array.from({ length: 13 }, (_, index) => base + index)];
    return route.fulfill({
      json: {
        ticker,
        candles: [[20260831, 74200, 1200000, 0, 73500, 74800, 73000], [20260830, 73500, 980000, 0, 72800, 74000, 72400]],
        holdings: [[20260831, 0, 51, 69800], [20260830, 0, 49, 69400]],
        holdingChanges: [investors(20260831, 1), investors(20260830, 0)],
        power: [investors(20260831, 2), investors(20260830, 1)],
        direction: [investors(20260831, 1), investors(20260830, -1)],
        rs: [[20260831, 94], [20260830, 92]],
      },
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
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".pro-chart")).toBeVisible();
  await expect(page.locator(".chart-engine canvas").first()).toBeVisible();
  await expect(page.locator(".search-dock")).toBeVisible();
  await expect(page.locator(".results-panel")).toBeVisible();
  await expect(page.locator(".watch-panel")).toBeVisible();
  await expect(page.locator(".news-panel")).toBeVisible();
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
  const holdingControls = page.locator(".chart-holding-controls");
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
  await expect(launcher.getByRole("button", { name: /^검색 \d$/ })).toHaveCount(5);
  await expect(launcher.getByRole("button", { name: "검색조건 만들기" })).toHaveCount(0);
  const openSettings = page.getByRole("button", { name: "검색조건 만들기" });
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

test("API v09 조건 검색 모드를 제공한다", async ({ page }) => {
  await mockStockData(page);
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "조건 검색", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "종목 조건 검색" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "보유비중" }).click();
  await expect(dialog.getByLabel("시작일")).toBeVisible();
  await expect(dialog.getByLabel("종료일")).toBeVisible();
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
