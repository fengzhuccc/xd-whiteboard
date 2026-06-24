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
const pendingQueue: Array<{
  options: ConfirmOptions
  resolve: (value: boolean) => void
}> = []

function openDialog(
  options: ConfirmOptions,
  resolve: (value: boolean) => void
) {
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
      openDialog(next.options, next.resolve)
      return
    }
  }
  globalSetState?.(initialState)
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(initialState)

  useEffect(() => {
    globalSetState = setState

    while (pendingQueue.length > 0) {
      const next = pendingQueue.shift()
      if (next) {
        openDialog(next.options, next.resolve)
      }
    }

    return () => {
      globalSetState = null
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
