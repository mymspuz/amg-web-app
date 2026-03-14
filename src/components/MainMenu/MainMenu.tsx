import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import './MainMenu.css'

import counterparties from '../../data/counterparty.json'

const MainMenu = () => {
    const [counterparty, setCounterparty] = useState<number>(counterparties[0].id)

    const navigate = useNavigate()
    const [search, setSearch] = useSearchParams()
    const incomingFile = Number(search.get('incomingFile'))
    const invoiceFile = Number(search.get('invoiceFile'))
    console.log('invoiceFile - ', invoiceFile)
    function onChangeCounterparty(e: { target: { value: any } }) {
        setCounterparty(Number(e.target.value))
    }

    const handleButtonClick = (path: string) => {
        navigate(`/${path}`)
    }
    const handleMainAction = () => {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.close();
        } else {
            alert('Основное действие выполнено!');
        }
    }

    return (
        <>
            <div className="telegram-container">
                <div className="header">
                    <h1>AMG</h1>
                    <h3>Пользователь</h3>
                </div>

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
                        onClick={() => handleButtonClick(`InvoiceForPayment?counterpartyId=${counterparty}&fromFile=${incomingFile}`)}
                    >
                        📝 Создать счет
                    </button>
                    {invoiceFile
                        ?
                        <button
                            id="buttonTaskMenu"
                            className="tg-button primary"
                            onClick={() => handleButtonClick(`PaymentOrder?counterpartyId=${counterparty}`)}
                        >
                            📝 Создать пп
                        </button>
                        :
                        null
                    }
                </div>
                <button className="main-action-button" onClick={handleMainAction}>
                    Закрыть
                </button>
            </div>
        </>
    )
}

export default MainMenu