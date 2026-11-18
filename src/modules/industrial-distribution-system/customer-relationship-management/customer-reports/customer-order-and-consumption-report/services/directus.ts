// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/directus.ts
// ============================================================
// Directus REST client helper for the Customer Order & Consumption Report.
// Server-side only: token stays on the server.
// ============================================================

import {
  UpstreamContractError,
  UpstreamHttpError,
} from "./customer-order-consumption.errors";
import { isAbortError } from "./customer-order-consumption.helpers";

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
    throw new Error(
      "Directus URL is not configured. Cannot fetch Customer Order & Consumption Report."
    );
  }

  return {
    baseUrl: /^https?:\/\//i.test(raw) ? raw : `http://${raw}`,
    token,
  };
}

function buildUrl(
  config: DirectusConfig,
  collection: string,
  options: DirectusFetchOptions
): string {
  const url = new URL(`${config.baseUrl}/items/${collection}`);
  url.searchParams.set("fields", options.fields);
  if (options.filter && Object.keys(options.filter).length > 0) {
    url.searchParams.set("filter", JSON.stringify(options.filter));
  }
  if (options.sort) url.searchParams.set("sort", options.sort);
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
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  const doFetch = options.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await doFetch(buildUrl(config, collection, options), {
      headers,
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new UpstreamHttpError(null, "", { cause: error });
  }

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new UpstreamContractError(
      `Directus collection ${collection} returned non-JSON response.`
    );
  }

  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    throw new UpstreamContractError(
      `Directus collection ${collection} returned no 'data' array.`
    );
  }

  return data as T[];
}

export function chunk<T>(items: T[], size = 500): T[][] {
  if (items.length === 0) return [];
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
