import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AppException } from './app.exception';
import { defineErrors } from './domain-errors';

const ProjectErrors = defineErrors('PROJECT', {
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Project not found' },
  NAME_TAKEN: { status: HttpStatus.CONFLICT, message: 'Project name already used' },
});

describe('defineErrors', () => {
  it('prefixes the code with the domain and keeps status, message, details', () => {
    const err = ProjectErrors.NOT_FOUND({ id: 'p1' });
    expect(err).toBeInstanceOf(AppException);
    expect(err.code).toBe('PROJECT_NOT_FOUND');
    expect(err.getStatus()).toBe(404);
    expect(err.message).toBe('Project not found');
    expect(err.details).toEqual({ id: 'p1' });
  });

  it('builds a fresh exception per call', () => {
    expect(ProjectErrors.NAME_TAKEN()).not.toBe(ProjectErrors.NAME_TAKEN());
    expect(ProjectErrors.NAME_TAKEN().code).toBe('PROJECT_NAME_TAKEN');
  });
});
