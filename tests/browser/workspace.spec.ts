import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("project backup round trip preserves translations and snapshots", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "UI 검사 실행", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("180개 조건");
  await page.getByRole("button", { name: "내보내기", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "프로젝트 백업", exact: false }).click();
  const d = await pending;
  const backup = await readFile((await d.path())!, "utf8");
  await page.getByRole("button", { name: "백업 복원", exact: false }).click();
  await page.getByRole("textbox", { name: "원본 JSON", exact: true }).fill(backup);
  await page.getByRole("button", { name: "백업 복원", exact: true }).click();
  await expect(page.locator(".breadcrumbs strong")).toContainText("(복원)");
  await expect(page.getByLabel("번역 문구")).toHaveValue("Jetzt kostenpflichtig bestellen");
  await page.getByRole("button", { name: "실행 이력", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
});
test("sample edit, real scan, regression, reload and export", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "문자열 작업공간" })).toBeVisible();
  await page.getByRole("button", { name: "UI 검사 실행", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("180개 조건");
  await expect(page.locator(".preview-result").first()).toContainText("초과");
  await page.getByLabel("번역 문구").fill("Jetzt kaufen");
  await expect(page.locator(".stale-notice")).toBeVisible();
  await page.getByRole("button", { name: "UI 검사 실행", exact: true }).click();
  await expect(page.locator(".stale-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "실행 이력", exact: true }).click();
  await expect(page.locator(".regression-summary")).toContainText("동일한 검사 조건");
  await expect(page.locator(".regression-counts .resolved strong")).not.toHaveText("0");
  await page.reload();
  await expect(page.getByLabel("번역 문구")).toHaveValue("Jetzt kaufen");
  await page.getByRole("button", { name: "내보내기", exact: true }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "독일어 번역 JSON" }).click();
  expect((await event).suggestedFilename()).toContain("-de.json");
  await page.getByRole("button", { name: "대화상자 닫기" }).click();
  await page.screenshot({ path: "test-results/workspace-desktop.png", fullPage: true });
});
test("import errors, placeholder loss and safe text rendering", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "JSON 가져오기", exact: true }).click();
  await page.getByRole("textbox", { name: "원본 JSON", exact: true }).fill('{"a":"x","a":"y"}');
  await page.getByRole("button", { name: "문자열 가져오기" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("중복");
  await page
    .getByRole("textbox", { name: "원본 JSON", exact: true })
    .fill('{"greet":"Hello, {name}"}');
  await page.getByRole("button", { name: "문자열 가져오기" }).click();
  await page.getByLabel("번역 문구").fill("Hallo");
  await expect(page.locator(".inline-validation")).toContainText("원문 1개 / 번역 0개");
  await page.getByRole("button", { name: "UI 검사 실행", exact: true }).click();
  await page.getByRole("button", { name: /검사 결과/ }).click();
  await expect(page.locator("tbody")).toContainText("변수 오류");
  await page.getByRole("button", { name: "문자열 작업공간", exact: true }).click();
  await page.getByLabel("번역 문구").fill('<img src=x onerror="window.pwned=1"> {name}');
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
  await expect(page.locator(".fixture-inner").first()).toContainText("<img");
});
for (const width of [360, 768, 1440])
  test(`responsive ${width}px without product overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "문자열 작업공간" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "UI 검사 실행", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("180개 조건");
    await page.screenshot({ path: `test-results/workspace-${width}.png`, fullPage: true });
  });
