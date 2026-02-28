import { expect, test } from "@playwright/test";

test("demo login and report hazard with Other category", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Demo Wallet Login" }).click();
  await expect(page.locator(".status")).toContainText("Signed in:", { timeout: 20_000 });

  await page.getByRole("button", { name: "Report Hazard" }).click();
  await expect(page.getByRole("heading", { name: "Engel Raporla" })).toBeVisible();

  const modal = page.locator(".hazard-modal");
  await expect(modal).toBeVisible();

  await modal.getByLabel("Kategori:").selectOption("255");
  await modal.getByLabel("Other Kategori Aciklamasi:").fill("temporary construction barrier");
  await modal.getByLabel("Siddet (1-5):").fill("4");
  await modal.getByLabel("Not/Fotograf URI:").fill("ipfs://smoke-other");

  await modal.getByRole("button", { name: "Raporla" }).click();

  await expect(page.locator(".status")).toContainText("Hazard created:", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Hazard Feed" })).toBeVisible();
  await expect(page.locator("table.hazard-table")).toContainText("Other", { timeout: 20_000 });
});
