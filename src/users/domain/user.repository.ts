import { CreateUserInput, UpdateUserInput, User } from './user.entity';

export interface UserRepository {
  create(data: CreateUserInput): Promise<User>;
  findAll(): Promise<User[]>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByClerkId(clerkId: string): Promise<User | null>;
  update(id: number, data: UpdateUserInput): Promise<User>;
  remove(id: number): Promise<User | null>;
  findMany(params: {
    page?: number;
    limit?: number;
    orderBy?: 'id' | 'first_name' | 'last_name' | 'email' | 'username' | 'created_at' | 'status';
    order?: 'asc' | 'desc';
    search?: string;
    email?: string;
    nombre?: string; // Busca en firstName y lastName
    username?: string;
    clerkId?: string;
    rolId?: number;
    status?: 'active' | 'inactive' | 'suspended';
    isVerified?: boolean;
  }): Promise<{ data: User[]; total?: number; page?: number; limit?: number }>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
