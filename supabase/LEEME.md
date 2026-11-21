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

Dos usuarios separados (decisión de César 17-11-2026): uno para Ces.Art y otro para La Moneda.
Así, como La Moneda se ve exactamente lo mismo que va a ver cualquier distribuidora que compre la app.

1. **Authentication** → **Users** → **Add user** → **Create new user**, dos veces:
   - Usuario **Ces.Art**: el email de Ces.Art y una clave. Copiá su "User UID".
   - Usuario **La Moneda**: el email de La Moneda y otra clave. Copiá su "User UID".
   - Dejá marcado "Auto Confirm User".
2. En el **SQL Editor**, en una query nueva, pegá esto reemplazando los dos UID (corré todo junto):

```sql
-- 1. Ces.Art: dueño de la plataforma (da de alta distribuidoras, cobra abonos, confirma rendiciones)
insert into plataforma_miembros (user_id, nombre, rol)
values ('UID-DE-CES-ART', 'Ces.Art', 'dueno_plataforma');

-- 2. La Moneda: la distribuidora (abono pagado hasta este mes)
--    y su dueño (el usuario de La Moneda)
with nueva as (
  insert into empresas (nombre, slug, abono_monto, abono_pagado_hasta)
  values ('La Moneda', 'la-moneda', 30000, date_trunc('month', now())::date)
  returning id
)
insert into miembros (empresa_id, user_id, nombre, roles)
select id, 'UID-DE-LA-MONEDA', 'César', '{dueno}' from nueva;
```

3. Para comprobar, corré en otra query: `select nombre, slug from empresas;` → tiene que aparecer La Moneda.

Más adelante, si alguien más cobra, se lo da de alta como `cobrador` en `plataforma_miembros`
y se le asignan sus distribuidoras en `cobrador_empresas`. Hoy cobrás vos como dueño de la plataforma.

## 2b. Carga inicial de productos (una sola vez por distribuidora)

1. **SQL Editor** → **New query** → pegá `carga/carga_inicial_la_moneda.sql` completo → **Run**.
   Si aparece el aviso de "destructive operations", confirmá.
2. Tiene que mostrar una fila `resultado` con los números (productos nuevos, grupos, categorías).
3. Si se corre de nuevo, se frena con `la_moneda_ya_tiene_productos` y no toca nada.

Para otra distribuidora: `node carga/generar_carga.js ruta/products-data.js slug "Nombre"`
genera su archivo (necesita su empresa y su dueño ya dados de alta).
Después de la carga inicial, los cambios de productos se hacen desde el panel.

## 3. Mails (Resend) para recuperar la clave

Los mails salen del dominio del producto **Dosys** (`dosysapp.com.ar`), no del de cada distribuidora.
Cada mail lleva como remitente el nombre de la distribuidora: "La Moneda <avisos@mail.dosysapp.com.ar>".
Así sirve para todas las distribuidoras sin tocar nada.

1. Registrá `dosysapp.com.ar` en [NIC Argentina](https://nic.ar) y delegalo a un DNS
   (por ejemplo Netlify DNS, como `lamoneda.com.ar`, o Cloudflare, que es gratis).
2. La cuenta de Resend va **a nombre de Ces.Art** (es de la plataforma): creala en [resend.com](https://resend.com)
   (gratis: 3000 mails por mes, 100 por día, hasta 3 dominios).
3. **Domains** → **Add domain** → `mail.dosysapp.com.ar` (un subdominio: Resend lo recomienda para que la
   reputación de los envíos no afecte al dominio principal). Resend te muestra unos registros DNS (TXT y MX).
4. Cargá esos registros tal cual en el DNS de `dosysapp.com.ar` y esperá a que Resend lo muestre como **Verified**
   (puede tardar unas horas).
5. **API Keys** → **Create API key** (permiso "Sending access"). Copiala: se ve una sola vez.

Mientras esto no esté, todo lo demás funciona; solo no anda "recuperar la clave por email"
(el respaldo por WhatsApp desde el panel sí).

## 4. Cargar las funciones del servidor

En Supabase: menú **Edge Functions** → **Deploy a new function** → **Via Editor**.

1. Nombre `registro-cliente` → **borrá todo el ejemplo que trae Supabase** (las 26 líneas), pegá
   `functions/registro-cliente/index.ts` completo → **Deploy**.
2. Nombre `reset-clave` → igual: borrá el ejemplo, pegá `functions/reset-clave/index.ts` → **Deploy**.
3. En cada función → **Details** (o Settings) → **desactivá "Enforce JWT verification"**
   (la app las llama antes de que el cliente tenga sesión; las funciones controlan todo adentro).
4. **Edge Functions** → **Secrets** → agregá:
   - `RESEND_API_KEY` = la clave de Resend
   - `MAIL_REMITENTE` = `avisos@mail.dosysapp.com.ar`

   (Las claves de Supabase ya están cargadas solas: las funciones usan las nuevas `SUPABASE_PUBLISHABLE_KEYS` /
   `SUPABASE_SECRET_KEYS` o, en proyectos viejos, `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.)

**Primera prueba:** cuando las funciones estén cargadas, avisame y las probamos juntos con un cliente de prueba.
Si Supabase rechazara el formato del usuario interno de los clientes (`5492346…@la-moneda.clientes.dosysapp.com.ar`),
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
