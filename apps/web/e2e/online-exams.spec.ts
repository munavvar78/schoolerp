import { expect, test } from '@playwright/test';

test.describe('Online exams staff create + question', () => {
  test.setTimeout(240_000);

  test('admin creates draft exam and adds a single-choice question', async ({ page }) => {
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

    await page.getByRole('link', { name: 'Online exams' }).click();
    await expect(page.getByRole('heading', { name: 'Online exams' }).first()).toBeVisible({
      timeout: 60_000,
    });

    const stamp = Date.now().toString().slice(-6);
    const title = `E2E Online ${stamp}`;
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Initial status').selectOption('DRAFT');
    await page.getByLabel('Require camera').selectOption('true');
    await page.getByLabel('Max camera warnings').fill('3');
    await page.getByLabel('Face absent (sec)').fill('10');

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/api/online-assessments') &&
          res.request().method() === 'POST' &&
          !res.url().includes('questions'),
        { timeout: 60_000 },
      ),
      page.getByRole('button', { name: 'Create exam & add questions' }).click(),
    ]);

    await expect(page.getByText(/Created · join code/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Add question' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel('Question').fill(`What is 2+2? (${stamp})`);
    await page.getByRole('button', { name: /Add question|Save question/i }).click();

    await expect(page.getByText('Question added')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
  });
});
