/**
 * The avatar upload carries only the binary `file` part, which multer takes off
 * the body before validation sees it. Declaring an empty body DTO is what puts
 * the global ValidationPipe in the path: with `forbidNonWhitelisted` on, any
 * extra form field is a 400 rather than a silently ignored value. Mirrors
 * files/dto/upload-file.dto.ts.
 */
export class UploadAvatarDto {}
