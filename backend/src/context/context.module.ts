import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectDocument } from './project-document.entity';
import { ProjectKnowledge } from './project-knowledge.entity';
import { Project } from '../projects/project.entity';
import { ContextController } from './context.controller';
import { ContextService } from './context.service';
import { DocumentParser } from './document-parser';
import { AiClient } from './ai-client';
import { WebResearch } from './web-research';
import { FilesModule } from '../files/files.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    // The ONLY place these entities register — app.module uses entities: [] +
    // autoLoadEntities, so forFeature here is what makes the repos injectable.
    // Project is also registered in ProjectsModule; forFeature per-module is fine.
    TypeOrmModule.forFeature([ProjectDocument, ProjectKnowledge, Project]),
    FilesModule,
    ProjectsModule,
  ],
  controllers: [ContextController],
  providers: [ContextService, DocumentParser, AiClient, WebResearch],
  exports: [ContextService],
})
export class ContextModule {}
