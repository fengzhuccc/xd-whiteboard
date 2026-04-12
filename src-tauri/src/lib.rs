mod security;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExcalidrawFile {
    pub name: String,
    pub path: String,
    pub modified: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub modified: bool,
    pub children: Option<Vec<FileTreeNode>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preferences {
    pub last_directory: Option<String>,
    pub recent_directories: Vec<String>,
    pub recent_files: Vec<RecentFile>,
    pub theme: String,
    pub sidebar_visible: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            last_directory: None,
            recent_directories: Vec::new(),
            recent_files: Vec::new(),
            theme: "system".to_string(),
            sidebar_visible: true,
        }
    }
}

pub struct AppState {
    pub current_directory: Mutex<Option<PathBuf>>,
    pub modified_files: Mutex<Vec<String>>,
}

#[tauri::command]
async fn select_directory(app: AppHandle, current_dir: Option<String>) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    let mut dialog = app.dialog().file();
    
    if let Some(dir) = current_dir {
        let path = std::path::Path::new(&dir);
        if path.exists() && path.is_dir() {
            dialog = dialog.set_directory(path);
        }
    }

    dialog.pick_folder(move |path| {
        let _ = tx.send(path);
    });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn list_excalidraw_files(directory: String) -> Result<Vec<ExcalidrawFile>, String> {
    let path = Path::new(&directory);

    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut files = Vec::new();
    collect_excalidraw_files_recursive(path, &mut files)?;
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

#[tauri::command]
async fn get_file_tree(directory: String) -> Result<Vec<FileTreeNode>, String> {
    let path = Path::new(&directory);

    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut tree = Vec::new();
    build_file_tree(path, &mut tree)?;
    tree.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(tree)
}

fn collect_excalidraw_files_recursive(
    dir: &Path,
    files: &mut Vec<ExcalidrawFile>,
) -> Result<(), String> {
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            if let Some(file_name) = path.file_name() {
                                files.push(ExcalidrawFile {
                                    name: file_name.to_string_lossy().to_string(),
                                    path: path.to_string_lossy().to_string(),
                                    modified: false,
                                });
                            }
                        }
                    }
                } else if path.is_dir() {
                    collect_excalidraw_files_recursive(&path, files)?;
                }
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(())
}

fn build_file_tree(dir: &Path, tree: &mut Vec<FileTreeNode>) -> Result<(), String> {
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path
                    .file_name()
                    .ok_or("Invalid file name")?
                    .to_string_lossy()
                    .to_string();

                if path.is_dir() {
                    let mut children = Vec::new();
                    build_file_tree(&path, &mut children)?;

                    children.sort_by(|a, b| match (a.is_directory, b.is_directory) {
                        (true, false) => std::cmp::Ordering::Less,
                        (false, true) => std::cmp::Ordering::Greater,
                        _ => a.name.cmp(&b.name),
                    });

                    tree.push(FileTreeNode {
                        name,
                        path: path.to_string_lossy().to_string(),
                        is_directory: true,
                        modified: false,
                        children: Some(children),
                    });
                } else if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            tree.push(FileTreeNode {
                                name,
                                path: path.to_string_lossy().to_string(),
                                is_directory: false,
                                modified: false,
                                children: None,
                            });
                        }
                    }
                }
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(())
}

fn has_excalidraw_files(dir: &Path) -> Result<bool, String> {
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            return Ok(true);
                        }
                    }
                } else if path.is_dir() && has_excalidraw_files(&path)? {
                    return Ok(true);
                }
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(false)
}

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    let validated_path = security::validate_path(path, None)?;
    security::validate_excalidraw_file(&validated_path)?;

    let content = fs::read_to_string(&validated_path).map_err(|e| e.to_string())?;
    security::validate_excalidraw_content(&content)?;

    Ok(content)
}

#[tauri::command]
async fn save_file(file_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    let validated_path = security::validate_path(path, None)?;
    security::validate_excalidraw_file(&validated_path)?;
    security::validate_excalidraw_content(&content)?;

    fs::write(&validated_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn save_file_as(app: AppHandle, content: String) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .add_filter("Excalidraw", &["excalidraw"])
        .set_title("Save As")
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => {
            let path_str = path.to_string();
            match fs::write(&path_str, content) {
                Ok(_) => Ok(Some(path_str)),
                Err(e) => Err(e.to_string()),
            }
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn create_new_file(directory: String, file_name: String) -> Result<String, String> {
    let dir_path = Path::new(&directory);
    let validated_dir = security::validate_path(dir_path, None)?;

    if !validated_dir.is_dir() {
        return Err(format!("Path is not a directory: {}", directory));
    }

    let mut path = security::safe_path_join(&validated_dir, &file_name)?;

    if path.exists() {
        let mut counter = 1;

        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid file name")?
            .to_string();

        let base_stem = if stem.ends_with(".excalidraw") {
            stem.trim_end_matches(".excalidraw").to_string()
        } else {
            stem
        };

        loop {
            let new_name = format!("{}-{}.excalidraw", base_stem, counter);
            path = dir_path.join(&new_name);

            if !path.exists() {
                break;
            }
            counter += 1;

            if counter > 100 {
                return Err("Could not find unique file name".to_string());
            }
        }
    }

    let default_content = serde_json::json!({
        "type": "excalidraw",
        "version": 2,
        "source": "小呆画板",
        "elements": [],
        "appState": {
            "gridSize": null,
            "viewBackgroundColor": "#ffffff"
        },
        "files": {}
    });

    let content_str = serde_json::to_string_pretty(&default_content)
        .map_err(|e| format!("Failed to serialize content: {}", e))?;

    fs::write(&path, &content_str).map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn create_folder(directory: String, folder_name: String) -> Result<String, String> {
    let dir_path = Path::new(&directory);
    let validated_dir = security::validate_path(dir_path, None)?;

    if !validated_dir.is_dir() {
        return Err(format!("Path is not a directory: {}", directory));
    }

    let mut path = security::safe_path_join(&validated_dir, &folder_name)?;

    if path.exists() {
        let mut counter = 1;
        let base_name = folder_name.trim_end_matches('/');

        loop {
            let new_name = format!("{}-{}", base_name, counter);
            path = validated_dir.join(&new_name);

            if !path.exists() {
                break;
            }
            counter += 1;

            if counter > 100 {
                return Err("Could not find unique folder name".to_string());
            }
        }
    }

    fs::create_dir(&path).map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn rename_folder(old_path: String, new_name: String) -> Result<String, String> {
    let old_path = Path::new(&old_path);
    let validated_old = security::validate_path(old_path, None)?;

    if !validated_old.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !validated_old.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let parent = validated_old.parent().ok_or("Invalid folder path")?;
    let new_path = security::safe_path_join(parent, &new_name)?;

    if new_path.exists() && new_path != validated_old {
        return Err("A folder with that name already exists".to_string());
    }

    fs::rename(&validated_old, &new_path)
        .map_err(|e| format!("Failed to rename folder: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn delete_folder(folder_path: String) -> Result<(), String> {
    let path = Path::new(&folder_path);
    let validated_path = security::validate_path(path, None)?;

    if !validated_path.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !validated_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    fs::remove_dir_all(&validated_path).map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn move_file(source_path: String, target_directory: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let validated_source = security::validate_path(source, None)?;

    if !validated_source.exists() {
        return Err("File does not exist".to_string());
    }

    if validated_source.is_dir() {
        return Err("Source path is a directory, not a file".to_string());
    }

    let target_dir = Path::new(&target_directory);
    let validated_target = security::validate_path(target_dir, None)?;

    if !validated_target.exists() {
        return Err("Target directory does not exist".to_string());
    }

    if !validated_target.is_dir() {
        return Err("Target path is not a directory".to_string());
    }

    let file_name = validated_source
        .file_name()
        .ok_or("Invalid file name")?
        .to_string_lossy()
        .to_string();

    let new_path = security::safe_path_join(&validated_target, &file_name)?;

    if new_path.exists() {
        return Err("A file with that name already exists in the target directory".to_string());
    }

    fs::rename(&validated_source, &new_path)
        .map_err(|e| format!("Failed to move file: {}", e))?;

    // Use dunce to get a clean path without \\?\ prefix on Windows
    let clean_path = dunce::simplified(&new_path);
    Ok(clean_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn move_folder(source_path: String, target_directory: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let validated_source = security::validate_path(source, None)?;

    if !validated_source.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !validated_source.is_dir() {
        return Err("Source path is a file, not a folder".to_string());
    }

    let target_dir = Path::new(&target_directory);
    let validated_target = security::validate_path(target_dir, None)?;

    if !validated_target.exists() {
        return Err("Target directory does not exist".to_string());
    }

    if !validated_target.is_dir() {
        return Err("Target path is not a directory".to_string());
    }

    let folder_name = validated_source
        .file_name()
        .ok_or("Invalid folder name")?
        .to_string_lossy()
        .to_string();

    let new_path = security::safe_path_join(&validated_target, &folder_name)?;

    if new_path.exists() && new_path != validated_source {
        return Err("A folder with that name already exists in the target directory".to_string());
    }

    fs::rename(&validated_source, &new_path)
        .map_err(|e| format!("Failed to move folder: {}", e))?;

    // Use dunce to get a clean path without \\?\ prefix on Windows
    let clean_path = dunce::simplified(&new_path);
    Ok(clean_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_preferences(app: AppHandle) -> Result<Preferences, String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("preferences.json").map_err(|e| e.to_string())?;

    let prefs = if let Some(value) = store.get("preferences") {
        match serde_json::from_value::<Preferences>(value.clone()) {
            Ok(mut p) => {
                if p.recent_directories.is_empty() {
                    p.recent_directories = Vec::new();
                }
                p
            }
            Err(_) => Preferences::default(),
        }
    } else {
        Preferences::default()
    };

    Ok(prefs)
}

#[tauri::command]
async fn rename_file(old_path: String, new_name: String) -> Result<String, String> {
    let old_path = Path::new(&old_path);
    let validated_old = security::validate_path(old_path, None)?;

    if !validated_old.exists() {
        return Err("File does not exist".to_string());
    }

    security::validate_excalidraw_file(&validated_old)?;

    let parent = validated_old.parent().ok_or("Invalid file path")?;

    let new_path = security::safe_path_join(parent, &new_name)?;

    let new_path = if new_path.extension() != Some(std::ffi::OsStr::new("excalidraw")) {
        new_path.with_extension("excalidraw")
    } else {
        new_path
    };

    if new_path.exists() && new_path != old_path {
        return Err("A file with that name already exists".to_string());
    }

    let content = fs::read_to_string(old_path)
        .map_err(|e| format!("Failed to read original file: {}", e))?;

    fs::write(&new_path, &content).map_err(|e| format!("Failed to create new file: {}", e))?;

    match fs::read_to_string(&new_path) {
        Ok(new_content) => {
            if new_content != content {
                let _ = fs::remove_file(&new_path);
                return Err("File content verification failed".to_string());
            }
        }
        Err(e) => {
            let _ = fs::remove_file(&new_path);
            return Err(format!("Failed to verify new file: {}", e));
        }
    }

    match fs::remove_file(old_path) {
        Ok(_) => Ok(new_path.to_string_lossy().to_string()),
        Err(_) => Ok(new_path.to_string_lossy().to_string()),
    }
}

#[tauri::command]
async fn delete_file(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    let validated_path = security::validate_path(path, None)?;

    if !validated_path.exists() {
        return Err("File does not exist".to_string());
    }

    security::validate_excalidraw_file(&validated_path)?;

    fs::remove_file(&validated_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn save_preferences(app: AppHandle, preferences: Preferences) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("preferences.json").map_err(|e| e.to_string())?;

    store.set("preferences", serde_json::to_value(&preferences).unwrap());
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn force_close_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn import_image(app: AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp"])
        .set_title("Import Image")
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn export_file(
    app: AppHandle,
    content: String,
    format: String,
) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::{DialogExt, FilePath};

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .set_title(format!("Export as {}", format.to_uppercase()))
        .save_file(move |path: Option<FilePath>| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => {
            let path_str = path.to_string();
            match fs::write(&path_str, content) {
                Ok(_) => Ok(Some(path_str)),
                Err(e) => Err(e.to_string()),
            }
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn watch_directory(
    app: AppHandle,
    directory: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = PathBuf::from(&directory);

    {
        let mut current_dir = state.current_directory.lock().unwrap();
        *current_dir = Some(path.clone());
    }

    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;

    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    std::thread::spawn(move || loop {
        match rx.recv() {
            Ok(Ok(Event {
                kind: EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_),
                paths,
                ..
            })) => {
                for path in paths {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            let _ = app_handle.emit("file-system-change", &path);
                        }
                    }
                }
            }
            Ok(Err(e)) => eprintln!("Watch error: {:?}", e),
            Err(e) => {
                eprintln!("Watch channel error: {:?}", e);
                break;
            }
            _ => {}
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            app.manage(AppState {
                current_directory: Mutex::new(None),
                modified_files: Mutex::new(Vec::new()),
            });

            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone.emit("check-unsaved-before-close", ());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_directory,
            list_excalidraw_files,
            get_file_tree,
            read_file,
            save_file,
            save_file_as,
            create_new_file,
            create_folder,
            rename_folder,
            delete_folder,
            move_file,
            move_folder,
            rename_file,
            delete_file,
            get_preferences,
            save_preferences,
            watch_directory,
            force_close_app,
            import_image,
            export_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
