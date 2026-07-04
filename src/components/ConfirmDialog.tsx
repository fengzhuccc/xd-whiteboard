import { useEffect, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: 'default' | 'destructive'
  hideCancel?: boolean
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  hideCancel = false,
}: ConfirmDialogProps) {
  const confirmedRef = useRef(false)
  const actionRef = useRef<HTMLButtonElement>(null)

  const handleCancel = () => {
    if (confirmedRef.current) return
    confirmedRef.current = true
    onCancel?.()
  }

  const handleConfirm = () => {
    if (confirmedRef.current) return
    confirmedRef.current = true
    onConfirm()
  }

  useEffect(() => {
    if (open) {
      confirmedRef.current = false
      // 短暂延迟确保对话框已挂载，再将焦点移到主按钮
      const timer = setTimeout(() => actionRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      } else if (e.key === 'Escape' && !hideCancel) {
        e.preventDefault()
        handleCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, hideCancel, onConfirm, onCancel, onOpenChange])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[360px] p-0 gap-0 overflow-hidden border-border bg-card shadow-float">
        <div className="px-6 py-5">
          <AlertDialogHeader className="space-y-1 mb-4">
            <AlertDialogTitle className="text-sm font-semibold text-foreground">
              {title}
            </AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            {!hideCancel && (
              <AlertDialogCancel
                onClick={handleCancel}
                className={`h-8 text-xs px-3 bg-surface-2 hover:bg-surface-3 border-0 text-muted-foreground ${focusRing}`}
              >
                {cancelLabel}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              ref={actionRef}
              onClick={handleConfirm}
              className={
                variant === 'destructive'
                  ? `h-8 text-xs px-3 bg-destructive text-destructive-foreground hover:bg-destructive/90 ${focusRing}`
                  : `h-8 text-xs px-3 ${focusRing}`
              }
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
