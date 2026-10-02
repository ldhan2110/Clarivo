import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Rename only — a document's file, project and history are never reassigned. */
export class RenameDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;
}
