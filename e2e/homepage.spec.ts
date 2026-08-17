import { test, expect } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login|sign-in/i);
});

test("unauthenticated home does not show the brand grid", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your Brands")).toHaveCount(0);
});
