import { afterEach, describe, expect, it } from 'vitest';
import { server, http, HttpResponse } from '../../../tests/msw-server';

server.use(
  http.get('http://localhost:3000/api/health', () =>
    HttpResponse.json({ status: 'OK' })
  )
);

import { authService } from '../apiAuthService';

afterEach(() => {
  authService.logout();
});

const sampleUser = {
  id: 'user-1',
  email: 'agent@example.com',
  name: 'Mario Rossi',
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLogin: '2025-01-10T12:00:00.000Z',
  firstName: 'Mario',
  lastName: 'Rossi',
  badgeNumber: 'AB12345',
  department: 'Polizia Locale',
  rank: 'Ispettore',
  phoneNumber: '3200000000',
  isVerified: true,
  isActive: true,
} as const;

const registrationData = {
  email: 'agent@example.com',
  password: 'password123',
  confirmPassword: 'password123',
  firstName: 'Mario',
  lastName: 'Rossi',
  badgeNumber: 'AB12345',
  department: 'Polizia Locale',
  rank: 'Ispettore',
  phoneNumber: '3200000000',
} as const;

describe('apiAuthService integration', () => {
  it('login salva token e utente su localStorage', async () => {
    server.use(
      http.post('http://localhost:3000/api/auth/login', async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({ email: 'agent@example.com', password: 'password123' });
        return HttpResponse.json({
          success: true,
          message: 'ok',
          token: 'jwt-token',
          user: sampleUser,
        });
      })
    );

    const result = await authService.login({ email: 'agent@example.com', password: 'password123' });

    expect(result.success).toBe(true);
    expect(window.localStorage.getItem('turni_pl_auth_token')).toBe('jwt-token');
    expect(window.localStorage.getItem('turni_pl_current_user')).toContain('agent@example.com');
  });

  it('login fallisce su errore HTTP', async () => {
    server.use(
      http.post('http://localhost:3000/api/auth/login', () =>
        HttpResponse.json({ success: false, message: 'invalid' }, { status: 401 })
      )
    );

    const result = await authService.login({ email: 'agent@example.com', password: 'wrong' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('HTTP error');
    expect(window.localStorage.getItem('turni_pl_auth_token')).toBeNull();
  });

  it('getCurrentUser valida il token con il server', async () => {
    window.localStorage.setItem('turni_pl_auth_token', 'jwt-token');

    server.use(
      http.post('http://localhost:3000/api/auth/verify', async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({ token: 'jwt-token' });
        return HttpResponse.json({ success: true, user: sampleUser });
      })
    );

    const user = await authService.getCurrentUser();

    expect(user?.email).toBe('agent@example.com');
    expect(window.localStorage.getItem('turni_pl_current_user')).toContain('agent@example.com');
  });

  it('getCurrentUser restituisce null e ripulisce storage su token invalido', async () => {
    window.localStorage.setItem('turni_pl_auth_token', 'expired');
    window.localStorage.setItem('turni_pl_current_user', JSON.stringify(sampleUser));

    server.use(
      http.post('http://localhost:3000/api/auth/verify', () =>
        HttpResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
      )
    );

    const user = await authService.getCurrentUser();

    expect(user).toBeNull();
    expect(window.localStorage.getItem('turni_pl_auth_token')).toBeNull();
    expect(window.localStorage.getItem('turni_pl_current_user')).toBeNull();
  });

  it('register crea un nuovo utente e ritorna il payload del server', async () => {
    server.use(
      http.post('http://localhost:3000/api/auth/register', async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual(registrationData);
        return HttpResponse.json({ success: true, message: 'Registrato', user: sampleUser });
      })
    );

    const result = await authService.register({ ...registrationData });

    expect(result.success).toBe(true);
    expect(result.user).toEqual(sampleUser);
    expect(result.message).toBe('Registrato');
  });

  it('changePassword restituisce errore leggibile su risposta non ok', async () => {
    window.localStorage.setItem('turni_pl_auth_token', 'jwt-token');

    server.use(
      http.post('http://localhost:3000/api/auth/change-password', async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({ currentPassword: 'oldpass', newPassword: 'newpass' });
        return HttpResponse.json({ success: false, message: 'Password troppo semplice' }, { status: 400 });
      })
    );

    const result = await authService.changePassword('oldpass', 'newpass');

    expect(result.success).toBe(false);
    expect(result.message).toContain('HTTP error! status: 400');
    expect(window.localStorage.getItem('turni_pl_auth_token')).toBe('jwt-token');
  });
});
