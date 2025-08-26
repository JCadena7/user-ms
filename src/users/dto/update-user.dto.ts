import { PartialType } from '@nestjs/mapped-types';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';


export class UpdateUserDto extends PartialType(CreateUserDto) {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
