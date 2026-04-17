import { Console, Command } from 'nestjs-console';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/user.entity';
import { Role } from '../../auth/enums/role.enum';

const SEED_USERS = [
  {
    email: 'user@test.com',
    password: 'Password123@',
    name: 'Test User',
    phone: '0901234567',
    role: Role.USER,
  },
  {
    email: 'admin@test.com',
    password: 'Password123@',
    name: 'Test Admin',
    phone: '0901234568',
    role: Role.ADMIN,
  },
  {
    email: 'system@test.com',
    password: 'Password123@',
    name: 'Test System',
    phone: '0901234569',
    role: Role.SYSTEM,
  },
];

@Console()
export class UserSeedCommand {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Command({
    command: 'seed:users',
    description: 'Seed test users for all roles (USER, ADMIN, SYSTEM)',
  })
  async seedUsers(): Promise<void> {
    for (const data of SEED_USERS) {
      const existing = await this.userRepo.findOne({
        where: { email: data.email },
      });
      if (existing) {
        console.log(`[SKIP] ${data.email} already exists`);
        continue;
      }

      const user = this.userRepo.create({
        ...data,
        password: await bcrypt.hash(data.password, 10),
        isActive: true,
      });
      await this.userRepo.save(user);
      console.log(`[CREATED] ${data.role} — ${data.email} / ${data.password}`);
    }

    console.log('Done.');
  }
}
