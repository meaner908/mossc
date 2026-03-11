import { NextResponse } from "next/server";

import { isAuthEnabled } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ authEnabled: isAuthEnabled() });
}
