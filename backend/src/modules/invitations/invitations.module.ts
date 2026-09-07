import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { DatabaseModule } from '../../database/database.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [DatabaseModule, RoomsModule],
  providers: [InvitationsService],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
