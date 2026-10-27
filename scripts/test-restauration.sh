#!/bin/sh
set -e
cd "$(dirname "$0")/.."
. ./.env
DERNIER=$(ls -t /var/sauvegardes/colibris/base_*.sql.gz | head -1)
PSQL="docker compose exec -T db psql -U $DB_ADMIN_UTILISATEUR -q"

$PSQL -d postgres -c "DROP DATABASE IF EXISTS test_restauration;" -c "CREATE DATABASE test_restauration;"
gunzip -c "$DERNIER" | $PSQL -d test_restauration
$PSQL -d test_restauration -tc 'SELECT count(*) AS utilisateurs FROM "Utilisateur";'
$PSQL -d postgres -c "DROP DATABASE test_restauration;"
echo "Restauration OK à partir de : $DERNIER"