import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { KNOWLEDGE_SECTIONS, type KnowledgeSection } from './knowledge-block.entity';

/**
 * Every AI response is an object, never a bare array: most providers' JSON mode
 * requires an object root, so a list always arrives as a property.
 */
export class SummaryDto {
  @IsString()
  @IsNotEmpty()
  summary: string;
}

export class ProposalDto {
  @IsIn(['add', 'update', 'conflict'])
  kind: 'add' | 'update' | 'conflict';

  @IsIn(KNOWLEDGE_SECTIONS)
  section: KnowledgeSection;

  @IsString()
  @IsNotEmpty()
  statement: string;

  @IsIn(['stated', 'implied', 'uncertain'])
  confidence: 'stated' | 'implied' | 'uncertain';

  /** Required for update and conflict; the server re-checks the pairing. */
  @IsOptional()
  @IsString()
  supersedesId?: string | null;

  /** Checked verbatim against the extracted text before anything is persisted. */
  @IsString()
  @IsNotEmpty()
  quote: string;

  @IsOptional()
  @IsString()
  locator?: string | null;
}

export class ProposalsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalDto)
  proposals: ProposalDto[];
}
