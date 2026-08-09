import { test, expect, ADMIN_AVAILABLE, ADMIN_EMAIL, ADMIN_PASSWORD } from './fixtures';

test.describe('Login admin', () => {
  test.skip(
    !ADMIN_AVAILABLE,
    'requires seeded admin user — set E2E_ADMIN_AVAILABLE=1 después de correr pnpm db:seed',
  );

  test('admin con credenciales válidas accede al panel', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    await page.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
    await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'auth_token')).toBeTruthy();
  });

  test('credenciales inválidas muestran mensaje de error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('not-a-real-user@expressmx.com');
    await page.getByLabel('Contraseña').fill('clearly-wrong-password');
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(page.getByText(/credenciales/i)).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
