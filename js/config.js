// =====================================================
//  CONFIGURAÇÃO DO SUPABASE
//  Troque os dois valores abaixo pelos do SEU projeto:
//  Supabase > Project Settings > API
//  (a chave "anon public" pode ficar no site, ela é pública)
// =====================================================
const SUPABASE_URL = "https://pfjhbmxrpjrzuxtbcadb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jh0K2xgFQBfXqqG7xDtiQg_DSKAuZNM";

// O login é "nome.sobrenome". O Supabase exige e-mail,
// então o sistema completa automaticamente com este domínio:
//   rafael.macedo  ->  rafael.macedo@jmacedo.internal
const DOMINIO_LOGIN = "jmacedo.internal";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
