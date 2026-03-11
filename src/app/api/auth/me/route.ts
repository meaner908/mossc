import { NextResponse } from "next/server";

import { findUserById } from "@/lib/users";
import { getCurrentUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const user = findUserById(current.id);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
  });
}
