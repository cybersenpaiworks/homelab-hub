import { NextResponse } from "next/server";
import {
  hideMissingService,
  listServices,
  removeServiceState,
  reorderServices,
  resetManualServiceUrl,
  updateManualServiceUrl,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const services = await listServices();
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
      EACCES: "Permissao negada para acessar o Docker socket.",
      ENOENT: "Docker socket nao encontrado em /var/run/docker.sock.",
      ECONNREFUSED: "Nao foi possivel conectar ao daemon Docker.",
    };

    return NextResponse.json(
      {
        error: "Falha ao descobrir servicos do Docker.",
        detail:
          (code && detailByCode[code]) ||
          "Verifique se o socket do Docker esta montado e acessivel pelo container.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      serviceId?: string;
      url?: string;
    };

    if (!body.serviceId || !body.url?.trim()) {
      return NextResponse.json(
        { error: "serviceId e url sao obrigatorios." },
        { status: 400 },
      );
    }

    const service = await updateManualServiceUrl(body.serviceId, body.url);

    if (!service) {
      return NextResponse.json(
        { error: "Servico nao encontrado para atualizar a URL." },
        { status: 404 },
      );
    }

    return NextResponse.json(service);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha ao salvar a URL manual do servico.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      serviceId?: string;
    };

    if (!body.serviceId) {
      return NextResponse.json(
        { error: "serviceId e obrigatorio." },
        { status: 400 },
      );
    }

    const service = await resetManualServiceUrl(body.serviceId);

    if (!service) {
      return NextResponse.json(
        { error: "Servico nao encontrado para restaurar a URL automatica." },
        { status: 404 },
      );
    }

    return NextResponse.json(service);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha ao restaurar a URL automatica do servico.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "hide" | "remove" | "reorder";
      serviceId?: string;
      orderedServiceIds?: string[];
    };

    if (body.action === "reorder") {
      if (!Array.isArray(body.orderedServiceIds) || body.orderedServiceIds.length === 0) {
        return NextResponse.json(
          { error: "orderedServiceIds e obrigatorio para reordenar." },
          { status: 400 },
        );
      }

      const services = await reorderServices(body.orderedServiceIds);
      return NextResponse.json(services);
    }

    if (!body.serviceId) {
      return NextResponse.json(
        { error: "serviceId e obrigatorio." },
        { status: 400 },
      );
    }

    if (body.action === "hide") {
      const ok = await hideMissingService(body.serviceId);

      if (!ok) {
        return NextResponse.json(
          { error: "Servico ausente nao encontrado para esconder." },
          { status: 404 },
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (body.action === "remove") {
      const ok = await removeServiceState(body.serviceId);

      if (!ok) {
        return NextResponse.json(
          { error: "Servico nao encontrado para remover." },
          { status: 404 },
        );
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Acao invalida." },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao aplicar a alteracao.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
