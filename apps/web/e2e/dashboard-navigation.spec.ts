import { test, expect, ADMIN_AVAILABLE, loginAsAdmin } from './fixtures';

test.describe('Dashboard · workspace operaciones', () => {
  test.skip(
    !ADMIN_AVAILABLE,
    'requires seeded admin user — set E2E_ADMIN_AVAILABLE=1 después de correr pnpm db:seed',
  );

  test('admin abre workspace operaciones y la cola se renderiza', async ({ page }) => {
    await loginAsAdmin(page);

    const response = await page.goto('/dashboard/operaciones');
    expect(response?.status()).toBeLessThan(500);

    await expect(page.getByRole('heading', { name: /operaciones/i })).toBeVisible({
      timeout: 8_000,
    });

    await expect(page.getByText(/Política SLA/i)).toBeVisible();
    await expect(page.getByText(/Selecciona una orden/i)).toBeVisible();
  });
});
