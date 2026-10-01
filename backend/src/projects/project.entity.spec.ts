import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { Project } from './project.entity';

/**
 * Reads the decorator arguments directly. Building real entity metadata needs
 * an initialised DataSource; the decorator args are enough to assert the thing
 * that actually breaks here — a forgotten `name:`.
 */
const args = getMetadataArgsStorage();
const table = args.tables.find((t) => t.target === Project);
const columns = args.columns.filter((c) => c.target === Project);
const column = (property: string) => columns.find((c) => c.propertyName === property);
const relation = (property: string) =>
  args.relations.find((r) => r.target === Project && r.propertyName === property);
const join = (property: string) =>
  args.joinColumns.find((j) => j.target === Project && j.propertyName === property);
const checks = args.checks.filter((c) => c.target === Project);

describe('Project', () => {
  it('maps to the projects table', () => {
    expect(table?.name).toBe('projects');
  });

  it('generates a v7 uuid id on insert', () => {
    const project = new Project();
    project.generateId();
    expect(project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  // Guards the easiest mistake in this repo: no naming strategy is configured,
  // so a forgotten `name:` ships the column as camelCase.
  it('names every multi-word column in snake_case', () => {
    expect(column('customerBu')?.options.name).toBe('customer_bu');
    expect(column('startsOn')?.options.name).toBe('starts_on');
    expect(column('endsOn')?.options.name).toBe('ends_on');
    expect(column('createdBy')?.options.name).toBe('created_by');
  });

  it('leaves single-word columns at their property name', () => {
    for (const property of ['code', 'name', 'domain', 'objective', 'status']) {
      expect(column(property)).toBeDefined();
      expect(column(property)?.options.name).toBeUndefined();
    }
  });

  it('makes code uniquely identifying, at 64 chars', () => {
    expect(column('code')?.options.unique).toBe(true);
    expect(column('code')?.options.length).toBe(64);
  });

  it('defaults status to active and constrains it to the two known values', () => {
    expect(column('status')?.options.default).toBe('active');
    expect(checks.map((c) => c.expression)).toContain("status IN ('active','archived')");
  });

  it('leaves domain unconstrained — it is customer data that grows', () => {
    expect(checks.map((c) => c.expression).join(' ')).not.toContain('domain');
  });

  it('stores both dates as date columns, nullable', () => {
    for (const property of ['startsOn', 'endsOn']) {
      expect(column(property)?.options.type).toBe('date');
      expect(column(property)?.options.nullable).toBe(true);
    }
  });

  it('restricts deletion of the creating user', () => {
    expect(relation('creator')?.options.onDelete).toBe('RESTRICT');
    expect(join('creator')?.name).toBe('created_by');
  });
});
