import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { firstValueFrom } from 'rxjs';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { providerPayoutAccounts, providerProfiles } from '../../db/schema';
import { CreatePayoutAccountDto } from './dto/create-payout-account.dto';

type Db = NodePgDatabase<typeof schema>;

export interface PaystackBank {
  name: string;
  code: string;
}

interface PaystackBankListResponse {
  data: PaystackBank[];
}

interface PaystackSubaccountResponse {
  data: {
    subaccount_code: string;
    account_name: string;
  };
}

interface PaystackResolveAccountResponse {
  data: {
    account_number: string;
    account_name: string;
  };
}

@Injectable()
export class PayoutsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private config: ConfigService,
    private http: HttpService,
  ) {}

  private async getProviderProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Provider profile not found');
    return profile;
  }

  async getMyPayoutAccount(userId: string) {
    const provider = await this.getProviderProfile(userId);
    return this.db.query.providerPayoutAccounts.findFirst({
      where: eq(providerPayoutAccounts.providerId, provider.id),
    });
  }

  async getBankList() {
    const { data } = await firstValueFrom(
      this.http.get<PaystackBankListResponse>(
        'https://api.paystack.co/bank?currency=NGN',
        {
          headers: {
            Authorization: `Bearer ${this.config.getOrThrow('paystack.secretKey')}`,
          },
        },
      ),
    );
    return data.data;
  }

  // Live account-name lookup for the mobile payout-setup form, so a provider sees
  // whose account they're about to save BEFORE creating the subaccount - purely a
  // read against Paystack, nothing persisted here (persisting/verifying happens in
  // createPayoutAccount below, same as before this method existed).
  async resolveAccountName(bankCode: string, accountNumber: string) {
    const { data } = await firstValueFrom(
      this.http.get<PaystackResolveAccountResponse>(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.getOrThrow('paystack.secretKey')}`,
          },
        },
      ),
    ).catch(() => {
      throw new BadRequestException(
        'Could not resolve this account - check the account number and bank',
      );
    });

    return { accountName: data.data.account_name };
  }

  async createPayoutAccount(userId: string, dto: CreatePayoutAccountDto) {
    const provider = await this.getProviderProfile(userId);

    const existing = await this.db.query.providerPayoutAccounts.findFirst({
      where: eq(providerPayoutAccounts.providerId, provider.id),
    });
    if (existing) {
      throw new ConflictException('Payout account already set up');
    }

    // NOTE: Paystack's docs conflict on which side percentage_charge applies to -
    // some say it's the platform's cut, others say it's the subaccount's cut.
    // Using the platform's-cut interpretation here. This MUST be confirmed against
    // a real test transaction's settlement breakdown before this is trusted in prod.
    const platformCommissionPercent = this.config.getOrThrow<number>(
      'payout.platformCommissionPercent',
    );

    const { data } = await firstValueFrom(
      this.http.post<PaystackSubaccountResponse>(
        'https://api.paystack.co/subaccount',
        {
          business_name: provider.fullName,
          settlement_bank: dto.bankCode,
          account_number: dto.accountNumber,
          percentage_charge: platformCommissionPercent,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.getOrThrow('paystack.secretKey')}`,
          },
        },
      ),
    ).catch(() => {
      throw new BadRequestException(
        'Could not create payout account - check the bank code and account number',
      );
    });

    const [account] = await this.db
      .insert(providerPayoutAccounts)
      .values({
        providerId: provider.id,
        paystackSubaccountCode: data.data.subaccount_code,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName: data.data.account_name,
        verified: true,
      })
      .returning();

    return account;
  }

  async assertProviderPayable(providerId: string) {
    const account = await this.db.query.providerPayoutAccounts.findFirst({
      where: eq(providerPayoutAccounts.providerId, providerId),
    });
    if (!account || !account.verified) {
      throw new BadRequestException(
        'This provider has not completed payout setup yet',
      );
    }
    return account;
  }
}
