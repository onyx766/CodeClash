import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { DatabaseModule } from '../../database/database.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SocketModule } from '../../socket/socket.module';

@Module({
  imports: [DatabaseModule, RoomsModule, SocketModule],
  providers: [InvitationsService],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
