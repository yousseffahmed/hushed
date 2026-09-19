import { test, expect, type Page, type Locator } from "@playwright/test";

async function viewport(page: Page, height: number, offsetTop = 0) {
  await page.evaluate(({ height, offsetTop }) => {
    const visible = window.visualViewport!;
    Object.defineProperties(visible, { height: { configurable: true, value: height }, offsetTop: { configurable: true, value: offsetTop } });
    visible.dispatchEvent(new Event("resize"));
    visible.dispatchEvent(new Event("scroll"));
  }, { height, offsetTop });
  await page.waitForTimeout(60);
}

async function atTop(page: Page) {
  const scroll = page.locator('.wedding-sheet-scroll');
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0);
  const header = await page.locator('.wedding-sheet-header').boundingBox();
  const dialog = await page.locator('dialog').boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(0);
  expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
}

async function scrollTo(page: Page, edge: 'top' | 'bottom') {
  await page.locator('.wedding-sheet-scroll').evaluate((el, edge) => { el.scrollTop = edge === 'top' ? 0 : el.scrollHeight; }, edge);
}

async function insideScroll(page: Page, field: Locator) {
  await expect.poll(async () => {
    const area = await page.locator('.wedding-sheet-scroll').boundingBox();
    const rect = await field.boundingBox();
    return Boolean(area && rect && rect.y >= area.y - 1 && rect.y + rect.height <= area.y + area.height + 1);
  }).toBe(true);
}

for (const size of [{ width: 390, height: 844 }, { width: 393, height: 852 }, { width: 430, height: 932 }, { width: 1280, height: 900 }]) {
  test(`editor top/bottom, focus, keyboard recovery and reopen ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 900));
    const originalY = await page.evaluate(() => window.scrollY);
    await page.getByRole('button', { name: 'New moment', exact: true }).click();
    await atTop(page);
    expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
    expect(await page.evaluate(() => document.body.style.top)).toBe(`-${originalY}px`);
    const title = page.getByLabel('What shall we call it?');
    await insideScroll(page, title);
    expect(await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await scrollTo(page, 'bottom');
    await insideScroll(page, page.getByRole('button', { name: 'Add to our forever' }));
    await scrollTo(page, 'top');
    await atTop(page);

    for (const field of [title, page.getByLabel('A little caption'), page.getByLabel('The whole story')]) {
      await field.fill('Typing with the keyboard open');
      await viewport(page, 420, 70);
      await insideScroll(page, field);
      const dialog = await page.locator('dialog').boundingBox();
      expect(dialog!.y).toBeGreaterThanOrEqual(70);
      expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(491);
      await viewport(page, size.height, 70); // stale Safari offset after keyboard dismissal
      await insideScroll(page, field);
      expect(await page.locator('dialog').evaluate((el) => el.style.getPropertyValue('--sheet-top'))).toBe('0px');
    }
    await scrollTo(page, 'top');
    await atTop(page); // a still-focused textarea must not force the user back down
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(originalY);
    expect(await page.evaluate(() => document.body.style.position)).toBe('');
    await page.getByRole('button', { name: 'New moment', exact: true }).click();
    await atTop(page);
    await page.screenshot({ path: `/tmp/wedding-sheet-editor-${test.info().project.name}-${size.width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(originalY);
  });

  test(`viewer/gallery/personal note/confirmation ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 1100));
    await page.getByRole('button', { name: 'View moment', exact: true }).click();
    await atTop(page);
    await page.getByRole('button', { name: 'Next photo' }).click();
    await expect(page.locator('.wedding-gallery-controls')).toContainText('2 of 2');
    await page.getByRole('button', { name: 'Previous photo' }).click();
    await scrollTo(page, 'bottom');
    await insideScroll(page, page.getByRole('button', { name: 'Remove', exact: true }));
    await page.getByRole('button', { name: 'Edit my note' }).click();
    await page.getByLabel('Your personal note').fill('A note saved in the layout test only.');
    await viewport(page, 420, 60);
    await insideScroll(page, page.getByLabel('Your personal note'));
    await page.getByRole('button', { name: 'Keep my words' }).click();
    await viewport(page, size.height, 0);
    await expect(page.getByText('A note saved in the layout test only.')).toBeVisible();
    await scrollTo(page, 'top');
    await atTop(page);
    await page.screenshot({ path: `/tmp/wedding-sheet-viewer-${test.info().project.name}-${size.width}.png` });
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Remove this moment?' })).toBeInViewport();
    await page.getByRole('button', { name: 'Keep It' }).click();
    await scrollTo(page, 'top');
    await atTop(page);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1100);
    await page.getByRole('button', { name: 'Upcoming', exact: true }).click();
    await atTop(page);
    await expect(page.getByText('A date still to come')).toBeVisible();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText('Removed');
  });
}

test('negative visual viewport offset cannot hide the header; save and edit remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await viewport(page, 844, -120);
  await page.getByRole('button', { name: 'New moment', exact: true }).click();
  await atTop(page);
  await page.getByLabel('What shall we call it?').fill('Local layout test');
  await page.getByRole('button', { name: 'Still to come', exact: true }).click();
  await expect(page.getByLabel('A date to look forward to')).toBeVisible();
  await page.getByRole('button', { name: 'It happened', exact: true }).click();
  await page.getByLabel('The date', { exact: true }).fill('2026-09-01');
  await page.getByRole('radio', { name: 'Family', exact: true }).check();
  await page.getByRole('button', { name: 'Add to our forever' }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'View moment', exact: true }).click();
  await page.getByRole('button', { name: 'Edit moment', exact: true }).click();
  await atTop(page);
  await page.getByLabel('What shall we call it?').fill('Edited locally');
  await page.getByRole('button', { name: 'Keep these changes' }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'View moment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edited locally' })).toBeInViewport();
});

test('wheel gestures cannot move background; close restores original body styles', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { document.body.style.paddingRight = '7px'; document.body.style.overflow = 'auto'; window.scrollTo(0, 800); });
  await page.getByRole('button', { name: 'View moment', exact: true }).click();
  const before = await page.locator('.wedding-story-header').boundingBox();
  await page.mouse.move(2, 2);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(100);
  const after = await page.locator('.wedding-story-header').boundingBox();
  expect(after!.y).toBe(before!.y);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => [document.body.style.paddingRight, document.body.style.overflow, window.scrollY])).toEqual(['7px', 'auto', 800]);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
});
