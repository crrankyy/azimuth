CREATE TABLE attempts (
  delivery_id TEXT NOT NULL REFERENCES deliveries (id),
  attempt INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status INTEGER,
  error TEXT,
  response_excerpt TEXT,
  truncated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (delivery_id, attempt)
);
