import { toast as sonner } from 'sonner'

type ConfirmOptions = {
  confirmLabel?: string
  cancelLabel?: string
}

export const toast = {
  success(message: string) {
    sonner.success(message)
  },
  error(message: string) {
    sonner.error(message)
  },
  message(message: string) {
    sonner.message(message)
  },
  /** Sonner confirmation — replaces browser confirm(). */
  confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise(resolve => {
      let settled = false
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      sonner(message, {
        duration: Infinity,
        action: {
          label: options.confirmLabel ?? 'Confirm',
          onClick: () => settle(true),
        },
        cancel: {
          label: options.cancelLabel ?? 'Cancel',
          onClick: () => settle(false),
        },
        onDismiss: () => settle(false),
      })
    })
  },
}
