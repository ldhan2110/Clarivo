import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ProjectDocument } from './project-document.entity';

const args = getMetadataArgsStorage();
const table = args.tables.find((t) => t.target === ProjectDocument);
const columns = args.columns.filter((c) => c.target === ProjectDocument);
const column = (property: string) => columns.find((c) => c.propertyName === property);
const relation = (property: string) =>
  args.relations.find((r) => r.target === ProjectDocument && r.propertyName === property);
const join = (property: string) =>
  args.joinColumns.find((j) => j.target === ProjectDocument && j.propertyName === property);
const checks = args.checks.filter((c) => c.target === ProjectDocument);
const indices = args.indices.filter((i) => i.target === ProjectDocument);

describe('ProjectDocument', () => {
  it('maps to the project_documents table', () => {
    expect(table?.name).toBe('project_documents');
  });

  it('names every column in snake_case', () => {
    expect(column('projectId')?.options.name).toBe('project_id');
    expect(column('sourceType')?.options.name).toBe('source_type');
    expect(column('fileId')?.options.name).toBe('file_id');
    expect(column('extractedText')?.options.name).toBe('extracted_text');
    expect(column('failureReason')?.options.name).toBe('failure_reason');
    expect(column('processedAt')?.options.name).toBe('processed_at');
    expect(column('uploadedBy')?.options.name).toBe('uploaded_by');
  });

  it('makes file_id, url, extracted_text, failure_reason, processed_at nullable', () => {
    for (const p of ['fileId', 'url', 'extractedText', 'failureReason', 'processedAt']) {
      expect(column(p)?.options.nullable).toBe(true);
    }
  });

  it('defaults status to new', () => {
    expect(column('status')?.options.default).toBe('new');
  });

  it('constrains source_type and status, and enforces doc-XOR-web', () => {
    const exprs = checks.map((c) => c.expression);
    expect(exprs).toContain("source_type IN ('doc','web')");
    expect(exprs).toContain("status IN ('new','processing','processed','failed')");
    expect(exprs.some((e) => e?.includes('file_id IS NOT NULL AND url IS NULL'))).toBe(true);
  });

  it('indexes project_id for the per-project source list', () => {
    expect(indices.some((i) => JSON.stringify(i.columns) === JSON.stringify(['projectId']))).toBe(
      true,
    );
  });

  it('cascades from its project, restricts its file and uploader', () => {
    expect(relation('project')?.options.onDelete).toBe('CASCADE');
    expect(join('project')?.name).toBe('project_id');
    expect(relation('file')?.options.onDelete).toBe('RESTRICT');
    expect(join('file')?.name).toBe('file_id');
    expect(relation('uploadedByUser')?.options.onDelete).toBe('RESTRICT');
    expect(join('uploadedByUser')?.name).toBe('uploaded_by');
  });
});
