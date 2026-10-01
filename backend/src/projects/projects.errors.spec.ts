import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { ProjectDto } from './dto/project.dto';
import { ProjectSummaryDto } from './dto/project-summary.dto';
import { ProjectErrors } from './projects.errors';

describe('ProjectErrors', () => {
  it('prefixes every code with the PROJECT domain', () => {
    expect(ProjectErrors.NOT_FOUND().code).toBe('PROJECT_NOT_FOUND');
    expect(ProjectErrors.NOT_OWNER().code).toBe('PROJECT_NOT_OWNER');
    expect(ProjectErrors.CODE_TAKEN().code).toBe('PROJECT_CODE_TAKEN');
    expect(ProjectErrors.INVALID_DATE_RANGE().code).toBe('PROJECT_INVALID_DATE_RANGE');
    expect(ProjectErrors.ARCHIVED().code).toBe('PROJECT_ARCHIVED');
    expect(ProjectErrors.MEMBER_NOT_FOUND().code).toBe('PROJECT_MEMBER_NOT_FOUND');
    expect(ProjectErrors.ALREADY_MEMBER().code).toBe('PROJECT_ALREADY_MEMBER');
    expect(ProjectErrors.OWNER_NOT_REMOVABLE().code).toBe('PROJECT_OWNER_NOT_REMOVABLE');
  });

  it('carries the right status on each', () => {
    expect(ProjectErrors.NOT_FOUND().getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(ProjectErrors.NOT_OWNER().getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(ProjectErrors.CODE_TAKEN().getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ProjectErrors.INVALID_DATE_RANGE().getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(ProjectErrors.ARCHIVED().getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ProjectErrors.MEMBER_NOT_FOUND().getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(ProjectErrors.ALREADY_MEMBER().getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ProjectErrors.OWNER_NOT_REMOVABLE().getStatus()).toBe(HttpStatus.CONFLICT);
  });

  it('passes details through', () => {
    expect(ProjectErrors.NOT_FOUND({ id: 'abc' }).details).toEqual({ id: 'abc' });
  });
});

describe('project response DTOs', () => {
  const row = {
    id: 'p1',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    code: 'CLT-DevSpec',
    name: 'DevSpec',
    customerBu: 'CLT',
    domain: 'Logistics',
    objective: null,
    status: 'active',
    startsOn: '2026-01-01',
    endsOn: null,
    memberCount: 1,
    memberNames: ['An Le'],
    createdByName: 'An Le',
    viewerRole: 'owner',
    // the thing that must not survive
    createdBy: '00000000-0000-7000-8000-000000000000',
  };

  it('does not serialise createdBy on the detail DTO', () => {
    const dto = plainToInstance(ProjectDto, row, { excludeExtraneousValues: true });
    expect(dto).not.toHaveProperty('createdBy');
    expect(dto.createdByName).toBe('An Le');
  });

  it('does not serialise createdBy on the list row DTO', () => {
    const dto = plainToInstance(ProjectSummaryDto, row, { excludeExtraneousValues: true });
    expect(dto).not.toHaveProperty('createdBy');
    expect(dto.memberNames).toEqual(['An Le']);
  });

  it('keeps both dates as strings', () => {
    const dto = plainToInstance(ProjectDto, row, { excludeExtraneousValues: true });
    expect(dto.startsOn).toBe('2026-01-01');
    expect(dto.endsOn).toBeNull();
  });
});
