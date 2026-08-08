import { createClient } from "@/app/api/util/supabase/client";
import { cookies } from "next/headers";

const supabase = createClient();

export async function GET() {
  const { data, error } = await supabase.from("users").select("*");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ data }, { status: 200 });
}
