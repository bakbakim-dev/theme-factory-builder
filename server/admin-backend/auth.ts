import crypto from 'node:crypto';
import type { AdminAuthContext, AdminDatabase, AdminPublicUser, AdminTenant, AdminUser } from './types.js';

export interface CreateAdminAuthServiceInput {
  database: AdminDatabase;
  tokenSecret: string;
  nextId: () => string;
  clock: () => string;
  tokenTtlSeconds?: number;
}

export interface EnsureTenantOwnerInput {
  tenantName: string;
  tenantSlug: string;
  email: string;
  displayName: string;
  password: string;
}

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface AdminLoginSuccess {
  ok: true;
  token: string;
  user: AdminPublicUser;
  tenant: AdminTenant;
  expiresAt: string;
}

export interface AdminLoginFailure {
  ok: false;
  error: string;
}

export type AdminLoginResult = AdminLoginSuccess | AdminLoginFailure;

export interface AdminTenantOwnerResult {
  tenant: AdminTenant;
  user: AdminUser;
}

export interface AdminAuthService {
  ensureTenantOwner(input: EnsureTenantOwnerInput): Promise<AdminTenantOwnerResult>;
  login(input: AdminLoginInput): Promise<AdminLoginResult>;
  requireToken(token: string): Promise<AdminAuthContext>;
  getSessionInfo(context: AdminAuthContext): Promise<{ user: AdminPublicUser; tenant: AdminTenant }>;
  publicUser(user: AdminUser): AdminPublicUser;
}

const PASSWORD_ITERATIONS = 120000;
const TOKEN_VERSION = 1;

const base64Url = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const publicUser = (user: AdminUser): AdminPublicUser => ({
  id: user.id,
  tenantId: user.tenantId,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
});

const hashPassword = (password: string, salt: string, iterations = PASSWORD_ITERATIONS): string => (
  crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url')
);

const verifyPassword = (password: string, user: AdminUser): boolean => {
  const expected = Buffer.from(user.passwordHash, 'base64url');
  const actual = Buffer.from(hashPassword(password, user.passwordSalt, user.passwordIterations), 'base64url');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const sign = (payload: string, tokenSecret: string): string => (
  crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url')
);

const signatureMatches = (payload: string, signature: string, tokenSecret: string): boolean => {
  const expected = Buffer.from(sign(payload, tokenSecret), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const createToken = (
  context: AdminAuthContext,
  input: Pick<CreateAdminAuthServiceInput, 'clock' | 'tokenSecret' | 'tokenTtlSeconds'>
): { token: string; expiresAt: string } => {
  const now = new Date(input.clock());
  const expiresAt = new Date(now.getTime() + (input.tokenTtlSeconds || 60 * 60 * 8) * 1000).toISOString();
  const payload = base64Url(JSON.stringify({
    v: TOKEN_VERSION,
    userId: context.userId,
    tenantId: context.tenantId,
    email: context.email,
    role: context.role,
    expiresAt,
  }));
  return { token: `${payload}.${sign(payload, input.tokenSecret)}`, expiresAt };
};

export const createAdminAuthService = (input: CreateAdminAuthServiceInput): AdminAuthService => ({
  publicUser,

  ensureTenantOwner: async (request) => {
    const now = input.clock();
    const tenantSlug = request.tenantSlug.trim().toLowerCase();
    const existingTenant = await input.database.getTenantBySlug(tenantSlug);
    const tenant: AdminTenant = existingTenant || {
      id: input.nextId(),
      name: request.tenantName.trim() || tenantSlug,
      slug: tenantSlug,
      createdAt: now,
      updatedAt: now,
    };
    if (!existingTenant) {
      await input.database.saveTenant(tenant);
    }

    const email = normalizeEmail(request.email);
    const existingUser = await input.database.getUserByEmail(email);
    if (existingUser) {
      if (existingUser.tenantId !== tenant.id) {
        throw new Error(`User ${email} already belongs to another tenant.`);
      }
      return { tenant, user: existingUser };
    }

    const passwordSalt = crypto.randomBytes(18).toString('base64url');
    const user: AdminUser = {
      id: input.nextId(),
      tenantId: tenant.id,
      email,
      displayName: request.displayName.trim() || email,
      role: 'owner',
      passwordHash: hashPassword(request.password, passwordSalt),
      passwordSalt,
      passwordIterations: PASSWORD_ITERATIONS,
      createdAt: now,
      updatedAt: now,
    };
    await input.database.saveUser(user);
    return { tenant, user };
  },

  login: async (request) => {
    const user = await input.database.getUserByEmail(normalizeEmail(request.email));
    if (!user || !verifyPassword(request.password, user)) {
      return { ok: false, error: 'invalid_credentials' };
    }
    const tenant = await input.database.getTenant(user.tenantId);
    if (!tenant) {
      return { ok: false, error: 'tenant_missing' };
    }
    const { token, expiresAt } = createToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    }, input);
    return { ok: true, token, user: publicUser(user), tenant, expiresAt };
  },

  requireToken: async (token) => {
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !signatureMatches(payload, signature, input.tokenSecret)) {
      throw new Error('Unauthorized');
    }

    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminAuthContext & { v?: number; expiresAt?: string };
    if (parsed.v !== TOKEN_VERSION || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= new Date(input.clock()).getTime()) {
      throw new Error('Unauthorized');
    }

    const user = await input.database.getUser(parsed.userId);
    if (!user || user.tenantId !== parsed.tenantId || user.email !== parsed.email || user.role !== parsed.role) {
      throw new Error('Unauthorized');
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };
  },

  getSessionInfo: async (context) => {
    const user = await input.database.getUser(context.userId);
    const tenant = await input.database.getTenant(context.tenantId);
    if (!user || !tenant || user.tenantId !== tenant.id) {
      throw new Error('Unauthorized');
    }
    return { user: publicUser(user), tenant };
  },
});
