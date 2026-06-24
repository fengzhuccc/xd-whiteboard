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
let pendingQueue: Array<{
  options: UnsavedDialogOptions
  resolve: (value: UnsavedDialogResult) => void
}> = []

export function useUnsavedDialog() {
  const [state, setState] = useState<UnsavedDialogState>(initialUnsavedState)

  useEffect(() => {
    globalSetState = setState

    // Flush any prompts that were requested before the component mounted
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

  const openDialog = (
    options: UnsavedDialogOptions,
    resolve: (value: UnsavedDialogResult) => void,
  ) => {
    setState({
      ...initialUnsavedState,
      ...options,
      saveLabel: options.saveLabel || initialUnsavedState.saveLabel,
      discardLabel: options.discardLabel || initialUnsavedState.discardLabel,
      cancelLabel: options.cancelLabel || initialUnsavedState.cancelLabel,
      open: true,
      resolve,
    })
  }

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
    [],
  )

  const closeDialog = useCallback(
    (result: UnsavedDialogResult) => {
      state.resolve?.(result)
      setState(initialUnsavedState)
    },
    [state],
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeDialog('cancel')
      }
    },
    [closeDialog],
  )

  return {
    prompt,
    state,
    closeDialog,
    handleOpenChange,
  }
}

export function promptUnsavedChanges(
  options: UnsavedDialogOptions,
): Promise<UnsavedDialogResult> {
  return new Promise((resolve) => {
    if (globalSetState) {
      globalSetState({
        ...initialUnsavedState,
        ...options,
        saveLabel: options.saveLabel || initialUnsavedState.saveLabel,
        discardLabel: options.discardLabel || initialUnsavedState.discardLabel,
        cancelLabel: options.cancelLabel || initialUnsavedState.cancelLabel,
        open: true,
        resolve,
      })
    } else {
      pendingQueue.push({ options, resolve })
    }
  })
}
