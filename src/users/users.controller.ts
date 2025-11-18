import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService, UploadedFilePayload } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ParseIntPipe } from '@nestjs/common';
import { FindUsersDto } from './dto/find-users.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern('createUser')
  create(@Payload() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @MessagePattern('findAllUsers')
  findAll(@Payload() dto: FindUsersDto) {
    return this.usersService.findAll(dto);
  }

  @MessagePattern('findOneUser')
  findOne(@Payload('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @MessagePattern('findUserByUsername')
  findByUsername(@Payload('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @MessagePattern('findUserByClerkId')
  findByClerkId(@Payload('clerkId') clerkId: string) {
    return this.usersService.findByClerkId(clerkId);
  }

  @MessagePattern('updateUser')
  update(@Payload() updateUserDto: UpdateUserDto) {
    return this.usersService.update(updateUserDto.id, updateUserDto);
  }

  @MessagePattern('uploadUserAvatar')
  uploadAvatar(@Payload() payload: { userId: number; file: UploadedFilePayload }) {
    return this.usersService.uploadAvatar(payload);
  }

  @MessagePattern('uploadUserCoverImage')
  uploadCoverImage(@Payload() payload: { userId: number; file: UploadedFilePayload }) {
    return this.usersService.uploadCoverImage(payload);
  }

  @MessagePattern('removeUser')
  remove(@Payload('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
