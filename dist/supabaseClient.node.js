// Supabase client cho Node
import { createClient } from "@supabase/supabase-js";


const SUPABASE_URL = "https://lowimtwtrqynycmuecfk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvd2ltdHd0cnF5bnljbXVlY2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzIzNzcsImV4cCI6MjA4Mzk0ODM3N30.RtYMSA913_mIaDaXgj7R9-GJd4t3rPQDI-UP7GywdFU";


export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);