import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadsService {
  constructor(private config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.getOrThrow<string>('cloudinary.cloudName'),
      api_key: this.config.getOrThrow<string>('cloudinary.apiKey'),
      api_secret: this.config.getOrThrow<string>('cloudinary.apiSecret'),
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    mimeType: string,
  ): Promise<{ url: string }> {
    const dataUri = `data:${mimeType};base64,${file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader
      .upload(dataUri, { folder: 'sliik' })
      .catch(() => {
        throw new BadRequestException('Image upload failed');
      });

    return { url: result.secure_url };
  }

  async uploadAudio(
    file: Express.Multer.File,
    mimeType: string,
  ): Promise<{ url: string }> {
    const dataUri = `data:${mimeType};base64,${file.buffer.toString('base64')}`;

    // Cloudinary has no dedicated "audio" resource type - audio-only files
    // go through the same pipeline as video, under resource_type: 'video'.
    const result = await cloudinary.uploader
      .upload(dataUri, { folder: 'sliik', resource_type: 'video' })
      .catch(() => {
        throw new BadRequestException('Audio upload failed');
      });

    return { url: result.secure_url };
  }
}
