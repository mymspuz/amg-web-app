import React, { useState, ChangeEvent, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/forms1c.css'
import './PaymentOrder.css'

import { IPaymentDetails, sendPaymentOrder } from '../../api/client'
import SupplierPaymentDetails from '../Payments/SupplierPaymentDetails'
import { useAppState } from '../../hooks/useAppState'
import { useTelegram } from '../../hooks/useTelegram'

// Платежка по счету, который уже проверен в 1С. Это всегда оплата поставщику:
// раньше здесь был выбор «Себе на карту / Перевести на счет», по умолчанию
// стоял первый пункт, и его название уходило в назначение платежа
const PaymentOrder = () => {
    const navigate = useNavigate()
    const { onClose, showMainButton, hasMainButton } = useTelegram()
    const { state, loading, organization: headerOrganization } = useAppState()

    const invoice = state?.hasInvoice ? state.invoice : null

    // Плательщик - организация, с которой загружали счет, а не выбранная
    // в шапке приложения: у сотрудника организаций несколько
    const payer = state?.organizations.find(o => o.id === invoice?.organizationId) || headerOrganization

    const [error, setError] = useState<string>('')
    const [sending, setSending] = useState<boolean>(false)
    const [comment, setComment] = useState<string>('')
    const [details, setDetails] = useState<IPaymentDetails>({})

    // Назначение подставляем один раз: состояние обновляется в фоне
    // раз в полминуты и не должно стирать то, что человек уже исправил
    const commentFilled = useRef(false)
    useEffect(() => {
        if (commentFilled.current || !invoice) return

        commentFilled.current = true
        setComment(invoice.defaultComment)
    }, [invoice])

    const onSendData = useCallback(async () => {
        if (!payer) return setError('Не выбрана организация')

        setSending(true)
        setError('')
        try {
            await sendPaymentOrder(comment, payer.id, details)
            // Документ придет в чат отдельным сообщением
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSending(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comment, payer?.id, details])

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

    const canConfirm = Boolean(payer?.permissions.includes('confirm'))

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
                <h1>🏭 Оплата поставщику</h1>
                <p>Платежное поручение по проверенному счету</p>
            </div>

            <form className="adaptive-form">
                {loading && <p>Загрузка...</p>}

                {payer && (
                    <fieldset className="form-section">
                        <legend>🏢 Плательщик</legend>
                        <div className="input-group">
                            <h3>{payer.name}</h3>
                            <h4>ИНН {payer.inn}</h4>
                            {invoice?.fromAccount && <h4>Счет списания {invoice.fromAccount}</h4>}
                        </div>
                    </fieldset>
                )}

                {invoice && (
                    <fieldset className="form-section">
                        <legend>👤 Получатель</legend>
                        <div className="input-group">
                            {invoice.supplierName && <h3>{invoice.supplierName}</h3>}
                            <h4>ИНН {invoice.supplierINN}</h4>
                            <h4>
                                На сумму {invoice.sum}
                                {invoice.invoiceNumber ? ` · счет № ${invoice.invoiceNumber}` : ''}
                            </h4>
                        </div>
                    </fieldset>
                )}

                {invoice && payer && (
                    <SupplierPaymentDetails
                        organizationId={payer.id}
                        counterpartyId={invoice.counterpartyId}
                        sum={invoice.sum}
                        recognizedVat={invoice.vat}
                        onChange={setDetails}
                    />
                )}

                {state && !invoice && (
                    <div className="error-message">
                        Нет данных счета. Пришлите счет боту и дождитесь проверки реквизитов.
                    </div>
                )}

                {state && payer && !canConfirm && (
                    <div className="error-message">
                        Нет права подтверждать платежи по этой организации.
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

                <fieldset className="form-section">
                    <div className="input-group">
                        <label htmlFor="comment">Назначение платежа</label>
                        <input
                            id="comment"
                            type="text"
                            value={comment}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setComment(e.target.value)}
                            placeholder="Оплата по счету"
                        />
                        <span className="hint">Строка об НДС добавится сама, если ее нет в назначении</span>
                    </div>

                    {/* В Telegram отправку делает родная кнопка внизу окна */}
                    {!hasMainButton && (
                        <button
                            type="button"
                            className="tg-button primary"
                            onClick={onSendData}
                            disabled={sending || !invoice || !canConfirm}
                        >
                            {sending ? 'Отправляем...' : 'Создать платежное поручение'}
                        </button>
                    )}
                </fieldset>
            </form>
        </div>
    )
}

export default PaymentOrder
