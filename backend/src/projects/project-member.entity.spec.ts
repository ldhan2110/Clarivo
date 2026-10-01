import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ProjectMember } from './project-member.entity';

const args = getMetadataArgsStorage();
const table = args.tables.find((t) => t.target === ProjectMember);
const columns = args.columns.filter((c) => c.target === ProjectMember);
const column = (property: string) => columns.find((c) => c.propertyName === property);
const relation = (property: string) =>
  args.relations.find((r) => r.target === ProjectMember && r.propertyName === property);
const join = (property: string) =>
  args.joinColumns.find((j) => j.target === ProjectMember && j.propertyName === property);
const checks = args.checks.filter((c) => c.target === ProjectMember);
const uniques = args.uniques.filter((u) => u.target === ProjectMember);
const indices = args.indices.filter((i) => i.target === ProjectMember);

describe('ProjectMember', () => {
  it('maps to the project_members table', () => {
    expect(table?.name).toBe('project_members');
  });

  it('names every column in snake_case', () => {
    expect(column('projectId')?.options.name).toBe('project_id');
    expect(column('userId')?.options.name).toBe('user_id');
    expect(column('role')?.options.name).toBeUndefined();
  });

  it('constrains role to owner or member', () => {
    expect(checks.map((c) => c.expression)).toContain("role IN ('owner','member')");
  });

  // First composite unique in this repo: one row per person per project, which
  // is what makes "add an existing member" a 409 instead of a duplicate row.
  it('allows one membership row per person per project', () => {
    expect(uniques).toHaveLength(1);
    expect(uniques[0].columns).toEqual(['projectId', 'userId']);
  });

  // Required, not optional: every list query starts from "which projects is
  // this user in", and the composite unique leads with project_id.
  it('indexes user_id for the membership-first list query', () => {
    expect(indices.some((i) => JSON.stringify(i.columns) === JSON.stringify(['userId']))).toBe(
      true,
    );
  });

  it('cascades from its project and restricts its user', () => {
    expect(relation('project')?.options.onDelete).toBe('CASCADE');
    expect(join('project')?.name).toBe('project_id');
    expect(relation('user')?.options.onDelete).toBe('RESTRICT');
    expect(join('user')?.name).toBe('user_id');
  });
});
