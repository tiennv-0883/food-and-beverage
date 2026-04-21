import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Attachment, AttachableType } from './attachment.entity';
import { executeOrThrow, t } from '../shared/util';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    private readonly i18n: I18nService,
  ) {}

  prepareAttachment(
    file: Express.Multer.File,
    attachableType: AttachableType,
    attachableId: string,
  ): Attachment {
    const fileId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const dir = path.join('uploads', attachableType.toLowerCase());
    const filePath = path.join(dir, `${fileId}${ext}`);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, file.buffer);

    return this.attachmentRepo.create({
      fileId,
      originName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: filePath,
      attachableType,
      attachableId,
      isPublic: true,
    });
  }

  saveAttachment(
    attachment: Attachment,
    manager?: EntityManager,
  ): Promise<Attachment> {
    const repo = manager
      ? manager.getRepository(Attachment)
      : this.attachmentRepo;
    return executeOrThrow(
      () => repo.save(attachment),
      t(this.i18n, 'attachment.upload-failed'),
    );
  }

  async createForEntity(
    file: Express.Multer.File,
    attachableType: AttachableType,
    attachableId: string,
  ): Promise<Attachment> {
    const attachment = this.prepareAttachment(
      file,
      attachableType,
      attachableId,
    );
    return this.saveAttachment(attachment);
  }

  async findByFileId(fileId: string): Promise<Attachment | null> {
    return this.attachmentRepo.findOne({ where: { fileId } });
  }

  async findByAttachable(
    attachableType: AttachableType,
    attachableId: string,
  ): Promise<Attachment | null> {
    return this.attachmentRepo.findOne({
      where: { attachableType, attachableId },
    });
  }

  async removeById(id: string): Promise<void> {
    const attachment = await this.attachmentRepo.findOne({ where: { id } });
    if (!attachment) return;

    if (attachment.path && fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    await this.attachmentRepo.delete(id);
  }

  async findByFileIdOrFail(fileId: string): Promise<Attachment> {
    const attachment = await this.findByFileId(fileId);
    if (!attachment) {
      throw new NotFoundException(t(this.i18n, 'attachment.not-found'));
    }
    return attachment;
  }
}
