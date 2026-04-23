import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import type { RequestWithUser } from '../auth/guards/jwt.guard';

@ApiBearerAuth()
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({ summary: 'Đánh giá sản phẩm (1–5 sao)' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @Post('products/:productId')
  @HttpCode(201)
  createReview(
    @Req() req: RequestWithUser,
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(req.user.sub, productId, dto);
  }
}
