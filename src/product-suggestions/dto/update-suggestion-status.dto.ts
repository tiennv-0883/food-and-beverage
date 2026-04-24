import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SuggestionStatus } from '../product-suggestion.entity';

const ALLOWED_STATUSES = [
  SuggestionStatus.APPROVED,
  SuggestionStatus.REJECTED,
] as const;

export type AdminUpdateStatus = (typeof ALLOWED_STATUSES)[number];

export class UpdateSuggestionStatusDto {
  @ApiProperty({
    enum: ALLOWED_STATUSES,
    description: 'APPROVED | REJECTED',
  })
  @IsEnum(ALLOWED_STATUSES)
  status!: AdminUpdateStatus;

  @ApiPropertyOptional({ example: 'Sản phẩm này đã có trong kế hoạch Q3' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
