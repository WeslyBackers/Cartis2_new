-- CARTIS 2.0 Database Schema

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS task_products CASCADE;
DROP TABLE IF EXISTS product_versions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS notifications_products CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS production_lines CASCADE;

-- Production Lines (Productielijnen)
CREATE TABLE production_lines (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- ZK, IENC, Pilot ENC, Publ
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users (Gebruikers)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    default_production_line_id INTEGER REFERENCES production_lines(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Production Line Rights
CREATE TABLE user_production_line_rights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    can_publish BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, production_line_id)
);

-- Products (Producten - kaarten en publicaties)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    production_line_id INTEGER REFERENCES production_lines(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'chart', 'publication', 'enc', etc.
    description TEXT,
    geometry TEXT, -- GeoJSON of WKT voor geografische omtrek
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications (Meldingen)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100), -- MSI 126/25, BASS 45/25, etc.
    title VARCHAR(500) NOT NULL,
    content TEXT,
    source VARCHAR(100), -- 'API', 'Mail', 'Manual', 'BaZ1', 'Push'
    source_detail VARCHAR(255), -- Specifieke bron zoals 'MRCC', 'POAB', etc.
    notification_date DATE NOT NULL,
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geometry TEXT, -- GeoJSON voor locatie
    metadata JSONB, -- Extra metadata van API's of mail headers
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Products Link
CREATE TABLE notifications_products (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    is_relevant BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_id, product_id)
);

-- Notification Decisions per Production Line
CREATE TABLE notification_decisions (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    decision VARCHAR(20), -- '-' (pending), 'Ja', 'Nee'
    decided_by INTEGER REFERENCES users(id),
    decided_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_id, production_line_id)
);

-- Attachments (Bijlagen)
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks (Taken)
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    task_number VARCHAR(20) UNIQUE NOT NULL, -- 250006 format (year + sequence)
    title VARCHAR(500) NOT NULL,
    description TEXT,
    production_line_id INTEGER REFERENCES production_lines(id),
    baz_number VARCHAR(50), -- Koppeling naar BaZ nummer
    msi_active BOOLEAN DEFAULT false, -- Is MSI nog van kracht
    needs_followup BOOLEAN DEFAULT false,
    needs_extra_info BOOLEAN DEFAULT false,
    caris_project_path VARCHAR(500),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Notifications Link
CREATE TABLE task_notifications (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, notification_id)
);

-- Related Tasks
CREATE TABLE related_tasks (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    related_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) DEFAULT 'related',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, related_task_id)
);

-- Product Versions
CREATE TABLE product_versions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    version_number VARCHAR(50) NOT NULL,
    version_date DATE,
    status VARCHAR(50) DEFAULT 'in behandeling', -- 'in behandeling', 'in inspectie', 'gepubliceerd'
    publication_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    published_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, version_number)
);

-- Product Version Attachments (Bijlagen per productversie)
CREATE TABLE product_version_attachments (
    id SERIAL PRIMARY KEY,
    product_version_id INTEGER REFERENCES product_versions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Products (Taak status per product)
CREATE TABLE task_products (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    product_version_id INTEGER REFERENCES product_versions(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'hoog_te_verwerken', 
    -- 'hoog_te_verwerken', 'te_verwerken', 'in_inspectie', 'voltooid', 'niet_van_toepassing'
    execution_status VARCHAR(50) DEFAULT 'not_executed',
    -- 'not_applicable', 'executed', 'not_executed'
    notes TEXT,
    assigned_to INTEGER REFERENCES users(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, product_id)
);

-- Activity Log (Audit trail)
CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'notification', 'task', 'product_version', etc.
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'published', etc.
    changes JSONB, -- JSON met voor/na waarden
    user_id INTEGER REFERENCES users(id),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Notes (dashboard notes with production-line visibility)
CREATE TABLE user_notes (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'gemiddeld' CHECK (priority IN ('laag', 'gemiddeld', 'hoog')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_note_production_lines (
    note_id INTEGER REFERENCES user_notes(id) ON DELETE CASCADE,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, production_line_id)
);

-- Indices voor betere performance
CREATE INDEX idx_notifications_date ON notifications(notification_date);
CREATE INDEX idx_tasks_number ON tasks(task_number);
CREATE INDEX idx_tasks_production_line ON tasks(production_line_id);
CREATE INDEX idx_task_products_status ON task_products(status);
CREATE INDEX idx_product_versions_status ON product_versions(status);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);

-- Insert default production lines
INSERT INTO production_lines (code, name, description) VALUES
('ZK', 'Zeekaartproductie', 'Elektronische en papieren nautische kaarten'),
('IENC', 'Inland ENC', 'Binnenvaartkaarten'),
('PILOT_ENC', 'Pilot ENC', 'Gedetailleerde bathymetrische loodskaarten'),
('PUBL', 'Publicaties', 'Berichten aan Zeevarenden, Lichtenlijst, Verbeterlijst');

-- Create default admin users (password: admin123)
-- Password hash for 'admin123' using bcrypt: $2a$10$N9qo8uLOickgx2ZMRZoMye7FRNvk7v7DqKvXjYKw.X8e8OxV5pB8S
INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id) VALUES
('admin@cartis.be', '$2a$10$N9qo8uLOickgx2ZMRZoMye7FRNvk7v7DqKvXjYKw.X8e8OxV5pB8S', 'Admin', 'User', 1),
('admin@cartis.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye7FRNvk7v7DqKvXjYKw.X8e8OxV5pB8S', 'Admin', 'User COM', 1);
