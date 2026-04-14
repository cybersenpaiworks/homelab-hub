import Docker from "dockerode";
import type { ContainerInfo } from "dockerode";
import {
  createSnapshot,
  normalizeServiceUrl,
  readServiceState,
  type ServiceSnapshot,
  type ServiceStateMap,
  writeServiceState,
} from "@/lib/service-state";
import type { Service, ServiceUrlSource } from "@/types/service";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

function getContainerName(names?: string[]) {
  return names?.[0]?.replace(/^\//, "") ?? "container-sem-nome";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getServiceId(container: ContainerInfo) {
  const labels = container.Labels ?? {};
  const containerName = getContainerName(container.Names);
  const stableValue =
    labels["hub.key"]?.trim() ||
    labels["hub.host"]?.trim() ||
    labels["hub.domain"]?.trim() ||
    labels["hub.hostname"]?.trim() ||
    labels["hub.url"]?.trim() ||
    labels["hub.name"]?.trim() ||
    containerName;

  return slugify(stableValue) || slugify(containerName) || container.Id;
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
  const rawPath = labels["hub.path"]?.trim() || "";
  const normalizedPath = rawPath
    ? rawPath.startsWith("/")
      ? rawPath
      : `/${rawPath}`
    : "";

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
    id: getServiceId(container),
    containerId: container.Id,
    name: labels["hub.name"] || getContainerName(container.Names),
    url,
    autoUrl,
    urlSource,
    icon: labels["hub.icon"] || "📦",
    description: labels["hub.description"] || "Servico descoberto automaticamente via Docker.",
    status: container.State || "unknown",
    isAvailable: true,
  };
}

function mapSnapshotToMissingService(serviceId: string, snapshot: ServiceSnapshot): Service {
  return {
    id: serviceId,
    containerId: null,
    name: snapshot.name,
    url: snapshot.url,
    autoUrl: snapshot.autoUrl,
    urlSource: snapshot.urlSource,
    icon: snapshot.icon,
    description: snapshot.description,
    status: "missing",
    isAvailable: false,
  };
}

function hasSnapshotChanged(left: ServiceSnapshot | undefined, right: ServiceSnapshot) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function compareServices(
  left: Service,
  right: Service,
  state: ServiceStateMap,
) {
  const leftOrder = state[left.id]?.order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = state[right.id]?.order ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (left.isAvailable !== right.isAvailable) {
    return left.isAvailable ? -1 : 1;
  }

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

async function readCurrentContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.filter((container) => container.Labels?.["hub.enable"] === "true");
}

async function updateSnapshotsForCurrentServices(
  services: Service[],
  state: ServiceStateMap,
) {
  let hasChanges = false;

  for (const service of services) {
    const currentEntry = state[service.id] ?? {};
    const nextSnapshot = createSnapshot(service);
    const nextEntry = {
      ...currentEntry,
      hidden: false,
      snapshot: nextSnapshot,
    };

    if (
      currentEntry.hidden ||
      hasSnapshotChanged(currentEntry.snapshot, nextSnapshot)
    ) {
      state[service.id] = nextEntry;
      hasChanges = true;
    } else if (!state[service.id]) {
      state[service.id] = nextEntry;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await writeServiceState(state);
  }
}

export async function listServices() {
  const [containers, state] = await Promise.all([
    readCurrentContainers(),
    readServiceState(),
  ]);

  const currentServices = containers.map((container) =>
    mapContainerToService(container, state[getServiceId(container)]?.manualUrl),
  );

  await updateSnapshotsForCurrentServices(currentServices, state);

  const currentIds = new Set(currentServices.map((service) => service.id));
  const missingServices = Object.entries(state)
    .filter(([serviceId, entry]) => {
      return !currentIds.has(serviceId) && !entry.hidden && Boolean(entry.snapshot);
    })
    .map(([serviceId, entry]) =>
      mapSnapshotToMissingService(serviceId, entry.snapshot as ServiceSnapshot),
    );

  return [...currentServices, ...missingServices].sort((left, right) =>
    compareServices(left, right, state),
  );
}

async function getCurrentServiceById(serviceId: string) {
  const state = await readServiceState();
  const containers = await readCurrentContainers();
  const container = containers.find((candidate) => getServiceId(candidate) === serviceId);

  if (!container) {
    return null;
  }

  return mapContainerToService(container, state[serviceId]?.manualUrl);
}

export async function updateManualServiceUrl(serviceId: string, url: string) {
  const service = await getCurrentServiceById(serviceId);

  if (!service) {
    return null;
  }

  const state = await readServiceState();
  state[serviceId] = {
    ...state[serviceId],
    hidden: false,
    manualUrl: normalizeServiceUrl(url),
    snapshot: createSnapshot({
      ...service,
      url: normalizeServiceUrl(url),
      urlSource: "manual",
    }),
  };
  await writeServiceState(state);

  return getCurrentServiceById(serviceId);
}

export async function resetManualServiceUrl(serviceId: string) {
  const service = await getCurrentServiceById(serviceId);

  if (!service) {
    return null;
  }

  const state = await readServiceState();
  state[serviceId] = {
    ...state[serviceId],
    hidden: false,
    manualUrl: "",
    snapshot: createSnapshot({
      ...service,
      url: service.autoUrl,
      urlSource: service.autoUrl ? service.urlSource : "none",
    }),
  };
  delete state[serviceId].manualUrl;
  await writeServiceState(state);

  return getCurrentServiceById(serviceId);
}

export async function reorderServices(orderedServiceIds: string[]) {
  const state = await readServiceState();
  const uniqueOrderedIds = Array.from(new Set(orderedServiceIds));
  const remainingIds = Object.keys(state).filter(
    (serviceId) => !uniqueOrderedIds.includes(serviceId),
  );
  const finalOrder = [...uniqueOrderedIds, ...remainingIds];

  finalOrder.forEach((serviceId, index) => {
    state[serviceId] = {
      ...state[serviceId],
      order: index,
    };
  });

  await writeServiceState(state);
  return listServices();
}

export async function hideMissingService(serviceId: string) {
  const state = await readServiceState();

  if (!state[serviceId]?.snapshot) {
    return false;
  }

  state[serviceId] = {
    ...state[serviceId],
    hidden: true,
  };
  await writeServiceState(state);
  return true;
}

export async function removeServiceState(serviceId: string) {
  const state = await readServiceState();

  if (!state[serviceId]) {
    return false;
  }

  delete state[serviceId];
  await writeServiceState(state);
  return true;
}
