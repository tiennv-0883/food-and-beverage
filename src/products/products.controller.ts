import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ProductsService } from './products.service';
import { FeaturedProductsQueryDto } from './dto/featured-products-query.dto';
import { SearchProductsQueryDto } from './dto/search-products-query.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Tìm kiếm & lọc sản phẩm (public)' })
  @ApiOkResponse({ description: 'Danh sách sản phẩm kèm phân trang' })
  @Public()
  @Get()
  search(@Query() query: SearchProductsQueryDto) {
    return this.productsService.search(query);
  }

  @ApiOperation({ summary: 'Top-selling products by time frame (public)' })
  @ApiOkResponse({
    description: 'Returns timeframe, since, label, and data array',
  })
  @Public()
  @Get('featured')
  getFeatured(@Query() query: FeaturedProductsQueryDto) {
    return this.productsService.getFeatured(query);
  }

  @ApiOperation({
    summary: 'Lấy link chia sẻ sản phẩm lên mạng xã hội (public)',
  })
  @ApiOkResponse({ description: 'URL chia sẻ kèm Open Graph metadata' })
  @Public()
  @Get(':slug/share')
  getShareLink(@Param('slug') slug: string) {
    return this.productsService.getShareLink(slug);
  }

  @ApiOperation({ summary: 'Xem chi tiết sản phẩm (public)' })
  @ApiOkResponse({ description: 'Thông tin chi tiết sản phẩm' })
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}
