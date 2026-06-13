export {}

declare global {
  interface TelegramWebAppUser {
    id: number
    first_name?: string
    last_name?: string
    username?: string
    language_code?: string
  }

  interface TelegramThemeParams {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
  }

  interface TelegramMainButton {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText: (text: string) => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
  }

  interface TelegramWebApp {
    initData: string
    initDataUnsafe: {
      user?: TelegramWebAppUser
      auth_date?: number
      hash?: string
    }
    version: string
    platform: string
    colorScheme: 'light' | 'dark'
    themeParams: TelegramThemeParams
    isExpanded: boolean
    viewportHeight: number
    viewportStableHeight: number
    ready: () => void
    expand: () => void
    close: () => void
    MainButton: TelegramMainButton
    HapticFeedback?: {
      impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
      notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    }
  }

  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}
