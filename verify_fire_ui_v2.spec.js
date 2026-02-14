import { test, expect } from '@playwright/test';

test('FIRE simulator UI updates', async ({ page }) => {
  // Setup: Mock authentication and API
  await page.addInitScript(() => {
    localStorage.setItem('asset-google-id-token', 'mock-token');
  });

  await page.route('https://script.google.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totals: {
          netWorthYen: 10000000,
          assetsYen: 15000000,
        },
        summary: {
            assetsByClass: [
                { name: '株式（現物）', amountYen: 5000000 }
            ]
        },
        cashFlow: [
          // Past 5 months from today (assume today is March 2026 for consistent testing if possible, but we'll use dynamic)
          // We'll just provide some data and see if accordions appear.
          { date: '2024-01-01', amount: -100000, category: 'Food', isTransfer: false },
          { date: '2024-01-01', amount: 300000, category: '収入/給与', isTransfer: false },
          { date: '2024-01-01', amount: 500000, category: '収入/賞与', isTransfer: false },
        ]
      }),
    });
  });

  await page.goto('http://localhost:5173/asset/fire');

  // Check for the new accordions
  const incomeBreakdown = page.locator('.expense-item:has-text("定期収入") details');
  const bonusBreakdown = page.locator('.expense-item:has-text("ボーナス") details');

  // They should exist if auto-calculation is on (which is default)
  // Wait, I need to make sure data is loaded and auto-calculated
  await expect(page.locator('h3:has-text("シミュレーション引数")')).toBeVisible();

  // Check the mortgage select
  const mortgageSelect = page.locator('select.date-select');
  await expect(mortgageSelect).toBeVisible();
  const options = await mortgageSelect.locator('option').count();
  expect(options).toBeGreaterThan(400);

  // Check for Required Assets card
  await expect(page.locator('h2:has-text("FIRE達成に必要な資産")')).toBeVisible();

  // Check Algorithm details for 90% CI
  const algoDetails = page.locator('details:has-text("FIREアルゴリズムの詳細")');
  await algoDetails.click();
  await expect(page.locator('.algorithm-details:has-text("90%信頼区間")')).toBeVisible();

  await page.screenshot({ path: '/home/jules/verification/fire_ui_v2.png', fullPage: true });
});
