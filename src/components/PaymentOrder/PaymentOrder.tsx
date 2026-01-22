import React, { useState, ChangeEvent, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useTelegram } from '../../hooks/useTelegram'

import './PaymentOrder.css'

import counterpartiesJson from '../../data/counterparty.json'
import clients from '../../data/clients.json'

interface IFormData {
    clientId: string
    sum: number
    comment: string
}

interface ICounterparty {
    id: number
    name: string
    inn: number
    kpp: number
    ind: number
    address: string
    phone: string | null
    bank: {
        name: string
        bik: string
        check1: string
        check2: string
    },
    items: string[]
}

const PaymentOrder = () => {
    const { tg, queryId, user, chat} = useTelegram()

    const navigate = useNavigate()
    const [search, setSearch] = useSearchParams()

    const counterpartyId = Number(search.get('counterpartyId'))
    const counterparties = [...counterpartiesJson]
    const counterparty: ICounterparty = counterparties.find(i => i.id === counterpartyId) ? counterparties.filter(i => i.id === counterpartyId)[0] : {} as ICounterparty

    const [formData, setFormData] = useState<IFormData>({
        clientId: clients[0].id,
        sum: 0,
        comment: '',
    })

    const handleBack = (): void => {
        navigate(-1)
    }

    function onChangeClient(e: { target: { value: any } }) {
        setFormData({ ...formData, clientId: e.target.value })
    }

    function handleSumChange(e: ChangeEvent<HTMLInputElement>) {
        setFormData({ ...formData, sum: Number(e.target.value) })
    }

    function handleCommentChange(e: ChangeEvent<HTMLInputElement>) {
        setFormData({ ...formData, comment: e.target.value })
    }

    const onSendData = useCallback(async () => {
        tg.sendData(JSON.stringify({
            type: 'paymentOrder',
            data: formData,
        }));
    }, [formData])

    useEffect(() => {
        tg.onEvent('mainButtonClicked', onSendData)
        return () => {
            tg.offEvent('mainButtonClicked', onSendData)
        }
    }, [onSendData])

    useEffect(() => {
        tg.MainButton.setParams({
            text: 'Отправить данные'
        })
    }, [])

    return (
        <div className="form-container">
            <div className="form-header">
                <button
                    type="button"
                    className="back-button"
                    onClick={handleBack}
                    aria-label="Назад"
                >
                    ‹
                </button>
                <h1>📋 Создание <strong>пп</strong></h1>
                <p>Заполните форму для создания нового платежного поручения от {counterparty.name}</p>
            </div>

            <form className="adaptive-form">
                {/* Основная информация */}
                <fieldset className="form-section">
                    <legend>👤 Получатель</legend>

                    <div className="input-group">
                        <label htmlFor="buyer" className="required">
                            Укажите получателя
                        </label>
                        <select
                            id="buyer"
                            value={formData.clientId}
                            onChange={onChangeClient}
                            className={''}
                        >
                            {clients.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                        </select>
                    </div>
                </fieldset>

                <fieldset className="form-section">
                    <div className="input-group">
                        <input
                            id="itemName"
                            type="text"
                            value={formData.comment}
                            onChange={handleCommentChange}
                            placeholder="Назначение платежа"
                            className={''}
                        />
                    </div>

                    <div className="input-row">
                        <div className="input-group half">
                            <label htmlFor="itemAmount" className="required">
                                Сумма
                            </label>
                            <input
                                id="itemAmount"
                                type="number"
                                value={formData.sum}
                                onChange={handleSumChange}
                                placeholder="Сумма"
                                min={1}
                                step="0.01"
                                required
                                className={''}
                            />
                        </div>
                    </div>
                </fieldset>
            </form>
        </div>
    )
}

export default PaymentOrder