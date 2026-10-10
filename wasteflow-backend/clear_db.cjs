/**
 * Clears all data from the WasteFlow database EXCEPT the superadmin account.
 *
 * Preserved:  admin@arecosys.tech  (auth user + profile + role)
 * Deleted:    All other auth users, all business data tables
 *
 * Usage:  node clear_db.cjs
 */

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

// ── Load .env ──────────────────────────────────────────────────────────
const env = fs
  .readFileSync(".env", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const parts = line.split("=");
    if (parts.length > 1) {
      const key = parts[0].trim();
      const val = parts
        .slice(1)
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, "");
      acc[key] = val;
    }
    return acc;
  }, {});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const SUPERADMIN_EMAIL = "admin@arecosys.tech";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function clearDB() {
  console.log("🗑️  Clearing database (preserving superadmin) …\n");

  // 1. Get the superadmin user ID so we can protect it
  const { data: adminUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", SUPERADMIN_EMAIL)
    .single();

  const adminId = adminUser?.id;
  if (!adminId) {
    console.error(`❌  Superadmin (${SUPERADMIN_EMAIL}) not found in profiles!`);
    console.error("   Run seed_superadmin.cjs first.");
    process.exit(1);
  }
  console.log(`🔒  Preserving superadmin: ${SUPERADMIN_EMAIL} (${adminId})\n`);

  // 2. Clear all business/operational data tables (order matters for FK deps)
  const dataTables = [
    "collection_items",    // FK → collection_events
    "gps_events",          // FK → collection_trips, bwgs, vehicles, employees
    "daily_bwg_status",    // FK → bwgs, collection_events
    "diesel_logs",         // FK → vehicles
    "waybills",            // FK → collection_trips, vehicles, employees, routes
    "collection_events",   // FK → collection_trips, bwgs
    "collection_trips",    // FK → routes, vehicles, employees
    "route_stops",         // FK → routes, bwgs
    "audit_logs",          // no FK deps
    "bwgs",                // FK → routes, employees
    "vehicles",            // FK → employees, routes  (clear before employees)
    "employees",           // FK → routes
    "waste_types",
    "routes",
  ];

  for (const table of dataTables) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows
    if (error) {
      console.error(`  ❌  ${table}: ${error.message}`);
    } else {
      console.log(`  ✅  ${table} — cleared`);
    }
  }

  // 3. Clear profiles and user_roles for non-superadmin users
  console.log();

  const { error: rolesErr } = await supabase
    .from("user_roles")
    .delete()
    .neq("user_id", adminId);
  console.log(rolesErr ? `  ❌  user_roles: ${rolesErr.message}` : "  ✅  user_roles — cleared (kept superadmin)");

  const { error: profilesErr } = await supabase
    .from("profiles")
    .delete()
    .neq("id", adminId);
  console.log(profilesErr ? `  ❌  profiles: ${profilesErr.message}` : "  ✅  profiles — cleared (kept superadmin)");

  // 4. Delete all other auth users via Admin API
  console.log("\n  Removing other auth users …");
  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error(`  ❌  Could not list auth users: ${listErr.message}`);
  } else {
    const toDelete = (authUsers?.users ?? []).filter((u) => u.id !== adminId);
    console.log(`  Found ${toDelete.length} non-superadmin auth user(s) to delete.`);
    for (const u of toDelete) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error(`    ❌  ${u.email}: ${delErr.message}`);
      } else {
        console.log(`    🗑️  deleted ${u.email}`);
      }
    }
  }

  console.log("\n✅  Database cleared! Only superadmin remains.");
  console.log(`   ${SUPERADMIN_EMAIL} / admin@123`);
}

clearDB().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
