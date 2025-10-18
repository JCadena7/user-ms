import { Module } from '@nestjs/common';
import { UserActivitiesService } from './user-activities.service';
import { UserActivitiesController } from './user-activities.controller';
import { PgUserActivityRepository } from './infrastructure/pg-user-activity.repository';
import { USER_ACTIVITY_REPOSITORY } from './domain/user-activity.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [UserActivitiesController],
  providers: [
    UserActivitiesService,
    {
      provide: USER_ACTIVITY_REPOSITORY,
      useClass: PgUserActivityRepository,
    },
  ],
  exports: [UserActivitiesService, USER_ACTIVITY_REPOSITORY],
})
export class UserActivitiesModule {}
