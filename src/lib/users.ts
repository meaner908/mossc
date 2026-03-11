import { randomBytes, scrypt, timingSafeEqual, randomUUID } from "node:crypto";
import { promisify } from "node:util";

import { getUserDb } from "@/lib/db";

const scryptAsync = promisify(scrypt);

export type UserRole = "admin" | "user";

export type UserRecord = {
  id: string;
  username: string;
  role: UserRole;
  createdAt: number;
};

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: number;
};

const KEY_LEN = 64;
const SALT_LEN = 16;

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LEN);
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt.toString("hex")}:${key.toString("hex")}`;
};

const verifyHashedPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  const [saltHex, keyHex] = hash.split(":");
  if (!saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");
  try {
    const actualKey = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
};

const toUserRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  username: row.username,
  role: row.role === "admin" ? "admin" : "user",
  createdAt: row.created_at,
});

export const hasAnyUsers = (): boolean => {
  const db = getUserDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
  return row.cnt > 0;
};

export const findUserByUsername = (username: string): UserRecord | null => {
  const db = getUserDb();
  const row = db
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(username) as UserRow | undefined;
  return row ? toUserRecord(row) : null;
};

export const findUserById = (id: string): UserRecord | null => {
  const db = getUserDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUserRecord(row) : null;
};

export const listUsers = (): UserRecord[] => {
  const db = getUserDb();
  const rows = db
    .prepare("SELECT * FROM users ORDER BY created_at ASC")
    .all() as UserRow[];
  return rows.map(toUserRecord);
};

export const createUser = async (
  username: string,
  password: string,
  role: UserRole = "user"
): Promise<UserRecord> => {
  const db = getUserDb();
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, username.trim(), passwordHash, role, createdAt);
  return { id, username: username.trim(), role, createdAt };
};

export const verifyUserPassword = async (
  username: string,
  password: string
): Promise<UserRecord | null> => {
  const db = getUserDb();
  const row = db
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(username) as UserRow | undefined;
  if (!row) return null;
  const valid = await verifyHashedPassword(password, row.password_hash);
  return valid ? toUserRecord(row) : null;
};

export const updateUserPassword = async (
  userId: string,
  newPassword: string
): Promise<void> => {
  const db = getUserDb();
  const passwordHash = await hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    passwordHash,
    userId
  );
};

export const deleteUser = (userId: string): void => {
  const db = getUserDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
};

export const countAdmins = (): number => {
  const db = getUserDb();
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
    .get() as { cnt: number };
  return row.cnt;
};
