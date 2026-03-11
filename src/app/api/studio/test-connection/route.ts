import { NextResponse } from "next/server";

import { OpenClawGatewayAdapter } from "@/lib/controlplane/openclaw-adapter";
import { loadUserStudioSettings } from "@/lib/studio/settings-store";
import { getCurrentUser } from "@/lib/user-context";

export const runtime = "nodejs";

type TestConnectionRequestBody = {
  gateway?: {
    url?: unknown;
    token?: unknown;
  } | null;
  useStoredToken?: unknown;
};

const readString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const userId = user?.id ?? "system";

  const resolveStoredToken = (): string =>
    readString(loadUserStudioSettings(userId).gateway?.token);

  let adapter: OpenClawGatewayAdapter | null = null;
  try {
    const body = (await request.json()) as TestConnectionRequestBody;
    const url = readString(body?.gateway?.url);
    if (!url) {
      return NextResponse.json({ ok: false, error: "Gateway URL is required." }, { status: 400 });
    }

    const tokenInput = readString(body?.gateway?.token);
    const useStoredToken = body?.useStoredToken !== false;
    const token = tokenInput || (useStoredToken ? resolveStoredToken() : "");
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Gateway token is required. Enter one or keep the stored token.",
        },
        { status: 400 }
      );
    }

    adapter = new OpenClawGatewayAdapter({
      loadSettings: () => ({ url, token }),
    });
    await adapter.start();
    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        checkedAt: new Date().toISOString(),
      },
      { status: 502 }
    );
  } finally {
    if (adapter) {
      try { await adapter.stop(); } catch { /* best-effort cleanup */ }
    }
  }
}
