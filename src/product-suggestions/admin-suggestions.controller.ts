import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ProductSuggestionsService } from './product-suggestions.service';
import { QuerySuggestionsDto } from './dto/query-suggestions.dto';
import { UpdateSuggestionStatusDto } from './dto/update-suggestion-status.dto';

@ApiBearerAuth()
@ApiTags('Admin - Suggestions')
@Roles(Role.ADMIN)
@Controller('admin/suggestions')
export class AdminSuggestionsController {
  constructor(private readonly service: ProductSuggestionsService) {}

  @ApiOperation({
    summary: 'Danh sách đề xuất — phân trang, lọc theo trạng thái',
  })
  @Get()
  findAll(@Query() query: QuerySuggestionsDto) {
    return this.service.adminFindAll(query);
  }

  @ApiOperation({ summary: 'Chi tiết đề xuất (tự động đánh dấu đã xem)' })
  @ApiParam({ name: 'id', description: 'Suggestion ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.adminFindOne(id);
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái: APPROVED | REJECTED | ARCHIVED' })
  @ApiParam({ name: 'id', description: 'Suggestion ID' })
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSuggestionStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
