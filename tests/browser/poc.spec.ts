import { test, expect } from "@playwright/test";
test("180 real DOM cases, goldens and repeat stability", async ({ page }) => {
  await page.goto("/poc");
  await page.getByRole("button", { name: "180개 측정" }).click();
  await expect(page.getByTestId("poc-result")).toContainText("completed");
  const first = JSON.parse(await page.getByTestId("poc-result").innerText());
  expect(first.measurements).toHaveLength(180);
  expect(first.measurements.every((m: { error?: string }) => !m.error)).toBeTruthy();
  expect(
    first.measurements.find(
      (m: { key: string; locale: string; width: number; font: string }) =>
        m.key === "checkout.buy" && m.locale === "de" && m.width === 100 && m.font === "Bench Sans",
    ).overflow,
  ).toBe(true);
  expect(
    first.measurements.find(
      (m: { key: string; locale: string; width: number; font: string }) =>
        m.key === "action.cancel" &&
        m.locale === "ko" &&
        m.width === 240 &&
        m.font === "Bench Sans",
    ).overflow,
  ).toBe(false);
  await page.getByRole("button", { name: "180개 측정" }).click();
  await expect
    .poll(async () => JSON.parse(await page.getByTestId("poc-result").innerText()).id)
    .not.toBe(first.id);
  const second = JSON.parse(await page.getByTestId("poc-result").innerText());
  expect(
    second.measurements.map((m: { overflow: boolean; textWidth: number }) => [
      m.overflow,
      m.textWidth,
    ]),
  ).toEqual(
    first.measurements.map((m: { overflow: boolean; textWidth: number }) => [
      m.overflow,
      m.textWidth,
    ]),
  );
  await page.screenshot({ path: "test-results/poc.png" });
});
