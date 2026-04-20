import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ProductsService } from './products.service';
import { FeaturedProductsQueryDto } from './dto/featured-products-query.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Top-selling products by time frame (public)' })
  @ApiOkResponse({
    description: 'Returns timeframe, since, label, and data array',
  })
  @Public()
  @Get('featured')
  getFeatured(@Query() query: FeaturedProductsQueryDto) {
    return this.productsService.getFeatured(query);
  }
}
