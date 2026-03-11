import { NextResponse } from "next/server";

import { hasAnyUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ hasUsers: hasAnyUsers() });
}
