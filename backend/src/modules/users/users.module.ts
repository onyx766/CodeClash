import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { ProfilesService } from './profiles.service';
import { RolesService } from './roles.service';
import { AdminUsersService } from './admin-users.service';
import { DatabaseModule } from '../../database/database.module';
import { SocketModule } from '../../socket/socket.module';

@Module({
  imports: [DatabaseModule, SocketModule],
  providers: [UsersService, ProfilesService, RolesService, AdminUsersService],
  controllers: [UsersController, AdminUsersController],
  exports: [UsersService],
})
export class UsersModule {}
