import { createClient } from "@supabase/supabase-js";

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const kv = {
  async get<T>(key: string): Promise<T | null> {
    const { data } = await client()
      .from("kv_store")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!data) return null;
    try { return JSON.parse(data.value) as T; } catch { return data.value as unknown as T; }
  },
  async set(key: string, value: string): Promise<void> {
    await client()
      .from("kv_store")
      .upsert({ key, value, updated_at: new Date().toISOString() });
  },
  async del(key: string): Promise<void> {
    await client().from("kv_store").delete().eq("key", key);
  },
};
