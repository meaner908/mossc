import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "mossc_auth";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Returns true when password-based auth is enabled (MOSSC_PASSWORD env var is set).
 */
export const isAuthEnabled = (): boolean => {
  return Boolean(process.env.MOSSC_PASSWORD?.trim());
};

/**
 * Computes the expected session token value (HMAC-SHA256 of a fixed nonce,
 * keyed with the configured password). Deterministic — no session store needed.
 */
export const computeSessionToken = (): string => {
  const password = process.env.MOSSC_PASSWORD?.trim();
  if (!password) return "";
  return createHmac("sha256", password).update("mossc_session_v1").digest("hex");
};

/**
 * Timing-safe password verification.
 * Compares HMACs of both values (using a fixed key) so that the comparison is
 * always constant-time regardless of input length differences.
 */
export const verifyPassword = (input: string): boolean => {
  const password = process.env.MOSSC_PASSWORD?.trim();
  if (!password) return true;
  const FIXED_KEY = "mossc_pwd_check";
  const hmac = (value: string) =>
    createHmac("sha256", FIXED_KEY).update(value).digest();
  return timingSafeEqual(hmac(input), hmac(password));
};
