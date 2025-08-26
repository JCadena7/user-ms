import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { USER_REPOSITORY } from './domain/user.repository';
import { PgUserRepository } from './infrastructure/pg-user.repository';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    PgUserRepository,
    { provide: USER_REPOSITORY, useExisting: PgUserRepository },
  ],
})
export class UsersModule {}
