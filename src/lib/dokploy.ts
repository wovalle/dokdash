import { z } from "zod";

export const domainSchema = z
  .object({
    domainId: z.string().optional(),
    host: z.string().min(1),
    https: z.boolean().optional(),
    port: z.number().optional().nullable(),
    path: z.string().optional().nullable(),
    serviceName: z.string().optional().nullable(),
  })
  .passthrough();

export const resourceSchema = z
  .object({
    composeId: z.string().optional(),
    applicationId: z.string().optional(),
    databaseId: z.string().optional(),
    name: z.string().optional(),
    appName: z.string().optional(),
    composeStatus: z.string().optional(),
    status: z.string().optional(),
    domains: z.array(domainSchema).optional().nullable(),
  })
  .passthrough();

export const environmentSchema = z
  .object({
    environmentId: z.string().optional(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    applications: z.array(resourceSchema).optional(),
    compose: z.array(resourceSchema).optional(),
    postgres: z.array(resourceSchema).optional(),
    mysql: z.array(resourceSchema).optional(),
    mariadb: z.array(resourceSchema).optional(),
    mongo: z.array(resourceSchema).optional(),
    redis: z.array(resourceSchema).optional(),
  })
  .passthrough();

export const projectSchema = z
  .object({
    projectId: z.string().optional(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    environments: z.array(environmentSchema).optional(),
  })
  .passthrough();

export const projectListSchema = z.array(projectSchema);

export const openApiInfoSchema = z
  .object({
    info: z
      .object({
        title: z.string().optional(),
        version: z.string().optional(),
        description: z.string().optional(),
      })
      .optional(),
    servers: z
      .array(
        z.object({
          url: z.string(),
        }),
      )
      .optional(),
  })
  .passthrough();

export const configResponseSchema = z.object({
  projects: projectListSchema,
  meta: z.object({
    title: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    servers: z.array(z.string()).default([]),
    fetchedAt: z.string(),
  }),
});

export type Domain = z.infer<typeof domainSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ConfigResponse = z.infer<typeof configResponseSchema>;

export function resolveDomainUrl(domain: Domain): string | null {
  if (!domain?.host) return null;
  const protocol = domain.https ? "https" : "http";
  const port = domain.port ? `:${domain.port}` : "";
  const path = domain.path && domain.path !== "/" ? domain.path : "";
  return `${protocol}://${domain.host}${port}${path}`;
}

export const resourceSections = [
  { key: "applications", label: "Applications" },
  { key: "compose", label: "Compose Stacks" },
  { key: "postgres", label: "Postgres" },
  { key: "mysql", label: "MySQL" },
  { key: "mariadb", label: "MariaDB" },
  { key: "mongo", label: "MongoDB" },
  { key: "redis", label: "Redis" },
] as const satisfies ReadonlyArray<{
  key: keyof Environment;
  label: string;
}>;


