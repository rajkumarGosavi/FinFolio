use tauri::State;
use crate::db::DbState;
use crate::error::{AppError, Result};

#[tauri::command]
pub fn is_password_set(state: State<DbState>) -> Result<bool> {
    Ok(state.0.is_password_set())
}

#[tauri::command]
pub fn setup_master_password(password: String, state: State<DbState>) -> Result<()> {
    state.0.initialize(&password)
}

#[tauri::command]
pub fn verify_master_password(password: String, state: State<DbState>) -> Result<bool> {
    state.0.unlock(&password)
}

#[tauri::command]
pub fn change_master_password(
    current_password: String,
    new_password: String,
    state: State<DbState>,
) -> Result<()> {
    state.0.get()?;
    if !state.0.verify_password(&current_password)? {
        return Err(AppError::WrongPassword);
    }
    state.0.rekey(&new_password)
}
