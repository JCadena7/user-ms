import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, IsBoolean, IsIn, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  clerkId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username?: string | null;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  passwordHash?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  rolId?: number | null;

  @IsOptional()
  @IsString()
  avatar?: string | null;

  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: Date | null;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended';

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['online', 'offline', 'away'])
  onlineStatus?: 'online' | 'offline' | 'away';
}
