import { NextResponse } from "next/server";

import { countAdmins, deleteUser, findUserById, updateUserPassword } from "@/lib/users";
import { getCurrentUser, requireAdmin } from "@/lib/user-context";

export const runtime = "nodejs";

const MIN_PASSWORD_LEN = 8;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
  }

  const { id } = await params;
  const current = await getCurrentUser();

  if (current?.id === id) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const target = findUserById(id);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Prevent deleting the last admin.
  if (target.role === "admin" && countAdmins() <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last admin account." },
      { status: 400 }
    );
  }

  deleteUser(id);
  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  // Only admin can change other users' passwords. Users can change their own.
  if (current.id !== id && current.role !== "admin") {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
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

  const newPassword = typeof body.password === "string" ? body.password : "";
  if (newPassword.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 400 }
    );
  }

  if (!findUserById(id)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await updateUserPassword(id, newPassword);
  return NextResponse.json({ ok: true });
}
