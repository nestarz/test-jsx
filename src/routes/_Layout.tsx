import { FreshContext } from "outils/fresh/types.ts";
import type { SqliteMiddlewareState } from "outils/database/sqlite/createSqlitePlugin.ts";
import type { ClientMiddleware } from "@/src/middlewares/client.ts";
import { Toast, Toaster } from "@/src/components/ui/sonner.tsx";

export default (
  req: Request,
  ctx: FreshContext<ClientMiddleware & SqliteMiddlewareState<any>>,
) => {
  const tables = ctx.state.tables;
  const tableConfig = tables.find(
    (table) => table.name === ctx.params.tableName,
  );
  const { data, error } = ctx.state.session.flash("x-sonner") ?? {};
  return (
    <body className="grid grid-cols-5 min-h-screen">
      <ctx.Component />
      <Toaster />
      <Toast string={data ? "Success" : error ? "Error" : null} />
    </body>
  );
};
