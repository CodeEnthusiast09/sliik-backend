import { IsString, IsNotEmpty, IsOptional, IsUrl, IsIn } from 'class-validator';
import { CATEGORY_VALUES } from '../../services/dto/create-service.dto';

export class CreatePortfolioItemDto {
  @IsUrl()
  @IsNotEmpty()
  imageUrl: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsIn(CATEGORY_VALUES)
  category: (typeof CATEGORY_VALUES)[number];

  @IsString()
  @IsOptional()
  caption?: string;
}
