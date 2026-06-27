use std::path::{Path, PathBuf};

/// Validates that a path is safe to access (no path traversal attacks).
///
/// `must_exist`:
/// - `true`: 路径必须已存在（读、删除、重命名等场景）。
/// - `false`: 路径可以不存在（创建、另存为等场景），此时只规范化其**父目录**来校验边界。
pub fn validate_path(path: &Path, allowed_base: Option<&Path>) -> Result<PathBuf, String> {
    validate_path_opt(path, allowed_base, true)
}

/// 与 [validate_path] 相同，但允许目标路径尚不存在（用于 "另存为" / 新建文件）。
pub fn validate_path_for_create(
    path: &Path,
    allowed_base: Option<&Path>,
) -> Result<PathBuf, String> {
    validate_path_opt(path, allowed_base, false)
}

fn validate_path_opt(
    path: &Path,
    allowed_base: Option<&Path>,
    must_exist: bool,
) -> Result<PathBuf, String> {
    // 1. 先做语法层面校验：拒绝纯相对逃逸段，避免规范化前就被绕过。
    //    （规范化后不会再出现 ..，所以这里只在规范化前检查有意义。）
    for comp in path.components() {
        use std::path::Component;
        match comp {
            Component::ParentDir => {
                return Err("Path contains parent directory reference (..)".to_string());
            }
            Component::RootDir | Component::Prefix(_) | Component::Normal(_) | Component::CurDir => {}
        }
    }

    // 2. 规范化路径。若目标可以不存在，则规范化其父目录后拼接文件名。
    let canonical_path = if must_exist {
        path.canonicalize()
            .map_err(|e| format!("Failed to canonicalize path: {}", e))?
    } else {
        let parent = path.parent().ok_or_else(|| "Path has no parent".to_string())?;
        let file_name = path
            .file_name()
            .ok_or_else(|| "Path has no file name".to_string())?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize parent path: {}", e))?;
        canonical_parent.join(file_name)
    };

    // 3. 若指定了 allowed_base，确保路径在其下。
    if let Some(base) = allowed_base {
        let canonical_base = base
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize base path: {}", e))?;
        if !canonical_path.starts_with(&canonical_base) {
            return Err("Path traversal detected: path is outside allowed directory".to_string());
        }
    }

    Ok(canonical_path)
}

/// Validates that a file has the expected .excalidraw extension
pub fn validate_excalidraw_file(path: &Path) -> Result<(), String> {
    match path.extension() {
        Some(ext) if ext == "excalidraw" => Ok(()),
        Some(ext) => Err(format!(
            "Invalid file extension: expected .excalidraw, got .{}",
            ext.to_string_lossy()
        )),
        None => Err("File has no extension".to_string()),
    }
}

/// Validates JSON content to ensure it's a valid Excalidraw file
pub fn validate_excalidraw_content(content: &str) -> Result<(), String> {
    let json: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON: {}", e))?;

    // Check for required Excalidraw fields
    let obj = json.as_object().ok_or("Content is not a JSON object")?;

    // Validate type field
    match obj.get("type") {
        Some(t) if t == "excalidraw" => {}
        Some(t) => return Err(format!("Invalid type field: expected 'excalidraw', got {:?}", t)),
        None => return Err("Missing required 'type' field".to_string()),
    }

    // Validate version field
    match obj.get("version") {
        Some(v) if v.is_number() => {}
        Some(_) => return Err("Version field must be a number".to_string()),
        None => return Err("Missing required 'version' field".to_string()),
    }

    // Validate elements field
    match obj.get("elements") {
        Some(e) if e.is_array() => {}
        Some(_) => return Err("Elements field must be an array".to_string()),
        None => return Err("Missing required 'elements' field".to_string()),
    }

    Ok(())
}

/// Safely joins a filename to a directory path.
///
/// 通过 `Path::file_name()` 提取纯文件名，自动剥离任何路径前缀和 `..`/`.` 段，
/// 比"字符替换"更可靠：`..`、`/`、`\` 都无法逃逸。
pub fn safe_path_join(base: &Path, file_name: &str) -> Result<PathBuf, String> {
    let clean_name = Path::new(file_name)
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .into_owned();

    if clean_name.is_empty() || clean_name == "." || clean_name == ".." {
        return Err("Invalid filename".to_string());
    }

    Ok(base.join(clean_name))
}
