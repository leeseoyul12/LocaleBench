import { test, expect } from "@playwright/test";
test("local mock sign-in saves a project and another browser restores it", async ({
  page,
  browser,
}) => {
  const origin = "http://127.0.0.1:5173";
  let id = "";
  let other;
  try {
    await page.goto("/signin-with-chatgpt?return_to=/");
    await expect(page.getByRole("heading", { name: "문자열 작업공간" })).toBeVisible();
    await page.getByRole("button", { name: "연결 및 설정", exact: true }).click();
    const title = `Cloud QA ${Date.now()}`;
    await page.getByRole("textbox", { name: "프로젝트 이름", exact: true }).fill(title);
    await page.getByRole("button", { name: "클라우드 저장", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("클라우드에 저장");
    const projects = (await (await page.request.get("/api/projects")).json()).projects;
    id = projects.find((p: { name: string }) => p.name === title).id;
    await expect(page.getByRole("button", { name: "클라우드 저장됨", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "프로젝트 이름", exact: true }).fill(title + " edited");
    await expect(page.getByRole("button", { name: "클라우드 저장", exact: true })).toBeVisible();
    other = await browser.newContext();
    await other.addCookies([{ name: "__sites_local_auth", value: "1", url: origin }]);
    const second = await other.newPage();
    await second.goto("/");
    await expect(second.locator(".breadcrumbs strong")).toHaveText(title);
  } finally {
    if (id) await page.request.delete("/api/projects/" + id, { data: {}, headers: { origin } });
    await other?.close();
  }
});
