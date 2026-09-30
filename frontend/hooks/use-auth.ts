"use client";

import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { login } from "@/services/auth";

export const GENERIC_AUTH_ERROR = "Incorrect email or password.";

/** 401 is deliberately indistinguishable between unknown email and bad password. */
export function authErrorMessage(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401
    ? GENERIC_AUTH_ERROR
    : "Something went wrong. Please try again.";
}

export function useLogin() {
  return useMutation({ mutationFn: login });
}
