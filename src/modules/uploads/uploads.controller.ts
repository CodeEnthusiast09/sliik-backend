import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { successResponse } from '../../common/utils/response.helper';
import { detectImageMimeType } from './utils/detect-image-mime-type';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const detectedMimeType = detectImageMimeType(file.buffer);
    if (!detectedMimeType || !ALLOWED_MIME_TYPES.includes(detectedMimeType)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const data = await this.uploadsService.uploadImage(file, detectedMimeType);
    return successResponse('Image uploaded', data);
  }
}
