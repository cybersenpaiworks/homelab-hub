"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Service, ServiceUrlSource } from "@/types/service";

type FetchState = {
  error: string | null;
  loading: boolean;
  updatedAt: string | null;
};

type SaveState = {
  error: string | null;
  serviceId: string | null;
};

function getStatusStyle(status: string) {
  return status === "running"
    ? "bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.75)]"
    : "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.65)]";
}

function getUrlSourceCopy(urlSource: ServiceUrlSource) {
  switch (urlSource) {
    case "manual":
      return {
        label: "Manual",
        tone: "border-amber-400/30 bg-amber-400/10 text-amber-100",
      };
    case "label":
      return {
        label: "Label",
        tone: "border-sky-400/30 bg-sky-400/10 text-sky-100",
      };
    case "derived":
      return {
        label: "Proxy",
        tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
      };
    default:
      return {
        label: "Sem URL",
        tone: "border-white/10 bg-white/5 text-slate-300",
      };
  }
}

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [controlsServiceId, setControlsServiceId] = useState<string | null>(null);
  const [holdServiceId, setHoldServiceId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({
    error: null,
    serviceId: null,
  });
  const [fetchState, setFetchState] = useState<FetchState>({
    error: null,
    loading: true,
    updatedAt: null,
  });
  const holdTimerRef = useRef<number | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const loadServices = useCallback(async () => {
    setFetchState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await fetch("/api/services", {
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.detail || payload?.error || "Falha ao carregar os servicos.",
        );
      }

      setServices(Array.isArray(payload) ? payload : []);
      setFetchState({
        error: null,
        loading: false,
        updatedAt: new Date().toLocaleTimeString("pt-BR"),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Falha inesperada ao consultar a API.";

      setFetchState({
        error: message,
        loading: false,
        updatedAt: null,
      });
    }
  }, []);

  const editingService = useMemo(
    () => services.find((service) => service.id === editingServiceId) ?? null,
    [editingServiceId, services],
  );

  const startEditing = useCallback((service: Service) => {
    setEditingServiceId(service.id);
    setControlsServiceId(service.id);
    setUrlDraft(service.url || service.autoUrl || "");
    setSaveState({ error: null, serviceId: null });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingServiceId(null);
    setUrlDraft("");
    setSaveState({ error: null, serviceId: null });
  }, []);

  const openControlsWithDelay = useCallback(
    (serviceId: string) => {
      clearHoldTimer();
      setHoldServiceId(serviceId);

      holdTimerRef.current = window.setTimeout(() => {
        setControlsServiceId(serviceId);
        setHoldServiceId(null);
        holdTimerRef.current = null;
      }, 5000);
    },
    [clearHoldTimer],
  );

  const cancelControlsDelay = useCallback(
    (serviceId: string) => {
      if (holdServiceId === serviceId) {
        clearHoldTimer();
        setHoldServiceId(null);
      }
    },
    [clearHoldTimer, holdServiceId],
  );

  const closeControls = useCallback(() => {
    setControlsServiceId(null);
    setHoldServiceId(null);
    clearHoldTimer();

    if (editingServiceId) {
      cancelEditing();
    }
  }, [cancelEditing, clearHoldTimer, editingServiceId]);

  const saveManualUrl = useCallback(async () => {
    if (!editingService) {
      return;
    }

    setSaveState({ error: null, serviceId: editingService.id });

    try {
      const response = await fetch("/api/services", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceId: editingService.id,
          url: urlDraft,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao salvar a URL manual.");
      }

      await loadServices();
      cancelEditing();
      setControlsServiceId(editingService.id);
    } catch (error) {
      setSaveState({
        error:
          error instanceof Error
            ? error.message
            : "Falha inesperada ao salvar a URL manual.",
        serviceId: editingService.id,
      });
    }
  }, [cancelEditing, editingService, loadServices, urlDraft]);

  const resetToAutomaticUrl = useCallback(
    async (serviceId: string) => {
      setSaveState({ error: null, serviceId });

      try {
        const response = await fetch("/api/services", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ serviceId }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || "Falha ao restaurar a URL automatica.",
          );
        }

        await loadServices();

        if (editingServiceId === serviceId) {
          cancelEditing();
        }

        setSaveState({ error: null, serviceId: null });
      } catch (error) {
        setSaveState({
          error:
            error instanceof Error
              ? error.message
              : "Falha inesperada ao restaurar a URL automatica.",
          serviceId,
        });
      }
    },
    [cancelEditing, editingServiceId, loadServices],
  );

  useEffect(() => {
    void loadServices();

    const interval = window.setInterval(() => {
      void loadServices();
    }, 30000);

    return () => {
      window.clearInterval(interval);
      clearHoldTimer();
    };
  }, [clearHoldTimer, loadServices]);

  return (
    <main className="min-h-screen bg-transparent px-6 py-10 text-slate-100 sm:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(8,47,73,0.72))] p-8 shadow-glow backdrop-blur xl:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex w-fit items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
                Homelab Hub
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Painel central para os servicos do seu servidor Docker
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Descoberta automatica por labels, prioridade para o proxy
                  reverso e override manual quando voce precisar corrigir uma
                  URL sem recriar o container.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <span className="block text-xs uppercase tracking-[0.24em] text-slate-500">
                  Servicos
                </span>
                <span className="mt-1 block text-2xl font-semibold text-white">
                  {services.length}
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <span className="block text-xs uppercase tracking-[0.24em] text-slate-500">
                  Ultima leitura
                </span>
                <span className="mt-1 block text-sm font-medium text-white">
                  {fetchState.updatedAt ?? "Aguardando"}
                </span>
              </div>

              <button
                className="inline-flex items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={fetchState.loading}
                onClick={() => void loadServices()}
                type="button"
              >
                {fetchState.loading ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
          </div>
        </section>

        {fetchState.error ? (
          <section className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-200/80">
              Erro de descoberta
            </p>
            <p className="mt-3 text-base text-rose-100">{fetchState.error}</p>
          </section>
        ) : null}

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {fetchState.loading && services.length === 0
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] p-6 backdrop-blur"
                  key={`skeleton-${index}`}
                >
                  <div className="animate-pulse space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-white/10" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 rounded-full bg-white/10" />
                          <div className="h-3 w-40 rounded-full bg-white/5" />
                        </div>
                      </div>
                      <div className="h-8 w-24 rounded-full bg-white/10" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded-full bg-white/5" />
                      <div className="h-3 rounded-full bg-white/5" />
                      <div className="h-3 w-3/4 rounded-full bg-white/5" />
                    </div>
                  </div>
                </div>
              ))
            : null}

          {services.map((service) => {
            const isReady = Boolean(service.url);
            const urlSource = getUrlSourceCopy(service.urlSource);
            const isEditing = editingServiceId === service.id;
            const areControlsOpen = controlsServiceId === service.id;
            const isHolding = holdServiceId === service.id;
            const isSaving = saveState.serviceId === service.id;

            return (
              <article
                className={[
                  "group relative overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] p-6 backdrop-blur transition duration-200",
                  isReady
                    ? "hover:-translate-y-1 hover:border-sky-300/30 hover:bg-slate-900/90 hover:shadow-glow"
                    : "opacity-85",
                ].join(" ")}
                key={service.id}
              >
                {isReady ? (
                  <a
                    aria-label={`Abrir ${service.name}`}
                    className="absolute inset-0 z-0 rounded-[28px]"
                    href={service.url}
                    rel="noreferrer"
                    target="_blank"
                  />
                ) : null}

                <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_35%)] opacity-0 transition group-hover:opacity-100" />

                <div className="relative z-10 flex h-full flex-col gap-5 pointer-events-none">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl shadow-inner shadow-black/20">
                        <span aria-hidden="true">{service.icon}</span>
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-white">
                          {service.name}
                        </h2>
                        <p className="mt-1 break-all text-sm text-slate-400">
                          {service.url || "URL nao configurada"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[42%] xl:justify-end">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${getStatusStyle(service.status)}`}
                        />
                        {service.status}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${urlSource.tone}`}
                      >
                        {urlSource.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm leading-7 text-slate-300">
                    {service.description}
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      URL efetiva
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-200">
                      {service.url || "URL nao configurada"}
                    </p>
                    {service.autoUrl ? (
                      <p className="mt-2 break-all text-xs text-slate-400">
                        Automatico: {service.autoUrl}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        Defina `hub.url` ou `hub.host`/`hub.domain` para usar a
                        URL do proxy reverso automaticamente.
                      </p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                    <span className="text-slate-400">
                      {isReady ? "Clique em qualquer area do card para abrir." : "Configure uma URL para ativar o acesso."}
                    </span>

                    <button
                      className="pointer-events-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-300/30 hover:bg-white/10"
                      onMouseEnter={() => openControlsWithDelay(service.id)}
                      onMouseLeave={() => cancelControlsDelay(service.id)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      type="button"
                    >
                      {isHolding ? "Segure para configurar..." : "Configurar"}
                    </button>
                  </div>

                  {areControlsOpen ? (
                    <div className="pointer-events-auto rounded-[24px] border border-sky-400/20 bg-sky-400/10 p-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Configuracao de URL
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              O card continua priorizando o proxy reverso automaticamente, mas voce pode sobrescrever a URL manualmente.
                            </p>
                          </div>

                          <button
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                            onClick={closeControls}
                            type="button"
                          >
                            Fechar
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-300/30 hover:bg-white/10"
                            onClick={() => startEditing(service)}
                            type="button"
                          >
                            Editar URL
                          </button>
                          <button
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-300/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={service.urlSource !== "manual" || isSaving}
                            onClick={() => void resetToAutomaticUrl(service.id)}
                            type="button"
                          >
                            Usar automatico
                          </button>
                        </div>

                        {isEditing ? (
                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="space-y-3">
                              <label className="block">
                                <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                                  URL manual
                                </span>
                                <input
                                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                                  onChange={(event) => setUrlDraft(event.target.value)}
                                  placeholder={
                                    service.autoUrl ||
                                    "https://servico.seudominio.com.br"
                                  }
                                  value={urlDraft}
                                />
                              </label>

                              {service.autoUrl ? (
                                <p className="break-all text-xs text-slate-400">
                                  URL automatica detectada: {service.autoUrl}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400">
                                  Dica: use `hub.url=https://app.seudominio.com.br` ou `hub.host=app.seudominio.com.br` para priorizar o proxy reverso.
                                </p>
                              )}

                              {saveState.error &&
                              saveState.serviceId === service.id ? (
                                <p className="text-sm text-rose-200">
                                  {saveState.error}
                                </p>
                              ) : null}

                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isSaving || !urlDraft.trim()}
                                  onClick={() => void saveManualUrl()}
                                  type="button"
                                >
                                  {isSaving ? "Salvando..." : "Salvar URL"}
                                </button>
                                <button
                                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                                  onClick={cancelEditing}
                                  type="button"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!fetchState.loading && services.length === 0 && !fetchState.error ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-900/60 p-10 text-center backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Nenhum servico encontrado
                </p>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
                  Adicione as labels{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5">
                    hub.enable=true
                  </code>
                  ,{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5">
                    hub.name
                  </code>{" "}
                  e{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5">
                    hub.url
                  </code>{" "}
                  aos seus containers. Se preferir derivar a URL publica do
                  proxy reverso, use{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5">
                    hub.host
                  </code>{" "}
                  ou{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5">
                    hub.domain
                  </code>
                  .
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
