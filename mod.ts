// @deno-types="@types/react-dom/server"
import { renderToReadableStream } from "react-dom/server";
import * as Islands from "@bureaudouble/islet/server";
import { join } from "@std/path/join";

import type { PluginMiddleware } from "outils/fresh/types.ts";
import createRenderer from "outils/fresh/createRenderPipe.ts";
import createSqlitePlugin from "outils/database/sqlite/createSqlitePlugin.ts";
import createHmrPlugin from "outils/fresh/createHmrPlugin.ts";
import createStaticFilePlugin from "outils/fresh/createStaticFilePlugin.ts";
import createTailwindPlugin from "outils/fresh/createTailwindPlugin.ts";
import { composeRoutes, type rutt } from "outils/fresh/composeRoutes.ts";

import { namespace } from "@/src/lib/useClient.ts";

const withWritePermission: boolean =
  (await Deno.permissions.query({ name: "write", path: Deno.cwd() })).state ===
    "granted";

interface BureauConfig {
  database: any;
  databaseKey?: string;
  basePath?: string;
  getS3Uri: () => URL; // Replace with the actual function signature if different
  s3Client: any;
  analyticsConfig?: any;
  isDev?: boolean;
  middleware?: PluginMiddleware[];
}

export default async ({
  basePath = "/admin/",
  database,
  databaseKey = "database.sqlite",
  getS3Uri,
  s3Client,
  isDev,
  middleware: middlewareFns,
  analyticsConfig,
}: BureauConfig): Promise<any> => {
  Islands.setNamespaceParentPathSegment(namespace, basePath ?? "");

  const sqlitePlugin = createSqlitePlugin({
    namespace: "default",
    database,
    withDeserializeNestedJSON: true,
  });
  const hmr = await createHmrPlugin({
    basePath,
    path: "/__hmr",
    hmrEventName: Islands.hmrNewIsletSnapshotEventName,
  });
  const islet = await Islands.createIsletPlugin({
    jsxImportSource: "react",
    baseUrl: new URL(import.meta.url),
    namespace,
    prefix: join(basePath ?? "", "/islands/"),
    importMapFileName: "deno.json",
    esbuildOptions: {
      minify: !(isDev ?? withWritePermission),
      logLevel: "verbose",
    },
  });
  const tailwindPlugin = await createTailwindPlugin({
    basePath,
    baseUrl: new URL(".", import.meta.url).href,
    tailwindConfig: () => import("@/tailwind.config.ts"),
  });
  const staticFilePlugin = createStaticFilePlugin({ baseUrl: import.meta.url });

  const routes: rutt.Routes[] = [
    composeRoutes({
      routes: [],
      middlewares: [
        middlewareFns,
        hmr.middlewares,
        sqlitePlugin.middlewares,
      ],
      renderer: createRenderer<JSX.Element>({
        virtualNodePipe: (vn: React.ReactNode) =>
          Promise.resolve(vn)
            .then(renderToReadableStream)
            .then(Islands.addScripts)
            .then(tailwindPlugin.transformEnd),
      }),
    }),
    composeRoutes({
      routes: [islet.routes, hmr.routes, staticFilePlugin.routes],
    }),
  ];

  return Object.assign(
    {},
    ...Object.values(Object.assign({}, ...routes)),
  ) as rutt.Routes;
};

if (withWritePermission && import.meta.url.includes("file://")) {
  setTimeout(async () => {
    const islands = await import("@bureaudouble/islet/client");
    const exports: Record<string, string> = { ".": "./mod.ts" };
    islands.getIslands(namespace).data.forEach((island) => {
      const path = island.url;
      const value = "./" +
        path.replace("file://" + import.meta.dirname + "/", "");
      const key = value.replace(/.(j|t)s(x|)$/, "");
      exports[key.replace("@", "_")] = value;
      exports[value.replace("@", "_")] = value;
    });

    let denoConfig: any = {};
    const configPath = join(import.meta.dirname!, "deno.json");
    try {
      denoConfig = JSON.parse(await Deno.readTextFile(configPath));
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error; // Ignore file not found to create a new one
    }
    if (JSON.stringify(denoConfig.export) === JSON.stringify(exports)) return;
    denoConfig.exports = exports;
    await Deno.writeTextFile(configPath, JSON.stringify(denoConfig, null, 2));
  }, 10);
}
