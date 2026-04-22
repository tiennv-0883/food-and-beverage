import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class PlaceOrderDto {
  @ApiProperty({ example: '123 Nguyễn Chí Thanh, Hải Châu, TP.ĐN' })
  @IsString()
  @IsNotEmpty()
  shippingAddress!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @Matches(/^[0-9]{10,11}$/, { message: 'Phone number must be 10-11 digits' })
  phone!: string;

  @ApiPropertyOptional({ example: 'Giao giờ hành chính' })
  @IsOptional()
  @IsString()
  note?: string;
}
