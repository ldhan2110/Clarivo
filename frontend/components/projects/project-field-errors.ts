import { isAxiosError } from "axios";

/** The backend's one error shape — `app-exception.filter.ts`. */
type ErrorEnvelope = { code?: string; message?: string };

export function errorCode(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  return (error.response?.data as ErrorEnvelope | undefined)?.code;
}

/**
 * Maps the API's error code to the field it belongs under. A duplicate code or
 * a bad date range is a field error the user can act on, never a toast that
 * makes them hunt for which input is wrong.
 */
export const PROJECT_FIELD_ERRORS: Record<string, { field: "code" | "endsOn"; message: string }> = {
  PROJECT_CODE_TAKEN: {
    field: "code",
    message: "A project with this code already exists.",
  },
  PROJECT_INVALID_DATE_RANGE: {
    field: "endsOn",
    message: "End date must be on or after the start date.",
  },
};
