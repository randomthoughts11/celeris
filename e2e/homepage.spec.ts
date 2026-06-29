import { test, expect } from "@playwright/test";

test("homepage loads companies", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your Brands")).toBeVisible();
  await expect(page.getByText("Apex Digital Solutions")).toBeVisible();
});

test("company dashboard loads", async ({ page }) => {
  await page.goto("/companies/apex-digital");
  await expect(page.getByText("Executive Overview")).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
});
