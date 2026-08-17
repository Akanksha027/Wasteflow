function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const ALLOWED_ROLES = new Set(["admin", "supervisor", "driver", "field_worker"]);

async function repairStaffLogin(
  supabaseAdmin: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  },
  email: string,
  password: string,
  fullName: string,
  role: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("admin_create_driver", {
    p_email: email,
    p_password: password,
    p_full_name: fullName || email.split("@")[0],
    p_role: role,
  });
  if (error || !data) return null;
  return String(data);
}

export async function handleDriverAccountRequest(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: isManager } = await supabaseAdmin.rpc("is_manager", {
      _user_id: userData.user.id,
    });
    if (!isManager) {
      return json({ error: "Only managers can create login accounts." }, 403);
    }

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      role?: string;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const role = ALLOWED_ROLES.has(String(body.role)) ? String(body.role) : "driver";

    if (!email || !email.includes("@") || password.length < 6) {
      return json(
        { error: "A valid email and a password of at least 6 characters are required." },
        400,
      );
    }

    const { data: existingId } = await supabaseAdmin.rpc("get_user_id_by_email", {
      email_input: email,
    });

    let userId: string | null = existingId ? String(existingId) : null;
    const meta = { full_name: fullName || email.split("@")[0], role };

    if (userId) {
      const updated = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: meta,
      });
      if (updated.error) {
        userId = await repairStaffLogin(supabaseAdmin, email, password, fullName, role);
        if (!userId) {
          return json(
            { error: updated.error.message || "Could not update login for this email." },
            409,
          );
        }
      }
    } else {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: meta,
      });
      if (created.error || !created.data.user) {
        userId = await repairStaffLogin(supabaseAdmin, email, password, fullName, role);
        if (!userId) {
          return json({ error: created.error?.message ?? "Failed to create login account." }, 400);
        }
      } else {
        userId = created.data.user.id;
      }
      const autoCode = "EMP-" + userId.replace(/-/g, "").slice(0, 6).toUpperCase();
      await supabaseAdmin
        .from("employees")
        .update({ is_archived: true, user_id: null } as never)
        .eq("employee_code", autoCode);
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role } as never);
    if (roleErr) {
      return json({ error: roleErr.message }, 400);
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName || email.split("@")[0],
    } as never);

    return json({ userId }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create login account.";
    return json({ error: message }, 500);
  }
}
