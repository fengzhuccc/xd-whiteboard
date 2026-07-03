import { useEffect, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export type UnsavedDialogResult = 'save' | 'discard' | 'cancel'

export interface UnsavedDialogState {
  open: boolean
  title: string
  description?: string
  saveLabel: string
  discardLabel: string
  cancelLabel: string
  resolve: ((value: UnsavedDialogResult) => void) | null
}

export const initialUnsavedState: UnsavedDialogState = {
  open: false,
  title: '',
  description: '',
  saveLabel: 'Save',
  discardLabel: "Don't Save",
  cancelLabel: 'Cancel',
  resolve: null,
}

interface UnsavedChangesDialogProps {
  state: UnsavedDialogState
  onOpenChange: (open: boolean) => void
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function UnsavedChangesDialog({
  state,
  onOpenChange,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const resolvedRef = useRef(false)
  const saveRef = useRef<HTMLButtonElement>(null)

  const finish = (result: UnsavedDialogResult) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (result === 'save') onSave()
    else if (result === 'discard') onDiscard()
    else onCancel()
  }

  useEffect(() => {
    if (state.open) {
      resolvedRef.current = false
      const timer = setTimeout(() => saveRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [state.open])

  useEffect(() => {
    if (!state.open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        finish('save')
      } else if (e.key === 'Escape') {
        e.preventDefault()
        finish('cancel')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.open, onSave, onDiscard, onCancel])

  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[360px] p-0 gap-0 overflow-hidden border-border bg-card shadow-float">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
              style={{ background: 'rgba(201, 148, 58, 0.12)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--state-warning)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground" style={{ textWrap: 'balance' }}>
                {state.title}
              </h2>
              {state.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{state.description}</p>
              )}
            </div>
          </div>

          <AlertDialogHeader className="sr-only">
            <AlertDialogDescription />
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 mt-5 sm:justify-end">
            <AlertDialogCancel
              onClick={() => finish('cancel')}
              className={`h-8 text-xs px-3 bg-surface-2 hover:bg-surface-3 border-0 ${focusRing}`}
            >
              {state.cancelLabel}
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => finish('discard')}
              className={`h-8 text-xs px-3 bg-surface-2 hover:bg-surface-3 border-0 text-muted-foreground ${focusRing}`}
            >
              {state.discardLabel}
            </Button>
            <AlertDialogAction
              ref={saveRef}
              onClick={() => finish('save')}
              className={`h-8 text-xs px-3 ${focusRing}`}
            >
              {state.saveLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
