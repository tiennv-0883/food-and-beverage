import {
  Controller,
  Body,
  Get,
  Param,
  Put,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { RequestWithUser } from '../auth/jwt.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: RequestWithUser) {
    return this.usersService.findById(req.user.sub);
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

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
