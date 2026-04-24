import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductSuggestion } from './product-suggestion.entity';
import { ProductSuggestionsService } from './product-suggestions.service';
import { ProductSuggestionsController } from './product-suggestions.controller';
import { AdminSuggestionsController } from './admin-suggestions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductSuggestion])],
  providers: [ProductSuggestionsService],
  controllers: [ProductSuggestionsController, AdminSuggestionsController],
  exports: [TypeOrmModule],
})
export class ProductSuggestionsModule {}
