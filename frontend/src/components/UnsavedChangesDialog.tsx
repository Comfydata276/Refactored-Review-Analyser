import { AlertTriangle, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface UnsavedChangesDialogProps {
  open: boolean
  onSave: () => Promise<void>
  onDiscard: () => void
  onCancel: () => void
  saving?: boolean
}

export function UnsavedChangesDialog({
  open,
  onSave,
  onDiscard,
  onCancel,
  saving = false
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="w-[95vw] max-w-[480px] max-h-[90vh] mx-4 p-4 sm:p-6">
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold leading-tight">
                Unsaved Changes
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-relaxed">
                You have unsaved changes that will be lost if you navigate away.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Would you like to save your changes before leaving this page?
          </p>
        </div>
        
        <DialogFooter className="flex-col gap-3 sm:flex-row sm:gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="w-full sm:w-auto sm:order-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDiscard}
            disabled={saving}
            className="w-full sm:w-auto sm:order-2"
          >
            <Trash2 className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Discard Changes</span>
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="w-full sm:w-auto sm:order-3"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 flex-shrink-0" />
                <span className="truncate">Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Save & Continue</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}