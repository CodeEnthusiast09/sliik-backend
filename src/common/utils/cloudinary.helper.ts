import { BadRequestException } from '@nestjs/common';

// Defends against a client submitting an arbitrary imageUrl instead of one
// actually returned by our own /uploads/image endpoint.
export function assertCloudinaryUrl(cloudName: string, imageUrl: string) {
  const allowedPrefix = `https://res.cloudinary.com/${cloudName}/`;
  if (!imageUrl.startsWith(allowedPrefix)) {
    throw new BadRequestException(
      'imageUrl must be a Cloudinary URL returned by the uploads endpoint',
    );
  }
}
