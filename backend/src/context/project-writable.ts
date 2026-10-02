import { ProjectErrors } from '../projects/projects.errors';
import type { Project } from '../projects/project.entity';

/**
 * Every context write goes through here. ui.md renders these controls disabled
 * on an archived project; this makes the API refuse independently, so the UI is
 * never the only thing enforcing it.
 *
 * Reuses ProjectErrors.ARCHIVED rather than defining a context-flavoured twin:
 * the reason is the project's, not the document's.
 */
export function assertProjectWritable(project: Project): void {
  if (project.status === 'archived') throw ProjectErrors.ARCHIVED({ id: project.id });
}
