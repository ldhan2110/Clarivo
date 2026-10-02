import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AuditDto } from '../../common/dtos/audit.dto';
import {
  KNOWLEDGE_SECTIONS,
  type KnowledgeConfidence,
  type KnowledgeKind,
  type KnowledgeOrigin,
  type KnowledgeSection,
  type KnowledgeState,
} from '../knowledge-block.entity';

/** A citation, resolved far enough that the UI can render and download it. */
export class KnowledgeRefDto {
  @Expose()
  id: string;

  @Expose()
  documentId: string;

  @Expose()
  title: string;

  /** So a chip can link straight at GET /files/:id. */
  @Expose()
  fileId: string;

  @Expose()
  locator: string | null;

  @Expose()
  quote: string;
}

export class KnowledgeBlockDto extends AuditDto {
  @Expose()
  section: KnowledgeSection;

  @Expose()
  position: number;

  @Expose()
  statement: string;

  @Expose()
  confidence: KnowledgeConfidence;

  @Expose()
  origin: KnowledgeOrigin;

  @Expose()
  state: KnowledgeState;

  @Expose()
  kind: KnowledgeKind;

  @Expose()
  supersedesId: string | null;

  @Expose()
  sourceDocumentId: string | null;

  /** Set means a human owns this wording; no document can silently replace it. */
  @Expose()
  editedAt: Date | null;

  @Expose()
  authorName: string | null;

  @Expose()
  refs: KnowledgeRefDto[];
}

/** One section of the page. Empty sections are returned, not hidden. */
export class KnowledgeSectionDto {
  @Expose()
  section: KnowledgeSection;

  @Expose()
  blocks: KnowledgeBlockDto[];
}

export class KnowledgePageDto {
  @Expose()
  sections: KnowledgeSectionDto[];

  /** Documents that became ready after the current brief was written. */
  @Expose()
  briefStaleCount: number;
}

export class CitationDto {
  @IsUUID()
  documentId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  locator?: string | null;

  @IsString()
  @IsNotEmpty()
  quote: string;
}

export class CreateBlockDto {
  @IsIn(KNOWLEDGE_SECTIONS)
  section: KnowledgeSection;

  @IsString()
  @IsNotEmpty()
  statement: string;

  @IsIn(['stated', 'implied', 'uncertain'])
  confidence: KnowledgeConfidence;

  /** A human block needs no citation — the author is the source. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CitationDto)
  refs?: CitationDto[];
}

export class UpdateBlockDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  statement?: string;

  @IsOptional()
  @IsIn(['stated', 'implied', 'uncertain'])
  confidence?: KnowledgeConfidence;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CitationDto)
  refs?: CitationDto[];
}

/** Grouped proposals, one group per document that produced them. */
export class ProposalGroupDto {
  @Expose()
  documentId: string;

  @Expose()
  documentTitle: string;

  @Expose()
  proposals: ProposalItemDto[];
}

export class ProposalItemDto extends KnowledgeBlockDto {
  /** The block this proposal updates or disagrees with, when it has one. */
  @Expose()
  target: KnowledgeBlockDto | null;
}

export class ResolveConflictDto {
  @IsOptional()
  @IsIn(['keep_existing', 'use_new', 'write_own'])
  resolution?: 'keep_existing' | 'use_new' | 'write_own';

  /** Required for write_own: the wording the human wants instead of both. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  statement?: string;
}
