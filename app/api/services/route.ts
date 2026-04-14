import Docker from "dockerode";
import { NextResponse } from "next/server";
import type { Service } from "@/types/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

function getContainerName(names?: string[]) {
  return names?.[0]?.replace(/^\//, "") ?? "container-sem-nome";
}

export async function GET() {
  try {
    const containers = await docker.listContainers({ all: true });

    const services: Service[] = containers
      .filter((container) => container.Labels?.["hub.enable"] === "true")
      .map((container) => {
        const labels = container.Labels ?? {};

        return {
          id: container.Id,
          name: labels["hub.name"] || getContainerName(container.Names),
          url: labels["hub.url"] || "",
          icon: labels["hub.icon"] || "📦",
          description: labels["hub.description"] || "Serviço descoberto automaticamente via Docker.",
          status: container.State || "unknown",
        };
      })
      .sort((left, right) => {
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
      });

    return NextResponse.json(services);
  } catch (error) {
    console.error("Failed to load Docker services", error);

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;

    const detailByCode: Record<string, string> = {
      EACCES: "Permissão negada para acessar o Docker socket.",
      ENOENT: "Docker socket não encontrado em /var/run/docker.sock.",
      ECONNREFUSED: "Não foi possível conectar ao daemon Docker.",
    };

    return NextResponse.json(
      {
        error: "Falha ao descobrir serviços do Docker.",
        detail:
          (code && detailByCode[code]) ||
          "Verifique se o socket do Docker está montado e acessível pelo container.",
      },
      { status: 500 },
    );
  }
}
