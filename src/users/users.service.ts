import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { executeOrThrow, t } from '../shared/util';
import { UserSerializer, UserSerializerType } from './user.serializer';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import { AttachableType } from '../attachments/attachment.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private i18n: I18nService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  findByVerificationToken(email: string, token: string) {
    return this.userRepo.findOne({
      where: { email, verificationToken: token },
    });
  }

  async verifyByToken(
    user: User,
  ): Promise<{ email: string; verifiedAt: Date }> {
    await executeOrThrow(
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
    await executeOrThrow(
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

  private findByIdWithPassword(id: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
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
    const saved = await executeOrThrow(
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
      await executeOrThrow(
        () => this.userRepo.update(id, payload),
        t(this.i18n, 'user.update-failed'),
      );
    }

    return this.findById(id);
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ): Promise<Record<string, unknown>> {
    if (file) {
      const old = await this.attachmentsService.findByAttachable(
        AttachableType.USER,
        id,
      );
      const att = await executeOrThrow(
        () =>
          this.attachmentsService.createForEntity(
            file,
            AttachableType.USER,
            id,
          ),
        t(this.i18n, 'user.avatar-update-failed'),
      );
      await executeOrThrow(
        () => this.userRepo.update(id, { avatar: att.fileId }),
        t(this.i18n, 'user.avatar-update-failed'),
      );
      if (old) await this.attachmentsService.removeById(old.id);
    }

    const update: Partial<Pick<User, 'name' | 'phone'>> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.phone !== undefined) update.phone = dto.phone;
    if (Object.keys(update).length > 0) {
      await executeOrThrow(
        () => this.userRepo.update(id, update),
        t(this.i18n, 'user.update-failed'),
      );
    }

    return this.findById(id);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findByIdWithPassword(id);
    if (!user)
      throw new NotFoundException(t(this.i18n, 'user.not-found', { id }));

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException(t(this.i18n, 'user.invalid-password'));
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await executeOrThrow(
      () => this.userRepo.update(id, { password: hashed }),
      t(this.i18n, 'user.update-failed'),
    );
  }
}
