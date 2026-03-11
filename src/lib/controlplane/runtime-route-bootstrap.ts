import { headers } from "next/headers";

import {
  getControlPlaneRuntimeForUser,
  isStudioDomainApiModeEnabled,
  type ControlPlaneRuntime,
} from "@/lib/controlplane/runtime";
import {
  classifyRuntimeInitError,
  type RuntimeInitFailure,
} from "@/lib/controlplane/runtime-init-errors";
import { loadUserStudioSettings } from "@/lib/studio/settings-store";
import { HEADER_USER_ID } from "@/lib/user-context";

type DomainRuntimeBootstrapResult =
  | { kind: "mode-disabled" }
  | { kind: "runtime-init-failed"; failure: RuntimeInitFailure }
  | { kind: "start-failed"; message: string; runtime: ControlPlaneRuntime }
  | { kind: "ready"; runtime: ControlPlaneRuntime };

const resolveErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export async function bootstrapDomainRuntime(): Promise<DomainRuntimeBootstrapResult> {
  if (!isStudioDomainApiModeEnabled()) {
    return { kind: "mode-disabled" };
  }

  // Resolve the current user's ID from injected request headers.
  const headerStore = await headers();
  const userId = headerStore.get(HEADER_USER_ID) ?? "system";

  let runtime: ControlPlaneRuntime;
  try {
    runtime = getControlPlaneRuntimeForUser(userId, {
      adapterOptions: {
        // Bind gateway settings to this user's configuration at runtime creation.
        loadSettings: () => {
          const settings = loadUserStudioSettings(userId);
          const gateway = settings.gateway;
          const url = typeof gateway?.url === "string" ? gateway.url.trim() : "";
          const token = typeof gateway?.token === "string" ? gateway.token.trim() : "";
          if (!url) {
            throw new Error(
              "Control-plane start failed: Studio gateway URL is not configured."
            );
          }
          if (!token) {
            throw new Error(
              "Control-plane start failed: Studio gateway token is not configured."
            );
          }
          return { url, token };
        },
      },
    });
  } catch (error) {
    return {
      kind: "runtime-init-failed",
      failure: classifyRuntimeInitError(error),
    };
  }

  try {
    await runtime.ensureStarted();
    return { kind: "ready", runtime };
  } catch (error) {
    const message = resolveErrorMessage(error, "controlplane_start_failed");
    return { kind: "start-failed", message, runtime };
  }
}
