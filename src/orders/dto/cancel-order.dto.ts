import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Tôi muốn thay đổi địa chỉ giao hàng' })
  @IsOptional()
  @IsString()
  reason?: string;
}
