import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

@Global()
@Module({
  imports: [],
  providers: [],
  controllers: [AuthController],
})
export class AuthModule {}
