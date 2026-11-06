#!/bin/bash
# Uso: tests/probar.sh ruta/a/productos.json   (el array de products-data.js en JSON)
cd "$(dirname "$0")/.."
cp "$1" /tmp/productos_prueba.json && chmod 644 /tmp/productos_prueba.json
./tests/cargar.sh
psql -h /tmp -p 5433 -U postgres -d prueba -v archivo=/tmp/productos_prueba.json -f tests/pruebas.sql 2>&1 | grep -v NOTICE
