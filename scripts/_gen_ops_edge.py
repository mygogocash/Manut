from pathlib import Path

ROOT = Path("/Users/kunanonjarat/Developer/new-tbh-intranet-dev")

def w(rel, content):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + "\n", encoding="utf-8")
    print("w", rel)

def app_page(title, api_path):
    return '''import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type Item = { id: string; name?: string; title?: string; partner?: string; status?: string };

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/''' + api_path + '''?limit=50`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: Item[] };
        if (!cancelled) setItems(json.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#8B6914" /></View>;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>''' + title + '''</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.sub}>No records yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.headline}>{item.name ?? item.title ?? item.partner ?? item.id}</Text>
            {item.status ? <Text style={styles.meta}>{item.status}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#F7F3EB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F3EB" },
  title: { fontSize: 28, fontWeight: "700", color: "#3D2B1F", marginBottom: 16 },
  sub: { color: "#8B7355" },
  error: { color: "#B42318", marginBottom: 12 },
  card: { borderBottomWidth: 1, borderBottomColor: "#E8DFD2", paddingVertical: 14, gap: 4 },
  headline: { fontSize: 18, fontWeight: "600", color: "#3D2B1F" },
  meta: { color: "#8B7355", fontSize: 13 },
});
'''

def team_route(slug, svc, qschema, rschema, vimport, read, write):
    read_perms = ", ".join("PERMISSIONS." + p for p in read)
    write_perms = ", ".join("PERMISSIONS." + p for p in write)
    extra_import = ", " + rschema if rschema else ""
    reminder_routes = ""
    if rschema:
        reminder_routes = """
  .get("/reminder-settings", requirePermission(""" + read_perms + """), async (c) =>
    c.json(await """ + svc + """.getReminderRecipients(c.var.db)),
  )
  .put(
    "/reminder-settings",
    requirePermission(""" + write_perms + """),
    zValidator("json", """ + rschema + """),
    async (c) => c.json(await """ + svc + """.setReminderRecipients(c.var.db, c.req.valid("json"))),
  )"""
    export_var = slug.replace("-", "_")
    return """import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { """ + qschema + extra_import + """ } from \"""" + vimport + """\";
import { """ + svc + """ } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const """ + export_var + """ = new Hono<AppEnv>()
  .get("/", requirePermission(""" + read_perms + """), zValidator("query", """ + qschema + """), async (c) =>
    c.json(await """ + svc + """.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .get("/dashboard", requirePermission(""" + read_perms + """), async (c) =>
    c.json({ data: await """ + svc + """.dashboard(c.var.db) }),
  )""" + reminder_routes + """
  .get("/:id", requirePermission(""" + read_perms + """), async (c) =>
    c.json({ data: await """ + svc + """.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  );
"""

def stub_route(slug, svc, qschema, vimport, perm):
    export_var = slug.replace("-", "_")
    return """import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { """ + qschema + """ } from \"""" + vimport + """\";
import { """ + svc + """ } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const """ + export_var + """ = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.""" + perm + """), zValidator("query", """ + qschema + """), async (c) =>
    c.json(await """ + svc + """.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .get("/:id", requirePermission(PERMISSIONS.""" + perm + """), async (c) =>
    c.json({ data: await """ + svc + """.getById(c.var.db, c.req.param("id")) }),
  );
"""

for slug, title, api in [
  ("it-crm", "IT CRM", "it-crm"),
  ("legal-crm", "Legal CRM", "legal-crm"),
  ("product-crm", "Product CRM", "product-crm"),
  ("qa-crm", "QA CRM", "qa-crm"),
  ("accounting-crm", "Accounting CRM", "accounting-crm"),
  ("voucher-crm", "Voucher CRM", "voucher-crm"),
  ("it-billing", "IT Billing", "it-billing"),
  ("it-access", "IT Access", "it-access"),
  ("it-operations", "IT Operations", "it-operations/dashboard"),
  ("proposals", "Proposals", "proposals"),
  ("legal-announcements", "Legal Announcements", "legal-announcements"),
  ("validator-monitor", "Validator Monitor", "validator-monitor"),
]:
    w(f"apps/app/app/(dashboard)/{slug}/index.tsx", app_page(title, api))

team = [
  ("it-crm", "itCrmService", "itProjectQuerySchema", "reminderSettingsSchema", "@nexora/contracts/modules/it-crm/it-crm.validation", ["IT_CRM_READ","IT_CRM_READ_ALL","PROJECTS_READ","PROJECTS_READ_ALL"], ["IT_CRM_UPDATE","IT_CRM_MANAGE","PROJECTS_UPDATE","PROJECTS_MANAGE"]),
  ("legal-crm", "legalCrmService", "legalProjectQuerySchema", None, "@nexora/contracts/modules/legal-crm/legal-crm.validation", ["LEGAL_CRM_READ","LEGAL_CRM_READ_ALL","PROJECTS_READ","PROJECTS_READ_ALL"], ["LEGAL_CRM_UPDATE","LEGAL_CRM_MANAGE","PROJECTS_UPDATE","PROJECTS_MANAGE"]),
  ("product-crm", "productCrmService", "productProjectQuerySchema", None, "@nexora/contracts/modules/product-crm/product-crm.validation", ["PRODUCT_CRM_READ","PRODUCT_CRM_READ_ALL","PROJECTS_READ","PROJECTS_READ_ALL"], ["PRODUCT_CRM_UPDATE","PRODUCT_CRM_MANAGE","PROJECTS_UPDATE","PROJECTS_MANAGE"]),
  ("qa-crm", "qaCrmService", "qaProjectQuerySchema", None, "@nexora/contracts/modules/qa-crm/qa-crm.validation", ["QA_CRM_READ","QA_CRM_READ_ALL","PROJECTS_READ","PROJECTS_READ_ALL"], ["QA_CRM_UPDATE","QA_CRM_MANAGE","PROJECTS_UPDATE","PROJECTS_MANAGE"]),
  ("accounting-crm", "accountingCrmService", "accountingProjectQuerySchema", None, "@nexora/contracts/modules/accounting-crm/accounting-crm.validation", ["ACCOUNTING_CRM_READ","ACCOUNTING_CRM_READ_ALL","PROJECTS_READ","PROJECTS_READ_ALL"], ["ACCOUNTING_CRM_UPDATE","ACCOUNTING_CRM_MANAGE","PROJECTS_UPDATE","PROJECTS_MANAGE"]),
]
for args in team:
    w("apps/edge/src/routes/" + args[0] + ".ts", team_route(*args))

print('generated app + team routes')
