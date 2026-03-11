import type {
  ControlPlaneDomainEvent,
  ControlPlaneOutboxEntry,
  ControlPlaneRuntimeSnapshot,
} from "@/lib/controlplane/contracts";
import { OpenClawGatewayAdapter, type OpenClawAdapterOptions } from "@/lib/controlplane/openclaw-adapter";
import {
  SQLiteControlPlaneProjectionStore,
  type BackfillAgentOutboxResult,
} from "@/lib/controlplane/projection-store";

type ControlPlaneRuntimeOptions = {
  adapterOptions?: OpenClawAdapterOptions;
  dbPath?: string;
};

export class ControlPlaneRuntime {
  private readonly store: SQLiteControlPlaneProjectionStore;
  private readonly adapter: OpenClawGatewayAdapter;
  private readonly eventSubscribers = new Set<(entry: ControlPlaneOutboxEntry) => void>();

  constructor(options?: ControlPlaneRuntimeOptions) {
    this.store = new SQLiteControlPlaneProjectionStore(options?.dbPath);
    this.adapter = new OpenClawGatewayAdapter({
      ...(options?.adapterOptions ?? {}),
      onDomainEvent: (event) => this.handleDomainEvent(event),
    });
  }

  async ensureStarted(): Promise<void> {
    await this.adapter.start();
  }

  async disconnect(): Promise<void> {
    await this.adapter.stop();
  }

  connectionStatus() {
    return this.adapter.getStatus();
  }

  async reconnectForGatewaySettingsChange(): Promise<void> {
    if (this.adapter.getStatus() === "stopped") return;
    await this.adapter.stop();
    await this.adapter.start();
  }

  snapshot(): ControlPlaneRuntimeSnapshot {
    return this.store.snapshot();
  }

  eventsAfter(lastSeenId: number, limit?: number): ControlPlaneOutboxEntry[] {
    return this.store.readOutboxAfter(lastSeenId, limit);
  }

  eventsBeforeForAgent(
    agentId: string,
    beforeOutboxId: number,
    limit?: number
  ): ControlPlaneOutboxEntry[] {
    return this.store.readAgentOutboxBefore(agentId, beforeOutboxId, limit);
  }

  backfillAgentHistoryIndex(beforeOutboxId: number, limit?: number): BackfillAgentOutboxResult {
    return this.store.backfillAgentOutboxBefore(beforeOutboxId, limit);
  }

  subscribe(handler: (entry: ControlPlaneOutboxEntry) => void): () => void {
    this.eventSubscribers.add(handler);
    return () => {
      this.eventSubscribers.delete(handler);
    };
  }

  async callGateway<T = unknown>(method: string, params: unknown): Promise<T> {
    return await this.adapter.request<T>(method, params);
  }

  close(): void {
    this.store.close();
  }

  private handleDomainEvent(event: ControlPlaneDomainEvent): void {
    const entry = this.store.applyDomainEvent(event);
    for (const subscriber of this.eventSubscribers) {
      try {
        subscriber(entry);
      } catch (err) {
        console.error("Control-plane event subscriber failed.", err);
      }
    }
  }
}

type GlobalControlPlaneState = typeof globalThis & {
  __openclawStudioControlPlaneRuntime?: ControlPlaneRuntime;
  __openclawStudioUserRuntimes?: Map<string, ControlPlaneRuntime>;
};

export const getControlPlaneRuntime = (options?: ControlPlaneRuntimeOptions): ControlPlaneRuntime => {
  const globalState = globalThis as GlobalControlPlaneState;
  if (!globalState.__openclawStudioControlPlaneRuntime) {
    globalState.__openclawStudioControlPlaneRuntime = new ControlPlaneRuntime(options);
  }
  return globalState.__openclawStudioControlPlaneRuntime;
};

export const peekControlPlaneRuntime = (): ControlPlaneRuntime | null => {
  const globalState = globalThis as GlobalControlPlaneState;
  return globalState.__openclawStudioControlPlaneRuntime ?? null;
};

/** Returns (or creates) a per-user runtime keyed by userId. */
export const getControlPlaneRuntimeForUser = (
  userId: string,
  options?: ControlPlaneRuntimeOptions
): ControlPlaneRuntime => {
  const globalState = globalThis as GlobalControlPlaneState;
  if (!globalState.__openclawStudioUserRuntimes) {
    globalState.__openclawStudioUserRuntimes = new Map();
  }
  const existing = globalState.__openclawStudioUserRuntimes.get(userId);
  if (existing) return existing;
  const runtime = new ControlPlaneRuntime(options);
  globalState.__openclawStudioUserRuntimes.set(userId, runtime);
  return runtime;
};

/** Returns the per-user runtime if it exists, without creating one. */
export const peekControlPlaneRuntimeForUser = (userId: string): ControlPlaneRuntime | null => {
  const globalState = globalThis as GlobalControlPlaneState;
  return globalState.__openclawStudioUserRuntimes?.get(userId) ?? null;
};

export const resetControlPlaneRuntimeForTests = (): void => {
  const globalState = globalThis as GlobalControlPlaneState;
  delete globalState.__openclawStudioControlPlaneRuntime;
  globalState.__openclawStudioUserRuntimes?.clear();
};

export const isStudioDomainApiModeEnabled = (): boolean => {
  return true;
};
