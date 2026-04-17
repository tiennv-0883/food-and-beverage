import { AppDataSource } from '../../data-source';
import { User } from '../../users/user.entity';
import { Role } from '../../auth/enums/role.enum';
import * as bcrypt from 'bcrypt';

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

async function seed() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  for (const data of SEED_USERS) {
    const existing = await userRepo.findOne({ where: { email: data.email } });
    if (existing) {
      console.log(`[SKIP] ${data.email} already exists`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = userRepo.create({
      ...data,
      password: hashedPassword,
      isActive: true,
    });
    await userRepo.save(user);
    console.log(`[CREATED] ${data.role} - ${data.email} / ${data.password}`);
  }

  await AppDataSource.destroy();
  console.log('Seeding done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
