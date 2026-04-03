import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login page on initial visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=FraternityOS")).toBeVisible();
    await expect(page.locator("text=Sign in with your chapter email")).toBeVisible();
  });

  test("shows demo login buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=DEMO — Quick login as:")).toBeVisible();
    await expect(page.locator("button", { hasText: "Alex Johnson" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Marcus Lee" })).toBeVisible();
  });

  test("demo login as officer navigates to dashboard", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Alex Johnson" }).click();
    await expect(page.locator("h1", { hasText: "Dashboard" })).toBeVisible();
    await expect(page.locator("text=officer")).toBeVisible();
  });

  test("demo login as member navigates to dashboard", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Marcus Lee" }).click();
    await expect(page.locator("h1", { hasText: "Dashboard" })).toBeVisible();
    await expect(page.locator("text=member")).toBeVisible();
  });

  test("magic link form shows error for unknown email", async ({ page }) => {
    await page.goto("/");
    await page.locator("input[type='email']").fill("unknown@test.org");
    await page.locator("button", { hasText: "Send Magic Link" }).click();
    await expect(page.locator("text=No account found for this email")).toBeVisible();
  });

  test("magic link form shows confirmation for known email", async ({ page }) => {
    await page.goto("/");
    await page.locator("input[type='email']").fill("alex@tke.org");
    await page.locator("button", { hasText: "Send Magic Link" }).click();
    await expect(page.locator("text=Check your email")).toBeVisible();
  });

  test("logout returns to login screen", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Alex Johnson" }).click();
    await expect(page.locator("h1", { hasText: "Dashboard" })).toBeVisible();
    await page.locator("button[title='Sign out']").click();
    await expect(page.locator("text=Sign in with your chapter email")).toBeVisible();
  });
});
