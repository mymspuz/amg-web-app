import React, { useState, ChangeEvent, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import './PaymentOrder.css'

import { sendPaymentOrder } from '../../api/client'
import { useAppState } from '../../hooks/useAppState'
import { useTelegram } from '../../hooks/useTelegram'

interface IFormData {
    clientId: string
    comment: string
}

const PaymentOrder = () => {
    const navigate = useNavigate()
    const { onClose, showMainButton } = useTelegram()
    const { state, loading, organization, can } = useAppState()

    const clients = [
        { id: '1', name: 'Себе на карту' },
        { id: '2', name: 'Перевести на счет' },
    ]

    const [error, setError] = useState<string>('')
    const [sending, setSending] = useState<boolean>(false)
    const [formData, setFormData] = useState<IFormData>({
        clientId: clients[0].id,
        comment: '',
    })

    const onSendData = useCallback(async () => {
        if (!organization) return setError('Не выбрана организация')

        setSending(true)
        setError('')
        try {
            await sendPaymentOrder(
                formData.comment || clients.find(c => c.id === formData.clientId)?.name || '',
                organization.id
            )
            // Документ придет в чат отдельным сообщением
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSending(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, organization])

    // Отправляем по главной кнопке Telegram, если она доступна
    useEffect(() => {
        return showMainButton('Создать платежное поручение', onSendData)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onSendData])

    // Экран открывается и напрямую из кнопки бота, поэтому идем на главную,
    // а не назад по истории - назад там пусто
    const handleBack = (): void => {
        navigate('/')
    }

    function onChangeClient(e: { target: { value: any } }) {
        setFormData({ ...formData, clientId: e.target.value })
    }

    function handleCommentChange(e: ChangeEvent<HTMLInputElement>) {
        setFormData({ ...formData, comment: e.target.value })
    }

    const canConfirm = can('confirm')

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
                <p>Заполните форму для создания нового платежного поручения</p>
            </div>

            <form className="adaptive-form">
                {loading && <p>Загрузка...</p>}

                {organization && (
                    <fieldset className="form-section">
                        <legend>🏢 Плательщик</legend>
                        <div className="input-group">
                            <h3>{organization.name}</h3>
                            <h4>ИНН {organization.inn}</h4>
                        </div>
                    </fieldset>
                )}

                {state?.hasInvoice && (
                    <fieldset className="form-section">
                        <legend>👤 Получатель</legend>
                        <div className="input-group">
                            <h3>ИНН {state.invoice.supplierINN}</h3>
                            <h4>На сумму {state.invoice.sum}</h4>
                        </div>
                    </fieldset>
                )}

                {state && !state.hasInvoice && (
                    <div className="error-message">
                        Нет данных счета. Пришлите счет боту и дождитесь проверки реквизитов.
                    </div>
                )}

                {state && !canConfirm && (
                    <div className="error-message">
                        Нет права подтверждать платежи по этой организации.
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

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
                    <label htmlFor="buyer" className="required">
                        Тип платежа
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

                    <button
                        type="button"
                        className="tg-button primary"
                        onClick={onSendData}
                        disabled={sending || !state?.hasInvoice || !canConfirm}
                    >
                        {sending ? 'Отправляем...' : 'Создать платежное поручение'}
                    </button>
                </fieldset>
            </form>
        </div>
    )
}

export default PaymentOrder
