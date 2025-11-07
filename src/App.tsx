import { useCallback, useEffect, useMemo, useState } from "react";

import { Pin } from "lucide-react";
import pkg from "../package.json" assert { type: "json" };
import { Button } from "./components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card.tsx";
import "./index.css";
import {
  type ConfigResponse,
  type Domain,
  type Environment,
  type Project,
  type Resource,
  configResponseSchema,
  resolveDomainUrl,
  resourceSections,
} from "./lib/dokploy";

type FetchState =
  | { status: "loading"; data: ConfigResponse | null; error: string | null }
  | { status: "idle"; data: ConfigResponse | null; error: string | null };

type ResourceEntry = {
  id: string;
  projectKey: string;
  title: string;
  projectName: string;
  environmentName: string | undefined;
  sectionLabel: string;
  urls: string[];
};

const PIN_STORAGE_KEY = "dokdash:pinnedResources";

function formatTimestamp(input?: string) {
  if (!input) return null;
  try {
    return new Date(input).toLocaleString();
  } catch {
    return input;
  }
}

function getDomainLabel(url: string): string {
  try {
    const host = new URL(url).hostname;
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    return parts.slice(-2).join(".");
  } catch {
    return url;
  }
}

function flattenProjects(projects: Project[]): ResourceEntry[] {
  const entries: ResourceEntry[] = [];

  projects.forEach((project, index) => {
    const projectName = project.name ?? "Unnamed project";
    const projectKey =
      project.projectId ?? project.name ?? `project-${index.toString(36)}`;

    (project.environments ?? []).forEach((environment: Environment) => {
      const environmentName = environment.name ?? undefined;

      resourceSections.forEach((section) => {
        const resources = environment[section.key] as Resource[] | undefined;
        if (!resources) return;

        resources.forEach((resource: Resource, resIndex) => {
          const urls =
            (resource.domains ?? [])
              ?.map((domain: Domain | null | undefined) =>
                domain ? resolveDomainUrl(domain) : null
              )
              .filter(
                (value: string | null): value is string =>
                  typeof value === "string" && value.length > 0
              ) ?? [];

          const title =
            resource.name ?? resource.appName ?? "Untitled resource";
          const id =
            resource.composeId ??
            resource.applicationId ??
            resource.databaseId ??
            `${project.projectId ?? projectName}-${section.key}-${resIndex}`;

          entries.push({
            id,
            projectKey,
            title,
            projectName,
            environmentName,
            sectionLabel: section.label,
            urls,
          });
        });
      });
    });
  });

  return entries.sort((a, b) => {
    if (a.projectName !== b.projectName) {
      return a.projectName.localeCompare(b.projectName);
    }
    return a.title.localeCompare(b.title);
  });
}

export function App() {
  const appVersion = (pkg as { version?: string }).version ?? "0.0.0";
  const [state, setState] = useState<FetchState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [pinnedResources, setPinnedResources] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(PIN_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch (error) {
      console.warn("Failed to restore pinned resources", error);
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PIN_STORAGE_KEY,
        JSON.stringify(pinnedResources)
      );
    } catch (error) {
      console.warn("Failed to persist pinned resources", error);
    }
  }, [pinnedResources]);

  const togglePin = useCallback((entryId: string) => {
    setPinnedResources((prev) => {
      if (prev.includes(entryId)) {
        return prev.filter((key) => key !== entryId);
      }
      return [...prev, entryId];
    });
  }, []);

  const loadConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));

    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const parsed = configResponseSchema.parse(payload);

      setState({ status: "idle", data: parsed, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setState({ status: "idle", data: null, error: message });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const isLoading = state.status === "loading";
  const meta = state.data?.meta;
  const lastUpdated = meta ? formatTimestamp(meta.fetchedAt) : null;

  const entries = useMemo(
    () => (state.data ? flattenProjects(state.data.projects) : []),
    [state.data]
  );

  const pinnedEntries = useMemo(
    () => entries.filter((entry) => pinnedResources.includes(entry.id)),
    [entries, pinnedResources]
  );

  const regularEntries = useMemo(
    () => entries.filter((entry) => !pinnedResources.includes(entry.id)),
    [entries, pinnedResources]
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900/40 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/70">
              Dokdash
            </p>
            <h1 className="mt-1 text-3xl font-light text-emerald-200">
              {meta?.title ?? "Applications Overview"}
            </h1>
            {meta?.description && (
              <p className="mt-2 max-w-xl text-sm text-slate-400">
                {meta.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 text-sm text-slate-400 sm:items-end">
            <span>v{appVersion}</span>
            {lastUpdated && <span>Updated {lastUpdated}</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8">
        {state.error && (
          <Card className="border-red-500/40 bg-red-500/10 text-red-100">
            <CardHeader>
              <CardTitle className="text-red-100">
                Unable to load Dokploy data
              </CardTitle>
              <CardDescription className="text-red-200">
                {state.error}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button
                onClick={loadConfig}
                variant="outline"
                className="border-red-500/40 text-red-100 hover:bg-red-500/10"
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading && !state.data && (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-28 animate-pulse rounded-lg bg-slate-900/70"
              />
            ))}
          </div>
        )}

        {state.data && entries.length === 0 && !isLoading && !state.error && (
          <Card className="border-slate-800/60 bg-slate-900/70">
            <CardHeader>
              <CardTitle>No deployments found</CardTitle>
              <CardDescription>
                We connected to Dokploy but did not find applications or
                services to show.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {pinnedEntries.length > 0 && (
          <section className="space-y-3">
            <header className="text-sm uppercase tracking-wide text-slate-500">
              Pinned
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              {pinnedEntries.map((entry) => (
                <DashboardCard
                  key={entry.id}
                  entry={entry}
                  pinnedResources={pinnedResources}
                  togglePin={togglePin}
                />
              ))}
            </div>
          </section>
        )}

        {regularEntries.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {regularEntries.map((entry) => (
              <DashboardCard
                key={entry.id}
                entry={entry}
                pinnedResources={pinnedResources}
                togglePin={togglePin}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

type DashboardCardProps = {
  entry: ResourceEntry;
  pinnedResources: string[];
  togglePin: (entryId: string) => void;
};

function DashboardCard({
  entry,
  pinnedResources,
  togglePin,
}: DashboardCardProps) {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-900/70 p-4 shadow-sm shadow-slate-950/30 transition hover:border-emerald-400/40 hover:shadow-emerald-500/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-slate-100">{entry.title}</h2>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-emerald-200">
            {entry.projectName}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            pinnedResources.includes(entry.id) ? "Unpin project" : "Pin project"
          }
          onClick={() => togglePin(entry.id)}
          className="text-emerald-200 hover:bg-transparent focus-visible:ring-0"
        >
          <Pin
            className={`transition-opacity duration-150 ${
              pinnedResources.includes(entry.id)
                ? "text-emerald-300 opacity-50 hover:opacity-100"
                : "text-emerald-200 opacity-50 hover:opacity-100"
            } ${
              pinnedResources.includes(entry.id)
                ? "fill-emerald-300"
                : "fill-transparent"
            }`}
            size={16}
          />
        </Button>
      </div>

      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
        {entry.environmentName ?? "Environment"} · {entry.sectionLabel}
      </p>

      {entry.urls.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.urls.map((url) => (
            <a
              key={`${entry.id}-${url}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              title={url}
              className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-300/60 hover:text-emerald-200"
            >
              {getDomainLabel(url)}
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">No domains configured.</p>
      )}
    </div>
  );
}

export default App;
