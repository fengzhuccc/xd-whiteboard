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
}

let globalSetState: ((state: ConfirmState) => void) | null = null
let globalCurrent: ConfirmState = initialState
const pendingQueue: Array<{
  options: ConfirmOptions
  resolve: (value: boolean) => void
}> = []

function openDialog(options: ConfirmOptions, resolve: (value: boolean) => void) {
  // 已有对话框打开时入队，避免覆盖前者导致 Promise 永久悬挂。
  if (globalCurrent.open) {
    pendingQueue.push({ options, resolve })
    return
  }
  globalSetState?.({
    ...initialState,
    ...options,
    open: true,
    resolve,
  })
}

function processNext() {
  if (pendingQueue.length > 0) {
    const next = pendingQueue.shift()
    if (next) {
      globalSetState?.({
        ...initialState,
        ...next.options,
        open: true,
        resolve: next.resolve,
      })
      return
    }
  }
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
        globalSetState({
          ...initialState,
          ...next.options,
          open: true,
          resolve: next.resolve,
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
    state.resolve?.(true)
    processNext()
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    processNext()
  }, [state])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        state.resolve?.(false)
        processNext()
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
