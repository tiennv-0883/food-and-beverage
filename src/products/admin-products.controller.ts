import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const MB5 = 5 * 1024 * 1024;

const thumbnailPipe = new ParseFilePipe({
  fileIsRequired: false,
  validators: [
    new MaxFileSizeValidator({ maxSize: MB5 }),
    new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
  ],
});

@ApiBearerAuth()
@ApiTags('Admin - Products')
@Roles(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Tạo sản phẩm mới (có thể kèm ảnh thumbnail)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'price', 'stockQuantity'],
      properties: {
        name: { type: 'string', example: 'Bánh flan caramel' },
        slug: { type: 'string', example: 'banh-flan-caramel' },
        price: { type: 'number', example: 45000 },
        stockQuantity: { type: 'integer', example: 50 },
        description: { type: 'string' },
        categoryId: { type: 'string' },
        status: { type: 'integer', example: 1 },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Thumbnail (jpeg/png/webp, max 5MB)',
        },
      },
    },
  })
  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  createProduct(
    @Body() dto: CreateProductDto,
    @UploadedFile(thumbnailPipe) file?: Express.Multer.File,
  ) {
    return this.productsService.createProduct(dto, file);
  }

  @ApiOperation({ summary: 'Cập nhật sản phẩm (có thể thay ảnh thumbnail)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        price: { type: 'number' },
        stockQuantity: { type: 'integer' },
        description: { type: 'string' },
        categoryId: { type: 'string' },
        status: { type: 'integer' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Thumbnail mới (jpeg/png/webp, max 5MB)',
        },
      },
    },
  })
  @Put(':id')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile(thumbnailPipe) file?: Express.Multer.File,
  ) {
    return this.productsService.updateProduct(id, dto, file);
  }

  @ApiOperation({ summary: 'Xóa mềm sản phẩm' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @Delete(':id')
  @HttpCode(204)
  deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(id);
  }
}
