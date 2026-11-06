// =========================================================
// EDGE FUNCTION: registro-cliente
// ---------------------------------------------------------
// Crea la cuenta del cliente al tocar "Enviar pedido" por primera vez.
//
// La app manda (POST, JSON):
//   { slug, nombre, telefono, clave, perfil, nombre_negocio?, entrega?, email, acepta_privacidad }
// Responde:
//   { ok: true, estado: "aprobado" | "pendiente", sesion: {...} }  → la app ya queda conectada
//   { ok: false, motivo: "..." }                                    → la app muestra un mensaje
//
// Después, para entrar desde otro celular, la app inicia sesión con
// emailInterno(telefono, slug) + clave (función emailInterno, más abajo).
// =========================================================

// ---------- Ayudas (iguales en las dos funciones) ----------
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cliente con la clave de servicio: SOLO dentro del servidor, nunca en la app
export function clienteServicio(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// Cliente que actúa como un usuario (con su token)
export function clienteComoUsuario(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function clienteAnonimo(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

// La app está en otro dominio (lamoneda.com.ar): hay que permitirlo
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function responder(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Error con un código corto que la app traduce a un mensaje amable
export function error(motivo: string, estado = 400): Response {
  return responder({ ok: false, motivo }, estado);
}

// Celular en formato internacional: +5492346123456
export function telefonoValido(t: unknown): t is string {
  return typeof t === "string" && /^\+[0-9]{10,15}$/.test(t);
}

// Usuario interno de Supabase de un cliente: un mismo celular puede ser
// cliente de dos distribuidoras, con claves distintas.
// No es un email real (no recibe mails): el email real está en la tabla clientes.
export function emailInterno(telefono: string, slug: string): string {
  return `${telefono.replace("+", "")}@${slug}.clientes.ces-art.app`;
}

export function claveValida(c: unknown): c is string {
  return typeof c === "string" && c.length >= 8 && c.length <= 72;
}

export async function leerCuerpo(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo = await req.json();
    return cuerpo && typeof cuerpo === "object" ? cuerpo : null;
  } catch {
    return null;
  }
}

// Inicia sesión y devuelve la sesión para que la app quede conectada
export async function iniciarSesion(email: string, clave: string) {
  const { data, error: e } = await clienteAnonimo().auth.signInWithPassword({ email, password: clave });
  if (e || !data.session) return null;
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user_id: data.user?.id,
  };
}

// ---------- Función ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error("metodo_invalido", 405);

  const d = await leerCuerpo(req);
  if (!d) return error("datos_invalidos");

  const slug = String(d.slug ?? "");
  const nombre = String(d.nombre ?? "").trim();
  const email = String(d.email ?? "").trim().toLowerCase();
  const perfil = d.perfil === "negocio" ? "negocio" : "hogar";

  if (!/^[a-z0-9-]+$/.test(slug)) return error("empresa_inexistente");
  if (nombre.length < 2) return error("nombre_invalido");
  if (!telefonoValido(d.telefono)) return error("telefono_invalido");
  if (!claveValida(d.clave)) return error("clave_corta");
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return error("email_invalido");
  if (d.acepta_privacidad !== true) return error("aceptar_privacidad");
  const telefono = d.telefono as string;
  const clave = d.clave as string;

  const servicio = clienteServicio();
  const { data: empresaId } = await servicio.rpc("empresa_por_slug", { p_slug: slug });
  if (!empresaId) return error("empresa_inexistente");

  // 1. Usuario de Supabase (el email interno no recibe mails; ya queda confirmado)
  const usuarioEmail = emailInterno(telefono, slug);
  const { data: creado, error: eCrear } = await servicio.auth.admin.createUser({
    email: usuarioEmail,
    password: clave,
    email_confirm: true,
    user_metadata: { empresa: slug, telefono },
  });
  if (eCrear || !creado.user) {
    // Ya existe: ese celular ya tiene cuenta en esta distribuidora
    if (/already|registered|exists/i.test(eCrear?.message ?? "")) return error("telefono_registrado", 409);
    console.error("registro-cliente: createUser", eCrear?.message);
    return error("error_interno", 500);
  }

  // 2. Sesión del nuevo usuario
  const sesion = await iniciarSesion(usuarioEmail, clave);
  if (!sesion) {
    await servicio.auth.admin.deleteUser(creado.user.id);
    return error("error_interno", 500);
  }

  // 3. Ficha de cliente (si pedía por WhatsApp, usa su misma ficha)
  const comoCliente = clienteComoUsuario(sesion.access_token);
  const { data: ficha, error: eFicha } = await comoCliente.rpc("registrar_cliente", {
    p_empresa: empresaId,
    p_nombre: nombre,
    p_telefono: telefono,
    p_perfil: perfil,
    p_nombre_negocio: perfil === "negocio" ? String(d.nombre_negocio ?? "").trim() || null : null,
    p_entrega: d.entrega === "envio" || d.entrega === "retiro" ? d.entrega : null,
    p_email: email,
    p_acepta_privacidad: true,
  });
  if (eFicha) {
    // Deshace el usuario para que pueda volver a intentar
    await servicio.auth.admin.deleteUser(creado.user.id);
    return error(eFicha.message || "error_interno");
  }

  return responder({ ok: true, estado: ficha?.estado ?? "aprobado", sesion });
});
