import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductSuggestion } from "./product-suggestion.entity";

@Module({
  imports: [TypeOrmModule.forFeature([ProductSuggestion])],
  exports: [TypeOrmModule],
})
export class ProductSuggestionsModule {}
