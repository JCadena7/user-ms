import { IsInt, IsOptional, IsString, IsIn, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FindUserActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['post_created', 'post_published', 'comment_added', 'profile_updated', 'follow', 'like_given'])
  type?: 'post_created' | 'post_published' | 'comment_added' | 'profile_updated' | 'follow' | 'like_given';

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
