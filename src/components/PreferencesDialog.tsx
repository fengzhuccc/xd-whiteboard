import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStore } from '../store/useStore'
import { useI18n } from '../hooks/useI18n'
import { Settings, Palette, Globe, Zap } from 'lucide-react'
import { useCallback } from 'react'
import { THEMES } from '../constants'

export function PreferencesDialog() {
  const { t } = useI18n()
  const open = useStore((s) => s.preferencesOpen)
  const setOpen = useStore((s) => s.setPreferencesOpen)
  const preferences = useStore((s) => s.preferences)
  const setPreferences = useStore((s) => s.setPreferences)
  const savePreferences = useStore((s) => s.savePreferences)
  const updateTheme = useStore((s) => s.updateTheme)
  const updateLanguage = useStore((s) => s.updateLanguage)

  const handlePreferenceChange = useCallback(
    async <K extends keyof typeof preferences>(
      key: K,
      value: (typeof preferences)[K],
    ) => {
      const next = { ...preferences, [key]: value }
      setPreferences(next)
      await savePreferences()
    },
    [preferences, setPreferences, savePreferences],
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-border bg-card shadow-float">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <DialogTitle className="text-base font-semibold">
                {t.preferences}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t.preferencesDescription}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border px-5 h-10">
            <TabsTrigger
              value="general"
              className="text-sm data-[state=active]:bg-surface-1 data-[state=active]:shadow-none rounded-md"
            >
              <Globe className="w-3.5 h-3.5 mr-1.5" />
              {t.general}
            </TabsTrigger>
            <TabsTrigger
              value="editor"
              className="text-sm data-[state=active]:bg-surface-1 data-[state=active]:shadow-none rounded-md"
            >
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              {t.editor}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-0 px-5 py-4 space-y-5">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-primary">
                {t.general}
              </h3>

              <div className="flex items-center justify-between mb-3">
                <Label htmlFor="pref-language" className="text-sm">
                  {t.language}
                </Label>
                <Select
                  value={preferences.language}
                  onValueChange={async (value) => {
                    await updateLanguage(value as typeof preferences.language)
                  }}
                >
                  <SelectTrigger id="pref-language" className="w-[140px] h-8 text-sm bg-surface-2 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="zh" className="text-sm">
                      {t.chinese}
                    </SelectItem>
                    <SelectItem value="en" className="text-sm">
                      {t.english}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label htmlFor="pref-sidebar" className="text-sm">
                    {t.showSidebarByDefault}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t.showSidebarByDefaultDescription}
                  </p>
                </div>
                <Switch
                  id="pref-sidebar"
                  checked={preferences.sidebarVisible}
                  onCheckedChange={async (checked) => {
                    await handlePreferenceChange('sidebarVisible', checked)
                    useStore.getState().setSidebarVisible(checked)
                  }}
                />
              </div>
            </section>

            <Separator className="bg-border" />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-primary flex items-center gap-1.5">
                <Zap className="w-3 h-3" />
                {t.autoSave}
              </h3>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label htmlFor="pref-autosave" className="text-sm">
                    {t.autoSave}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t.autoSaveDescription}
                  </p>
                </div>
                <Switch
                  id="pref-autosave"
                  checked={preferences.autoSaveEnabled}
                  onCheckedChange={async (checked) => {
                    await handlePreferenceChange('autoSaveEnabled', checked)
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pref-autosave-interval" className="text-sm">
                    {t.autoSaveInterval}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t.autoSaveIntervalDescription}
                  </p>
                </div>
                <Select
                  value={String(preferences.autoSaveInterval)}
                  onValueChange={async (value) => {
                    await handlePreferenceChange(
                      'autoSaveInterval',
                      Number(value),
                    )
                  }}
                  disabled={!preferences.autoSaveEnabled}
                >
                  <SelectTrigger
                    id="pref-autosave-interval"
                    className="w-[120px] h-8 text-sm bg-surface-2 border-border"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {[10, 30, 60, 120, 300].map((sec) => (
                      <SelectItem key={sec} value={String(sec)} className="text-sm">
                        {sec < 60
                          ? `${sec}${t.seconds}`
                          : `${sec / 60}${t.minutes}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="editor" className="mt-0 px-5 py-4 space-y-5">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-primary flex items-center gap-1.5">
                <Palette className="w-3 h-3" />
                {t.theme}
              </h3>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label htmlFor="pref-theme" className="text-sm">
                    {t.theme}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t.preferencesDescription}
                  </p>
                </div>
                <Select
                  value={preferences.theme}
                  onValueChange={async (value) => {
                    await updateTheme(value as typeof preferences.theme)
                  }}
                >
                  <SelectTrigger id="pref-theme" className="w-[140px] h-8 text-sm bg-surface-2 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {THEMES.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm border border-border"
                            style={{ backgroundColor: theme.canvasColor }}
                          />
                          {t[theme.labelKey]}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
