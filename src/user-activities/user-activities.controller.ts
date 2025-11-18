import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserActivitiesService } from './user-activities.service';
import { CreateUserActivityDto } from './dto/create-user-activity.dto';
import { FindUserActivitiesDto } from './dto/find-user-activities.dto';

@Controller()
export class UserActivitiesController {
  constructor(private readonly userActivitiesService: UserActivitiesService) {}

  @MessagePattern('createUserActivity')
  create(@Payload() createUserActivityDto: CreateUserActivityDto) {
    return this.userActivitiesService.create(createUserActivityDto);
  }

  @MessagePattern('findAllUserActivities')
  findAll(@Payload() dto: FindUserActivitiesDto) {
    return this.userActivitiesService.findAll(dto);
  }

  @MessagePattern('findUserActivitiesByUserId')
  findByUserId(@Payload() payload: { userId: number; params?: FindUserActivitiesDto }) {
    return this.userActivitiesService.findByUserId(payload.userId, payload.params);
  }

  @MessagePattern('findOneUserActivity')
  findOne(@Payload('id') id: string) {
    return this.userActivitiesService.findOne(id);
  }

  @MessagePattern('removeUserActivity')
  remove(@Payload('id') id: string) {
    return this.userActivitiesService.remove(id);
  }

  @MessagePattern('removeUserActivitiesByUserId')
  removeByUserId(@Payload('userId') userId: number) {
    return this.userActivitiesService.removeByUserId(userId);
  }
}
