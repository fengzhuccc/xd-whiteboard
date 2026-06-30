mod menu;
mod security;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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
    pub auto_save_enabled: bool,
    pub auto_save_interval: u64,
    pub language: String,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            last_directory: None,
            recent_directories: Vec::new(),
            recent_files: Vec::new(),
            theme: "warm-white".to_string(),
            sidebar_visible: true,
            auto_save_enabled: true,
            auto_save_interval: 30,
            language: "zh".to_string(),
        }
    }
}

pub struct AppState {
    pub current_directory: Mutex<Option<PathBuf>>,
    /// 当前活跃的文件 watcher。保存 watcher 本身（而非 Sender），
    /// drop 即停止监听并释放系统资源。
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    /// 自身写入抑制窗口：每次后端写文件后记录时间，
    /// watcher 在此窗口内的事件会被忽略，避免 "保存→监听→重载" 循环。
    /// 用 Arc 以便 watcher 线程共享访问。
    pub last_self_write: Arc<Mutex<Option<Instant>>>,
}

/// 自身写入抑制窗口时长。
const SELF_WRITE_SUPPRESS: Duration = Duration::from_millis(800);

#[tauri::command]
async fn select_directory(app: AppHandle, current_dir: Option<String>) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    let mut dialog = app.dialog().file();

    if let Some(dir) = current_dir {
        let path = std::path::Path::new(&dir);
        if path.is_dir() {
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
async fn list_excalidraw_files(directory: String, state: State<'_, AppState>) -> Result<Vec<ExcalidrawFile>, String> {
    let path = Path::new(&directory);
    let allowed_base = get_current_directory(&state);
    let validated_path = security::validate_path(path, allowed_base.as_deref())?;

    if !validated_path.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    let mut files = Vec::new();
    collect_excalidraw_files_recursive(&validated_path, &mut files, 0)?;
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

#[tauri::command]
async fn get_file_tree(directory: String, state: State<'_, AppState>) -> Result<Vec<FileTreeNode>, String> {
    let path = Path::new(&directory);
    let allowed_base = get_current_directory(&state);
    let validated_path = security::validate_path(path, allowed_base.as_deref())?;

    if !validated_path.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    let mut tree = Vec::new();
    build_file_tree(&validated_path, &mut tree, 0)?;
    tree.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(tree)
}

/// 递归最大深度，防止极深目录栈溢出。
const MAX_RECURSION_DEPTH: usize = 32;

fn collect_excalidraw_files_recursive(
    dir: &Path,
    files: &mut Vec<ExcalidrawFile>,
    depth: usize,
) -> Result<(), String> {
    if depth > MAX_RECURSION_DEPTH {
        return Err(format!("Max directory depth exceeded at {}", dir.display()));
    }
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                // 用 symlink_metadata 防止符号链接循环导致无限递归
                let meta = match path.symlink_metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                if meta.is_file() {
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
                } else if meta.is_dir() {
                    collect_excalidraw_files_recursive(&path, files, depth + 1)?;
                }
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(())
}

fn build_file_tree(dir: &Path, tree: &mut Vec<FileTreeNode>, depth: usize) -> Result<(), String> {
    if depth > MAX_RECURSION_DEPTH {
        return Err(format!("Max directory depth exceeded at {}", dir.display()));
    }
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path
                    .file_name()
                    .ok_or("Invalid file name")?
                    .to_string_lossy()
                    .to_string();

                let meta = match path.symlink_metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                if meta.is_dir() {
                    let mut children = Vec::new();
                    build_file_tree(&path, &mut children, depth + 1)?;

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
                } else if meta.is_file() {
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

fn get_current_directory(state: &State<'_, AppState>) -> Option<PathBuf> {
    state.current_directory.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
async fn read_file(file_path: String, state: State<'_, AppState>) -> Result<String, String> {
    let path = Path::new(&file_path);
    let allowed_base = get_current_directory(&state);
    let validated_path = security::validate_path(path, allowed_base.as_deref())?;
    security::validate_excalidraw_file(&validated_path)?;

    let content = fs::read_to_string(&validated_path).map_err(|e| e.to_string())?;
    security::validate_excalidraw_content(&content)?;

    Ok(content)
}

#[tauri::command]
async fn save_file(file_path: String, content: String, state: State<'_, AppState>) -> Result<(), String> {
    let path = Path::new(&file_path);
    let allowed_base = get_current_directory(&state);
    let validated_path = security::validate_path(path, allowed_base.as_deref())?;
    security::validate_excalidraw_file(&validated_path)?;
    security::validate_excalidraw_content(&content)?;

    mark_self_write(&state);
    fs::write(&validated_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn save_file_as(
    app: AppHandle,
    content: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    security::validate_excalidraw_content(&content)?;

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
            let path = path.into_path().map_err(|e| e.to_string())?;
            let allowed_base = get_current_directory(&state);
            // 另存为的目标文件通常不存在，用 validate_path_for_create。
            let validated_path = security::validate_path_for_create(&path, allowed_base.as_deref())?;
            security::validate_excalidraw_file(&validated_path)?;
            mark_self_write(&state);
            fs::write(&validated_path, content).map_err(|e| e.to_string())?;
            Ok(Some(simplified_path_string(&validated_path)))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn create_new_file(
    directory: String,
    file_name: String,
    theme: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let dir_path = Path::new(&directory);
    let allowed_base = get_current_directory(&state);
    let validated_dir = security::validate_path(dir_path, allowed_base.as_deref())?;

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

        loop {
            let new_name = format!("{}-{}.excalidraw", stem, counter);
            path = validated_dir.join(&new_name);

            if !path.exists() {
                break;
            }
            counter += 1;

            if counter > 100 {
                return Err("Could not find unique file name".to_string());
            }
        }
    }

    let background_color = match theme.as_deref() {
        Some("white") => "#FFFFFF",
        _ => "#FAF8F5",
    };

    let default_content = serde_json::json!({
        "type": "excalidraw",
        "version": 2,
        "source": "小呆画板",
        "elements": [],
        "appState": {
            "gridSize": null,
            "viewBackgroundColor": background_color
        },
        "files": {}
    });

    let content_str = serde_json::to_string_pretty(&default_content)
        .map_err(|e| format!("Failed to serialize content: {}", e))?;

    mark_self_write(&state);
    fs::write(&path, &content_str).map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(simplified_path_string(&path))
}

#[tauri::command]
async fn create_folder(directory: String, folder_name: String, state: State<'_, AppState>) -> Result<String, String> {
    let dir_path = Path::new(&directory);
    let allowed_base = get_current_directory(&state);
    let validated_dir = security::validate_path(dir_path, allowed_base.as_deref())?;

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

    Ok(simplified_path_string(&path))
}

#[tauri::command]
async fn rename_folder(old_path: String, new_name: String, state: State<'_, AppState>) -> Result<String, String> {
    let old_path = Path::new(&old_path);
    let allowed_base = get_current_directory(&state);
    let validated_old = security::validate_path(old_path, allowed_base.as_deref())?;

    if !validated_old.is_dir() {
        return Err("Folder does not exist or is not a directory".to_string());
    }

    let parent = validated_old.parent().ok_or("Invalid folder path")?;
    let new_path = security::safe_path_join(parent, &new_name)?;

    if new_path.exists() && new_path != validated_old {
        return Err("A folder with that name already exists".to_string());
    }

    mark_self_write(&state);
    fs::rename(&validated_old, &new_path)
        .map_err(|e| format!("Failed to rename folder: {}", e))?;

    Ok(simplified_path_string(&new_path))
}

#[tauri::command]
async fn delete_folder(folder_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let path = Path::new(&folder_path);
    let allowed_base = get_current_directory(&state);
    let validated_path = security::validate_path(path, allowed_base.as_deref())?;

    if !validated_path.is_dir() {
        return Err("Folder does not exist or is not a directory".to_string());
    }

    fs::remove_dir_all(&validated_path).map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn move_file(source_path: String, target_directory: String, state: State<'_, AppState>) -> Result<String, String> {
    let source = Path::new(&source_path);
    let allowed_base = get_current_directory(&state);
    let validated_source = security::validate_path(source, allowed_base.as_deref())?;

    if !validated_source.is_file() {
        return Err("Source file does not exist or is a directory".to_string());
    }

    let target_dir = Path::new(&target_directory);
    let validated_target = security::validate_path(target_dir, allowed_base.as_deref())?;

    if !validated_target.is_dir() {
        return Err("Target directory does not exist".to_string());
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

    mark_self_write(&state);
    fs::rename(&validated_source, &new_path)
        .map_err(|e| format!("Failed to move file: {}", e))?;

    Ok(simplified_path_string(&new_path))
}

#[tauri::command]
async fn move_folder(source_path: String, target_directory: String, state: State<'_, AppState>) -> Result<String, String> {
    let source = Path::new(&source_path);
    let allowed_base = get_current_directory(&state);
    let validated_source = security::validate_path(source, allowed_base.as_deref())?;

    if !validated_source.is_dir() {
        return Err("Source folder does not exist or is a file".to_string());
    }

    let target_dir = Path::new(&target_directory);
    let validated_target = security::validate_path(target_dir, allowed_base.as_deref())?;

    if !validated_target.is_dir() {
        return Err("Target directory does not exist".to_string());
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

    mark_self_write(&state);
    fs::rename(&validated_source, &new_path)
        .map_err(|e| format!("Failed to move folder: {}", e))?;

    Ok(simplified_path_string(&new_path))
}

#[tauri::command]
async fn get_preferences(app: AppHandle) -> Result<Preferences, String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("preferences.json").map_err(|e| e.to_string())?;

    let prefs = if let Some(value) = store.get("preferences") {
        match serde_json::from_value::<Preferences>(value) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("Preferences corrupted, falling back to defaults: {}", e);
                Preferences::default()
            }
        }
    } else {
        Preferences::default()
    };

    Ok(prefs)
}

#[tauri::command]
async fn rename_file(old_path: String, new_name: String, state: State<'_, AppState>) -> Result<String, String> {
    let old_path = Path::new(&old_path);
    let allowed_base = get_current_directory(&state);
    let validated_old = security::validate_path(old_path, allowed_base.as_deref())?;

    if !validated_old.is_file() {
        return Err("File does not exist or is not a regular file".to_string());
    }

    security::validate_excalidraw_file(&validated_old)?;

    let parent = validated_old.parent().ok_or("Invalid file path")?;

    let new_path = security::safe_path_join(parent, &new_name)?;

    // 用 file_name 判断是否已含 .excalidraw 后缀，避免 "foo." 变成 "foo..excalidraw"。
    let new_path = if new_path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.ends_with(".excalidraw"))
        .unwrap_or(false)
    {
        new_path
    } else {
        new_path.with_extension("excalidraw")
    };

    if new_path.exists() && new_path != validated_old {
        return Err("A file with that name already exists".to_string());
    }

    mark_self_write(&state);
    fs::rename(&validated_old, &new_path)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    Ok(simplified_path_string(&new_path))
}

#[tauri::command]
async fn delete_file(file_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let path = Path::new(&file_path);
    let allowed_base = get_current_directory(&state);
    let validated_path = security::validate_path(path, allowed_base.as_deref())?;

    if !validated_path.is_file() {
        return Err("File does not exist or is not a regular file".to_string());
    }

    security::validate_excalidraw_file(&validated_path)?;

    fs::remove_file(&validated_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn save_preferences(app: AppHandle, preferences: Preferences) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("preferences.json").map_err(|e| e.to_string())?;

    let value = serde_json::to_value(&preferences).map_err(|e| e.to_string())?;
    store.set("preferences", value);
    store.save().map_err(|e| e.to_string())?;

    // 同步更新菜单中的最近目录/最近文件
    if let Err(e) = menu::update_recent_directories_menu(&app, preferences.recent_directories.clone())
    {
        eprintln!("Failed to update recent directories menu: {}", e);
    }
    if let Err(e) = menu::update_recent_files_menu(&app, preferences.recent_files.clone()) {
        eprintln!("Failed to update recent files menu: {}", e);
    }

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
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::{DialogExt, FilePath};

    let allowed_format = format.to_lowercase();
    let extensions: &[&str] = match allowed_format.as_str() {
        "png" => &["png"],
        "svg" => &["svg"],
        "json" => &["json"],
        "excalidraw" => &["excalidraw"],
        _ => return Err(format!("Unsupported export format: {}", format)),
    };

    // If exporting as excalidraw/json, validate the content structure.
    if allowed_format == "excalidraw" || allowed_format == "json" {
        security::validate_excalidraw_content(&content)?;
    }

    let (tx, rx) = mpsc::channel();

    let filter_name = allowed_format.to_uppercase();

    app.dialog()
        .file()
        .add_filter(&filter_name, extensions)
        .set_title(format!("Export as {}", filter_name))
        .save_file(move |path: Option<FilePath>| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => {
            let path = path.into_path().map_err(|e| e.to_string())?;
            // 校验扩展名与所选格式一致
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if !extensions.contains(&ext) {
                return Err(format!(
                    "Export path extension '.{}' does not match format '{}'",
                    ext, allowed_format
                ));
            }
            let allowed_base = get_current_directory(&state);
            let validated_path = security::validate_path_for_create(&path, allowed_base.as_deref())?;
            mark_self_write(&state);
            fs::write(&validated_path, content).map_err(|e| e.to_string())?;
            Ok(Some(simplified_path_string(&validated_path)))
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

    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // 路径校验：至少规范化并拒绝 .. 逃逸。
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    // 先创建 watcher，失败立即回传错误（修复原先静默返回 Ok 的问题）。
    let (tx, rx) = std::sync::mpsc::channel::<notify::Result<notify::Event>>();
    let mut watcher = notify::recommended_watcher(tx)
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;
    watcher
        .watch(&canonical, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    // 切换目录：更新 current_directory，drop 旧 watcher（释放系统监听资源与线程）。
    {
        let mut current_dir = state.current_directory.lock().map_err(|e| e.to_string())?;
        *current_dir = Some(canonical.clone());
    }
    {
        let mut w = state.watcher.lock().map_err(|e| e.to_string())?;
        // 旧 watcher 在此处被 drop，自动停止监听。
        *w = Some(watcher);
    }

    let app_handle = app.clone();
    // clone Arc 给 watcher 线程，用于读取自身写入抑制窗口。
    let last_self_write = state.last_self_write.clone();
    std::thread::spawn(move || {
        // 线程只持有 rx；watcher 由 state 持有。当 state 中 watcher 被 drop 时，
        // tx 也随之被 drop，rx.recv() 会返回 Err 从而退出循环——线程自然结束。
        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    if !matches!(
                        event.kind,
                        notify::EventKind::Create(_)
                            | notify::EventKind::Remove(_)
                            | notify::EventKind::Modify(_)
                    ) {
                        continue;
                    }
                    // 自身写入抑制窗口：在窗口内的事件不通知前端，避免保存→重载循环。
                    let suppressed = last_self_write
                        .lock()
                        .ok()
                        .and_then(|g| {
                            g.and_then(|t| Instant::now().checked_duration_since(t))
                        })
                        .map(|elapsed| elapsed < SELF_WRITE_SUPPRESS)
                        .unwrap_or(false);
                    if suppressed {
                        continue;
                    }
                    for changed_path in event.paths {
                        if let Some(extension) = changed_path.extension() {
                            if extension == "excalidraw" {
                                if let Err(e) = app_handle.emit("file-system-change", &changed_path) {
                                    eprintln!("emit file-system-change failed: {}", e);
                                }
                            }
                        }
                    }
                }
                Ok(Err(e)) => eprintln!("Watch error: {:?}", e),
                Err(_) => break,
            }
        }
    });

    Ok(())
}

/// 标记一次"自身写入"，用于 watcher 抑制窗口。
fn mark_self_write(state: &State<'_, AppState>) {
    if let Ok(mut g) = state.last_self_write.lock() {
        *g = Some(Instant::now());
    }
}
/// 统一返回前端路径字符串：去掉 Windows UNC `\\?\` 前缀。
fn simplified_path_string(path: &Path) -> String {
    dunce::simplified(path).to_string_lossy().into_owned()
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
                watcher: Mutex::new(None),
                last_self_write: Arc::new(Mutex::new(None)),
            });

            // 创建并设置应用菜单（设置在主窗口上）。
            let app_handle = app.handle().clone();
            match menu::create_menu(&app_handle) {
                Ok(menu) => {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Err(e) = window.set_menu(menu) {
                            eprintln!("Failed to set menu: {}", e);
                        }
                    }
                    menu::setup_menu_event_handler(&app_handle);
                }
                Err(e) => eprintln!("Failed to create menu: {}", e),
            }

            // 窗口关闭前让前端处理未保存改动。
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.emit("check-unsaved-before-close", ());
                    }
                });
            } else {
                eprintln!("Main window not found during setup");
            }

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
        .unwrap_or_else(|e| {
            eprintln!("error while running tauri application: {}", e);
            std::process::exit(1);
        });
}
