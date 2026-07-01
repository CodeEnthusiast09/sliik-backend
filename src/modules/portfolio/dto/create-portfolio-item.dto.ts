import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreatePortfolioItemDto {
  @IsUrl()
  @IsNotEmpty()
  imageUrl: string;

  @IsString()
  @IsOptional()
  caption?: string;
}
