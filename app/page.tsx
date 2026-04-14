"use client";

import { useCallback, useEffect, useState } from "react";
import type { Service } from "@/types/service";

type FetchState = {
  error: string | null;
  loading: boolean;
  updatedAt: string | null;
};

function getStatusStyle(status: string) {
  return status === "running"
    ? "bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.75)]"
    : "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.65)]";
}

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>({
    error: null,
    loading: true,
    updatedAt: null,
  });

  const loadServices = useCallback(async () => {
    setFetchState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await fetch("/api/services", {
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.detail || payload?.error || "Falha ao carregar os serviços.",
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

  useEffect(() => {
    void loadServices();

    const interval = window.setInterval(() => {
      void loadServices();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadServices]);

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
                  Painel central para os serviços do seu servidor Docker
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Descoberta automática por labels, visão operacional imediata e
                  acesso rápido aos containers que importam.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <span className="block text-xs uppercase tracking-[0.24em] text-slate-500">
                  Serviços
                </span>
                <span className="mt-1 block text-2xl font-semibold text-white">
                  {services.length}
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <span className="block text-xs uppercase tracking-[0.24em] text-slate-500">
                  Última leitura
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

            return (
              <a
                className={[
                  "group relative overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] p-6 backdrop-blur transition duration-200",
                  isReady
                    ? "hover:-translate-y-1 hover:border-sky-300/30 hover:bg-slate-900/90 hover:shadow-glow"
                    : "cursor-not-allowed opacity-70",
                ].join(" ")}
                href={isReady ? service.url : "#"}
                key={service.id}
                onClick={(event) => {
                  if (!isReady) {
                    event.preventDefault();
                  }
                }}
                rel="noreferrer"
                target="_blank"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_35%)] opacity-0 transition group-hover:opacity-100" />
                <div className="relative flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl shadow-inner shadow-black/20">
                        <span aria-hidden="true">{service.icon}</span>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-white">
                          {service.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-400">
                          {service.url || "URL não configurada"}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${getStatusStyle(service.status)}`}
                      />
                      {service.status}
                    </span>
                  </div>

                  <p className="text-sm leading-7 text-slate-300">
                    {service.description}
                  </p>

                  <div className="mt-auto flex items-center justify-between text-sm text-slate-400">
                    <span>Nova aba</span>
                    <span className="text-sky-200 transition group-hover:text-sky-100">
                      Acessar
                    </span>
                  </div>
                </div>
              </a>
            );
          })}

          {!fetchState.loading && services.length === 0 && !fetchState.error ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-900/60 p-10 text-center backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Nenhum serviço encontrado
                </p>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
                  Adicione as labels <code className="rounded bg-white/5 px-1.5 py-0.5">hub.enable=true</code>,{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5">hub.name</code> e{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5">hub.url</code> aos seus containers para
                  exibi-los aqui.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
