import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpsertCartItemDto {
  @ApiProperty({
    description: 'Số lượng sản phẩm. Đặt về 0 để xóa khỏi giỏ hàng.',
    minimum: 0,
    maximum: 999,
  })
  @IsInt()
  @Min(0)
  @Max(999)
  quantity!: number;
}
