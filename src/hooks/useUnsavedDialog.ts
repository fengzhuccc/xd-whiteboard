import { useState, useCallback, useEffect } from 'react'
import {
  UnsavedDialogResult,
  UnsavedDialogState,
  initialUnsavedState,
} from '../components/UnsavedChangesDialog'

export interface UnsavedDialogOptions {
  title: string
  description?: string
  saveLabel?: string
  discardLabel?: string
  cancelLabel?: string
}

let globalSetState: ((state: UnsavedDialogState) => void) | null = null
let globalCurrent: UnsavedDialogState = initialUnsavedState
let pendingQueue: Array<{
  options: UnsavedDialogOptions
  resolve: (value: UnsavedDialogResult) => void
}> = []

function openDialog(
  options: UnsavedDialogOptions,
  resolve: (value: UnsavedDialogResult) => void
) {
  // 已有对话框打开时入队，避免覆盖前者导致 Promise 永久悬挂。
  if (globalCurrent.open) {
    pendingQueue.push({ options, resolve })
    return
  }
  globalSetState?.({
    ...initialUnsavedState,
    ...options,
    saveLabel: options.saveLabel || initialUnsavedState.saveLabel,
    discardLabel: options.discardLabel || initialUnsavedState.discardLabel,
    cancelLabel: options.cancelLabel || initialUnsavedState.cancelLabel,
    open: true,
    resolve,
  })
}

function processNext() {
  if (pendingQueue.length > 0) {
    const next = pendingQueue.shift()
    if (next) {
      globalSetState?.({
        ...initialUnsavedState,
        ...next.options,
        saveLabel: next.options.saveLabel || initialUnsavedState.saveLabel,
        discardLabel: next.options.discardLabel || initialUnsavedState.discardLabel,
        cancelLabel: next.options.cancelLabel || initialUnsavedState.cancelLabel,
        open: true,
        resolve: next.resolve,
      })
      return
    }
  }
  globalSetState?.(initialUnsavedState)
}

export function useUnsavedDialog() {
  const [state, setState] = useState<UnsavedDialogState>(initialUnsavedState)

  useEffect(() => {
    globalSetState = (next) => {
      globalCurrent = next
      setState(next)
    }

    // Flush any prompts that were requested before the component mounted
    while (pendingQueue.length > 0 && !globalCurrent.open) {
      const next = pendingQueue.shift()
      if (next) {
        globalSetState?.({
          ...initialUnsavedState,
          ...next.options,
          saveLabel: next.options.saveLabel || initialUnsavedState.saveLabel,
          discardLabel: next.options.discardLabel || initialUnsavedState.discardLabel,
          cancelLabel: next.options.cancelLabel || initialUnsavedState.cancelLabel,
          open: true,
          resolve: next.resolve,
        })
      }
    }

    return () => {
      globalSetState = null
      globalCurrent = initialUnsavedState
    }
  }, [])

  const prompt = useCallback(
    (options: UnsavedDialogOptions): Promise<UnsavedDialogResult> => {
      return new Promise((resolve) => {
        if (globalSetState) {
          openDialog(options, resolve)
        } else {
          pendingQueue.push({ options, resolve })
        }
      })
    },
    []
  )

  const closeDialog = useCallback(
    (result: UnsavedDialogResult) => {
      state.resolve?.(result)
      processNext()
    },
    [state]
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeDialog('cancel')
      }
    },
    [closeDialog]
  )

  return {
    prompt,
    state,
    closeDialog,
    handleOpenChange,
  }
}

export function promptUnsavedChanges(
  options: UnsavedDialogOptions
): Promise<UnsavedDialogResult> {
  return new Promise((resolve) => {
    if (globalSetState) {
      openDialog(options, resolve)
    } else {
      pendingQueue.push({ options, resolve })
    }
  })
}
