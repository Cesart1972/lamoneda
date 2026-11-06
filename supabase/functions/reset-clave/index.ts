// =========================================================
// EDGE FUNCTION: reset-clave
// ---------------------------------------------------------
// "Olvidé mi clave": el cliente recibe un código por email y pone una clave nueva.
// No depende de la distribuidora. (Respaldo: el panel genera el código y se manda
// por WhatsApp; se confirma acá igual, con accion "confirmar".)
//
// Paso 1 — la app manda: { accion: "pedir", slug, telefono }
//   → { ok: true, email_tapado: "a***@gmail.com" }
//   → { ok: false, motivo: "sin_cuenta" | "demasiados_pedidos" | ... }
// Paso 2 — la app manda: { accion: "confirmar", slug, telefono, codigo, clave_nueva }
//   → { ok: true, sesion: {...} }   (queda conectado con la clave nueva)
//   → { ok: false, motivo: "codigo_incorrecto" | "codigo_invalido" | "clave_corta" }
//
// Secretos que hay que cargar en Supabase (Edge Functions → Secrets):
//   RESEND_API_KEY   la clave de Resend
//   MAIL_REMITENTE   por ejemplo avisos@lamoneda.com.ar (dominio verificado en Resend)
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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_REMITENTE = Deno.env.get("MAIL_REMITENTE") ?? "";

function escapar(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function mandarMail(para: string, empresa: string, nombre: string, codigo: string): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#222">
      <h2 style="margin:0 0 12px">${escapar(empresa)}</h2>
      <p>Hola ${escapar(nombre)}, este es tu código para poner una clave nueva:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;
                background:#f3f3f3;border-radius:8px;padding:16px">${escapar(codigo)}</p>
      <p>Vence en 15 minutos. Si no lo pediste vos, ignorá este mail: tu clave sigue igual.</p>
    </div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${empresa} <${MAIL_REMITENTE}>`,
      to: [para],
      subject: `Tu código para entrar a ${empresa}: ${codigo}`,
      html,
      text: `Hola ${nombre}, tu código es ${codigo}. Vence en 15 minutos. Si no lo pediste vos, ignorá este mail.`,
    }),
  });
  if (!r.ok) console.error("reset-clave: Resend", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error("metodo_invalido", 405);

  const d = await leerCuerpo(req);
  if (!d) return error("datos_invalidos");
  const slug = String(d.slug ?? "");
  if (!/^[a-z0-9-]+$/.test(slug)) return error("empresa_inexistente");
  if (!telefonoValido(d.telefono)) return error("telefono_invalido");
  const telefono = d.telefono as string;

  const servicio = clienteServicio();
  const { data: empresaId } = await servicio.rpc("empresa_por_slug", { p_slug: slug });
  if (!empresaId) return error("empresa_inexistente");

  // ---------- Paso 1: mandar el código por email ----------
  if (d.accion === "pedir") {
    if (!RESEND_API_KEY || !MAIL_REMITENTE) return error("mail_no_configurado", 500);
    const { data, error: e } = await servicio.rpc("crear_codigo_reset_email", {
      p_empresa: empresaId, p_telefono: telefono,
    });
    if (e) return error(e.message);              // demasiados_pedidos
    if (!data) return error("sin_cuenta", 404);  // ese celular no tiene cuenta (o no cargó email)
    const enviado = await mandarMail(data.email, data.empresa, data.nombre, data.codigo);
    if (!enviado) return error("mail_no_enviado", 502);
    return responder({ ok: true, email_tapado: data.email_tapado });
  }

  // ---------- Paso 2: código + clave nueva ----------
  if (d.accion === "confirmar") {
    if (!claveValida(d.clave_nueva)) return error("clave_corta");
    const clave = d.clave_nueva as string;
    const { data: userId, error: e } = await servicio.rpc("validar_codigo_reset", {
      p_empresa: empresaId, p_telefono: telefono, p_codigo: String(d.codigo ?? ""),
    });
    if (e) return error(e.message);              // codigo_invalido (vencido, usado o bloqueado)
    if (!userId) return error("codigo_incorrecto");

    const { error: eClave } = await servicio.auth.admin.updateUserById(userId, { password: clave });
    if (eClave) {
      console.error("reset-clave: updateUser", eClave.message);
      return error("error_interno", 500);
    }
    const sesion = await iniciarSesion(emailInterno(telefono, slug), clave);
    return responder({ ok: true, sesion });
  }

  return error("accion_invalida");
});
