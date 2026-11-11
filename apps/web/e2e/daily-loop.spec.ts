import { expect, test } from '@playwright/test';

test.describe('School ERP daily loop', () => {
  test.setTimeout(180_000);

  test('admin can operate core modules; parent sees linked child', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 60_000 });

    await page.getByLabel('Email').fill('admin@bharatvidya.edu');
    await page.getByLabel('Password').fill('Password123!');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
        { timeout: 60_000 },
      ),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]).then(async ([res]) => {
      if (!res.ok()) {
        throw new Error(`login failed: ${res.status()} ${await res.text()}`);
      }
    });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
    await expect(page.getByText('Student strength')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('link', { name: 'Students' }).click();
    await expect(page.getByRole('heading', { name: 'Students' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ADM-8001' })).toBeVisible();

    const stamp = Date.now().toString().slice(-6);
    await page.getByLabel('First name').fill('Play');
    await page.getByLabel('Last name').fill('Wright');
    await page.getByLabel('Admission no').fill(`ADM-PW-${stamp}`);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Student created')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: 'Attendance' }).click();
    await expect(page.getByRole('heading', { name: 'Attendance' }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Fees' }).click();
    await expect(page.getByRole('heading', { name: 'Fees' }).first()).toBeVisible();
    await expect(page.getByText(/Outstanding|Tuition|Apr-2026|₹/i).first()).toBeVisible();

    await page.getByRole('link', { name: 'Exams' }).click();
    await expect(page.getByRole('heading', { name: 'Exams' }).first()).toBeVisible();
    await expect(page.getByText('Term 1').first()).toBeVisible();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.getByLabel('Question').fill('How many students do we have?');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.locator('pre')).toContainText(/Class strength|students/i, { timeout: 30_000 });

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Email').fill('parent@bharatvidya.edu');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard|\/parent/, { timeout: 60_000 });

    await page.getByRole('link', { name: 'Parent Portal' }).click();
    await expect(page.getByText(/Aarav|ADM-8001/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('ADM-8002', { exact: true })).toHaveCount(0);
  });
});
