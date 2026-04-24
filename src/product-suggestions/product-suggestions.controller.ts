import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProductSuggestionsService } from './product-suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { QuerySuggestionsDto } from './dto/query-suggestions.dto';

@ApiBearerAuth()
@ApiTags('Suggestions')
@Controller('suggestions')
export class ProductSuggestionsController {
  constructor(private readonly service: ProductSuggestionsService) {}

  @ApiOperation({ summary: 'Gửi đề xuất sản phẩm cho admin' })
  @Post()
  create(
    @Request() req: { user: { sub: string } },
    @Body() dto: CreateSuggestionDto,
  ) {
    return this.service.create(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Xem các đề xuất của tôi' })
  @Get('me')
  findMine(
    @Request() req: { user: { sub: string } },
    @Query() query: QuerySuggestionsDto,
  ) {
    return this.service.findMine(req.user.sub, query);
  }
}
