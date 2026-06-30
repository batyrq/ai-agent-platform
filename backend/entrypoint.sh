#!/bin/sh
# Точка входа backend-контейнера:
#  1) применяем миграции Prisma к БД;
#  2) запускаем seed в фоне (демо-данные «из коробки», не блокирует старт);
#  3) поднимаем сервер.
set -e

echo "[entrypoint] Применяю миграции Prisma..."
npx prisma migrate deploy

echo "[entrypoint] Запускаю seed в фоне..."
( npm run seed || echo "[entrypoint] seed пропущен/упал — не критично" ) &

echo "[entrypoint] Стартую сервер..."
exec node dist/src/main.js
