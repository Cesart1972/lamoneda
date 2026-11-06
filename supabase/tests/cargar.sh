#!/bin/bash
# Arma la base de prueba desde cero con todas las migraciones
P="psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists prueba" -c "create database prueba" >/dev/null
for f in tests/00_simular_supabase.sql migrations/*.sql; do
  $P -d prueba -f "$f" 2>&1 | grep -v NOTICE || true
done
