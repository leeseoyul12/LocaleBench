import { test, expect } from "@playwright/test";

async function mockAccount(page: import("@playwright/test").Page) {
  await page.route("**/api/status", route => route.fulfill({ json: { signedIn: true, cloud: true, google: false, gemini: true, name: "AI test" } }));
  await page.route("**/api/projects", route => route.fulfill({ json: route.request().method() === "GET" ? { projects: [] } : { saved: true } }));
}
test("mock Gemini response is DOM-measured, explicitly applied, rescanned and restored", async ({ page }) => {
  await mockAccount(page);
  await page.route("**/api/suggest", route => route.fulfill({ json: { provider: "gemini", model: "gemini-test-only", candidates: [
    { text: "Jetzt sofort kostenpflichtig bestellen", reason: "넘침이 있는 테스트 후보" },
    { text: "Kaufen", reason: "짧은 테스트 후보" },
  ] } }));
  await page.goto("/");
  const original = await page.getByLabel("번역 문구", { exact: true }).inputValue();
  await page.getByRole("button", { name: "AI로 짧은 문구 제안", exact: true }).click();
  await expect(page.locator(".ai-candidate")).toHaveCount(2);
  await expect(page.locator(".ai-candidate").first()).toContainText("초과");
  await expect(page.locator(".ai-candidate").nth(1)).toContainText("6/6 조건 통과");
  await expect(page.getByLabel("번역 문구", { exact: true })).toHaveValue(original);
  await page.locator(".ai-candidate").nth(1).getByRole("button", { name: "이 문구 적용 후 재검사" }).click();
  await expect(page.getByLabel("번역 문구", { exact: true })).toHaveValue("Kaufen");
  await expect(page.getByRole("status")).toContainText("AI 후보를 적용");
  await page.getByRole("button", { name: "실행 이력", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("번역 문구", { exact: true })).toHaveValue("Kaufen");
});
test("AI quota errors preserve the current translation", async ({ page }) => {
  await mockAccount(page);
  await page.route("**/api/suggest", route => route.fulfill({ status: 429, json: { error: "AI 요청 한도 테스트" } }));
  await page.goto("/");
  const original = await page.getByLabel("번역 문구", { exact: true }).inputValue();
  await page.getByRole("button", { name: "AI로 짧은 문구 제안", exact: true }).click();
  await expect(page.locator(".ai-error")).toContainText("AI 요청 한도 테스트");
  await expect(page.getByLabel("번역 문구", { exact: true })).toHaveValue(original);
  await expect(page.locator(".ai-candidate")).toHaveCount(0);
});
