import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_SECTIONS, KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import { NON_TERMINAL_STATUSES, ProjectDocument } from './project-document.entity';

/**
 * Reads the decorator arguments directly, the way file.entity.spec.ts does:
 * building real metadata needs an initialised DataSource, and the decorator
 * args already cover the mistake that actually happens here — no naming
 * strategy is configured, so a forgotten `name:` ships a camelCase column.
 */
const args = getMetadataArgsStorage();
const table = (target: Function) => args.tables.find((t) => t.target === target);
const columns = (target: Function) => args.columns.filter((c) => c.target === target);
const column = (target: Function, property: string) =>
  columns(target).find((c) => c.propertyName === property);
const relation = (target: Function, property: string) =>
  args.relations.find((r) => r.target === target && r.propertyName === property);
const join = (target: Function, property: string) =>
  args.joinColumns.find((j) => j.target === target && j.propertyName === property);
const checks = (target: Function) =>
  args.checks.filter((c) => c.target === target).map((c) => c.expression);
const indices = (target: Function) => args.indices.filter((i) => i.target === target);

describe('ProjectDocument', () => {
  it('maps to the project_documents table', () => {
    expect(table(ProjectDocument)?.name).toBe('project_documents');
  });

  it('names every column in snake_case', () => {
    expect(column(ProjectDocument, 'projectId')?.options.name).toBe('project_id');
    expect(column(ProjectDocument, 'fileId')?.options.name).toBe('file_id');
    expect(column(ProjectDocument, 'charCount')?.options.name).toBe('char_count');
    expect(column(ProjectDocument, 'uploadedBy')?.options.name).toBe('uploaded_by');
  });

  it('makes file_id unique — one file backs at most one document', () => {
    expect(column(ProjectDocument, 'fileId')?.options.unique).toBe(true);
  });

  it('defaults status to pending and checks every value the pipeline writes', () => {
    expect(column(ProjectDocument, 'status')?.options.default).toBe('pending');
    const check = checks(ProjectDocument).find((e) => e.includes('status IN'));
    for (const status of [...NON_TERMINAL_STATUSES, 'ready', 'failed', 'archived']) {
      expect(check).toContain(`'${status}'`);
    }
  });

  it('leaves error, char_count and digest nullable', () => {
    expect(column(ProjectDocument, 'error')?.options.nullable).toBe(true);
    expect(column(ProjectDocument, 'charCount')?.options.nullable).toBe(true);
    expect(column(ProjectDocument, 'digest')?.options.nullable).toBe(true);
  });

  it('counts characters as an int, never a bigint', () => {
    expect(column(ProjectDocument, 'charCount')?.options.type).toBe('int');
  });

  it('cascades from the project but restricts the file and the uploader', () => {
    expect(relation(ProjectDocument, 'project')?.options.onDelete).toBe('CASCADE');
    expect(relation(ProjectDocument, 'file')?.options.onDelete).toBe('RESTRICT');
    expect(relation(ProjectDocument, 'uploader')?.options.onDelete).toBe('RESTRICT');
    expect(join(ProjectDocument, 'file')?.name).toBe('file_id');
  });

  it('stores no extracted text — only the digest is persisted', () => {
    const names = columns(ProjectDocument).map((c) => c.options.name ?? c.propertyName);
    expect(names).not.toContain('extracted_text');
  });
});

describe('KnowledgeBlock', () => {
  it('maps to the knowledge_blocks table', () => {
    expect(table(KnowledgeBlock)?.name).toBe('knowledge_blocks');
  });

  it('names every column in snake_case', () => {
    expect(column(KnowledgeBlock, 'projectId')?.options.name).toBe('project_id');
    expect(column(KnowledgeBlock, 'supersedesId')?.options.name).toBe('supersedes_id');
    expect(column(KnowledgeBlock, 'sourceDocumentId')?.options.name).toBe('source_document_id');
    expect(column(KnowledgeBlock, 'editedAt')?.options.name).toBe('edited_at');
    expect(column(KnowledgeBlock, 'createdBy')?.options.name).toBe('created_by');
  });

  it('checks all nine sections', () => {
    const check = checks(KnowledgeBlock).find((e) => e.includes('section IN'));
    expect(KNOWLEDGE_SECTIONS).toHaveLength(9);
    for (const section of KNOWLEDGE_SECTIONS) expect(check).toContain(`'${section}'`);
  });

  it('checks confidence, origin, state and kind', () => {
    const all = checks(KnowledgeBlock).join(' ');
    for (const value of [
      'stated',
      'implied',
      'uncertain',
      'ai',
      'human',
      'proposed',
      'accepted',
      'rejected',
      'superseded',
      'add',
      'update',
      'conflict',
    ]) {
      expect(all).toContain(`'${value}'`);
    }
  });

  it('pairs kind with supersedes_id so a dangling update cannot exist', () => {
    const check = checks(KnowledgeBlock).find((e) => e.includes('supersedes_id IS NULL'));
    expect(check).toContain("kind = 'add'");
    expect(check).toContain('supersedes_id IS NOT NULL');
  });

  it('indexes (project_id, state) — the page and review queries', () => {
    const index = indices(KnowledgeBlock)[0];
    expect(index?.columns).toEqual(['projectId', 'state']);
  });

  it('defaults a new row to a proposed add', () => {
    expect(column(KnowledgeBlock, 'state')?.options.default).toBe('proposed');
    expect(column(KnowledgeBlock, 'kind')?.options.default).toBe('add');
    expect(column(KnowledgeBlock, 'position')?.options.default).toBe(0);
  });

  it('cascades from the project and restricts history', () => {
    expect(relation(KnowledgeBlock, 'project')?.options.onDelete).toBe('CASCADE');
    expect(relation(KnowledgeBlock, 'supersedes')?.options.onDelete).toBe('RESTRICT');
    expect(relation(KnowledgeBlock, 'sourceDocument')?.options.onDelete).toBe('RESTRICT');
    expect(relation(KnowledgeBlock, 'creator')?.options.onDelete).toBe('RESTRICT');
  });

  it('leaves supersedes_id, source_document_id and edited_at nullable', () => {
    expect(column(KnowledgeBlock, 'supersedesId')?.options.nullable).toBe(true);
    expect(column(KnowledgeBlock, 'sourceDocumentId')?.options.nullable).toBe(true);
    expect(column(KnowledgeBlock, 'editedAt')?.options.nullable).toBe(true);
  });

  it('has no isDiagram column — a diagram is a mermaid fence in the statement', () => {
    const names = columns(KnowledgeBlock).map((c) => c.options.name ?? c.propertyName);
    expect(names).not.toContain('is_diagram');
  });
});

describe('KnowledgeRef', () => {
  it('maps to the knowledge_refs table', () => {
    expect(table(KnowledgeRef)?.name).toBe('knowledge_refs');
  });

  it('names every column in snake_case', () => {
    expect(column(KnowledgeRef, 'blockId')?.options.name).toBe('block_id');
    expect(column(KnowledgeRef, 'documentId')?.options.name).toBe('document_id');
  });

  it('indexes both FK columns', () => {
    const indexed = indices(KnowledgeRef).flatMap((i) => (i.columns as string[]) ?? []);
    expect(indexed).toEqual(expect.arrayContaining(['blockId', 'documentId']));
  });

  it('cascades from the block but restricts the document', () => {
    expect(relation(KnowledgeRef, 'block')?.options.onDelete).toBe('CASCADE');
    expect(relation(KnowledgeRef, 'document')?.options.onDelete).toBe('RESTRICT');
  });

  it('requires a quote and allows a null locator', () => {
    expect(column(KnowledgeRef, 'quote')?.options.nullable).toBeFalsy();
    expect(column(KnowledgeRef, 'locator')?.options.nullable).toBe(true);
  });
});
