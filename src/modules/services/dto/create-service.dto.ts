import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Shared with CreatePortfolioItemDto - kept here since services is the
// primary owner of "category" (mirrors categoryEnum in db/schema/services.ts).
export const CATEGORY_VALUES = [
  'hair',
  'braids',
  'wig_install',
  'makeup',
  'lashes',
  'nails',
  'barbering',
  'mens_grooming',
] as const;

export const ADD_ON_VALUES = [
  'beard_shape',
  'hot_towel',
  'eyebrow_trim',
  'deep_conditioning',
  'scalp_massage',
] as const;

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsNumber()
  @Min(1)
  durationMinutes: number;

  @IsOptional()
  @IsIn(CATEGORY_VALUES)
  category?: (typeof CATEGORY_VALUES)[number];

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ADD_ON_VALUES, { each: true })
  addOns?: (typeof ADD_ON_VALUES)[number][];
}
