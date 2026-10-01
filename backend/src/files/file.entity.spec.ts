import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { FileEntity } from './file.entity';

/**
 * Reads the decorator arguments directly. Building real entity metadata needs
 * an initialised DataSource; the decorator args are enough to assert the thing
 * that actually breaks here — a forgotten `name:`.
 */
const args = getMetadataArgsStorage();
const table = args.tables.find((t) => t.target === FileEntity);
const columns = args.columns.filter((c) => c.target === FileEntity);
const column = (property: string) => columns.find((c) => c.propertyName === property);
const relation = (property: string) =>
  args.relations.find((r) => r.target === FileEntity && r.propertyName === property);
const join = (property: string) =>
  args.joinColumns.find((j) => j.target === FileEntity && j.propertyName === property);

describe('FileEntity', () => {
  it('maps to the files table', () => {
    expect(table?.name).toBe('files');
  });

  it('generates a v7 uuid id on insert', () => {
    const file = new FileEntity();
    file.generateId();
    expect(file.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('keeps an id it was already given', () => {
    const file = new FileEntity();
    file.id = 'preset';
    file.generateId();
    expect(file.id).toBe('preset');
  });

  // Guards the easiest mistake in this repo: no naming strategy is configured,
  // so a forgotten `name:` ships the column as camelCase.
  it('names every column in snake_case', () => {
    expect(column('storageKey')?.options.name).toBe('storage_key');
    expect(column('originalName')?.options.name).toBe('original_name');
    expect(column('mimeType')?.options.name).toBe('mime_type');
    expect(column('sizeBytes')?.options.name).toBe('size_bytes');
    expect(column('uploadedBy')?.options.name).toBe('uploaded_by');
  });

  it('stores the size as an int, never a bigint', () => {
    expect(column('sizeBytes')?.options.type).toBe('int');
  });

  it('makes storage_key unique', () => {
    expect(column('storageKey')?.options.unique).toBe(true);
  });

  it('restricts deletion of the uploading user', () => {
    expect(relation('uploader')?.options.onDelete).toBe('RESTRICT');
    expect(join('uploader')?.name).toBe('uploaded_by');
  });

  it('declares no owner column — the consumer brings its own FK', () => {
    const names = columns.map((c) => c.options.name);
    expect(names).not.toContain('owner_id');
    expect(names).not.toContain('owner_type');
    expect(names).not.toContain('project_id');
  });
});
