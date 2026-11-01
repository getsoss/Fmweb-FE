async function changeFromResult(page, name, slot, mode) {
  const row = page.locator(".results-panel tbody tr").filter({ hasText: name });
  await row.click({ button: "right" });
  const menu = page.getByRole("menu", { name: `${name} 관심종목 관리`, exact: true });
  await menu.getByRole("menuitem", { name: new RegExp(`^관심 ${slot}`) }).hover();
  await page.getByRole("menu", { name: `관심 ${slot} 종목 관리`, exact: true }).getByRole("menuitem", { name: mode === "add" ? "넣기" : "빼기", exact: true }).click();
  await page.keyboard.press("Escape");
}

async function removeWatchStock(page, name) {
  const watch = page.locator(".watch-panel");
  const active = await watch.locator(".watch-tabs button.active").innerText();
  const slot = Number(active.match(/관심 (\d)/)[1]);
  await watch.getByRole("button", { name: "검색창에서 보기", exact: true }).click();
  await changeFromResult(page, name, slot, "delete");
}

const activeCount = watch => watch.locator(".watch-tabs button.active span");
module.exports = { changeFromResult, removeWatchStock, activeCount };
