import { createClient } from "@supabase/supabase-js";
import { cfg } from "./config";

export const supabase = createClient(
  cfg.supabaseUrl,
  cfg.supabaseServiceKey
);
