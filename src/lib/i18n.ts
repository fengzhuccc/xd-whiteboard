export type Language = 'en' | 'zh'

export interface Translations {
  // Menu
  file: string
  edit: string
  view: string
  help: string
  openWorkspace: string
  newFile: string
  newFolder: string
  save: string
  saveAs: string
  exportImage: string
  rename: string
  delete: string
  about: string
  keyboardShortcuts: string
  preferences: string
  language: string
  english: string
  chinese: string
  theme: string
  themeSystem: string
  themeLight: string
  themeDark: string
  autoSave: string
  autoSaveInterval: string
  openLastDirectoryOnStartup: string
  preferencesTitle: string
  general: string
  saving: string
  editor: string
  seconds: string
  recentDirectories: string
  recentFiles: string
  quit: string
  toggleSidebar: string
  zoomIn: string
  zoomOut: string
  resetZoom: string
  toggleFullscreen: string
  window: string
  minimize: string
  close: string
  shortcutsDescription: string

  // Sidebar
  currentWorkspace: string
  myDesignProject: string
  noExcalidrawFilesFound: string
  noDirectorySelected: string
  files: string

  // Empty state
  noFileSelected: string
  selectFileToEdit: string
  orCreateNewFile: string
  loading: string

  // Sidebar selection bar
  selected: string
  clear: string

  // Save status
  saving: string
  saved: string

  // Dialogs
  confirmDelete: string
  confirmDeleteDescription: string
  unsavedChanges: string
  unsavedChangesDescription: string
  unsavedChangesCloseDescription: string
  unsavedChangesSwitchDescription: string
  unsavedChangesNewFileDescription: string
  saveAndMove: string
  saveAndClose: string
  dontSave: string
  cancel: string
  deleteConfirm: string
  confirmClose: string
  confirmCloseDescription: string
  closeWithoutSaving: string

  // About
  aboutTitle: string
  version: string
  aboutDescription: string
  authors: string
  license: string

  // Context Menu
  newFileContext: string
  newFolderContext: string
  renameContext: string
  deleteContext: string

  // Other
  untitled: string
  appName: string

  // Errors
  error: string
  fileNotFound: string
  fileNotFoundDescription: string
  fileAlreadyExists: string
  fileAlreadyExistsDescription: string
  folderAlreadyExists: string
  folderAlreadyExistsDescription: string
  operationFailed: string
  ok: string

  // Error boundary
  errorTitle: string
  errorDescription: string
  technicalDetails: string
  componentStack: string
  tryAgain: string
  reloadApp: string
}

export const translations: Record<Language, Translations> = {
  en: {
    // Menu
    file: 'File',
    edit: 'Edit',
    view: 'View',
    help: 'Help',
    openWorkspace: 'Open Workspace',
    newFile: 'New File',
    newFolder: 'New Folder',
    save: 'Save',
    saveAs: 'Save As',
    exportImage: 'Export Image',
    rename: 'Rename',
    delete: 'Delete',
    about: 'About',
    keyboardShortcuts: 'Keyboard Shortcuts',
    preferences: 'Preferences',
    language: 'Language',
    english: 'English',
    chinese: 'Chinese',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    autoSave: 'Auto Save',
    autoSaveInterval: 'Auto Save Interval',
    openLastDirectoryOnStartup: 'Open Last Directory on Startup',
    preferencesTitle: 'Preferences',
    general: 'General',
    saving: 'Saving',
    editor: 'Editor',
    seconds: 'seconds',
    recentDirectories: 'Recent Directories',
    recentFiles: 'Recent Files',
    quit: 'Quit',
    toggleSidebar: 'Toggle Sidebar',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Reset Zoom',
    toggleFullscreen: 'Toggle Fullscreen',
    window: 'Window',
    minimize: 'Minimize',
    close: 'Close',
    shortcutsDescription: 'Use these shortcuts to work faster',

    // Sidebar
    currentWorkspace: 'Current Workspace',
    myDesignProject: 'My Design Project',
    noExcalidrawFilesFound: 'No .excalidraw files found',
    noDirectorySelected: 'No directory selected',
    files: 'files',

    // Empty state
    noFileSelected: 'No file selected',
    selectFileToEdit: 'Select a file from the sidebar to start editing',
    orCreateNewFile: 'or create a new file',
    loading: 'Loading...',

    // Sidebar selection bar
    selected: 'Selected',
    clear: 'Clear',

    // Save status
    saving: 'Saving...',
    saved: 'Saved',

    // Dialogs
    confirmDelete: 'Confirm Delete',
    confirmDeleteDescription: 'Are you sure you want to delete "{name}"?',
    unsavedChanges: 'Unsaved Changes',
    unsavedChangesDescription: 'Do you want to save changes to "{name}" before moving?',
    unsavedChangesCloseDescription: 'Do you want to save your changes before closing?',
    unsavedChangesSwitchDescription: 'Do you want to save changes to "{name}" before switching files?',
    unsavedChangesNewFileDescription: 'Do you want to save changes to "{name}" before creating a new file?',
    saveAndMove: 'Save & Move',
    saveAndClose: 'Save & Close',
    dontSave: "Don't Save",
    cancel: 'Cancel',
    deleteConfirm: 'Delete',
    confirmClose: 'Confirm Close',
    confirmCloseDescription: 'Are you sure you want to close without saving?',
    closeWithoutSaving: 'Close Without Saving',

    // About
    aboutTitle: 'About XD Whiteboard',
    version: 'Version',
    aboutDescription: 'A desktop application for managing and editing local Excalidraw files. Built with Tauri, React, and the Excalidraw engine.',
    authors: 'XD Whiteboard Team',
    license: 'MIT License',

    // Context Menu
    newFileContext: 'New File',
    newFolderContext: 'New Folder',
    renameContext: 'Rename',
    deleteContext: 'Delete',

    // Other
    untitled: 'Untitled',
    appName: 'XD Whiteboard',

    // Errors
    error: 'Error',
    fileNotFound: 'File Not Found',
    fileNotFoundDescription: 'The file "{name}" may have been deleted or moved.',
    fileAlreadyExists: 'File Already Exists',
    fileAlreadyExistsDescription: 'A file with that name already exists in the target directory.',
    folderAlreadyExists: 'Folder Already Exists',
    folderAlreadyExistsDescription: 'A folder with that name already exists in the target directory.',
    operationFailed: 'Operation Failed',
    ok: 'OK',

    // Error boundary
    errorTitle: 'Something went wrong',
    errorDescription: "An unexpected error occurred. The error has been logged and we'll look into it.",
    technicalDetails: 'Technical details',
    componentStack: 'Component Stack:',
    tryAgain: 'Try Again',
    reloadApp: 'Reload App',
  },
  zh: {
    // Menu
    file: '文件',
    edit: '编辑',
    view: '视图',
    help: '帮助',
    openWorkspace: '打开工作空间',
    newFile: '新建文件',
    newFolder: '新建文件夹',
    save: '保存',
    saveAs: '另存为',
    exportImage: '导出图片',
    rename: '重命名',
    delete: '删除',
    about: '关于',
    keyboardShortcuts: '快捷键',
    preferences: '偏好设置',
    language: '语言',
    english: '英文',
    chinese: '中文',
    theme: '主题',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    autoSave: '自动保存',
    autoSaveInterval: '自动保存间隔',
    openLastDirectoryOnStartup: '启动时打开上次目录',
    preferencesTitle: '偏好设置',
    general: '通用',
    saving: '保存',
    editor: '编辑器',
    seconds: '秒',
    recentDirectories: '最近目录',
    recentFiles: '最近文件',
    quit: '退出',
    toggleSidebar: '切换侧边栏',
    zoomIn: '放大',
    zoomOut: '缩小',
    resetZoom: '重置缩放',
    toggleFullscreen: '切换全屏',
    window: '窗口',
    minimize: '最小化',
    close: '关闭',
    shortcutsDescription: '使用这些快捷键提高效率',

    // Sidebar
    currentWorkspace: '当前工作空间',
    myDesignProject: '我的设计项目',
    noExcalidrawFilesFound: '未找到 .excalidraw 文件',
    noDirectorySelected: '未选择目录',
    files: '个文件',

    // Empty state
    noFileSelected: '未选择文件',
    selectFileToEdit: '从侧边栏选择一个文件开始编辑',
    orCreateNewFile: '或创建新文件',
    loading: '加载中...',

    // Sidebar selection bar
    selected: '已选择',
    clear: '清除',

    // Save status
    saving: '保存中...',
    saved: '已保存',

    // Dialogs
    confirmDelete: '确认删除',
    confirmDeleteDescription: '确定要删除 "{name}" 吗？',
    unsavedChanges: '未保存的更改',
    unsavedChangesDescription: '移动前是否保存对 "{name}" 的更改？',
    unsavedChangesCloseDescription: '关闭前是否保存更改？',
    unsavedChangesSwitchDescription: '切换文件前是否保存对 "{name}" 的更改？',
    unsavedChangesNewFileDescription: '创建新文件前是否保存对 "{name}" 的更改？',
    saveAndMove: '保存并移动',
    saveAndClose: '保存并关闭',
    dontSave: '不保存',
    cancel: '取消',
    deleteConfirm: '删除',
    confirmClose: '确认关闭',
    confirmCloseDescription: '确定要不保存就关闭吗？',
    closeWithoutSaving: '不保存关闭',

    // About
    aboutTitle: '关于小呆画板',
    version: '版本',
    aboutDescription: '一款用于管理和编辑本地 Excalidraw 文件的桌面应用程序。基于 Tauri、React 和 Excalidraw 引擎构建。',
    authors: '小呆画板团队',
    license: 'MIT 许可证',

    // Context Menu
    newFileContext: '新建文件',
    newFolderContext: '新建文件夹',
    renameContext: '重命名',
    deleteContext: '删除',

    // Other
    untitled: '未命名',
    appName: '小呆画板',

    // Errors
    error: '错误',
    fileNotFound: '文件未找到',
    fileNotFoundDescription: '文件 "{name}" 可能已被删除或移动。',
    fileAlreadyExists: '文件已存在',
    fileAlreadyExistsDescription: '目标目录中已存在同名文件。',
    folderAlreadyExists: '文件夹已存在',
    folderAlreadyExistsDescription: '目标目录中已存在同名文件夹。',
    operationFailed: '操作失败',
    ok: '确定',

    // Error boundary
    errorTitle: '出了点问题',
    errorDescription: '发生了意外错误。错误已记录，我们会进一步排查。',
    technicalDetails: '技术细节',
    componentStack: '组件堆栈：',
    tryAgain: '重试',
    reloadApp: '重新加载应用',
  }
}