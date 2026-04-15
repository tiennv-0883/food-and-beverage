import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { t } from '../shared/util';
import { RefreshToken } from './refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private i18n: I18nService,
  ) {}

  async logout(
    refreshToken: string,
    userId: string,
  ): Promise<{ message: string }> {
    const hash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash },
    });
    if (stored && stored.userId === userId) {
      await this.refreshTokenRepo.delete(stored.id);
    }
    return { message: t(this.i18n, 'auth.logged-out') };
  }

  async signup(email: string, password: string, name?: string) {
    await this.checkUserExistingAndThrow(email);

    try {
      return await this.usersService.create({ email, password, name });
    } catch {
      throw new InternalServerErrorException(
        t(this.i18n, 'auth.create-user-failed'),
      );
    }
  }

  async login(email: string, password: string) {
    const user = await this.findUserOrThrow(email);
    await this.checkPasswordOrThrow(password, user.password);

    const payload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);
    const refresh_token = await this.createRefreshToken(user.id);
    return { access_token, refresh_token };
  }

  async refresh(rawToken: string): Promise<{ access_token: string }> {
    const hash = this.hashToken(rawToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await this.refreshTokenRepo.delete(stored.id);
      throw new UnauthorizedException();
    }

    const user = await this.usersService
      .findByIdRaw(stored.userId)
      .catch(async (err: unknown) => {
        if (err instanceof NotFoundException) {
          await this.refreshTokenRepo.delete(stored.id);
          throw new UnauthorizedException();
        }
        throw err;
      });
    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
    return { access_token };
  }

  private throwUnauthorized(): never {
    throw new UnauthorizedException();
  }

  private async checkUserExistingAndThrow(email: string): Promise<void> {
    const existing = await this.usersService.findByEmail(email);
    if (existing)
      throw new ConflictException(t(this.i18n, 'auth.email-exists'));
  }

  private async findUserOrThrow(email: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) this.throwUnauthorized();
    return user;
  }

  private async checkPasswordOrThrow(
    password: string,
    hashedPassword: string,
  ): Promise<void> {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) this.throwUnauthorized();
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = this.hashToken(raw);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.refreshTokenRepo.save({ tokenHash: hash, userId, expiresAt });
    return raw;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
