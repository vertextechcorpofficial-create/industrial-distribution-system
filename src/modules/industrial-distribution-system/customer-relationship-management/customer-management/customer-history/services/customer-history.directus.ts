// ============================================================================
// Customer History — Server-Side Directus REST Client
// Keeps DIRECTUS_STATIC_TOKEN strictly on the server.
// ============================================================================

export interface DirectusConfig {
  baseUrl: string;
  token: string;
}

export interface DirectusFetchOptions {
  fields: string;
  filter?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export class DirectusUpstreamError extends Error {
  readonly statusCode: number | null;
  constructor(statusCode: number | null, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DirectusUpstreamError";
    this.statusCode = statusCode;
  }
}

export function resolveDirectusConfig(
  env: NodeJS.ProcessEnv = process.env
): DirectusConfig {
  const raw = (
    env.DIRECTUS_URL ||
    env.NEXT_PUBLIC_DIRECTUS_URL ||
    env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const token = (env.DIRECTUS_STATIC_TOKEN || env.DIRECTUS_TOKEN || "").trim();

  if (!raw) {
    throw new Error("Directus URL is not configured for Customer History.");
  }

  return {
    baseUrl: /^https?:\/\//i.test(raw) ? raw : `http://${raw}`,
    token,
  };
}

function buildDirectusUrl(
  config: DirectusConfig,
  collection: string,
  options: DirectusFetchOptions
): string {
  const url = new URL(`${config.baseUrl}/items/${collection}`);
  url.searchParams.set("fields", options.fields);
  if (options.filter && Object.keys(options.filter).length > 0) {
    url.searchParams.set("filter", JSON.stringify(options.filter));
  }
  if (options.sort) {
    url.searchParams.set("sort", options.sort);
  }
  url.searchParams.set("limit", String(options.limit ?? -1));
  return url.toString();
}

export async function fetchDirectusRows<T>(
  collection: string,
  options: DirectusFetchOptions,
  config: DirectusConfig
): Promise<T[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const doFetch = options.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await doFetch(buildDirectusUrl(config, collection, options), {
      headers,
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new DirectusUpstreamError(
      null,
      `Network error reading ${collection}`,
      { cause: error }
    );
  }

  if (!response.ok) {
    throw new DirectusUpstreamError(
      response.status,
      `Directus ${collection} failed with ${response.status} ${response.statusText}`
    );
  }

  const payload = (await response.json()) as { data?: unknown };
  if (!Array.isArray(payload?.data)) {
    throw new DirectusUpstreamError(
      502,
      `Directus ${collection} returned unexpected payload shape`
    );
  }

  return payload.data as T[];
}

export function chunk<T>(items: T[], size = 400): T[][] {
  if (items.length === 0) return [];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export function flatten<T>(batches: T[][]): T[] {
  const result: T[] = [];
  for (const b of batches) {
    for (const item of b) result.push(item);
  }
  return result;
}
