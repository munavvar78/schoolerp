import { expect, test } from '@playwright/test';

test.describe('School ERP Phase 2 ops', () => {
  test.setTimeout(240_000);

  test('admin notices/admissions/timetable/homework; parent sees notices and homework', async ({
    page,
  }) => {
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
      if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);
    });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
    await expect(page.getByText('Open applications')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('link', { name: 'Notices' }).click();
    await expect(page.getByRole('heading', { name: 'Notices' }).first()).toBeVisible();
    const stamp = Date.now().toString().slice(-6);
    await page.getByLabel('Title').fill(`E2E Circular ${stamp}`);
    await page.getByLabel('Body').fill('Phase 2 e2e notice body for parents.');
    await page.getByRole('button', { name: 'Save notice' }).click();
    await expect(page.getByText(new RegExp(`Notice saved.*E2E Circular ${stamp}`))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(`E2E Circular ${stamp}`).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: 'Admissions' }).click();
    await expect(page.getByRole('heading', { name: 'Admissions' }).first()).toBeVisible();
    await expect(page.getByText('Riya')).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Applicant first name').fill('E2E');
    await page.getByLabel('Last name').fill('Applicant');
    await page.getByLabel('Contact name').fill('E2E Parent');
    await page.getByLabel('Grade').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByText('Application submitted')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: 'Timetable' }).click();
    await expect(page.getByRole('heading', { name: 'Timetable' }).first()).toBeVisible();
    await expect(page.getByText(/Period 1|P1|Section grid/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('link', { name: 'Homework' }).click();
    await expect(page.getByRole('heading', { name: 'Homework' }).first()).toBeVisible();
    await expect(page.getByText('Algebra worksheet 1')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Email').fill('parent@bharatvidya.edu');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard|\/parent/, { timeout: 60_000 });

    await page.getByRole('link', { name: 'Parent Portal' }).click();
    await expect(page.getByText(/Aarav|ADM-8001/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Welcome to the 2026-27|E2E Circular|Notices/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Algebra worksheet|Homework/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
