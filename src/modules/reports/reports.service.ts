import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { reports } from '../../db/schema';
import { CreateReportDto } from './dto/create-report.dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  async create(reporterId: string, dto: CreateReportDto) {
    if (dto.reportedUserId === reporterId) {
      throw new BadRequestException('You cannot report yourself');
    }

    await this.db.insert(reports).values({
      reporterId,
      reportedUserId: dto.reportedUserId,
      bookingId: dto.bookingId,
      reason: dto.reason,
    });
  }
}
