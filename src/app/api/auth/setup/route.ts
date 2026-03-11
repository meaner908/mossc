import { NextResponse } from "next/server";

import { SESSION_COOKIE_MAX_AGE, SESSION_COOKIE_NAME, createSessionToken } from "@/lib/session";
import { createUser, hasAnyUsers } from "@/lib/users";

export const runtime = "nodejs";

const MIN_PASSWORD_LEN = 8;

export async function POST(request: Request) {
  // Setup is only allowed when no users exist yet.
  if (hasAnyUsers()) {
    return NextResponse.json(
      { error: "Setup has already been completed. Please log in." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    Boolean(v && typeof v === "object" && !Array.isArray(v));

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 400 }
    );
  }

  try {
    const user = await createUser(username, password, "admin");
    const token = createSessionToken(user.id, user.role);
    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: isProduction,
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create admin account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
