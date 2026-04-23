import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Bánh flan caramel' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'banh-flan-caramel' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ example: 45000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @ApiPropertyOptional({ example: 'Bánh flan mịn, béo ngậy...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value || undefined)
  @IsNumberString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 1, description: '1 = active, 0 = inactive' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  file?: any;
}
