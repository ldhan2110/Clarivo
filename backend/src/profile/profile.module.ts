import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

/**
 * A leaf module on purpose. The avatar endpoint needs FilesModule (FilesService
 * + its exported multer config); importing that into UsersModule would close
 * the cycle Users→Files→Projects→Users and force forwardRef. ProfileModule
 * imports both instead and nothing imports it back. The routes still live at
 * /users/me — the controller path string is independent of this module's name.
 */
@Module({
  imports: [UsersModule, FilesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
