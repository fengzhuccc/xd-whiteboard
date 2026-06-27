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

export function UnsavedChangesDialog({
  state,
  onOpenChange,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description && (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onCancel}>
            {state.cancelLabel}
          </AlertDialogCancel>
          <Button variant="outline" onClick={onDiscard}>
            {state.discardLabel}
          </Button>
          <AlertDialogAction onClick={onSave}>
            {state.saveLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
