import { serve } from "bun";
import index from "./index.html";
import {
  configResponseSchema,
  openApiInfoSchema,
  projectListSchema,
} from "./lib/dokploy";

const server = serve({
  routes: {
    "/api/config": async () => {
      try {
        const baseUrl = Bun.env.DOKPLOY_BASE_URL ?? "";
        const apiKey = Bun.env.DOKPLOY_API_KEY ?? "";

        const sanitizedBase = sanitizeBaseUrl(baseUrl);
        if (!sanitizedBase) {
          return Response.json(
            { error: "Missing DOKPLOY_BASE_URL environment variable." },
            { status: 500 }
          );
        }

        const headers: HeadersInit = {
          Accept: "application/json",
        };

        if (apiKey) {
          headers["x-api-key"] = apiKey;
        }

        const openApiUrl = `${sanitizedBase}/settings.getOpenApiDocument`;
        const projectsUrl = `${sanitizedBase}/project.all`;

        const [openApiResponse, projectsResponse] = await Promise.all([
          fetch(openApiUrl, { headers }),
          fetch(projectsUrl, { headers }),
        ]);

        if (!openApiResponse.ok) {
          throw new Error(
            `Unable to load Dokploy OpenAPI document (${openApiResponse.status} ${openApiResponse.statusText})`
          );
        }

        if (!projectsResponse.ok) {
          throw new Error(
            `Unable to load Dokploy projects (${projectsResponse.status} ${projectsResponse.statusText})`
          );
        }

        const openApiJson = await openApiResponse.json();
        const projectsJson = await projectsResponse.json();

        const openApi = openApiInfoSchema.parse(openApiJson);
        const projects = projectListSchema.parse(projectsJson);

        const payload = configResponseSchema.parse({
          projects,
          meta: {
            title: openApi.info?.title,
            version: openApi.info?.version,
            description: openApi.info?.description,
            servers: (openApi.servers ?? []).map((server) => server.url),
            fetchedAt: new Date().toISOString(),
          },
        });

        return Response.json(payload, {
          headers: {
            "cache-control": "no-store",
          },
        });
      } catch (error) {
        console.error("Failed to build Dokploy config payload", error);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return Response.json({ error: message }, { status: 500 });
      }
    },
    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);

function sanitizeBaseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/\/$/, "");
  if (!/\/api(?:\/|$)/.test(normalized)) {
    normalized = `${normalized}/api`;
  }

  return normalized;
}
