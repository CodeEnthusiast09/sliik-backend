import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePayoutAccountDto {
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;
}
