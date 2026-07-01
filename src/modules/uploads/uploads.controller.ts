import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { successResponse } from '../../common/utils/response.helper';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    private uploadsService: UploadsService,
    private config: ConfigService,
  ) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const maxSizeMb = this.config.getOrThrow<number>('uploads.maxSizeMb');
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds the ${maxSizeMb}MB limit`);
    }

    const data = await this.uploadsService.uploadImage(file);
    return successResponse('Image uploaded', data);
  }
}
