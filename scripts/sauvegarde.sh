#!/bin/sh
# Sauvegarde quotidienne : base de données + fichiers déposés. Conserve 14 jours.
set -e
umask 077
cd "$(dirname "$0")/.."
. ./.env
DOSSIER=/var/sauvegardes/colibris
DATE=$(date +%F_%H%M)
mkdir -p "$DOSSIER"

docker compose exec -T db pg_dump -U "$DB_ADMIN_UTILISATEUR" -d "$DB_NOM" --no-owner > "$DOSSIER/base_$DATE.sql"
gzip "$DOSSIER/base_$DATE.sql"
gzip -t "$DOSSIER/base_$DATE.sql.gz"

docker compose exec -T api tar -C /app/storage -czf - . > "$DOSSIER/fichiers_$DATE.tar.gz"

find "$DOSSIER" -type f -mtime +14 -delete
echo "Sauvegarde OK : $DATE"