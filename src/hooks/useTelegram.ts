const tg = window.Telegram.WebApp

export function useTelegram() {

    const onClose = () => {
        tg.close()
    }

    const onToggleButton = () => {
        tg.MainButton.isVisible ? tg.MainButton.hide() : tg.MainButton.show()
    }

    return {
        onClose,
        onToggleButton,
        tg,
        user: tg.initDataUnsafe?.user, // {"id":319925498,"first_name":"Smirnov","last_name":"Ruslan","username":"mspuz","language_code":"ru","allows_write_to_pm":true,"photo_url":"https://t.me/i/userpic/320/fjsE1BHxePMsPeHkgTZXBzcWNuvwPw7SN3c0nvnTwrM.svg"}
        chat: tg.initDataUnsafe?.chat,
        queryId: tg.initDataUnsafe?.query_id,
    }
}