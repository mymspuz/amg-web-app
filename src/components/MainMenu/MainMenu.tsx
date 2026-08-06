import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import './MainMenu.css'

import counterparties from '../../data/counterparty.json'
import { fetchState, IChatState } from '../../api/client'
import { useTelegram } from '../../hooks/useTelegram'

const MainMenu = () => {
    const [counterparty, setCounterparty] = useState<number>(counterparties[0].id)
    const [state, setState] = useState<IChatState | null>(null)
    const [error, setError] = useState<string>('')

    const navigate = useNavigate()
    const { onClose, hideMainButton } = useTelegram()

    useEffect(() => {
        hideMainButton()

        // Состояние приходит от бота, а не из ссылки: оно всегда актуальное
        fetchState()
            .then(setState)
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить данные от бота'))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function onChangeCounterparty(e: { target: { value: any } }) {
        setCounterparty(Number(e.target.value))
    }

    const handleButtonClick = (path: string) => {
        navigate(`/${path}`)
    }

    return (
        <>
            <div className="telegram-container">
                <div className="header">
                    <h1>AMG</h1>
                    <h3>{state ? state.fullName : 'Загрузка...'}</h3>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="buttons-container">
                    <div className="input-row">
                        <div className="input-group half">
                            <select
                                id="counterparty"
                                value={counterparty}
                                onChange={onChangeCounterparty}
                                className={''}
                            >
                                {counterparties.map(i => (
                                    <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        id="buttonTaskMenu"
                        className="tg-button primary"
                        onClick={() => handleButtonClick(`InvoiceForPayment?counterpartyId=${counterparty}&fromFile=${state?.hasItems ? 1 : 0}`)}
                    >
                        📝 Создать счет{state?.hasItems ? ` (строк из файла: ${state.itemsCount})` : ''}
                    </button>

                    {state?.hasInvoice
                        ? <button
                            id="buttonTaskMenu"
                            className="tg-button primary"
                            onClick={() => handleButtonClick('PaymentOrder')}
                        >
                            📝 Создать пп на {state.invoice.sum} руб.
                        </button>
                        : null
                    }
                </div>
                <button className="main-action-button" onClick={onClose}>
                    Закрыть
                </button>
            </div>
        </>
    )
}

export default MainMenu
