import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { AttachmentsController } from '../src/attachments/attachments.controller';
import { AttachmentsService } from '../src/attachments/attachments.service';
import {
  Attachment,
  AttachableType,
} from '../src/attachments/attachment.entity';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';

describe('AttachmentsController Integration (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let attachmentRepo: Repository<Attachment>;

  const uploadDir = path.join('uploads', 'user');
  const createdFiles: string[] = [];

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [Attachment],
      controllers: [AttachmentsController],
      providers: [AttachmentsService],
    });

    app = setup.app as INestApplication<App>;
    dataSource = setup.dataSource;
    attachmentRepo = setup.getRepo(Attachment);
  });

  afterAll(async () => {
    createdFiles.forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  async function createAttachment(fileId: string): Promise<Attachment> {
    fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `${fileId}.png`);
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.writeFileSync(filePath, pngBuffer);
    createdFiles.push(filePath);

    const att = attachmentRepo.create({
      fileId,
      originName: 'test.png',
      mimeType: 'image/png',
      size: pngBuffer.length,
      path: filePath,
      attachableType: AttachableType.USER,
      attachableId: 'test-user-id',
      isPublic: true,
    });
    return attachmentRepo.save(att);
  }

  // ─── GET /attachments/:fileId ────────────────────────────────────────────────

  describe('GET /attachments/:fileId — public endpoint', () => {
    it('valid fileId → 200 with binary content', async () => {
      const fileId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      await createAttachment(fileId);

      const res = await request(app.getHttpServer())
        .get(`/attachments/${fileId}`)
        .expect(200);

      expect(res.body).toBeTruthy();
    });

    it('non-existent fileId → 404', () => {
      return request(app.getHttpServer())
        .get('/attachments/non-existent-file-id')
        .expect(404);
    });

    it('no auth required — public access works without token', async () => {
      const fileId = 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee';
      await createAttachment(fileId);

      return request(app.getHttpServer())
        .get(`/attachments/${fileId}`)
        .expect(200);
    });
  });
});
