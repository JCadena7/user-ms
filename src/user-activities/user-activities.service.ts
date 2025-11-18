import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserActivityDto } from './dto/create-user-activity.dto';
import { FindUserActivitiesDto } from './dto/find-user-activities.dto';
import * as userActivityRepository from './domain/user-activity.repository';

@Injectable()
export class UserActivitiesService {
  constructor(
    @Inject(userActivityRepository.USER_ACTIVITY_REPOSITORY)
    private readonly repo: userActivityRepository.UserActivityRepository,
  ) {}

  async create(createUserActivityDto: CreateUserActivityDto) {
    return this.repo.create({
      userId: createUserActivityDto.userId,
      type: createUserActivityDto.type,
      description: createUserActivityDto.description,
      target: createUserActivityDto.target ?? null,
      content: createUserActivityDto.content ?? null,
      metadata: createUserActivityDto.metadata ?? null,
    });
  }

  async findAll(params: FindUserActivitiesDto) {
    const result = await this.repo.findMany({
      userId: params.userId,
      type: params.type,
      startDate: params.startDate,
      endDate: params.endDate,
      page: params.page,
      limit: params.limit,
    });

    if (typeof params.page === 'number' && params.page > 0) {
      return result; // objeto paginado { data, total, page, limit }
    }
    return result.data; // lista simple sin paginación
  }

  async findByUserId(userId: number, params?: FindUserActivitiesDto) {
    const result = await this.repo.findByUserId(userId, {
      type: params?.type,
      startDate: params?.startDate,
      endDate: params?.endDate,
      page: params?.page,
      limit: params?.limit,
    });

    if (typeof params?.page === 'number' && params.page > 0) {
      return result;
    }
    return result.data;
  }

  async findOne(id: string) {
    const activity = await this.repo.findById(id);
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  async remove(id: string) {
    const deleted = await this.repo.deleteById(id);
    if (!deleted) throw new NotFoundException('Actividad no encontrada');
    return { deleted: true };
  }

  async removeByUserId(userId: number) {
    const count = await this.repo.deleteByUserId(userId);
    return { deleted: count };
  }
}
