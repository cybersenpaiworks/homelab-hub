import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.HUB_DATA_DIR || path.join(process.cwd(), "data");
const OVERRIDES_PATH = path.join(DATA_DIR, "service-overrides.json");

type ServiceOverrideMap = Record<string, string>;

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

export async function readServiceOverrides() {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => {
        const [serviceId, value] = entry;
        return Boolean(serviceId) && typeof value === "string";
      }),
    ) satisfies ServiceOverrideMap;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    console.error("Failed to read service overrides", error);
    return {};
  }
}

async function writeServiceOverrides(overrides: ServiceOverrideMap) {
  await ensureDataDir();

  const tempPath = `${OVERRIDES_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(overrides, null, 2), "utf8");
  await fs.rename(tempPath, OVERRIDES_PATH);
}

export async function saveServiceOverride(serviceId: string, url: string) {
  const overrides = await readServiceOverrides();
  overrides[serviceId] = normalizeServiceUrl(url);
  await writeServiceOverrides(overrides);
}

export async function clearServiceOverride(serviceId: string) {
  const overrides = await readServiceOverrides();

  if (!(serviceId in overrides)) {
    return;
  }

  delete overrides[serviceId];
  await writeServiceOverrides(overrides);
}
