import { JwtService } from '@nestjs/jwt';
import { Role } from '../src/auth/enums/role.enum';

export const TEST_JWT_SECRET = 'test-secret-key';

export function makeToken(
  jwtService: JwtService,
  role: Role,
  sub = 'test-user-id',
): string {
  return jwtService.sign({
    sub,
    email: `${role.toLowerCase()}@test.com`,
    role,
  });
}
