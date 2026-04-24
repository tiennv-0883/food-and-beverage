import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSuggestionDto {
  @ApiProperty({ example: 'Bánh mì pate trứng' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'Tôi muốn thêm bánh mì pate vào menu buổi sáng...' })
  @IsOptional()
  @IsString()
  description?: string;
}
