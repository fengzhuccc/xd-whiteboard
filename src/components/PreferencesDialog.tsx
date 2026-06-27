import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStore } from '../store/useStore'
import { useI18n } from '../hooks/useI18n'
import { Language } from '../lib/i18n'

interface PreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AUTO_SAVE_INTERVALS = [10, 30, 60, 300]

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
  const { t, language } = useI18n()
  const preferences = useStore((s) => s.preferences)
  const setPreferences = useStore((s) => s.setPreferences)
  const savePreferences = useStore((s) => s.savePreferences)

  const updatePreferences = (patch: Partial<typeof preferences>) => {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    savePreferences()

    // 主题变化立即生效
    if (patch.theme) {
      const root = document.documentElement
      if (patch.theme === 'dark') {
        root.classList.add('dark')
      } else if (patch.theme === 'light') {
        root.classList.remove('dark')
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.preferencesTitle}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">{t.general}</TabsTrigger>
            <TabsTrigger value="saving">{t.saving}</TabsTrigger>
            <TabsTrigger value="editor">{t.editor}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t.language}</Label>
                <Select
                  value={language}
                  onValueChange={(value) => updatePreferences({ language: value as Language })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t.english}</SelectItem>
                    <SelectItem value="zh">{t.chinese}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.theme}</Label>
                <Select
                  value={preferences.theme}
                  onValueChange={(value) =>
                    updatePreferences({ theme: value as 'system' | 'light' | 'dark' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{t.themeSystem}</SelectItem>
                    <SelectItem value="light">{t.themeLight}</SelectItem>
                    <SelectItem value="dark">{t.themeDark}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="saving" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-save" className="cursor-pointer">
                  {t.autoSave}
                </Label>
                <Switch
                  id="auto-save"
                  checked={preferences.autoSaveEnabled}
                  onCheckedChange={(checked) =>
                    updatePreferences({ autoSaveEnabled: checked })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.autoSaveInterval}</Label>
                <Select
                  value={String(preferences.autoSaveInterval)}
                  onValueChange={(value) =>
                    updatePreferences({ autoSaveInterval: Number(value) })
                  }
                  disabled={!preferences.autoSaveEnabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTO_SAVE_INTERVALS.map((sec) => (
                      <SelectItem key={sec} value={String(sec)}>
                        {sec >= 60 ? `${sec / 60} min` : `${sec} ${t.seconds}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="default-sidebar" className="cursor-pointer">
                {t.toggleSidebar}
              </Label>
              <Switch
                id="default-sidebar"
                checked={preferences.sidebarVisible}
                onCheckedChange={(checked) =>
                  updatePreferences({ sidebarVisible: checked })
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
