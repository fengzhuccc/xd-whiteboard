import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface LibraryInstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: 'downloading' | 'success' | 'error'
  message: string
}

export function LibraryInstallDialog({
  open,
  onOpenChange,
  status,
  message,
}: LibraryInstallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {status === 'downloading' && (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                正在安装素材库
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-state-success" />
                安装成功
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="w-5 h-5 text-state-error" />
                安装失败
              </>
            )}
          </DialogTitle>
          <DialogDescription className="break-all text-sm">
            {status === 'downloading' ? (
              <>
                正在下载：
                <span className="block mt-1 text-xs text-muted-foreground">{message}</span>
              </>
            ) : (
              message
            )}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
