import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { envs } from '../config';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: envs.cloudinary.name,
      api_key: envs.cloudinary.apiKey,
      api_secret: envs.cloudinary.apiSecret,
    });
  }

  async uploadImage(buffer: Buffer, folder: string, filename?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const normalizedName = filename
        ? filename.toLowerCase().replace(/[^a-z0-9-_]+/g, '-')
        : undefined;

      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          overwrite: true,
          public_id: normalizedName,
        },
        (error, result) => {
          if (error || !result) {
            return reject(new InternalServerErrorException('Error al subir imagen a Cloudinary'));
          }
          resolve(result.secure_url);
        }
      );

      stream.end(buffer);
    });
  }
}
