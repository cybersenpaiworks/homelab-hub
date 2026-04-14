import Docker from "dockerode";
import type { ContainerInfo } from "dockerode";
import {
  clearServiceOverride,
  normalizeServiceUrl,
  readServiceOverrides,
  saveServiceOverride,
} from "@/lib/service-overrides";
import type { Service, ServiceUrlSource } from "@/types/service";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

function getContainerName(names?: string[]) {
  return names?.[0]?.replace(/^\//, "") ?? "container-sem-nome";
}

function resolveAutomaticUrl(labels: Record<string, string | undefined>) {
  const directUrl = labels["hub.url"]?.trim();

  if (directUrl) {
    return {
      autoUrl: normalizeServiceUrl(directUrl),
      urlSource: "label" as const,
    };
  }

  const host =
    labels["hub.host"]?.trim() ||
    labels["hub.domain"]?.trim() ||
    labels["hub.hostname"]?.trim();

  if (!host) {
    return {
      autoUrl: "",
      urlSource: "none" as const,
    };
  }

  const scheme = labels["hub.scheme"]?.trim() || "https";
  const path = labels["hub.path"]?.trim() || "";
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";

  return {
    autoUrl: normalizeServiceUrl(`${scheme}://${host}${normalizedPath}`),
    urlSource: "derived" as const,
  };
}

function mapContainerToService(
  container: ContainerInfo,
  manualUrl: string | undefined,
): Service {
  const labels = container.Labels ?? {};
  const { autoUrl, urlSource: automaticUrlSource } = resolveAutomaticUrl(labels);
  const normalizedManualUrl = manualUrl?.trim() ? normalizeServiceUrl(manualUrl) : "";
  const url = normalizedManualUrl || autoUrl;
  const urlSource: ServiceUrlSource = normalizedManualUrl
    ? "manual"
    : automaticUrlSource;

  return {
    id: container.Id,
    name: labels["hub.name"] || getContainerName(container.Names),
    url,
    autoUrl,
    urlSource,
    icon: labels["hub.icon"] || "📦",
    description: labels["hub.description"] || "Servico descoberto automaticamente via Docker.",
    status: container.State || "unknown",
  };
}

function sortServices(left: Service, right: Service) {
  if (left.status === right.status) {
    return left.name.localeCompare(right.name, "pt-BR");
  }

  if (left.status === "running") {
    return -1;
  }

  if (right.status === "running") {
    return 1;
  }

  return left.name.localeCompare(right.name, "pt-BR");
}

export async function listServices() {
  const [containers, overrides] = await Promise.all([
    docker.listContainers({ all: true }),
    readServiceOverrides(),
  ]);

  return containers
    .filter((container) => container.Labels?.["hub.enable"] === "true")
    .map((container) => mapContainerToService(container, overrides[container.Id]))
    .sort(sortServices);
}

async function getContainerByServiceId(serviceId: string) {
  const containers = await docker.listContainers({ all: true });

  return containers.find(
    (container) =>
      container.Id === serviceId && container.Labels?.["hub.enable"] === "true",
  );
}

export async function updateManualServiceUrl(serviceId: string, url: string) {
  const container = await getContainerByServiceId(serviceId);

  if (!container) {
    return null;
  }

  await saveServiceOverride(serviceId, url);
  const overrides = await readServiceOverrides();
  return mapContainerToService(container, overrides[serviceId]);
}

export async function resetManualServiceUrl(serviceId: string) {
  const container = await getContainerByServiceId(serviceId);

  if (!container) {
    return null;
  }

  await clearServiceOverride(serviceId);
  return mapContainerToService(container, undefined);
}
