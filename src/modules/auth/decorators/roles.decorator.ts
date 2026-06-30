import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('customer' | 'provider')[]) =>
  SetMetadata(ROLES_KEY, roles);
