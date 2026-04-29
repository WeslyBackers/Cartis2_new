-- BaZ articles for PUBL production line tasks
CREATE TABLE IF NOT EXISTS task_articles (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    baz_number VARCHAR(20) NOT NULL UNIQUE,
    book_number INTEGER NOT NULL,
    article_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    is_temporary BOOLEAN DEFAULT false,
    content_nl TEXT,
    content_en TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, book_number, article_number)
);
