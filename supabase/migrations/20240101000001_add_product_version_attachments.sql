-- Add attachments table for product versions
CREATE TABLE IF NOT EXISTS product_version_attachments (
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

CREATE INDEX IF NOT EXISTS idx_product_version_attachments_version
    ON product_version_attachments(product_version_id);
