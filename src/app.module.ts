import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { UserActivitiesModule } from './user-activities/user-activities.module';

@Module({
  imports: [UsersModule, DatabaseModule, UserActivitiesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
