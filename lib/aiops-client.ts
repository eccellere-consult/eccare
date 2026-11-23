/**
 * Eccellere AI Control Tower: client for an app's SERVER side.
 *
 * One file, no dependencies. Copy it into an app and call it from server code only (a route handler, a server action,
 * a background job). NEVER import it into browser code: it holds the app's secret key.
 *
 * It never throws and never blocks the app: every call has a short time limit, and any failure is swallowed (and
 * reported to `onError` if you give one). Telemetry must not be able to break a customer's page.
 *
 *   const tower = createControlTower({
 *     endpoint: process.env.AIOPS_ENDPOINT!,   // e.g. https://aiops.eccellere.co.in/api/v1
 *     appCode: 'eccellere',
 *     apiKey: process.env.AIOPS_KEY!,          // made in Configuration > Apps; keep it in the server's settings
 *   });
 *   await tower.capabilityStarted('business_health_assessment', 'diagnostics', { userId: user.id });
 *   await tower.recordAIRequest({ capabilityCode: 'business_health_assessment', moduleCode: 'diagnostics',
 *     provider: 'anthropic', model: 'claude-sonnet-5-5', inputTokens: 1200, outputTokens: 800, latencyMs: 4200, status: 'success' });
 *
 * People are identified only by a hash you make yourself (tower.hashUser): never send a name, e-mail or phone.
 * Never send prompts or answers: the Control Tower stores none and does not want them.
 */

import { createHash, randomUUID } from 'node:crypto';

export interface ControlTowerConfig {
  endpoint: string;
  appCode: string;
  apiKey: string;
  /** Set false to switch telemetry off without removing the calls. Default true. */
  enabled?: boolean;
  /** Milliseconds to wait for the Control Tower before giving up. Default 2000. */
  timeoutMs?: number;
  /** A secret text of your own, mixed into user hashes so they cannot be reversed. Default: the api key. */
  hashSalt?: string;
  onError?: (error: unknown) => void;
}

export interface EventContext {
  /** Your own id for the person. It is hashed before it leaves your server. */
  userId?: string | number;
  sessionId?: string;
  requestUuid?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AIRequestRecord {
  requestUuid?: string;
  capabilityCode?: string;
  moduleCode?: string;
  userId?: string | number;
  provider?: string;
  model?: string;
  promptCode?: string;
  promptVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** See docs/integration_guide.md: how cached tokens are counted depends on the provider. */
  cachedTokens?: number;
  /** True when you counted the tokens yourself instead of reading them from the provider's answer. */
  tokenUsageEstimated?: boolean;
  latencyMs?: number;
  retryCount?: number;
  status: 'success' | 'failed' | 'timeout' | 'blocked' | 'cancelled' | 'partial';
  errorCode?: string;
  occurredAt?: Date;
}

export function createControlTower(config: ControlTowerConfig) {
  const base = config.endpoint.replace(/\/+$/, '');
  const enabled = config.enabled !== false && Boolean(config.endpoint && config.apiKey);
  const timeoutMs = config.timeoutMs ?? 2000;
  const salt = config.hashSalt ?? config.apiKey;

  async function post(path: string, body: Record<string, unknown>): Promise<boolean> {
    if (!enabled) return false;
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-aiops-key': config.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) config.onError?.(new Error(`Control Tower answered ${response.status}`));
      return response.ok;
    } catch (error) {
      config.onError?.(error);
      return false;
    }
  }

  function hashUser(userId: string | number | undefined): string | undefined {
    if (userId === undefined || userId === null || userId === '') return undefined;
    return createHash('sha256').update(`${salt}:${config.appCode}:${userId}`).digest('hex').slice(0, 32);
  }

  function trackEvent(eventType: string, capabilityCode?: string, moduleCode?: string, context: EventContext = {}): Promise<boolean> {
    return post('/events', {
      event_uuid: randomUUID(),
      app_code: config.appCode,
      module_code: moduleCode,
      capability_code: capabilityCode,
      event_type: eventType,
      user_hash: hashUser(context.userId),
      session_hash: context.sessionId ? hashUser(context.sessionId) : undefined,
      request_uuid: context.requestUuid,
      event_metadata: context.metadata,
      occurred_at: new Date().toISOString(),
    });
  }

  return {
    hashUser,
    trackEvent,
    moduleViewed: (moduleCode: string, context?: EventContext) => trackEvent('module_viewed', undefined, moduleCode, context),
    capabilityStarted: (capabilityCode: string, moduleCode?: string, context?: EventContext) => trackEvent('capability_started', capabilityCode, moduleCode, context),
    capabilityCompleted: (capabilityCode: string, moduleCode?: string, context?: EventContext) => trackEvent('capability_completed', capabilityCode, moduleCode, context),
    capabilityAbandoned: (capabilityCode: string, moduleCode?: string, context?: EventContext) => trackEvent('capability_abandoned', capabilityCode, moduleCode, context),
    outputAccepted: (capabilityCode: string, moduleCode?: string, context?: EventContext) => trackEvent('output_accepted', capabilityCode, moduleCode, context),
    outputRejected: (capabilityCode: string, moduleCode?: string, context?: EventContext) => trackEvent('output_rejected', capabilityCode, moduleCode, context),
    outputModified: (capabilityCode: string, moduleCode?: string, context?: EventContext) => trackEvent('output_modified', capabilityCode, moduleCode, context),
    outputRegenerated: (capabilityCode: string, moduleCode?: string, context?: EventContext) => trackEvent('output_regenerated', capabilityCode, moduleCode, context),

    /** Report one completed AI call. The Control Tower works out the cost; do not send one. */
    recordAIRequest(record: AIRequestRecord): Promise<boolean> {
      return post('/requests', {
        request_uuid: record.requestUuid ?? randomUUID(),
        app_code: config.appCode,
        module_code: record.moduleCode,
        capability_code: record.capabilityCode,
        user_hash: hashUser(record.userId),
        provider: record.provider,
        model: record.model,
        prompt_code: record.promptCode,
        prompt_version: record.promptVersion,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        cached_tokens: record.cachedTokens,
        token_usage_estimated: record.tokenUsageEstimated ?? false,
        latency_ms: record.latencyMs,
        retry_count: record.retryCount ?? 0,
        status: record.status,
        error_code: record.errorCode,
        occurred_at: (record.occurredAt ?? new Date()).toISOString(),
      });
    },
  };
}
