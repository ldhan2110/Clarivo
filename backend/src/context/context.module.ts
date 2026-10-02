import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { ContextController } from './context.controller';
import { BriefGenerator } from './brief-generator';
import { ContextPipeline } from './context.pipeline';
import { ContextService } from './context.service';
import { ProposalGenerator } from './proposal-generator';
import { ProposalsService } from './proposals.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import { ProjectDocument } from './project-document.entity';

@Module({
  imports: [
    // The ONLY thing that registers these three entities: app.module.ts passes
    // entities: [] + autoLoadEntities: true on purpose, so registering them
    // anywhere else is a silent no-op.
    TypeOrmModule.forFeature([ProjectDocument, KnowledgeBlock, KnowledgeRef]),
    // FilesModule for FilesService and the multer config the upload reuses.
    FilesModule,
    ProjectsModule,
    UsersModule,
    AiModule,
  ],
  controllers: [ContextController, KnowledgeController],
  providers: [ContextService, ContextPipeline, ProposalGenerator, ProposalsService, KnowledgeService, BriefGenerator],
  exports: [ContextService],
})
export class ContextModule {}
