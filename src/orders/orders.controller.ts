import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import type { RequestWithUser } from '../auth/guards/jwt.guard';

@ApiBearerAuth()
@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Đặt hàng từ giỏ hàng hiện tại' })
  @Post()
  @HttpCode(201)
  placeOrder(@Req() req: RequestWithUser, @Body() dto: PlaceOrderDto) {
    return this.ordersService.placeOrder(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Xem lịch sử đơn hàng của bản thân' })
  @Get('me')
  listOrders(@Req() req: RequestWithUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOrders(req.user.sub, query);
  }

  @ApiOperation({ summary: 'Xem chi tiết một đơn hàng' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @Get('me/:id')
  findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.ordersService.findOne(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Hủy đơn hàng (chỉ khi đang ở trạng thái PENDING)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @Patch(':id/cancel')
  @HttpCode(200)
  cancelOrder(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(id, req.user.sub, dto);
  }
}
