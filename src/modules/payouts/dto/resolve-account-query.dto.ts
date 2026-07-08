import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ResolveAccountQueryDto {
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @IsString()
  @Length(10, 10)
  accountNumber: string;
}
