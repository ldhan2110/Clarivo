import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

/** Every field optional, same validation as create. */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
