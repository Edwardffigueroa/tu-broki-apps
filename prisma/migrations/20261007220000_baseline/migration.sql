-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "contabilidad";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "diagramas";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "roadmap";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "wiki";

-- CreateEnum
CREATE TYPE "wiki"."version_source" AS ENUM ('web', 'import', 'system');

-- CreateTable
CREATE TABLE "contabilidad"."config" (
    "clave" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "contabilidad"."metas" (
    "mes" TEXT NOT NULL,
    "unidades" JSONB NOT NULL DEFAULT '{}',
    "ventas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "utilidad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metas_pkey" PRIMARY KEY ("mes")
);

-- CreateTable
CREATE TABLE "contabilidad"."movimientos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "fecha_pendiente" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "quien" TEXT NOT NULL DEFAULT '',
    "tercero" TEXT NOT NULL DEFAULT '',
    "concepto" TEXT NOT NULL DEFAULT '',
    "notas" TEXT NOT NULL DEFAULT '',
    "servicio" TEXT,
    "cantidad" INTEGER,
    "costo_directo" DECIMAL(14,2),
    "medio" TEXT,
    "categoria" TEXT,
    "servicio_cac" TEXT,
    "creado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramas"."diagrama_etiquetas" (
    "diagrama_id" UUID NOT NULL,
    "etiqueta_id" UUID NOT NULL,

    CONSTRAINT "diagrama_etiquetas_pkey" PRIMARY KEY ("diagrama_id","etiqueta_id")
);

-- CreateTable
CREATE TABLE "diagramas"."diagramas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'swimlane',
    "grupo_id" UUID,
    "modelo" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagramas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramas"."etiquetas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramas"."grupos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap"."respaldos" (
    "id" BIGSERIAL NOT NULL,
    "tablero_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "csv" TEXT NOT NULL,
    "creado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respaldos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap"."tableros" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 1,
    "actualizado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tableros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap"."tareas" (
    "id" TEXT NOT NULL,
    "tablero_id" TEXT NOT NULL DEFAULT 'principal',
    "padre_id" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "grupo" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "responsable" TEXT NOT NULL DEFAULT '',
    "estimacion_dias" DECIMAL,
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki"."assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sha256" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "original_name" TEXT,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki"."page_aliases" (
    "alias_key" TEXT NOT NULL,
    "page_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_aliases_pkey" PRIMARY KEY ("alias_key")
);

-- CreateTable
CREATE TABLE "wiki"."page_links" (
    "source_page_id" UUID NOT NULL,
    "target_key" TEXT NOT NULL,
    "target_page_id" UUID,

    CONSTRAINT "page_links_pkey" PRIMARY KEY ("source_page_id","target_key")
);

-- CreateTable
CREATE TABLE "wiki"."page_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "page_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'TuBroki',
    "message" TEXT,
    "source" "wiki"."version_source" NOT NULL DEFAULT 'web',
    "restored_from" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki"."pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "position" TEXT NOT NULL DEFAULT 'a0',
    "title" TEXT NOT NULL,
    "title_key" TEXT NOT NULL,
    "icon" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "current_version_id" UUID,
    "draft_title" TEXT,
    "draft_content" TEXT,
    "draft_revision" INTEGER NOT NULL DEFAULT 0,
    "draft_base_version_id" UUID,
    "draft_updated_at" TIMESTAMPTZ(6),
    "search" tsvector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "kind" TEXT NOT NULL DEFAULT 'page',
    "asset_id" UUID,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki"."version_assets" (
    "version_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,

    CONSTRAINT "version_assets_pkey" PRIMARY KEY ("version_id","asset_id")
);

-- CreateIndex
CREATE INDEX "movimientos_estado_idx" ON "contabilidad"."movimientos"("estado");

-- CreateIndex
CREATE INDEX "movimientos_fecha_idx" ON "contabilidad"."movimientos"("fecha" DESC);

-- CreateIndex
CREATE INDEX "movimientos_tipo_idx" ON "contabilidad"."movimientos"("tipo");

-- CreateIndex
CREATE INDEX "diagrama_etiquetas_etiqueta_idx" ON "diagramas"."diagrama_etiquetas"("etiqueta_id");

-- CreateIndex
CREATE INDEX "diagramas_archived_idx" ON "diagramas"."diagramas"("archived_at");

-- CreateIndex
CREATE INDEX "diagramas_updated_idx" ON "diagramas"."diagramas"("updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_nombre_uq" ON "diagramas"."etiquetas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "respaldos_tablero_id_fecha_key" ON "roadmap"."respaldos"("tablero_id", "fecha");

-- CreateIndex
CREATE INDEX "tareas_padre_idx" ON "roadmap"."tareas"("padre_id");

-- CreateIndex
CREATE INDEX "tareas_tablero_idx" ON "roadmap"."tareas"("tablero_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "assets_sha256_key" ON "wiki"."assets"("sha256");

-- CreateIndex
CREATE INDEX "page_aliases_page_idx" ON "wiki"."page_aliases"("page_id");

-- CreateIndex
CREATE INDEX "page_links_key_idx" ON "wiki"."page_links"("target_key");

-- CreateIndex
CREATE INDEX "page_links_target_idx" ON "wiki"."page_links"("target_page_id");

-- CreateIndex
CREATE INDEX "page_versions_page_idx" ON "wiki"."page_versions"("page_id", "version_number" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "page_versions_page_id_version_number_key" ON "wiki"."page_versions"("page_id", "version_number");

-- CreateIndex
CREATE INDEX "pages_search_idx" ON "wiki"."pages" USING GIN ("search");

-- AddForeignKey
ALTER TABLE "diagramas"."diagrama_etiquetas" ADD CONSTRAINT "diagrama_etiquetas_diagrama_id_fkey" FOREIGN KEY ("diagrama_id") REFERENCES "diagramas"."diagramas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diagramas"."diagrama_etiquetas" ADD CONSTRAINT "diagrama_etiquetas_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "diagramas"."etiquetas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diagramas"."diagramas" ADD CONSTRAINT "diagramas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "diagramas"."grupos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roadmap"."respaldos" ADD CONSTRAINT "respaldos_tablero_id_fkey" FOREIGN KEY ("tablero_id") REFERENCES "roadmap"."tableros"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roadmap"."tareas" ADD CONSTRAINT "tareas_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "roadmap"."tareas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roadmap"."tareas" ADD CONSTRAINT "tareas_tablero_id_fkey" FOREIGN KEY ("tablero_id") REFERENCES "roadmap"."tableros"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."page_aliases" ADD CONSTRAINT "page_aliases_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."page_links" ADD CONSTRAINT "page_links_source_page_id_fkey" FOREIGN KEY ("source_page_id") REFERENCES "wiki"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."page_links" ADD CONSTRAINT "page_links_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "wiki"."pages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."page_versions" ADD CONSTRAINT "page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."page_versions" ADD CONSTRAINT "page_versions_restored_from_fkey" FOREIGN KEY ("restored_from") REFERENCES "wiki"."page_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."pages" ADD CONSTRAINT "pages_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "wiki"."assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."pages" ADD CONSTRAINT "pages_current_version_fk" FOREIGN KEY ("current_version_id") REFERENCES "wiki"."page_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."pages" ADD CONSTRAINT "pages_draft_base_fk" FOREIGN KEY ("draft_base_version_id") REFERENCES "wiki"."page_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."pages" ADD CONSTRAINT "pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wiki"."pages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."version_assets" ADD CONSTRAINT "version_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "wiki"."assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wiki"."version_assets" ADD CONSTRAINT "version_assets_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "wiki"."page_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

