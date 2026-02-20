import { test, expect } from '@playwright/test';

test('verify copy button on balance sheet', async ({ page }) => {
  // Setup: bypass login
  await page.addInitScript(() => {
    window.localStorage.setItem('asset-google-id-token', 'dummy-token');
  });

  // Mock API
  await page.route('**/exec*', async (route) => {
    const response = await fetch('file://' + process.cwd() + '/src/mocks/sampleApi.json');
    const json = await response.json();
    await route.fulfill({ json });
  });

  await page.goto('http://localhost:5173/asset/balance-sheet');

  // Wait for loading to complete
  await page.waitForSelector('h2.section-title');

  // Find the "株式" table header
  const stocksHeading = page.locator('h3.section-title', { hasText: '株式' });
  await expect(stocksHeading).toBeVisible();

  // Find the copy button next to it
  const copyButton = page.locator('section.section-block:has(h3:text("株式")) button', { hasText: '📋 銘柄コードをコピー' });
  await expect(copyButton).toBeVisible();

  // Test the copy functionality
  // Since we can't easily check the clipboard in many environments, we can at least check if clicking it changes the text
  await copyButton.click();
  await expect(copyButton).toHaveText('コピー完了！');

  // Screenshot for manual check
  await page.screenshot({ path: 'balance_sheet_copy_button.png' });
});
