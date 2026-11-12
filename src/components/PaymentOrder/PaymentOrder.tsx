import React, { useState, ChangeEvent, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/forms1c.css'
import './PaymentOrder.css'

import { fetchCounterpartyAccounts, IBankAccount, IPaymentDetails, sendPaymentOrder } from '../../api/client'
import { accountLabel, sortAccounts } from '../../data/accounts'
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
    const [supplierAccounts, setSupplierAccounts] = useState<IBankAccount[]>([])
    const [supplierAccount, setSupplierAccount] = useState('')
    const accountTouched = useRef(false)

    // Назначение подставляем один раз: состояние обновляется в фоне
    // раз в полминуты и не должно стирать то, что человек уже исправил
    const commentFilled = useRef(false)
    useEffect(() => {
        if (commentFilled.current || !invoice) return

        commentFilled.current = true
        setComment(invoice.defaultComment)
    }, [invoice])

    useEffect(() => {
        if (!invoice?.counterpartyId || !payer) {
            setSupplierAccounts([])
            return
        }

        fetchCounterpartyAccounts(invoice.counterpartyId, payer.id)
            .then((accounts) => {
                setSupplierAccounts(accounts)
                if (accountTouched.current) return

                const wanted = (invoice.supplierAccount || '').replace(/\s/g, '')
                const fromInvoice = accounts.find(a => a.account.replace(/\s/g, '') === wanted)
                const main = accounts.find(a => a.isDefault) || accounts[0]
                setSupplierAccount((fromInvoice || main)?.account || '')
            })
            .catch(() => setSupplierAccounts([]))
    }, [invoice, payer])

    const onSendData = useCallback(async () => {
        if (!payer) return setError('Не выбрана организация')

        setSending(true)
        setError('')
        try {
            await sendPaymentOrder(comment, payer.id, details, supplierAccount)
            // Документ придет в чат отдельным сообщением
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSending(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comment, payer?.id, details, supplierAccount])

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
                        <div className="input-group">
                            <label htmlFor="supplierAccount">Расчётный счёт поставщика</label>
                            {supplierAccounts.length ? (
                                <select
                                    id="supplierAccount"
                                    value={supplierAccount}
                                    onChange={(e) => {
                                        accountTouched.current = true
                                        setSupplierAccount(e.target.value)
                                    }}
                                >
                                    {sortAccounts(supplierAccounts).map(a => (
                                        <option key={a.account} value={a.account}>
                                            {accountLabel(a)}{a.isDefault ? ' · основной' : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className="hint">Счета поставщика ещё не загружены</span>
                            )}
                            {invoice.supplierAccount
                                && supplierAccount
                                && invoice.supplierAccount.replace(/\s/g, '') !== supplierAccount.replace(/\s/g, '') && (
                                <span className="hint">В счёте указан другой счёт: {invoice.supplierAccount}</span>
                            )}
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
                        <textarea
                            id="comment"
                            rows={3}
                            value={comment}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                            placeholder="Оплата по счету"
                        />
                        <span className="hint">Строка «Сумма …» добавится сама, перед текстом про НДС</span>
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
