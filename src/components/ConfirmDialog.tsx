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
  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

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
                className="h-8 text-xs px-3 bg-surface-2 hover:bg-surface-3 border-0 text-muted-foreground"
              >
                {cancelLabel}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                variant === 'destructive'
                  ? 'h-8 text-xs px-3 bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'h-8 text-xs px-3'
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
