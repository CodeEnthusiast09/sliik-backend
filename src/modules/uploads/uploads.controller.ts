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
import { detectAudioMimeType } from './utils/detect-audio-mime-type';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AUDIO_MIME_TYPES = ['audio/mp4', 'audio/webm'];

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const detectedMimeType = detectImageMimeType(file.buffer);
    if (
      !detectedMimeType ||
      !ALLOWED_IMAGE_MIME_TYPES.includes(detectedMimeType)
    ) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      );
    }

    const data = await this.uploadsService.uploadImage(file, detectedMimeType);
    return successResponse('Image uploaded', data);
  }

  @Post('audio')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const detectedMimeType = detectAudioMimeType(file.buffer);
    if (
      !detectedMimeType ||
      !ALLOWED_AUDIO_MIME_TYPES.includes(detectedMimeType)
    ) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_AUDIO_MIME_TYPES.join(', ')}`,
      );
    }

    const data = await this.uploadsService.uploadAudio(file, detectedMimeType);
    return successResponse('Audio uploaded', data);
  }
}
