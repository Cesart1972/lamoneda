// Genera carga_inicial_<slug>.sql a partir de products-data.js
// Uso: node generar_carga.js ruta/products-data.js slug "Nombre"
const fs = require("fs");
const [archivo, slug = "la-moneda", nombre = "La Moneda"] = process.argv.slice(2);

let fuente = fs.readFileSync(archivo, "utf8").replace(/^﻿/, "");
fuente = fuente.replace(/const products\s*=/, "globalThis.products =");
eval(fuente);
const datos = JSON.stringify(globalThis.products);
if (datos.includes("$json$")) throw new Error("Los datos contienen $json$");

const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

const sql = `-- =========================================================
-- CARGA INICIAL DE LOS PRODUCTOS DE ${nombre.toUpperCase()}
-- ---------------------------------------------------------
-- Generado el ${hoy} a partir de products-data.js
-- (${globalThis.products.length} filas: productos y posters).
--
-- Se corre UNA SOLA VEZ en el SQL Editor de Supabase (query nueva → Run).
-- Carga categorías (en el orden del Excel), proveedores, grupos/posters,
-- productos, precios, ofertas y las marcas de SIN STOCK. No genera novedades.
-- El stock queda "sin cargar" (cantidades vacías) hasta contarlo en el panel.
-- Si ${nombre} ya tiene productos, se frena y no toca nada.
-- =========================================================

begin;

-- La carga la hace el dueño de ${nombre} (la función controla ese permiso)
select set_config('request.jwt.claim.sub',
  (select m.user_id::text from public.miembros m join public.empresas e on e.id = m.empresa_id
    where e.slug = '${slug}' and 'dueno' = any (m.roles) and m.activo limit 1), true);
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('request.jwt.claim.sub', true), 'role', 'authenticated')::text, true);

-- Freno: si ya hay productos, no se vuelve a cargar
select case when exists (select 1 from public.productos p join public.empresas e on e.id = p.empresa_id
                          where e.slug = '${slug}')
            then public.error_app('${slug.replace(/-/g, "_")}_ya_tiene_productos') end;

select public.importar_productos(
  (select id from public.empresas where slug = '${slug}'),
  $json$${datos}$json$::jsonb,
  true
) as resultado;

commit;

-- Para revisar después (en una query aparte):
-- select k.nombre as categoria, count(p.id) as productos
--   from categorias k left join productos p on p.categoria_id = k.id
--  group by k.nombre, k.orden order by k.orden;
`;
const salida = `carga_inicial_${slug.replace(/-/g, "_")}.sql`;
fs.writeFileSync(salida, sql);
console.log(`${salida}: ${(sql.length / 1024).toFixed(0)} KB, ${globalThis.products.length} filas`);
