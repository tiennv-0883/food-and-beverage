import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as path from 'path';
import { Public } from '../auth/decorators/public.decorator';
import { AttachmentsService } from './attachments.service';

@ApiTags('Attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @ApiOperation({ summary: 'Stream file by UUID (public)' })
  @ApiOkResponse({ description: 'Returns file as binary stream' })
  @Public()
  @Get(':fileId')
  async getFile(
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const attachment = await this.attachmentsService.findByFileIdOrFail(fileId);
    const absolutePath = path.resolve(process.cwd(), attachment.path!);
    if (attachment.mimeType) res.type(attachment.mimeType);
    res.sendFile(absolutePath);
  }
}
