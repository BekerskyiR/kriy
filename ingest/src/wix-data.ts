import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Тонкий REST-клієнт до Wix Data v2.
 *
 * Авторизація: WIX_SITE_TOKEN з env (для CI), інакше токен мінтиться
 * через Wix CLI (`npx wix token --site <id>`) — на дев-машині цього досить.
 * siteId читається з wix.config.json у корені репо.
 */

const API = "https://www.wixapis.com/wix-data/v2";
const BULK_CHUNK = 1000;

function resolveSiteId(): string {
  const config = JSON.parse(readFileSync(join(process.cwd(), "wix.config.json"), "utf8"));
  return config.siteId;
}

let cached: { siteId: string; token: string } | null = null;

function auth(): { siteId: string; token: string } {
  if (cached) return cached;
  const siteId = process.env.WIX_SITE_ID ?? resolveSiteId();
  const token =
    process.env.WIX_SITE_TOKEN ??
    execSync(`npx @wix/cli@latest token --site "${siteId}"`, { encoding: "utf8" }).trim();
  cached = { siteId, token };
  return cached;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const { siteId, token } = auth();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "wix-site-id": siteId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Wix Data ${path} → HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface DataItem<T = Record<string, unknown>> {
  id: string;
  data: T & { _id: string };
}

/** Вичитує колекцію повністю, сторінками по 1000. */
export async function queryAll<T = Record<string, unknown>>(
  collectionId: string,
  filter?: Record<string, unknown>,
): Promise<Array<T & { _id: string }>> {
  const items: Array<T & { _id: string }> = [];
  let offset = 0;
  for (;;) {
    const resp = await call<{ dataItems?: Array<{ data: T & { _id: string } }> }>("/items/query", {
      dataCollectionId: collectionId,
      query: { ...(filter ? { filter } : {}), paging: { limit: 1000, offset } },
    });
    const batch = (resp.dataItems ?? []).map((i) => i.data);
    items.push(...batch);
    if (batch.length < 1000) return items;
    offset += 1000;
  }
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function bulkInsert(
  collectionId: string,
  items: Array<Record<string, unknown>>,
): Promise<number> {
  let count = 0;
  for (const chunk of chunks(items, BULK_CHUNK)) {
    const resp = await call<{ results?: unknown[] }>("/bulk/items/insert", {
      dataCollectionId: collectionId,
      dataItems: chunk.map((data) => ({ data })),
    });
    count += resp.results?.length ?? 0;
  }
  return count;
}

/** Повна заміна data (id на рівні елемента, без _id всередині data). */
export async function bulkUpdate(
  collectionId: string,
  items: Array<{ id: string; data: Record<string, unknown> }>,
): Promise<number> {
  let count = 0;
  for (const chunk of chunks(items, BULK_CHUNK)) {
    const resp = await call<{ results?: unknown[] }>("/bulk/items/update", {
      dataCollectionId: collectionId,
      dataItems: chunk,
    });
    count += resp.results?.length ?? 0;
  }
  return count;
}

/** Частковий апдейт окремих полів — не чіпає решту запису. */
export async function bulkPatch(
  collectionId: string,
  patches: Array<{ id: string; set: Record<string, unknown> }>,
): Promise<number> {
  let count = 0;
  for (const chunk of chunks(patches, BULK_CHUNK)) {
    const resp = await call<{ results?: unknown[] }>("/bulk/items/patch", {
      dataCollectionId: collectionId,
      patches: chunk.map(({ id, set }) => ({
        dataItemId: id,
        fieldModifications: Object.entries(set).map(([fieldPath, value]) => ({
          fieldPath,
          action: "SET_FIELD",
          setFieldOptions: { value },
        })),
      })),
    });
    count += resp.results?.length ?? 0;
  }
  return count;
}
