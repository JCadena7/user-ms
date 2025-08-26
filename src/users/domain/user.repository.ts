import { CreateUserInput, UpdateUserInput, User } from './user.entity';

export interface UserRepository {
  create(data: CreateUserInput): Promise<User>;
  findAll(): Promise<User[]>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: number, data: UpdateUserInput): Promise<User>;
  remove(id: number): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
