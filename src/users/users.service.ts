import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { t } from '../shared/util';
import { UserSerializer, UserSerializerType } from './user.serializer';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private i18n: I18nService,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  findByVerificationToken(token: string) {
    return this.userRepo.findOne({ where: { verificationToken: token } });
  }

  async verifyByToken(
    user: User,
  ): Promise<{ email: string; verifiedAt: Date }> {
    await this.executeOrThrow(
      () =>
        this.userRepo.update(user.id, {
          isActive: true,
          verificationToken: null,
          verificationTokenExpiresAt: null,
        }),
      t(this.i18n, 'user.update-failed'),
    );
    return { email: user.email, verifiedAt: new Date() };
  }

  async resetVerificationToken(
    user: User,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.executeOrThrow(
      () =>
        this.userRepo.update(user.id, {
          verificationToken: token,
          verificationTokenExpiresAt: expiresAt,
        }),
      t(this.i18n, 'user.update-failed'),
    );
  }

  findByEmailWithPassword(email: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string, type: UserSerializerType = 'PROFILE') {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new NotFoundException(t(this.i18n, 'user.not-found', { id }));
    return new UserSerializer({ ...user }, { type }).serialize();
  }

  async findByIdRaw(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new NotFoundException(t(this.i18n, 'user.not-found', { id }));
    return user;
  }

  async findAll() {
    const users = await this.userRepo.find();
    return UserSerializer.serializeMany(
      users.map((u) => ({ ...u })),
      { type: 'BASIC_INFO' },
    );
  }

  async create(data: Partial<User>) {
    if (data.password) {
      data = { ...data, password: await bcrypt.hash(data.password, 10) };
    }
    const user = this.userRepo.create(data);
    const saved = await this.executeOrThrow(
      () => this.userRepo.save(user),
      t(this.i18n, 'user.create-failed'),
    );
    return new UserSerializer({ ...saved }, { type: 'PROFILE' }).serialize();
  }

  async update(id: string, data: Partial<User>) {
    const { password, ...safeData } = data;

    const payload: Partial<User> = { ...safeData };
    if (password) {
      payload.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(payload).length > 0) {
      await this.executeOrThrow(
        () => this.userRepo.update(id, payload),
        t(this.i18n, 'user.update-failed'),
      );
    }

    return this.findById(id);
  }

  private async executeOrThrow<T>(
    fn: () => Promise<T>,
    errorMessage: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch {
      throw new InternalServerErrorException(errorMessage);
    }
  }
}
