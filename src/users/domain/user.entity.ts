export interface Rol {
  id: number;
  nombre: string;
}

export interface UserStats {
  postsCreated: number;
  commentsApproved: number;
  usersManaged: number;
}

export interface User {
  id: number;
  clerkId: string | null;
  username: string | null;
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  rolId: number | null;
  rol: Rol | null;
  avatar: string | null;
  coverImage: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  phone: string | null;
  birthDate: Date | null;
  status: 'active' | 'inactive' | 'suspended';
  isVerified: boolean;
  onlineStatus: 'online' | 'offline' | 'away';
  lastLogin: Date | null;
  stats?: UserStats;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserInput = {
  clerkId?: string | null;
  username?: string | null;
  email: string;
  passwordHash?: string | null;
  firstName: string;
  lastName: string;
  rolId?: number | null;
  avatar?: string | null;
  coverImage?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  phone?: string | null;
  birthDate?: Date | null;
  status?: 'active' | 'inactive' | 'suspended';
  isVerified?: boolean;
  onlineStatus?: 'online' | 'offline' | 'away';
};

export type UpdateUserInput = {
  clerkId?: string | null;
  username?: string | null;
  email?: string;
  passwordHash?: string | null;
  firstName?: string;
  lastName?: string;
  rolId?: number | null;
  avatar?: string | null;
  coverImage?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  phone?: string | null;
  birthDate?: Date | null;
  status?: 'active' | 'inactive' | 'suspended';
  isVerified?: boolean;
  onlineStatus?: 'online' | 'offline' | 'away';
  lastLogin?: Date | null;
};
