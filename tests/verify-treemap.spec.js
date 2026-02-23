import { test, expect } from '@playwright/test';
import fs from 'fs';

test('Verify Balance Sheet Treemap', async ({ page }) => {
  // Mock API
  await page.route('**/exec*', async (route) => {
    const json = JSON.parse(fs.readFileSync('src/mocks/sampleApi.json', 'utf8'));
    await route.fulfill({ json });
  });

  // Bypass login
  await page.addInitScript(() => {
    window.localStorage.setItem('asset-google-id-token', 'mock-token');
  });

  await page.goto('http://localhost:5173/asset/balance-sheet');

  // Wait for treemap to render
  await page.waitForSelector('.treemap-container');

  // Take a screenshot
  await page.screenshot({ path: 'treemap-verification.png', fullPage: true });

  // Check if labels are visible in colored tiles
  const tiles = await page.locator('.stock-tile').all();
  console.log(`Found ${tiles.length} tiles`);

  for (const tile of tiles) {
    const backgroundColor = await tile.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const label = await tile.locator('.stock-tile-name').textContent();
    const isColored = backgroundColor !== 'rgb(31, 41, 55)'; // Neutral is #1f2937

    if (isColored) {
      console.log(`Colored tile: ${label}, BG: ${backgroundColor}`);
      await expect(tile.locator('.stock-tile-name')).toBeVisible();
    }
  }
});
