import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { UserActivitiesModule } from './user-activities/user-activities.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [UsersModule, DatabaseModule, UserActivitiesModule, CloudinaryModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
