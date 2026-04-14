import { NextResponse } from "next/server";
import { listServices, resetManualServiceUrl, updateManualServiceUrl } from "@/lib/services";

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
