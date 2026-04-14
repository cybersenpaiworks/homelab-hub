import { promises as fs } from "fs";
import path from "path";
import type { Service, ServiceUrlSource } from "@/types/service";

const DATA_DIR = process.env.HUB_DATA_DIR || path.join(process.cwd(), "data");
const STATE_PATH = path.join(DATA_DIR, "service-state.json");

export type ServiceSnapshot = {
  name: string;
  icon: string;
  description: string;
  url: string;
  autoUrl: string;
  urlSource: ServiceUrlSource;
  status: string;
};

export type StoredServiceState = {
  hidden?: boolean;
  manualUrl?: string;
  order?: number;
  snapshot?: ServiceSnapshot;
};

export type ServiceStateMap = Record<string, StoredServiceState>;

function hasScheme(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
}

export function normalizeServiceUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "";
  }

  const candidate = hasScheme(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(candidate).toString();
  } catch {
    throw new Error("Informe uma URL valida ou um dominio acessivel.");
  }
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readServiceState() {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([serviceId, value]) => {
        return Boolean(serviceId) && typeof value === "object" && value !== null;
      }),
    ) as ServiceStateMap;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    console.error("Failed to read service state", error);
    return {};
  }
}

export async function writeServiceState(state: ServiceStateMap) {
  await ensureDataDir();

  const tempPath = `${STATE_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tempPath, STATE_PATH);
}

export function createSnapshot(service: Service): ServiceSnapshot {
  return {
    name: service.name,
    icon: service.icon,
    description: service.description,
    url: service.url,
    autoUrl: service.autoUrl,
    urlSource: service.urlSource,
    status: service.status,
  };
}
