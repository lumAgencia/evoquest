import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function removeUserFolder(admin: ReturnType<typeof createClient>, bucket: string, userId: string) {
  const { data, error } = await admin.storage.from(bucket).list(userId, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error && !error.message.toLowerCase().includes("not found")) throw error;
  const paths = (data || []).filter((item) => item.name !== ".emptyFolderPlaceholder").map((item) => `${userId}/${item.name}`);
  if (!paths.length) return;
  const removed = await admin.storage.from(bucket).remove(paths);
  if (removed.error) throw removed.error;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Método não permitido", { status: 405, headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sessão ausente.");
    const token = authorization.replace("Bearer ", "");
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== "EXCLUIR") {
      return new Response(JSON.stringify({ error: "Confirmação inválida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, adminKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Sessão inválida ou expirada.");
    const userId = authData.user.id;

    await removeUserFolder(admin, "profile-photos", userId);
    await removeUserFolder(admin, "progress-photos", userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-account", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Falha ao excluir conta." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
