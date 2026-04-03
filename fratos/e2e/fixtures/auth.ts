import { test as base, type Page } from "@playwright/test";

/**
 * Login as a specific demo user by clicking their button on the login screen.
 * Works in mock mode (NEXT_PUBLIC_USE_MOCKS=true).
 */
async function loginAs(page: Page, name: string) {
  await page.goto("/");
  const btn = page.locator("button", { hasText: name });
  await btn.click();
  await page.waitForSelector("text=Dashboard");
}

export async function loginAsOfficer(page: Page) {
  await loginAs(page, "Alex Johnson");
}

export async function loginAsMember(page: Page) {
  await loginAs(page, "Marcus Lee");
}

interface Fixtures {
  officerPage: Page;
  memberPage: Page;
}

export const test = base.extend<Fixtures>({
  officerPage: async ({ page }, use) => {
    await loginAsOfficer(page);
    await use(page);
  },
  memberPage: async ({ page }, use) => {
    await loginAsMember(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
