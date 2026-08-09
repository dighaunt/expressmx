import { test as base, expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

export const ADMIN_AVAILABLE =
  process.env.E2E_ADMIN_AVAILABLE === '1' && Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/(orders|dashboard)/, { timeout: 10_000 });
}

export const test = base.extend({});
export { expect };
