import { IsInt, IsNotEmpty, IsOptional, IsString, IsIn, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserActivityDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['post_created', 'post_published', 'comment_added', 'profile_updated', 'follow', 'like_given'])
  type!: 'post_created' | 'post_published' | 'comment_added' | 'profile_updated' | 'follow' | 'like_given';

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  target?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;
}
