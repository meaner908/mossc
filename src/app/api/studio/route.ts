import { NextResponse } from "next/server";

import { type StudioSettingsPatch } from "@/lib/studio/settings";
import { defaultStudioInstallContext } from "@/lib/studio/install-context";
import {
  isStudioDomainApiModeEnabled,
  peekControlPlaneRuntimeForUser,
} from "@/lib/controlplane/runtime";
import {
  applyUserStudioSettingsPatch,
  loadLocalGatewayDefaults,
  loadUserStudioSettings,
  redactLocalGatewayDefaultsSecrets,
  redactStudioSettingsSecrets,
} from "@/lib/studio/settings-store";
import { getCurrentUser } from "@/lib/user-context";

export const runtime = "nodejs";

const isPatch = (value: unknown): value is StudioSettingsPatch =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

type RuntimeReconnectMetadata = {
  attempted: boolean;
  restarted: boolean;
  reason?: string;
  previousStatus?: string;
  error?: string;
};

const normalizeGatewaySettings = (settings: ReturnType<typeof loadUserStudioSettings>) => {
  const gateway = settings.gateway ?? null;
  return {
    url: typeof gateway?.url === "string" ? gateway.url.trim() : "",
    token: typeof gateway?.token === "string" ? gateway.token.trim() : "",
  };
};

const gatewaySettingsChanged = (
  previous: ReturnType<typeof loadUserStudioSettings>,
  next: ReturnType<typeof loadUserStudioSettings>
) => {
  const left = normalizeGatewaySettings(previous);
  const right = normalizeGatewaySettings(next);
  return left.url !== right.url || left.token !== right.token;
};

const reconnectRuntimeForGatewaySettingsChange = async (
  userId: string,
  previous: ReturnType<typeof loadUserStudioSettings>,
  next: ReturnType<typeof loadUserStudioSettings>
): Promise<RuntimeReconnectMetadata | null> => {
  if (!gatewaySettingsChanged(previous, next)) return null;
  if (!isStudioDomainApiModeEnabled()) {
    return {
      attempted: false,
      restarted: false,
      reason: "domain_api_mode_disabled",
    };
  }
  const rt = peekControlPlaneRuntimeForUser(userId);
  if (!rt) {
    return {
      attempted: false,
      restarted: false,
      reason: "runtime_not_initialized",
    };
  }
  const previousStatus = rt.connectionStatus();
  if (previousStatus === "stopped") {
    return {
      attempted: false,
      restarted: false,
      reason: "runtime_stopped",
      previousStatus,
    };
  }
  try {
    await rt.reconnectForGatewaySettingsChange();
    return {
      attempted: true,
      restarted: true,
      previousStatus,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "controlplane_reconnect_failed";
    console.error("Failed to reconnect control-plane runtime after gateway settings update.", error);
    return {
      attempted: true,
      restarted: false,
      previousStatus,
      error: message,
    };
  }
};

const buildSettingsResponseBody = async (
  userId: string,
  metadata?: RuntimeReconnectMetadata | null
) => {
  const settings = loadUserStudioSettings(userId);
  const localGatewayDefaults = loadLocalGatewayDefaults();
  const installContext = defaultStudioInstallContext();
  return {
    settings: redactStudioSettingsSecrets(settings),
    localGatewayDefaults: redactLocalGatewayDefaultsSecrets(localGatewayDefaults),
    localGatewayDefaultsMeta: {
      hasToken: Boolean(localGatewayDefaults?.token?.trim()),
    },
    gatewayMeta: {
      hasStoredToken: Boolean(settings.gateway?.token?.trim()),
    },
    installContext,
    domainApiModeEnabled: isStudioDomainApiModeEnabled(),
    ...(metadata ? { runtimeReconnect: metadata } : {}),
  };
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id ?? "system";
    return NextResponse.json(await buildSettingsResponseBody(userId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load studio settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id ?? "system";
    const body = (await request.json()) as unknown;
    if (!isPatch(body)) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    const previousSettings = loadUserStudioSettings(userId);
    const nextSettings = applyUserStudioSettingsPatch(userId, body);
    const runtimeReconnect = await reconnectRuntimeForGatewaySettingsChange(
      userId,
      previousSettings,
      nextSettings
    );
    return NextResponse.json(await buildSettingsResponseBody(userId, runtimeReconnect));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save studio settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
