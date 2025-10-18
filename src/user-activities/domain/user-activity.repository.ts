import { CreateUserActivityInput, FindUserActivitiesParams, UserActivity } from './user-activity.entity';

export interface UserActivityRepository {
  create(data: CreateUserActivityInput): Promise<UserActivity>;
  findById(id: string): Promise<UserActivity | null>;
  findByUserId(userId: number, params?: FindUserActivitiesParams): Promise<{ data: UserActivity[]; total?: number; page?: number; limit?: number }>;
  findMany(params: FindUserActivitiesParams): Promise<{ data: UserActivity[]; total?: number; page?: number; limit?: number }>;
  deleteById(id: string): Promise<boolean>;
  deleteByUserId(userId: number): Promise<number>; // Retorna cantidad eliminada
}

export const USER_ACTIVITY_REPOSITORY = Symbol('USER_ACTIVITY_REPOSITORY');
