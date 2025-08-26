import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { USER_REPOSITORY } from './domain/user.repository';
import type { UserRepository } from './domain/user.repository';
import { FindUsersDto } from './dto/find-users.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepository,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.repo.findByEmail(createUserDto.email);
    if (existing) throw new ConflictException('El email ya está registrado');
    return this.repo.create({
      clerkId: createUserDto.clerkId ?? null,
      nombre: createUserDto.nombre,
      email: createUserDto.email,
      rolId: createUserDto.rolId ?? null,
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
      clerkId: params.clerkId,
      rolId: params.rolId,
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

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      return await this.repo.update(id, {
        clerkId: updateUserDto.clerkId,
        nombre: updateUserDto.nombre,
        email: updateUserDto.email,
        rolId: updateUserDto.rolId,
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
