import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { UpsertCartItemDto } from './dto/upsert-cart-item.dto';
import type { RequestWithUser } from '../auth/guards/jwt.guard';

@ApiBearerAuth()
@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: 'Xem giỏ hàng' })
  @Get()
  getCart(@Req() req: RequestWithUser) {
    return this.cartService.getCart(req.user.sub);
  }

  @ApiOperation({
    summary: 'Thêm hoặc cập nhật số lượng sản phẩm (quantity=0 để xóa)',
  })
  @ApiParam({ name: 'productId', description: 'ID sản phẩm' })
  @Put('items/:productId')
  upsertItem(
    @Req() req: RequestWithUser,
    @Param('productId') productId: string,
    @Body() dto: UpsertCartItemDto,
  ) {
    return this.cartService.upsertItem(req.user.sub, productId, dto.quantity);
  }

  @ApiOperation({ summary: 'Xóa toàn bộ giỏ hàng' })
  @Delete()
  @HttpCode(204)
  clearCart(@Req() req: RequestWithUser) {
    return this.cartService.clearCart(req.user.sub);
  }
}
