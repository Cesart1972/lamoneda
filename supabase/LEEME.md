# Base de datos en Supabase · PWA distribuidores (Ces.Art)

Modelo v4 (05-11-2026). Un solo proyecto de Supabase para todas las distribuidoras.
El detalle de cada decisión está en los documentos del proyecto `modelo-de-datos` y `auditoria-tablas`.

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `migrations/20261105000001_esquema.sql` | Las tablas |
| `migrations/20261105000002_base.sql` | Quién es quién, estado del abono y los automatismos (novedades, lista de compras, avisos de faltantes) |
| `migrations/20261105000003_negocio.sql` | Las funciones del negocio: precios, catálogo, pedidos, armado, stock, compras, clientes, faltantes, novedades, abono, cobros, informes e importación del Excel |
| `migrations/20261105000004_seguridad.sql` | La seguridad: quién puede ver y tocar cada cosa |
| `migrations/20261105000005_clave_por_email.sql` | Email obligatorio y recuperar la clave por email |
| `functions/registro-cliente/index.ts` | Crea la cuenta del cliente (celular + clave + email) |
| `functions/reset-clave/index.ts` | "Olvidé mi clave": manda un código por email (Resend) y pone la clave nueva |
| `config.toml` | Configuración de las funciones (para la CLI de Supabase) |
| `tests/` | Pruebas que se corren en una base local (no se cargan en Supabase) |

## 1. Crear el proyecto y cargar la base (una sola vez)

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y un proyecto nuevo.
   - Región: **São Paulo** (la más cercana).
   - Guardá la contraseña de la base en un lugar seguro.
2. En el proyecto: menú **SQL Editor** → **New query**.
3. Copiá y pegá el archivo `20261105000001_esquema.sql` completo → **Run**. Tiene que decir "Success".
4. Repetí con los otros cuatro, **en orden** (`…02`, `…03`, `…04`, `…05`).
5. Menú **Authentication** → **Sign In / Providers** → **Email**: dejá activado "Email" y **desactivá "Confirm email"**
   (las cuentas de los clientes las crea la función `registro-cliente`, ya confirmadas).

## 2. Primer alta (Ces.Art y La Moneda)

1. **Authentication** → **Users** → **Add user**: creá tu usuario de Ces.Art (tu email y una clave).
   Copiá el "User UID" que aparece.
2. En el **SQL Editor**, con ese UID:

```sql
-- Vos como dueño de la plataforma
insert into plataforma_miembros (user_id, nombre, rol)
values ('PEGAR-TU-UID', 'Ces.Art', 'dueno_plataforma');

-- La Moneda (abono pagado hasta este mes)
insert into empresas (nombre, slug, abono_monto, abono_pagado_hasta)
values ('La Moneda', 'la-moneda', 30000, date_trunc('month', now())::date)
returning id;   -- copiá este id

-- Vos como dueño de La Moneda (como dueño de la plataforma ya podés cobrar y rendir)
insert into miembros (empresa_id, user_id, nombre, roles)
values ('PEGAR-ID-LA-MONEDA', 'PEGAR-TU-UID', 'César', '{dueno}');
```

3. La carga de los productos (`importar_productos`) se hace desde el panel cuando esté listo,
   o se prepara un archivo SQL a partir de `products-data.js`.

## 3. Mails (Resend) para recuperar la clave

1. Creá una cuenta gratis en [resend.com](https://resend.com) (3000 mails por mes, 100 por día).
2. **Domains** → **Add domain** → `lamoneda.com.ar`. Resend te muestra unos registros DNS (TXT y MX).
3. En **Netlify** → **Domains** → `lamoneda.com.ar` → **DNS settings** → **Add new record**: cargá cada uno tal cual.
   Esperá a que Resend muestre el dominio como **Verified** (puede tardar unas horas).
   Esto no toca la página: solo autoriza a mandar mails en nombre del dominio.
4. **API Keys** → **Create API key** (permiso "Sending access"). Copiala: se ve una sola vez.

## 4. Cargar las funciones del servidor

En Supabase: menú **Edge Functions** → **Deploy a new function** → **Via Editor**.

1. Nombre `registro-cliente` → borrá el ejemplo, pegá `functions/registro-cliente/index.ts` → **Deploy**.
2. Nombre `reset-clave` → pegá `functions/reset-clave/index.ts` → **Deploy**.
3. En cada función → **Details** (o Settings) → **desactivá "Enforce JWT verification"**
   (la app las llama antes de que el cliente tenga sesión; las funciones controlan todo adentro).
4. **Edge Functions** → **Secrets** → agregá:
   - `RESEND_API_KEY` = la clave de Resend
   - `MAIL_REMITENTE` = `avisos@lamoneda.com.ar`

   (Las claves de Supabase `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya están cargadas solas.)

**Primera prueba:** cuando las funciones estén cargadas, avisame y las probamos juntos con un cliente de prueba.
Si Supabase rechazara el formato del usuario interno de los clientes (`5492346…@la-moneda.clientes.ces-art.app`),
se cambia en una sola línea (`emailInterno`).

## Reglas para cambios futuros

- **Nunca editar** un archivo de `migrations/` que ya se cargó en Supabase: los cambios van en un archivo nuevo
  con fecha más reciente (por ejemplo `20261120000001_lo_que_cambia.sql`).
- Supabase da permisos amplios a las tablas nuevas: **toda tabla nueva necesita** `enable row level security`
  y sus reglas, igual que en `…04_seguridad.sql`. El "Security Advisor" de Supabase avisa si falta alguna.
- La clave **service_role** (Settings → API) nunca va en la app ni en GitHub: solo en las Edge Functions.

## Qué falta (próximas etapas)

- Edge Functions `subir-foto` (publica en GitHub juntando varias fotos) y `notificar` (avisos al celular).
- Storage privado para las fotos del frente (plan PRO).
- Conectar la app del cliente y armar los paneles.

## Pruebas (para quien programa)

Se corren en un PostgreSQL local con `tests/probar.sh productos.json`, donde `productos.json` es el array
de `products-data.js` en JSON. Prueban 86 situaciones: precios del servidor, compra mínima, pedido repetido sin señal,
dos clientes pidiendo lo último a la vez, armado con faltantes y CRÍTICO, compras que liberan las marcas,
faltantes al precio original, novedades por perfil, cobro con código, rendición, calendario del abono,
informes de utilidades, recuperación de clave por email y que nadie vea ni cambie lo que no le corresponde.
Las Edge Functions se prueban una vez cargadas en Supabase.
