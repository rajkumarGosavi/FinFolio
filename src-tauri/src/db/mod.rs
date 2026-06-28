use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use crate::error::{AppError, Result};

pub mod migrations;

pub struct DbState(pub Pool<SqliteConnectionManager>);

impl DbState {
    pub fn new(db_path: &str) -> Result<Self> {
        let manager = SqliteConnectionManager::file(db_path)
            .with_init(|conn| {
                conn.execute_batch(
                    "PRAGMA journal_mode=WAL;
                     PRAGMA foreign_keys=ON;
                     PRAGMA busy_timeout=5000;
                     PRAGMA synchronous=NORMAL;
                     PRAGMA temp_store=MEMORY;",
                )
            });

        let pool = Pool::builder()
            .max_size(4)
            .build(manager)
            .map_err(|e| AppError::Database(e.to_string()))?;

        {
            let conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
            migrations::run_migrations(&conn)?;
        }

        Ok(DbState(pool))
    }
}
