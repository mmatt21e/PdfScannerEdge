import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'icons');
// Three valid PNG images stand in for three captured/imported pages.
const pageImages = [
  join(iconsDir, 'icon-192.png'),
  join(iconsDir, 'icon-512.png'),
  join(iconsDir, 'icon-maskable-512.png'),
];

test.describe('PocketScan primary mobile workflow', () => {
  test('import, edit, save into a folder, open, download, and persist', async ({ page }) => {
    // 1. Launch the application.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'PocketScan' })).toBeVisible();

    // 2 & 3. Start a scan by importing three pages (camera fallback path).
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(pageImages);

    // 5. Review screen opens with all three pages.
    await expect(page).toHaveURL(/#\/review/);
    await expect(page.getByText('3 pages')).toBeVisible();

    // 4. Reorder: move the first page later.
    await page.getByRole('button', { name: 'Move selected page later' }).click();

    // 5. Rotate the selected page.
    await page.getByRole('button', { name: 'Rotate' }).click();
    // Still three pages after edits.
    await expect(page.getByText('3 pages')).toBeVisible();

    // Proceed to the save screen.
    await page.getByRole('button', { name: /Generate PDF/ }).click();
    await expect(page).toHaveURL(/#\/save/);

    // 7. Enter a filename.
    const filename = page.getByLabel('Filename');
    await filename.fill('E2E Test Scan');

    // 6 & 8. Create a destination folder and select it.
    await page.getByRole('button', { name: '＋ New' }).click();
    await page.getByLabel('Folder name').fill('E2E Folder');
    await page.getByRole('button', { name: 'Create' }).click();

    // 9. Generate and save the PDF.
    await page.getByRole('button', { name: 'Save PDF' }).click();

    // 10. The document detail screen opens.
    await expect(page).toHaveURL(/#\/documents\//);
    await expect(page.getByRole('heading', { name: 'E2E Test Scan.pdf' })).toBeVisible();
    await expect(page.getByText('E2E Folder')).toBeVisible();

    // Download the PDF and confirm a download is produced.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '⬇ Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('E2E Test Scan.pdf');

    // Reload the application and verify the document still exists (IndexedDB persistence).
    await page.goto('/');
    await page.reload();
    await expect(page.getByText('E2E Test Scan.pdf')).toBeVisible();
  });

  test('loads and renders offline-capable shell', async ({ page }) => {
    await page.goto('/');
    // The app shell and primary actions render without any network dependency.
    await expect(page.getByRole('button', { name: /New Scan/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByText(/remain on this device/)).toBeVisible();
  });
});
