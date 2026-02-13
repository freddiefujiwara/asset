import { test, expect } from '@playwright/test';

test('verify cash flow page with generic names', async ({ page }) => {
  await page.goto('http://localhost:5173/asset/cash-flow');

  // Set mock token
  await page.evaluate(() => {
    localStorage.setItem('asset-google-id-token', 'mock-token');
  });

  // Reload to apply token
  await page.reload();

  // Wait for the table to be visible
  await page.waitForSelector('.cash-flow-table');

  // Verify some generic names are present
  const content = await page.content();
  expect(content).toContain('クレジットカード');
  expect(content).toContain('レストラン');
  expect(content).toContain('電気代');

  await page.screenshot({ path: '/home/jules/verification/cash_flow_page_generic.png', fullPage: true });
});
