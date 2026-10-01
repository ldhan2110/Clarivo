import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from './project-member.entity';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // The ONLY thing that registers these two entities: app.module.ts passes
    // entities: [] + autoLoadEntities: true on purpose, so registering them
    // anywhere else is a silent no-op.
    TypeOrmModule.forFeature([Project, ProjectMember]),
    UsersModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
