import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import '../PaymentOrder/PaymentOrder.css'

import { cancelRequest, confirmRequest, fetchRequest, IRequestCard } from '../../api/client'
import { useTelegram } from '../../hooks/useTelegram'

interface IForm {
    supplierINN: string
    buyerINN: string
    sum: string
}

// Карточка распознанного счета. В 1С заявка уходит только отсюда:
// пользователь должен увидеть распознанное и при необходимости поправить
const RequestCard = () => {
    const { uuid } = useParams<{ uuid: string }>()
    const navigate = useNavigate()
    const { onClose, showMainButton } = useTelegram()

    const [request, setRequest] = useState<IRequestCard | null>(null)
    const [form, setForm] = useState<IForm>({ supplierINN: '', buyerINN: '', sum: '' })
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
                })
            })
            .catch((e) => setError(e?.response?.data?.error || 'Заявка не найдена'))
            .finally(() => setLoading(false))
    }, [uuid])

    // ИНН бывает 10 знаков у организаций и 12 у предпринимателей
    const validate = (): string => {
        if (!/^\d{10}$|^\d{12}$/.test(form.supplierINN)) return 'ИНН поставщика должен содержать 10 или 12 цифр'
        if (!/^\d{10}$|^\d{12}$/.test(form.buyerINN)) return 'ИНН покупателя должен содержать 10 или 12 цифр'
        if (!Number(form.sum)) return 'Укажите сумму'

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
                    <div className="input-group">
                        <label htmlFor="supplierINN" className="required">ИНН поставщика</label>
                        <input
                            id="supplierINN"
                            type="text"
                            inputMode="numeric"
                            value={form.supplierINN}
                            onChange={(e) => setForm({ ...form, supplierINN: e.target.value.replace(/\D/g, '') })}
                            disabled={!request?.editable}
                        />
                        {changed('supplierINN') && <span className="hint">Распознано: {recognized?.supplierINN}</span>}
                    </div>

                    <div className="input-group">
                        <label htmlFor="buyerINN" className="required">ИНН покупателя</label>
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
                </fieldset>

                {request?.editable && (
                    <fieldset className="form-section">
                        <button type="button" className="tg-button primary" onClick={onConfirm} disabled={sending}>
                            {sending ? 'Отправляем...' : 'Подтвердить и отправить в 1С'}
                        </button>
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
