export interface TelegramWebApp {
    ready: () => void;
    expand: () => void;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
    }
}
