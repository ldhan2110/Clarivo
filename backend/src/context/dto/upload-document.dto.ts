/**
 * Empty on purpose, exactly like UploadFileDto: the upload carries only the
 * binary `file` part, and declaring a body DTO is what puts the global
 * ValidationPipe in the path so a stray form field is a 400 rather than a
 * silently ignored value.
 */
export class UploadDocumentDto {}
