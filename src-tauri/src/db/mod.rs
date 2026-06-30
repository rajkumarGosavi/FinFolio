use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::io::Read;
use std::path::Path;
use rand::RngCore;

use crate::error::{AppError, Result};

pub mod migrations;

pub struct DbState(pub Pool<SqliteConnectionManager>);

const KEYRING_SERVICE: &str = "suvarix";
const KEYRING_ACCOUNT: &str = "db_key";
const SQLITE_MAGIC: &[u8] = b"SQLite format 3\0";

impl DbState {
    pub fn new(db_path: &str) -> Result<Self> {
        let path = Path::new(db_path);
        let key = get_or_create_db_key()?;

        // One-time migration: encrypt existing plain SQLite DB
        if path.exists() && is_plain_sqlite(path) {
            migrate_to_cipher(path, &key)?;
        }

        let init_sql = format!(
            "PRAGMA key = \"x'{}'\";\n\
             PRAGMA journal_mode=WAL;\n\
             PRAGMA foreign_keys=ON;\n\
             PRAGMA busy_timeout=5000;\n\
             PRAGMA synchronous=NORMAL;\n\
             PRAGMA temp_store=MEMORY;",
            key
        );

        let manager = SqliteConnectionManager::file(db_path)
            .with_init(move |conn| conn.execute_batch(&init_sql));

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

fn get_or_create_db_key() -> Result<String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| AppError::Io(format!("keyring: {}", e)))?;

    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(_) => {
            // First install — generate and persist a random 32-byte key
            let mut bytes = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut bytes);
            let key = hex::encode(bytes);
            entry.set_password(&key)
                .map_err(|e| AppError::Io(format!("keyring store: {}", e)))?;
            Ok(key)
        }
    }
}

fn is_plain_sqlite(path: &Path) -> bool {
    let Ok(mut f) = std::fs::File::open(path) else { return false };
    let mut magic = [0u8; 16];
    let _ = f.read_exact(&mut magic);
    magic.as_slice() == SQLITE_MAGIC
}

fn migrate_to_cipher(db_path: &Path, key: &str) -> Result<()> {
    let temp_path = db_path.with_extension("db.tmp");
    // Forward slashes required in SQLite URI paths on Windows
    let temp_str = temp_path.to_string_lossy().replace('\\', "/");

    // Open plain DB (no PRAGMA key = passthrough mode).
    // ATTACH an encrypted destination and use sqlcipher_export() to copy all data.
    // This is the canonical SQLCipher API for encrypting a plain SQLite file.
    let conn = Connection::open(db_path)
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute_batch(&format!(
        "ATTACH DATABASE '{temp_str}' AS encrypted KEY \"x'{key}'\";\
         SELECT sqlcipher_export('encrypted');\
         DETACH DATABASE encrypted;"
    )).map_err(|e| AppError::Database(format!("cipher export: {e}")))?;
    drop(conn);

    // Atomic swap: replace plain original with encrypted copy
    std::fs::rename(&temp_path, db_path)?;
    Ok(())
}
