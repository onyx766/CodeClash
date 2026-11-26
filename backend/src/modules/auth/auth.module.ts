import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { GeolocationModule } from '../geolocation/geolocation.module';
import { RoomsModule } from '../rooms/rooms.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SocketModule } from '../../socket/socket.module';

@Module({
  imports: [UsersModule, GeolocationModule, RoomsModule, SocketModule, JwtModule.register({})],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
