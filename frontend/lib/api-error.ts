import { isAxiosError } from "axios";

/** Shown whenever the server's own message is not user-facing copy. */
export const GENERIC_API_ERROR = "Something went wrong. Please try again.";

/** The backend's one error shape — `app-exception.filter.ts`. */
type ErrorEnvelope = {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: string[];
};

/**
 * Turns anything thrown by a mutation into a sentence a user can read.
 *
 * A 4xx carries a message written for the user, so it is rendered. A 5xx never
 * is — `AppExceptionFilter` has already replaced it with "Internal server
 * error", which is not copy — and neither is an unknown throw, whose
 * `error.message` could be any internal string.
 */
export function apiErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return GENERIC_API_ERROR;

  const status = error.response?.status;
  if (status === undefined || status >= 500) return GENERIC_API_ERROR;

  const message = (error.response?.data as ErrorEnvelope | undefined)?.message;
  return typeof message === "string" && message.trim() ? message : GENERIC_API_ERROR;
}
