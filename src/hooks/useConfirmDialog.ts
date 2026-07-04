import { useState, useCallback, useEffect } from 'react'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  hideCancel?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((value: boolean) => void) | null
  dialogId: number
}

const initialState: ConfirmState = {
  open: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
  hideCancel: false,
  resolve: null,
  dialogId: 0,
}

let globalSetState: ((state: ConfirmState) => void) | null = null
let globalCurrent: ConfirmState = initialState
let nextDialogId = 1
const pendingQueue: Array<{
  options: ConfirmOptions
  resolve: (value: boolean) => void
}> = []

function openDialog(options: ConfirmOptions, resolve: (value: boolean) => void) {
  if (globalCurrent.open) {
    pendingQueue.push({ options, resolve })
    return
  }
  const dialogId = nextDialogId++
  globalSetState?.({
    ...initialState,
    ...options,
    open: true,
    resolve,
    dialogId,
  })
}

/// 解析当前对话框并打开队列中的下一个（若有）。
/// 用 dialogId 保证幂等：同一对话框的重复调用（来自 Radix 自动关闭 +
/// 显式 onOpenChange 等）会被安全忽略，避免队列中的下一个对话框被误关。
function resolveCurrent(dialogId: number, value: boolean) {
  if (globalCurrent.dialogId !== dialogId || !globalCurrent.open) {
    return
  }

  const resolve = globalCurrent.resolve
  resolve?.(value)

  if (pendingQueue.length > 0) {
    const next = pendingQueue.shift()
    if (next) {
      const newId = nextDialogId++
      globalSetState?.({
        ...initialState,
        ...next.options,
        open: true,
        resolve: next.resolve,
        dialogId: newId,
      })
      return
    }
  }
  globalSetState?.(initialState)
}

/// 重置全局确认对话框状态，清空队列。
/// 供关闭流程在调用 confirm() 前清理可能卡住的旧状态。
export function resetConfirmState() {
  pendingQueue.length = 0
  globalSetState?.(initialState)
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(initialState)

  useEffect(() => {
    globalSetState = (next) => {
      globalCurrent = next
      setState(next)
    }

    // Flush any prompts that were requested before the component mounted.
    while (pendingQueue.length > 0 && !globalCurrent.open) {
      const next = pendingQueue.shift()
      if (next) {
        const dialogId = nextDialogId++
        globalSetState({
          ...initialState,
          ...next.options,
          open: true,
          resolve: next.resolve,
          dialogId,
        })
      }
    }

    return () => {
      globalSetState = null
      globalCurrent = initialState
    }
  }, [])

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      if (globalSetState) {
        openDialog(options, resolve)
      } else {
        pendingQueue.push({ options, resolve })
      }
    })
  }, [])

  const handleConfirm = useCallback(() => {
    resolveCurrent(state.dialogId, true)
  }, [state])

  const handleCancel = useCallback(() => {
    resolveCurrent(state.dialogId, false)
  }, [state])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resolveCurrent(state.dialogId, false)
      }
    },
    [state]
  )

  return {
    confirm,
    confirmState: state,
    handleConfirm,
    handleCancel,
    handleOpenChange,
  }
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (globalSetState) {
      openDialog(options, resolve)
    } else {
      pendingQueue.push({ options, resolve })
    }
  })
}
