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
  resolve: null,
}

let globalSetState: ((state: ConfirmState) => void) | null = null
let pendingConfirm: ((state: ConfirmState) => void) | null = null

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(initialState)

  useEffect(() => {
    globalSetState = setState
    if (pendingConfirm) {
      pendingConfirm(state)
      pendingConfirm = null
    }
    return () => {
      globalSetState = null
    }
  }, [])

  useEffect(() => {
    if (pendingConfirm) {
      pendingConfirm(state)
      pendingConfirm = null
    }
  }, [state])

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      if (globalSetState) {
        globalSetState({
          ...options,
          open: true,
          resolve,
        })
      } else {
        pendingConfirm = (currentState: ConfirmState) => {
          if (currentState.resolve) {
            resolve(false)
          }
        }
      }
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(initialState)
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(initialState)
  }, [state])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      state.resolve?.(false)
      setState(initialState)
    }
  }, [state])

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
      globalSetState({
        ...options,
        open: true,
        resolve,
      })
    } else {
      resolve(false)
    }
  })
}
