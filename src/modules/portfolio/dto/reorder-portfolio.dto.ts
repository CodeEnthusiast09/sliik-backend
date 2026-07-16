import { IsArray, IsUUID } from 'class-validator';

export class ReorderPortfolioDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
