const { expect, test } = require("@playwright/test");

test("와이어프레임 기반 랜딩과 외부 링크를 제공한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /세력의 움직임을 읽고/ })).toBeVisible();
  await expect(page.getByText("핀셋 종목선정")).toBeVisible();
  await expect(page.getByText("세력모니터 & 모트레이더")).toBeVisible();
  await expect(page.getByRole("link", { name: "네이버 카페", exact: true })).toHaveAttribute("href", "https://cafe.naver.com/motrader");
  await expect(page.getByRole("link", { name: "유튜브", exact: true })).toHaveAttribute("href", "https://www.youtube.com/@motrader-morangs");
});

test("회원가입 이메일 인증 단계를 제공한다", async ({ page }) => {
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

test("세력모니터 창으로 진입하면 핵심 차트를 제공한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".pro-chart")).toBeVisible();
  await expect(page.locator(".chart-engine canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "지표", exact: true }).click();
  await expect(page.getByText("20일 이동평균")).toBeVisible();
  await expect(page.getByText("60일 이동평균")).toBeVisible();
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await expect(page.getByRole("heading", { name: /세력의 움직임을 읽고/ })).toBeVisible();
});

test("API v09 조건 검색 모드를 제공한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "조건 검색", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "종목 조건 검색" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "보유비중" }).click();
  await expect(dialog.getByLabel("시작일")).toBeVisible();
  await expect(dialog.getByLabel("종료일")).toBeVisible();
});
