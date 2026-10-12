/**
 * Seed script to create the superadmin account.
 *
 * Credentials:
 *   Email:    admin@arecosys.tech
 *   Password: admin@123
 *   Role:     admin  (highest privilege in app_role enum)
 *
 * Usage:  node seed_superadmin.cjs
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

// ── Superadmin credentials ─────────────────────────────────────────────
const SUPERADMIN_EMAIL = "admin@arecosys.tech";
const SUPERADMIN_PASSWORD = "admin@123";
const SUPERADMIN_NAME = "Super Admin";
const SUPERADMIN_ROLE = "admin"; // highest role in app_role enum

// ── Supabase client with service_role (bypasses RLS) ───────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedSuperAdmin() {
  console.log("🔧  Seeding superadmin account …");
  console.log(`    Email:    ${SUPERADMIN_EMAIL}`);
  console.log(`    Password: ${SUPERADMIN_PASSWORD}`);
  console.log(`    Role:     ${SUPERADMIN_ROLE}`);
  console.log();

  // Use the existing admin_create_driver RPC (works for any role)
  const { data, error } = await supabase.rpc("admin_create_driver", {
    p_email: SUPERADMIN_EMAIL,
    p_password: SUPERADMIN_PASSWORD,
    p_full_name: SUPERADMIN_NAME,
    p_role: SUPERADMIN_ROLE,
  });

  if (error) {
    console.error("❌  Failed to create superadmin:", error.message);
    console.error("    Details:", JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log("✅  Superadmin created/updated successfully!");
  console.log(`    User ID: ${data}`);
  console.log();
  console.log("You can now log in at the web dashboard with:");
  console.log(`    Email:    ${SUPERADMIN_EMAIL}`);
  console.log(`    Password: ${SUPERADMIN_PASSWORD}`);
}

seedSuperAdmin().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
