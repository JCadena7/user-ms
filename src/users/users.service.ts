import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { USER_REPOSITORY } from './domain/user.repository';
import type { UserRepository } from './domain/user.repository';
import { FindUsersDto } from './dto/find-users.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

export interface UploadedFilePayload {
  buffer: Buffer | Uint8Array | { data: number[] } | number[];
  mimetype?: string;
  originalname?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private toBuffer(input: UploadedFilePayload['buffer']): Buffer | null {
    if (!input) return null;
    if (Buffer.isBuffer(input)) return input;
    if (input instanceof Uint8Array) return Buffer.from(input);
    if (Array.isArray(input)) return Buffer.from(input);
    if (typeof (input as any)?.data !== 'undefined') {
      return Buffer.from((input as any).data);
    }
    return null;
  }

  async uploadAvatar(payload: { userId: number; file: UploadedFilePayload }) {
    const { userId, file } = payload;
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const buffer = this.toBuffer(file?.buffer);
    if (!buffer) throw new BadRequestException('Archivo inválido');

    const secureUrl = await this.cloudinary.uploadImage(
      buffer,
      `users/${userId}`,
      file?.originalname ?? `user-${userId}-avatar`,
    );

    await this.repo.update(userId, { avatar: secureUrl } as any);
    return this.repo.findById(userId);
  }

  async uploadCoverImage(payload: { userId: number; file: UploadedFilePayload }) {
    const { userId, file } = payload;
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const buffer = this.toBuffer(file?.buffer);
    if (!buffer) throw new BadRequestException('Archivo inválido');

    const secureUrl = await this.cloudinary.uploadImage(
      buffer,
      `users/${userId}`,
      file?.originalname ?? `user-${userId}-cover`,
    );

    await this.repo.update(userId, { coverImage: secureUrl } as any);
    return this.repo.findById(userId);
  }

  async create(createUserDto: CreateUserDto) {
    // Validar email único
    const existingEmail = await this.repo.findByEmail(createUserDto.email);
    if (existingEmail) throw new ConflictException('El email ya está registrado');

    // Validar username único si se proporciona
    if (createUserDto.username) {
      const existingUsername = await this.repo.findByUsername(createUserDto.username);
      if (existingUsername) throw new ConflictException('El username ya está en uso');
    }

    // Validar clerkId único si se proporciona
    if (createUserDto.clerkId) {
      const existingClerkId = await this.repo.findByClerkId(createUserDto.clerkId);
      if (existingClerkId) throw new ConflictException('El clerkId ya está registrado');
    }

    return this.repo.create({
      clerkId: createUserDto.clerkId ?? null,
      username: createUserDto.username ?? null,
      email: createUserDto.email,
      passwordHash: createUserDto.passwordHash ?? null,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      rolId: createUserDto.rolId ?? null,
      avatar: createUserDto.avatar ?? null,
      coverImage: createUserDto.coverImage ?? null,
      bio: createUserDto.bio ?? null,
      website: createUserDto.website ?? null,
      location: createUserDto.location ?? null,
      phone: createUserDto.phone ?? null,
      birthDate: createUserDto.birthDate ?? null,
      status: createUserDto.status ?? 'active',
      isVerified: createUserDto.isVerified ?? false,
      onlineStatus: createUserDto.onlineStatus ?? 'offline',
    });
  }

  async findAll(params: FindUsersDto) {
    const result = await this.repo.findMany({
      page: params.page,
      limit: params.limit,
      orderBy: params.orderBy,
      order: params.order,
      search: params.search,
      email: params.email,
      nombre: params.nombre,
      username: params.username,
      clerkId: params.clerkId,
      rolId: params.rolId,
      status: params.status,
      isVerified: params.isVerified,
    });
    if (typeof params.page === 'number' && params.page > 0) {
      return result; // objeto paginado { data, total, page, limit }
    }
    return result.data; // lista simple sin paginación
  }

  async findOne(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.repo.findByUsername(username);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findByClerkId(clerkId: string) {
    const user = await this.repo.findByClerkId(clerkId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      return await this.repo.update(id, {
        clerkId: updateUserDto.clerkId,
        username: updateUserDto.username,
        email: updateUserDto.email,
        passwordHash: updateUserDto.passwordHash,
        firstName: updateUserDto.firstName,
        lastName: updateUserDto.lastName,
        rolId: updateUserDto.rolId,
        avatar: updateUserDto.avatar,
        coverImage: updateUserDto.coverImage,
        bio: updateUserDto.bio,
        website: updateUserDto.website,
        location: updateUserDto.location,
        phone: updateUserDto.phone,
        birthDate: updateUserDto.birthDate,
        status: updateUserDto.status,
        isVerified: updateUserDto.isVerified,
        onlineStatus: updateUserDto.onlineStatus,
        lastLogin: updateUserDto.lastLogin,
      });
    } catch (e) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async remove(id: number) {
    const removed = await this.repo.remove(id);
    if (!removed) throw new NotFoundException('Usuario no encontrado');
    return removed;
  }
}
