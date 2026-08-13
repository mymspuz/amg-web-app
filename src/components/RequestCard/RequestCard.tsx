import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import '../../theme/forms1c.css'
import '../PaymentOrder/PaymentOrder.css'

import { cancelRequest, confirmRequest, fetchRequest, fetchRequestEvents, IRequestCard, IRequestEvent } from '../../api/client'
import { useTelegram } from '../../hooks/useTelegram'

interface IForm {
    supplierINN: string
    buyerINN: string
    sum: string
    comment: string
}

// Что показывать в карточке платежа: у каждого вида операции свои поля
const KIND_TITLES: Record<string, string> = {
    self_card: '💰 Себе на карту',
    supplier: '🏭 Оплата поставщику',
    between_accounts: '🔁 Между своими счетами',
    salary: '👥 Выплата зарплаты',
}

// Карточка распознанного счета. В 1С заявка уходит только отсюда:
// пользователь должен увидеть распознанное и при необходимости поправить
const RequestCard = () => {
    const { uuid } = useParams<{ uuid: string }>()
    const navigate = useNavigate()
    const { onClose, showMainButton, hasMainButton } = useTelegram()

    const [request, setRequest] = useState<IRequestCard | null>(null)
    const [events, setEvents] = useState<IRequestEvent[]>([])
    const [form, setForm] = useState<IForm>({ supplierINN: '', buyerINN: '', sum: '', comment: '' })
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!uuid) return

        fetchRequest(uuid)
            .then((data) => {
                setRequest(data)
                setForm({
                    supplierINN: String(data.payload.supplierINN || ''),
                    buyerINN: String(data.payload.buyerINN || ''),
                    sum: String(data.payload.sum ?? ''),
                    comment: String(data.payload.comment || ''),
                })
            })
            .catch((e) => setError(e?.response?.data?.error || 'Заявка не найдена'))
            .finally(() => setLoading(false))

        // История переходов: что с заявкой происходило
        fetchRequestEvents(uuid).then(setEvents).catch(() => setEvents([]))
    }, [uuid])

    // Платеж себе или между своими счетами обходится без ИНН получателя,
    // поэтому проверяем только то, что относится к виду операции
    const needsCounterparty = !request?.paymentKind || request.paymentKind === 'supplier'

    const validate = (): string => {
        if (!Number(form.sum)) return 'Укажите сумму'

        if (needsCounterparty) {
            if (!/^\d{10}$|^\d{12}$/.test(form.supplierINN)) return 'ИНН получателя должен содержать 10 или 12 цифр'
            // ИНН плательщика подставляется из организации - проверяем,
            // только если он вообще заполнен
            if (form.buyerINN && !/^\d{10}$|^\d{12}$/.test(form.buyerINN)) return 'ИНН плательщика должен содержать 10 или 12 цифр'
        }

        return ''
    }

    const onConfirm = useCallback(async () => {
        const validationError = validate()
        if (validationError) return setError(validationError)

        setSending(true)
        setError('')
        try {
            await confirmRequest(uuid as string, {
                supplierINN: form.supplierINN,
                buyerINN: form.buyerINN,
                sum: Number(form.sum),
                comment: form.comment,
            })
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSending(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, uuid])

    useEffect(() => {
        if (!request?.editable) return

        return showMainButton('Подтвердить и отправить в 1С', onConfirm)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onConfirm, request])

    const onCancel = async () => {
        try {
            await cancelRequest(uuid as string)
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }

    if (loading) return <div className="form-container"><p>Загрузка...</p></div>

    if (error && !request) {
        return (
            <div className="form-container">
                <div className="error-message">{error}</div>
                <button className="main-action-button" onClick={() => navigate('/')}>В меню</button>
            </div>
        )
    }

    // Не все поля могли распознаться - подскажем, что их надо дозаполнить
    const isComplete = Boolean(form.supplierINN && form.buyerINN && form.sum)

    // Показываем, что именно распознали, если пользователь уже правил
    const recognized = request?.recognized
    const changed = (field: keyof IForm): boolean =>
        Boolean(recognized && String((recognized as any)[field] ?? '') !== form[field])

    return (
        <div className="form-container">
            <div className="form-header">
                <button type="button" className="back-button" onClick={() => navigate('/')} aria-label="Назад">‹</button>
                <h1>🧾 Проверка реквизитов</h1>
                <p>{request?.editable
                    ? 'Проверьте распознанные данные и исправьте, если нужно'
                    : `Заявка уже в работе: ${request?.statusTitle}`}</p>
                {request?.editable && !isComplete && (
                    <div className="error-message">
                        Часть реквизитов распознать не удалось — заполните пустые поля вручную.
                    </div>
                )}
            </div>

            <form className="adaptive-form">
                {error && <div className="error-message">{error}</div>}

                {/* Проверки раздела 6.4: строгие ведут к согласованию бухгалтером */}
                {Boolean(request?.warnings?.length) && (
                    <fieldset className="form-section">
                        <legend>Обратите внимание</legend>
                        {request?.warnings.map(w => (
                            <div key={w.code} className={w.level === 'strong' ? 'error-message' : 'hint'}>
                                {w.level === 'strong' ? '‼️ ' : '⚠️ '}{w.message}
                            </div>
                        ))}
                        {request?.warnings.some(w => w.level === 'strong') && (
                            <p className="hint">После подтверждения заявка уйдет на согласование бухгалтеру.</p>
                        )}
                    </fieldset>
                )}

                <fieldset className="form-section">
                    {/* Вид операции виден сразу: в истории заявок платежи
                        разных видов лежат вперемешку */}
                    {request?.paymentKind && (
                        <legend>{KIND_TITLES[request.paymentKind] || 'Платеж'}</legend>
                    )}

                    {needsCounterparty && (
                        <>
                            <div className="input-group">
                                <label htmlFor="supplierINN" className="required">ИНН получателя</label>
                                <input
                                    id="supplierINN"
                                    type="text"
                                    inputMode="numeric"
                                    value={form.supplierINN}
                                    onChange={(e) => setForm({ ...form, supplierINN: e.target.value.replace(/\D/g, '') })}
                                    disabled={!request?.editable}
                                />
                                {request?.payload.supplierName && (
                                    <span className="hint">{request.payload.supplierName}</span>
                                )}
                                {changed('supplierINN') && <span className="hint">Распознано: {recognized?.supplierINN}</span>}
                            </div>

                            <div className="input-group">
                                <label htmlFor="buyerINN">ИНН плательщика</label>
                                <input
                                    id="buyerINN"
                                    type="text"
                                    inputMode="numeric"
                                    value={form.buyerINN}
                                    onChange={(e) => setForm({ ...form, buyerINN: e.target.value.replace(/\D/g, '') })}
                                    disabled={!request?.editable}
                                />
                                {changed('buyerINN') && <span className="hint">Распознано: {recognized?.buyerINN}</span>}
                            </div>
                        </>
                    )}

                    {/* Реквизиты, которые правит не пользователь, а форма
                        создания платежа - показываем как есть */}
                    {request?.paymentKind === 'between_accounts' && (
                        <div className="party-card">
                            <div className="party-line">Со счета {request.payload.fromAccount || '—'}</div>
                            <div className="party-line">На счет {request.payload.toAccount || '—'}</div>
                        </div>
                    )}

                    {request?.paymentKind === 'salary' && (
                        <div className="party-card">
                            <div className="party-line">{request.payload.employeeName || 'По ведомости'}</div>
                            {request.payload.employeeAccount && (
                                <div className="party-line muted">Счет {request.payload.employeeAccount}</div>
                            )}
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="sum" className="required">Сумма</label>
                        <input
                            id="sum"
                            type="number"
                            step="0.01"
                            value={form.sum}
                            onChange={(e) => setForm({ ...form, sum: e.target.value })}
                            disabled={!request?.editable}
                        />
                        {changed('sum') && <span className="hint">Распознано: {recognized?.sum}</span>}
                    </div>

                    {request?.paymentKind && (
                        <div className="input-group">
                            <label htmlFor="comment">Назначение платежа</label>
                            <input
                                id="comment"
                                type="text"
                                value={form.comment}
                                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                                disabled={!request?.editable}
                            />
                        </div>
                    )}
                </fieldset>

                {events.length > 1 && (
                    <fieldset className="form-section">
                        <legend>Что происходило</legend>
                        {events.map((e, i) => (
                            <div key={i} className="hint">
                                {new Date(e.createdAt).toLocaleString('ru-RU')} — {e.statusTitle}
                                {e.actor !== 'system' ? ` (${e.actor === '1c' ? '1С' : e.actor === 'user' ? 'вы' : e.actor})` : ''}
                                {e.comment ? `: ${e.comment}` : ''}
                            </div>
                        ))}
                    </fieldset>
                )}

                {request?.editable && (
                    <fieldset className="form-section">
                        {/* В Telegram подтверждение делает родная кнопка внизу окна */}
                        {!hasMainButton && (
                            <button type="button" className="tg-button primary" onClick={onConfirm} disabled={sending}>
                                {sending ? 'Отправляем...' : 'Подтвердить и отправить в 1С'}
                            </button>
                        )}
                        <button type="button" className="main-action-button" onClick={onCancel} disabled={sending}>
                            Отменить заявку
                        </button>
                    </fieldset>
                )}
            </form>
        </div>
    )
}

export default RequestCard
