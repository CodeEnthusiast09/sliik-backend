import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateDealDto } from './create-deal.dto';

export class UpdateDealDto extends PartialType(
  OmitType(CreateDealDto, ['serviceId', 'slotsTotal'] as const),
) {}
