import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../../src/users/user.entity';
import { Role } from '../../src/auth/enums/role.enum';

export const DEFAULT_PASSWORD = 'Password123@';

export interface UserInput {
  email?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
  phone?: string | null;
  plainPassword?: string;
  verificationToken?: string | null;
  verificationTokenExpiresAt?: Date | null;
}

let _seq = 0;

export async function createUser(
  repo: Repository<User>,
  input: UserInput = {},
): Promise<User> {
  const { plainPassword = DEFAULT_PASSWORD, ...fields } = input;
  _seq++;

  const user = repo.create({
    email: `user-${_seq}@test.com`,
    password: await bcrypt.hash(plainPassword, 10),
    name: 'Test User',
    role: Role.USER,
    isActive: true,
    ...fields,
  } as Partial<User>);

  return repo.save(user);
}
