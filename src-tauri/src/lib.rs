mod menu;
mod security;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;

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
pub struct ZoomState {
    pub value: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileViewState {
    pub zoom: ZoomState,
    pub scroll_x: f64,
    pub scroll_y: f64,
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
    pub file_view_states: HashMap<String, FileViewState>,
}

/// Excalidraw 素材库条目（与官方 .excalidrawlib 格式兼容）。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryItem {
    pub id: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub created: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
    pub elements: Vec<serde_json::Value>,
}

/// 本地持久化的素材库数据结构。
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct LibraryData {
    pub items: Vec<LibraryItem>,
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
            file_view_states: HashMap::new(),
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
    /// 强制关闭标志：force_close_app 设置为 true 后，
    /// on_window_event 的 CloseRequested 不再 prevent_close，
    /// 让 app.exit(0) 能正常关闭窗口退出程序。
    pub is_force_closing: Arc<AtomicBool>,
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
                                    path: simplified_path_string(&path),
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
                        path: simplified_path_string(&path),
                        is_directory: true,
                        modified: false,
                        children: Some(children),
                    });
                } else if meta.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            tree.push(FileTreeNode {
                                name,
                                path: simplified_path_string(&path),
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
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 返回素材库存储文件路径：应用数据目录下的 library.json。
fn library_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_data_dir.join("library.json"))
}

#[tauri::command]
async fn load_library(app: AppHandle) -> Result<LibraryData, String> {
    let path = library_file_path(&app)?;
    if !path.exists() {
        return Ok(LibraryData::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read library: {}", e))?;
    if content.trim().is_empty() {
        return Ok(LibraryData::default());
    }
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse library: {}", e))
}

#[tauri::command]
async fn save_library(app: AppHandle, data: LibraryData) -> Result<(), String> {
    let path = library_file_path(&app)?;
    let content = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| format!("Failed to write library: {}", e))
}

/// 只允许访问官方素材库域名，避免被滥用来访问任意 URL。
fn validate_library_url(url: &str) -> Result<url::Url, String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("Invalid library URL: {}", e))?;
    let host = parsed.host_str().unwrap_or("");
    let allowed_hosts = [
        "libraries.excalidraw.com",
        "raw.githubusercontent.com",
    ];
    if !allowed_hosts.contains(&host) {
        return Err(format!("Library URL host '{}' is not allowed", host));
    }
    Ok(parsed)
}

#[tauri::command]
async fn download_library(url: String) -> Result<LibraryData, String> {
    validate_library_url(&url)?;

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download library: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download library: HTTP {}", response.status()));
    }

    let body = response.bytes()
        .await
        .map_err(|e| format!("Failed to read library response: {}", e))?;

    let json: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|e| format!("Downloaded library is not valid JSON: {}", e))?;

    // 支持两种格式：
    // 1. 官方 .excalidrawlib: { "libraryItems": [...] }
    // 2. libraries.json 中某一项的 source 字段可能直接是 item 数组
    let items = if let Some(library_items) = json.get("libraryItems").and_then(|v| v.as_array()) {
        library_items.clone()
    } else if let Some(items) = json.as_array() {
        items.clone()
    } else {
        return Err("Unrecognized library format: expected 'libraryItems' array".to_string());
    };

    let parsed_items: Vec<LibraryItem> = items
        .into_iter()
        .map(|value| {
            // 优先尝试标准反序列化；若结构不完全匹配，至少把 id/name/elements 提取出来。
            let mut item: LibraryItem = serde_json::from_value(value.clone())
                .unwrap_or_else(|_| {
                    let id = value
                        .get("id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("{:x}", md5::compute(value.to_string())));
                    let name = value
                        .get("name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let elements = value
                        .get("elements")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default();
                    LibraryItem {
                        id,
                        status: "published".to_string(),
                        created: None,
                        name,
                        elements,
                    }
                });
            if item.id.is_empty() {
                item.id = format!("{:x}", md5::compute(value.to_string()));
            }
            item
        })
        .filter(|item| !item.elements.is_empty())
        .collect();

    Ok(LibraryData { items: parsed_items })
}

/// 在独立 webview 窗口中打开官方素材库网站，并拦截 "Add to Excalidraw" 安装链接。
#[tauri::command]
async fn open_library_browser(app: AppHandle) -> Result<(), String> {
    const LABEL: &str = "library-browser";

    // 已有窗口则聚焦，避免重复打开。
    if let Some(existing) = app.get_webview_window(LABEL) {
        let _ = existing.set_focus();
        return Ok(());
    }

    let external_url = "https://libraries.excalidraw.com/?referrer=xd-whiteboard"
        .parse::<url::Url>()
        .map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::External(external_url))
        .title("Excalidraw 素材库")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .on_navigation(move |url: &url::Url| {
            let host = url.host_str().unwrap_or("");

            // 只允许官方素材库相关域名。
            let allowed = matches!(
                host,
                "libraries.excalidraw.com" | "excalidraw.com" | "www.excalidraw.com"
            );
            if !allowed {
                return false;
            }

            // 拦截 "Add to Excalidraw" 安装链接：
            // https://excalidraw.com/?addLibrary=https://...
            if host == "excalidraw.com" || host == "www.excalidraw.com" {
                if let Some((_, add_library_url)) = url.query_pairs().find(|(k, _)| k == "addLibrary") {
                    let _ = app_handle.emit_to(
                        "main",
                        "library-install-requested",
                        add_library_url.to_string(),
                    );
                    if let Some(win) = app_handle.get_webview_window(LABEL) {
                        let _ = win.close();
                    }
                    return false;
                }
                // excalidraw.com 其它页面不允许在浏览器里浏览。
                return false;
            }

            true
        })
        .build()
        .map_err(|e| e.to_string())?;

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
async fn force_close_app(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    // 设置标志，让 on_window_event 的 CloseRequested 放行关闭，
    // 否则 app.exit(0) 触发的窗口关闭会被 prevent_close 阻止，程序无法退出。
    state.is_force_closing.store(true, Ordering::SeqCst);
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 已有实例运行时，将主窗口带到前台并聚焦。
            #[cfg(desktop)]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let is_force_closing = Arc::new(AtomicBool::new(false));
            app.manage(AppState {
                current_directory: Mutex::new(None),
                watcher: Mutex::new(None),
                last_self_write: Arc::new(Mutex::new(None)),
                is_force_closing: is_force_closing.clone(),
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
                let app_handle_for_close = app.handle().clone();
                let app_handle_for_window_state = app.handle().clone();
                let is_force_closing_clone = is_force_closing.clone();
                // Tauri 2 的 WindowEvent 没有 Maximized/Unmaximized 变体，
                // 通过 Resized 事件结合 is_maximized() 检测最大化/还原状态变化。
                let window_for_state = window.clone();
                let was_maximized = Arc::new(AtomicBool::new(false));
                let was_maximized_clone = was_maximized.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            // force_close_app 设置标志后放行关闭，
                            // 否则 app.exit(0) 会再次触发 CloseRequested 被阻止，程序卡死。
                            if is_force_closing_clone.load(Ordering::SeqCst) {
                                return;
                            }
                            api.prevent_close();
                            // 用 app 级 emit 确保所有 webview 都能收到，
                            // 避免窗口级 emit 在某些时序下丢失。
                            let _ = app_handle_for_close.emit("check-unsaved-before-close", ());
                        }
                        tauri::WindowEvent::Resized(_) => {
                            let is_maximized = window_for_state.is_maximized().unwrap_or(false);
                            let was = was_maximized_clone.load(Ordering::SeqCst);
                            if is_maximized != was {
                                let event_name = if is_maximized {
                                    "window-maximized"
                                } else {
                                    "window-unmaximized"
                                };
                                let _ = app_handle_for_window_state.emit(event_name, ());
                                was_maximized_clone.store(is_maximized, Ordering::SeqCst);
                            }
                        }
                        _ => {}
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
            get_app_version,
            watch_directory,
            force_close_app,
            import_image,
            export_file,
            load_library,
            save_library,
            download_library,
            open_library_browser,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("error while running tauri application: {}", e);
            std::process::exit(1);
        });
}
