import { IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  // Required for password accounts (re-confirmation), verified in the service.
  // Omitted for OAuth-only accounts that have no password set.
  @IsOptional()
  @IsString()
  password?: string;
}
