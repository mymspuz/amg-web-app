const tg = window.Telegram?.WebApp

export function useTelegram() {
    const onClose = () => tg?.close()

    // Показывает главную кнопку Telegram с нужным текстом и обработчиком
    const showMainButton = (text: string, onClick: () => void) => {
        if (!tg?.MainButton) return () => {}

        tg.MainButton.setParams({ text })
        tg.MainButton.show()
        tg.MainButton.onClick(onClick)

        return () => {
            tg.MainButton.offClick(onClick)
            tg.MainButton.hide()
        }
    }

    const hideMainButton = () => tg?.MainButton?.hide()

    return {
        tg,
        onClose,
        showMainButton,
        hideMainButton,
        user: tg?.initDataUnsafe?.user,
        // Приложение открыто внутри Telegram - только тогда есть подписанные данные
        isTelegram: Boolean(tg?.initData),
        // Есть родная кнопка отправки внизу окна. Тогда свою в форме
        // не показываем: две одинаковые кнопки сбивают с толку
        hasMainButton: Boolean(tg?.MainButton),
    }
}
