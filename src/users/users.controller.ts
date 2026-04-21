import {
  Body,
  Controller,
  FileTypeValidator,
  ForbiddenException,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { RequestWithUser } from '../auth/guards/jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

const MB5 = 5 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: 'Get own profile' })
  @Get('me')
  getProfile(@Req() req: RequestWithUser) {
    return this.usersService.findById(req.user.sub);
  }

  @ApiOperation({ summary: 'Update own profile (name, phone, avatar)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Nguyen Van A' },
        phone: { type: 'string', example: '0901234567' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image (jpeg/png/webp, max 5MB)',
        },
      },
    },
  })
  @Put('me')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  updateProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: MB5 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(req.user.sub, dto, file);
  }

  @ApiOperation({ summary: 'Change own password' })
  @Put('me/password')
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(req.user.sub, dto);
    return { message: 'Password changed successfully' };
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  find(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.sub !== id) throw new ForbiddenException();
    return this.usersService.update(id, body);
  }
}
