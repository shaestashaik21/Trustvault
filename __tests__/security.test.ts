import { signToken, verifyToken } from '../src/lib/auth';

describe('TrustVault Security & Access Control Tests', () => {
  const adminUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@trustvault.local',
    role: 'admin' as const,
  };

  const normalUser = {
    userId: '00000000-0000-0000-0000-000000000002',
    email: 'user@trustvault.local',
    role: 'user' as const,
  };

  test('T-SEC-01: Generates valid signed JWT token', () => {
    const token = signToken(normalUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('T-SEC-02: Verifies valid token and decodes accurate payload', () => {
    const token = signToken(normalUser);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe(normalUser.email);
    expect(decoded?.role).toBe('user');
    expect(decoded?.userId).toBe(normalUser.userId);
  });

  test('T-SEC-03: Rejects tampered tokens (integrity enforcement)', () => {
    const token = signToken(normalUser);
    const tampered = token.slice(0, -6) + 'abcdef';
    const decoded = verifyToken(tampered);
    expect(decoded).toBeNull();
  });

  test('T-SEC-04: Enforces role isolation between admin and user', () => {
    const adminToken = signToken(adminUser);
    const userToken = signToken(normalUser);

    const adminPayload = verifyToken(adminToken);
    const userPayload = verifyToken(userToken);

    expect(adminPayload?.role).toBe('admin');
    expect(userPayload?.role).toBe('user');
    expect(userPayload?.role).not.toBe('admin');
  });
});
