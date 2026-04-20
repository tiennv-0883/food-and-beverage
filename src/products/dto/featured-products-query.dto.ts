import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum Timeframe {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class FeaturedProductsQueryDto {
  @ApiPropertyOptional({
    enum: Timeframe,
    default: Timeframe.WEEK,
    description: 'Khung thời gian thống kê',
  })
  @IsOptional()
  @IsEnum(Timeframe)
  timeframe?: Timeframe = Timeframe.WEEK;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50,
    default: 10,
    description: 'Số lượng sản phẩm trả về',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
