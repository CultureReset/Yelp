import {
  type Permission, type Role,
  ROLE_PERMISSIONS, STEP_UP_PERMISSIONS, STEP_UP_WINDOW_MS,
} from './roles';

export interface AuthContext {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  sessionId: string;
  orgId: string;
  orgName: string;
  role: Role;
  /** 'all' means every location in the org. */
  locationScope: string[] | 'all';
  permissions: ReadonlySet<Permission>;
  mfaSatisfiedAt: Date | null;
  reauthAt: Date | null;
  impersonatorId: string | null;
}

export class PermissionError extends Error {
  constructor(
    public readonly permission: Permission,
    public readonly kind: 'forbidden' | 'out_of_scope' | 'step_up_required',
    message: string,
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

export function buildPermissions(role: Role): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS[role] ?? new Set<Permission>();
}

export function inScope(ctx: AuthContext, businessId?: string | null): boolean {
  if (!businessId) return true;
  if (ctx.locationScope === 'all') return true;
  return ctx.locationScope.includes(businessId);
}

/** Non-throwing check. Use for rendering — hide what the user cannot do. */
export function can(
  ctx: AuthContext,
  permission: Permission,
  businessId?: string | null,
): boolean {
  if (!ctx.permissions.has(permission)) return false;
  return inScope(ctx, businessId);
}

/** Does this action need a fresh password prompt right now? */
export function needsStepUp(ctx: AuthContext, permission: Permission): boolean {
  if (!STEP_UP_PERMISSIONS.has(permission)) return false;
  if (!ctx.reauthAt) return true;
  return Date.now() - ctx.reauthAt.getTime() > STEP_UP_WINDOW_MS;
}

/** Throwing check. Use at the top of every mutation. */
export function authorize(
  ctx: AuthContext,
  permission: Permission,
  businessId?: string | null,
): void {
  if (!ctx.permissions.has(permission)) {
    throw new PermissionError(
      permission, 'forbidden',
      `Your role (${ctx.role}) cannot ${permission}.`,
    );
  }
  if (!inScope(ctx, businessId)) {
    throw new PermissionError(
      permission, 'out_of_scope',
      'That location is not in your access scope.',
    );
  }
  if (needsStepUp(ctx, permission)) {
    throw new PermissionError(
      permission, 'step_up_required',
      'Confirm your password to continue.',
    );
  }
}
