import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ProjectKnowledge } from './project-knowledge.entity';

const args = getMetadataArgsStorage();
const table = args.tables.find((t) => t.target === ProjectKnowledge);
const columns = args.columns.filter((c) => c.target === ProjectKnowledge);
const column = (property: string) => columns.find((c) => c.propertyName === property);
const relation = (property: string) =>
  args.relations.find((r) => r.target === ProjectKnowledge && r.propertyName === property);
const uniques = args.uniques.filter((u) => u.target === ProjectKnowledge);

describe('ProjectKnowledge', () => {
  it('maps to the project_knowledge table', () => {
    expect(table?.name).toBe('project_knowledge');
  });

  it('names columns in snake_case', () => {
    expect(column('projectId')?.options.name).toBe('project_id');
    expect(column('summaryMd')?.options.name).toBe('summary_md');
    expect(column('generatedAt')?.options.name).toBe('generated_at');
    expect(column('edited')?.options.name).toBeUndefined();
  });

  // One summary per project — this is the whole model: the page is a single
  // document, not a collection of blocks.
  it('allows one knowledge row per project', () => {
    expect(uniques).toHaveLength(1);
    expect(uniques[0].columns).toEqual(['projectId']);
  });

  it('defaults edited to false and summary to empty', () => {
    expect(column('edited')?.options.default).toBe(false);
    expect(column('summaryMd')?.options.default).toBe('');
  });

  it('cascades from its project', () => {
    expect(relation('project')?.options.onDelete).toBe('CASCADE');
  });
});
