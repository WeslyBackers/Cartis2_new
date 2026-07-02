-- =============================================================================
-- CARTIS 2.0  –  Complete Database Setup
-- Run this once on a fresh PostgreSQL database to create the full schema.
-- Usage:  psql -U postgres -d cartis -f backend/database/setup-complete.sql
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- DROP existing tables (safe for re-runs in development)
-- Order matters: children before parents
-- =============================================================================
DROP TABLE IF EXISTS hpd_projects                   CASCADE;
DROP TABLE IF EXISTS task_articles                  CASCADE;
DROP TABLE IF EXISTS task_info_requests             CASCADE;
DROP TABLE IF EXISTS task_workflow                  CASCADE;
DROP TABLE IF EXISTS task_comments                  CASCADE;
DROP TABLE IF EXISTS task_production_line_status    CASCADE;
DROP TABLE IF EXISTS task_products                  CASCADE;
DROP TABLE IF EXISTS task_notifications             CASCADE;
DROP TABLE IF EXISTS related_tasks                  CASCADE;
DROP TABLE IF EXISTS tasks                          CASCADE;
DROP TABLE IF EXISTS notification_zones             CASCADE;
DROP TABLE IF EXISTS notification_info_requests     CASCADE;
DROP TABLE IF EXISTS notification_comments          CASCADE;
DROP TABLE IF EXISTS notification_coordinates       CASCADE;
DROP TABLE IF EXISTS notification_decisions         CASCADE;
DROP TABLE IF EXISTS notifications_products         CASCADE;
DROP TABLE IF EXISTS notifications                  CASCADE;
DROP TABLE IF EXISTS product_version_attachments    CASCADE;
DROP TABLE IF EXISTS product_versions               CASCADE;
DROP TABLE IF EXISTS kml_coverages                  CASCADE;
DROP TABLE IF EXISTS kml_files                      CASCADE;
DROP TABLE IF EXISTS attachments                    CASCADE;
DROP TABLE IF EXISTS products                       CASCADE;
DROP TABLE IF EXISTS user_note_production_lines     CASCADE;
DROP TABLE IF EXISTS user_notes                     CASCADE;
DROP TABLE IF EXISTS activity_log                   CASCADE;
DROP TABLE IF EXISTS user_production_line_rights    CASCADE;
DROP TABLE IF EXISTS users                          CASCADE;
DROP TABLE IF EXISTS production_lines               CASCADE;

-- =============================================================================
-- CORE REFERENCE TABLES
-- =============================================================================

-- Production Lines (ZK, IENC, PILOT_ENC, PUBL, …)
CREATE TABLE production_lines (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20)  UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE users (
    id                          SERIAL PRIMARY KEY,
    email                       VARCHAR(255) UNIQUE NOT NULL,
    password_hash               VARCHAR(255) NOT NULL,
    first_name                  VARCHAR(100),
    last_name                   VARCHAR(100),
    default_production_line_id  INTEGER REFERENCES production_lines(id),
    is_active                   BOOLEAN   DEFAULT TRUE,
    last_login                  TIMESTAMP,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User rights per production line
CREATE TABLE user_production_line_rights (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    production_line_id  INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    can_view            BOOLEAN DEFAULT TRUE,
    can_edit            BOOLEAN DEFAULT FALSE,
    can_publish         BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, production_line_id)
);

-- =============================================================================
-- KML / COVERAGE TABLES
-- (defined before products so products can reference them)
-- =============================================================================

-- KML file metadata
CREATE TABLE kml_files (
    id                  SERIAL PRIMARY KEY,
    filename            VARCHAR(255) UNIQUE NOT NULL,
    filepath            VARCHAR(500) NOT NULL,
    category            VARCHAR(50)  NOT NULL,   -- 'products' | 'zones'
    display_name        VARCHAR(255) NOT NULL,
    description         TEXT,
    production_line_id  INTEGER REFERENCES production_lines(id),
    imported_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual geometries extracted from KML files
CREATE TABLE kml_coverages (
    id             SERIAL PRIMARY KEY,
    kml_file_id    INTEGER REFERENCES kml_files(id) ON DELETE CASCADE,
    code           VARCHAR(100) NOT NULL,
    name           VARCHAR(500) NOT NULL,
    geometry_type  VARCHAR(20)  NOT NULL,
    geometry       TEXT         NOT NULL,  -- GeoJSON
    style_url      VARCHAR(100),
    properties     JSONB,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PRODUCTS
-- =============================================================================

-- Nautische producten (kaarten, publicaties, ENC's, …)
CREATE TABLE products (
    id                  SERIAL PRIMARY KEY,
    production_line_id  INTEGER REFERENCES production_lines(id),
    code                VARCHAR(50)  NOT NULL,
    name                VARCHAR(255) NOT NULL,
    type                VARCHAR(50),           -- 'chart' | 'publication' | 'enc' | …
    description         TEXT,
    geometry            TEXT,                  -- GeoJSON
    is_active           BOOLEAN   DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (production_line_id, code)
);

-- Product versions
CREATE TABLE product_versions (
    id               SERIAL PRIMARY KEY,
    product_id       INTEGER REFERENCES products(id) ON DELETE CASCADE,
    version_number   VARCHAR(50) NOT NULL,
    version_date     DATE,
    status           VARCHAR(50) DEFAULT 'in behandeling', -- 'in behandeling' | 'in inspectie' | 'gepubliceerd'
    publication_date DATE,
    notes            TEXT,
    created_by       INTEGER REFERENCES users(id),
    published_by     INTEGER REFERENCES users(id),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, version_number)
);

-- Attachments per product version
CREATE TABLE product_version_attachments (
    id                  SERIAL PRIMARY KEY,
    product_version_id  INTEGER REFERENCES product_versions(id) ON DELETE CASCADE,
    filename            VARCHAR(255) NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    file_type           VARCHAR(100),
    file_size           INTEGER,
    uploaded_by         INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- NOTIFICATIONS (MELDINGEN)
-- =============================================================================

CREATE TABLE notifications (
    id                SERIAL PRIMARY KEY,
    code              VARCHAR(100),           -- MSI 126/25, BASS 45/25, …
    title             VARCHAR(500) NOT NULL,
    content           TEXT,
    opmerkingen       TEXT,                   -- General remarks
    source            VARCHAR(100),           -- 'API' | 'Mail' | 'Manual' | 'BaZ1' | 'Push'
    source_detail     VARCHAR(255),
    notification_date DATE NOT NULL,
    received_date     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geometry          TEXT,                   -- GeoJSON
    metadata          JSONB,
    created_by        INTEGER REFERENCES users(id),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Linked products (affected chart areas)
CREATE TABLE notifications_products (
    id               SERIAL PRIMARY KEY,
    notification_id  INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    product_id       INTEGER REFERENCES products(id)      ON DELETE CASCADE,
    is_relevant      BOOLEAN DEFAULT TRUE,
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (notification_id, product_id)
);

-- Decision per notification per production line
CREATE TABLE notification_decisions (
    id                  SERIAL PRIMARY KEY,
    notification_id     INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    production_line_id  INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    decision            VARCHAR(20),   -- '-' (pending) | 'Ja' | 'Nee'
    decided_by          INTEGER REFERENCES users(id),
    decided_at          TIMESTAMP,
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (notification_id, production_line_id)
);

-- Comments per notification per production line
CREATE TABLE notification_comments (
    id                  SERIAL PRIMARY KEY,
    notification_id     INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    production_line_id  INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    comment             TEXT NOT NULL,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Information request emails sent from notification detail
CREATE TABLE notification_info_requests (
    id               SERIAL PRIMARY KEY,
    notification_id  INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    recipient        VARCHAR(255) NOT NULL,
    subject          TEXT         NOT NULL,
    body             TEXT         NOT NULL,
    created_by       INTEGER REFERENCES users(id),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Additional coordinates / geometries linked to a notification
CREATE TABLE notification_coordinates (
    id               SERIAL PRIMARY KEY,
    notification_id  INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    latitude         DECIMAL(10, 8),
    longitude        DECIMAL(11, 8),
    geometry         TEXT,          -- GeoJSON for complex shapes
    label            VARCHAR(255),
    description      TEXT,
    created_by       INTEGER REFERENCES users(id),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geographic zones linked to a notification
CREATE TABLE notification_zones (
    id               SERIAL PRIMARY KEY,
    notification_id  INTEGER REFERENCES notifications(id)   ON DELETE CASCADE,
    kml_coverage_id  INTEGER REFERENCES kml_coverages(id)   ON DELETE CASCADE,
    zone_code        VARCHAR(100) NOT NULL,
    zone_name        VARCHAR(500) NOT NULL,
    detection_method VARCHAR(50) DEFAULT 'automatic',   -- 'automatic' | 'manual'
    detected_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (notification_id, kml_coverage_id)
);

-- Attachments for notifications
CREATE TABLE attachments (
    id                  SERIAL PRIMARY KEY,
    notification_id     INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    filename            VARCHAR(255) NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    file_type           VARCHAR(100),
    file_size           INTEGER,
    uploaded_by         INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TASKS (TAKEN)
-- =============================================================================

CREATE TABLE tasks (
    id                  SERIAL PRIMARY KEY,
    task_number         VARCHAR(20) UNIQUE NOT NULL,  -- e.g. 250006
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    production_line_id  INTEGER REFERENCES production_lines(id),
    baz_number          VARCHAR(50),
    msi_active          BOOLEAN DEFAULT FALSE,
    needs_followup      BOOLEAN DEFAULT FALSE,
    needs_extra_info    BOOLEAN DEFAULT FALSE,
    caris_project_path  VARCHAR(500),
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many: tasks ↔ notifications
CREATE TABLE task_notifications (
    id               SERIAL PRIMARY KEY,
    task_id          INTEGER REFERENCES tasks(id)         ON DELETE CASCADE,
    notification_id  INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, notification_id)
);

-- Self-referencing related tasks
CREATE TABLE related_tasks (
    id               SERIAL PRIMARY KEY,
    task_id          INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    related_task_id  INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    relation_type    VARCHAR(50) DEFAULT 'related',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, related_task_id)
);

-- Task status per product
CREATE TABLE task_products (
    id                  SERIAL PRIMARY KEY,
    task_id             INTEGER REFERENCES tasks(id)            ON DELETE CASCADE,
    product_id          INTEGER REFERENCES products(id)         ON DELETE CASCADE,
    product_version_id  INTEGER REFERENCES product_versions(id) ON DELETE SET NULL,
    status              VARCHAR(50) DEFAULT 'hoog_te_verwerken',
    -- 'hoog_te_verwerken' | 'te_verwerken' | 'in_inspectie' | 'voltooid' | 'niet_van_toepassing'
    execution_status    VARCHAR(50) DEFAULT 'not_executed',
    -- 'not_applicable' | 'executed' | 'not_executed'
    notes               TEXT,
    assigned_to         INTEGER REFERENCES users(id),
    started_at          TIMESTAMP,
    completed_at        TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, product_id)
);

-- Comments per task per production line
CREATE TABLE task_comments (
    id                  SERIAL PRIMARY KEY,
    task_id             INTEGER REFERENCES tasks(id)            ON DELETE CASCADE,
    production_line_id  INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    comment             TEXT NOT NULL,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow notes per task per production line
CREATE TABLE task_workflow (
    id                  SERIAL PRIMARY KEY,
    task_id             INTEGER REFERENCES tasks(id)            ON DELETE CASCADE,
    production_line_id  INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    workflow_content    TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, production_line_id)
);

-- Information request emails sent from task detail
CREATE TABLE task_info_requests (
    id          SERIAL PRIMARY KEY,
    task_id     INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    recipient   VARCHAR(255) NOT NULL,
    subject     VARCHAR(500) NOT NULL,
    body        TEXT         NOT NULL,
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Overall status of a task per production line
CREATE TABLE task_production_line_status (
    id                  SERIAL PRIMARY KEY,
    task_id             INTEGER NOT NULL REFERENCES tasks(id)            ON DELETE CASCADE,
    production_line_id  INTEGER NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    status              VARCHAR(50) NOT NULL DEFAULT 'under_construction',
    -- 'under_construction' | 'completed' | 'rejected'
    wait_for_zk         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, production_line_id)
);

-- BaZ articles for PUBL production line tasks
CREATE TABLE task_articles (
    id              SERIAL PRIMARY KEY,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    baz_number      VARCHAR(20) NOT NULL UNIQUE,
    book_number     INTEGER NOT NULL,
    article_number  INTEGER NOT NULL,
    year            INTEGER NOT NULL,
    is_temporary    BOOLEAN DEFAULT FALSE,
    title_nl        VARCHAR(255),
    title_en        VARCHAR(255),
    content_nl      TEXT,
    content_en      TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (year, book_number, article_number)
);

-- HPD projects linked to tasks (future Oracle sync)
CREATE TABLE hpd_projects (
    id                  SERIAL PRIMARY KEY,
    task_id             INTEGER NOT NULL REFERENCES tasks(id)            ON DELETE CASCADE,
    production_line_id  INTEGER NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    project_code        VARCHAR(50) NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'under_construction',
    synced_to_oracle    BOOLEAN DEFAULT FALSE,
    oracle_sync_date    TIMESTAMP,
    oracle_sync_error   TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, production_line_id)
);

-- =============================================================================
-- DASHBOARD NOTES
-- =============================================================================

CREATE TABLE user_notes (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    priority    VARCHAR(20) NOT NULL DEFAULT 'gemiddeld'
                    CHECK (priority IN ('laag', 'gemiddeld', 'hoog')),
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note visibility per production line
CREATE TABLE user_note_production_lines (
    note_id             INTEGER REFERENCES user_notes(id)        ON DELETE CASCADE,
    production_line_id  INTEGER REFERENCES production_lines(id)  ON DELETE CASCADE,
    PRIMARY KEY (note_id, production_line_id)
);

-- =============================================================================
-- AUDIT LOG
-- =============================================================================

CREATE TABLE activity_log (
    id           SERIAL PRIMARY KEY,
    entity_type  VARCHAR(50) NOT NULL,
    entity_id    INTEGER     NOT NULL,
    action       VARCHAR(50) NOT NULL,  -- 'created' | 'updated' | 'deleted' | 'published' | …
    changes      JSONB,
    user_id      INTEGER REFERENCES users(id),
    ip_address   VARCHAR(45),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_notifications_date             ON notifications(notification_date);
CREATE INDEX idx_notifications_source           ON notifications(source);
CREATE INDEX idx_notification_decisions_notif   ON notification_decisions(notification_id);
CREATE INDEX idx_notification_comments_notif    ON notification_comments(notification_id);
CREATE INDEX idx_notification_comments_pl       ON notification_comments(production_line_id);
CREATE INDEX idx_notification_info_notif        ON notification_info_requests(notification_id);
CREATE INDEX idx_notification_coords_notif      ON notification_coordinates(notification_id);
CREATE INDEX idx_notification_zones_notif       ON notification_zones(notification_id);
CREATE INDEX idx_notification_zones_code        ON notification_zones(zone_code);
CREATE INDEX idx_notifications_products_notif   ON notifications_products(notification_id);
CREATE INDEX idx_notifications_products_prod    ON notifications_products(product_id);

CREATE INDEX idx_tasks_number                   ON tasks(task_number);
CREATE INDEX idx_tasks_production_line          ON tasks(production_line_id);
CREATE INDEX idx_task_products_status           ON task_products(status);
CREATE INDEX idx_task_comments_task             ON task_comments(task_id);
CREATE INDEX idx_task_comments_pl               ON task_comments(production_line_id);
CREATE INDEX idx_task_info_requests_task        ON task_info_requests(task_id);
CREATE INDEX idx_task_pl_status_task            ON task_production_line_status(task_id);
CREATE INDEX idx_task_pl_status_pl              ON task_production_line_status(production_line_id);
CREATE INDEX idx_task_pl_status_status          ON task_production_line_status(status);
CREATE INDEX idx_hpd_projects_task_id           ON hpd_projects(task_id);
CREATE INDEX idx_hpd_projects_project_code      ON hpd_projects(project_code);

CREATE INDEX idx_product_versions_status        ON product_versions(status);
CREATE INDEX idx_product_version_attach_ver     ON product_version_attachments(product_version_id);

CREATE INDEX idx_kml_files_category             ON kml_files(category);
CREATE INDEX idx_kml_files_production_line      ON kml_files(production_line_id);
CREATE INDEX idx_kml_coverages_file             ON kml_coverages(kml_file_id);
CREATE INDEX idx_kml_coverages_code             ON kml_coverages(code);

CREATE INDEX idx_activity_log_entity            ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_user              ON activity_log(user_id);

-- =============================================================================
-- POSTGIS HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION geojson_intersects(geojson1 TEXT, geojson2 TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF geojson1 IS NULL OR geojson2 IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN ST_Intersects(
        ST_GeomFromGeoJSON(geojson1),
        ST_GeomFromGeoJSON(geojson2)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION geojson_intersects IS
    'Returns TRUE when two GeoJSON text geometries spatially intersect.';

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Production lines
INSERT INTO production_lines (code, name, description) VALUES
    ('ZK',        'Zeekaartproductie', 'Elektronische en papieren nautische kaarten'),
    ('IENC',      'Inland ENC',        'Binnenvaartkaarten'),
    ('PILOT_ENC', 'Pilot ENC',         'Gedetailleerde bathymetrische loodskaarten'),
    ('PUBL',      'Publicaties',       'Berichten aan Zeevarenden, Lichtenlijst, Verbeterlijst')
ON CONFLICT (code) DO NOTHING;

-- Default admin user  (password: admin123)
-- Hash generated with: bcrypt.hashSync('admin123', 10)
INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id, is_active)
VALUES (
    'admin@cartis.be',
    '$2a$10$N9qo8uLOickgx2ZMRZoMye7FRNvk7v7DqKvXjYKw.X8e8OxV5pB8S',
    'Admin', 'User',
    (SELECT id FROM production_lines WHERE code = 'ZK'),
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Admin gets full rights on all production lines
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
SELECT
    (SELECT id FROM users WHERE email = 'admin@cartis.be'),
    pl.id,
    TRUE, TRUE, TRUE
FROM production_lines pl
ON CONFLICT (user_id, production_line_id) DO NOTHING;

-- Test user  (password: test123)
-- Hash generated with: bcrypt.hashSync('test123', 10)
DO $$
DECLARE
    v_user_id            INTEGER;
    v_default_line_id    INTEGER;
BEGIN
    SELECT id INTO v_default_line_id
    FROM production_lines WHERE code = 'ZK'
    ORDER BY id LIMIT 1;

    INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id, is_active)
    VALUES (
        'test@cartis.be',
        '$2a$10$Ct4XdaQG0dsh9otDqjC7TeECDJAgLS3EmfwstJ9gccY5XeJAVGNx6',
        'Test', 'User',
        v_default_line_id,
        TRUE
    )
    ON CONFLICT (email)
    DO UPDATE SET
        password_hash               = EXCLUDED.password_hash,
        default_production_line_id  = EXCLUDED.default_production_line_id,
        is_active                   = TRUE,
        updated_at                  = CURRENT_TIMESTAMP
    RETURNING id INTO v_user_id;

    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM users WHERE email = 'test@cartis.be';
    END IF;

    INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
    SELECT v_user_id, pl.id, TRUE, TRUE, TRUE
    FROM production_lines pl
    WHERE pl.is_active = TRUE
    ON CONFLICT (user_id, production_line_id) DO UPDATE SET
        can_view    = TRUE,
        can_edit    = TRUE,
        can_publish = TRUE;
END $$;

-- =============================================================================
-- Done
-- =============================================================================
\echo '✅  CARTIS 2.0 database schema created successfully.'
\echo '   Default accounts:'
\echo '     admin@cartis.be  / admin123'
\echo '     test@cartis.be   / test123'
