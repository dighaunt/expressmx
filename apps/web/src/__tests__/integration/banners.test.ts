import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { GET as bannersList } from '@/app/api/v1/mobile/banners/route';
import {
  cleanupAllTestFixtures,
  makeFixtureUser,
  type FixtureUser,
} from './_fixtures';
import { invokeHandler } from './_helpers';

describe('integration: /api/v1/mobile/banners (sin mocks)', () => {
  let cliente: FixtureUser;

  beforeAll(async () => {
    cliente = await makeFixtureUser({ rol: 'cliente' });
  });

  afterAll(async () => {
    await cleanupAllTestFixtures();
  });

  it('no controlados: sin token -> 401', async () => {
    const r = await invokeHandler<{ code: string }>(bannersList, {});
    expect(r.status).toBe(401);
  });

  it('controlados-positivos: cliente autenticado -> 200 con banners segmentados', async () => {
    const r = await invokeHandler<{ data: unknown[] }>(bannersList, {
      token: cliente.token,
    });

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });
});
