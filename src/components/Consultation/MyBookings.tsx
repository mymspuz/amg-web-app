import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/theme1c.css'
import '../Taxes/Taxes.css'

import {
    cancelBooking,
    fetchBookings,
    fetchConsultationSlots,
    fetchConsultationTopics,
    IBooking,
    IConsultationSlot,
    moveBooking,
} from '../../api/client'

// Мои консультации: перенос и отмена по правилам АМГ. Кнопки показываем
// только там, где сервер это разрешит - у него же и последнее слово
const MyBookings = () => {
    const navigate = useNavigate()
    const [items, setItems] = useState<IBooking[]>([])
    const [scope, setScope] = useState<'upcoming' | 'all'>('upcoming')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    // Перенос: показываем свободные слоты на ближайший подходящий день
    const [movingId, setMovingId] = useState<number>(0)
    const [slots, setSlots] = useState<IConsultationSlot[]>([])
    const [moveDate, setMoveDate] = useState('')

    const load = useCallback(() => {
        setLoading(true)
        fetchBookings(scope)
            .then(setItems)
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить записи'))
            .finally(() => setLoading(false))
    }, [scope])

    useEffect(() => load(), [load])

    const startMove = async (booking: IBooking) => {
        setError('')
        setNotice('')
        setMovingId(booking.id)

        // Тему записи ищем по названию: сервер отдает ее строкой, а слоты
        // просит по идентификатору
        try {
            const { topics } = await fetchConsultationTopics()
            const topic = topics.find(t => t.title === booking.topic)
            if (!topic) throw new Error('Тема этой записи больше недоступна')

            const date = new Date(booking.startsAt).toISOString().slice(0, 10)
            setMoveDate(date)
            setSlots(await fetchConsultationSlots(topic.id, date))
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
            setMovingId(0)
        }
    }

    const onMove = async (id: number, start: string) => {
        try {
            const when = await moveBooking(id, start)
            setNotice(`Запись перенесена на ${when}`)
            setMovingId(0)
            load()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }

    const onCancel = async (id: number) => {
        try {
            await cancelBooking(id)
            setNotice('Запись отменена')
            load()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }

    const badgeClass = (status: string): string => {
        if (status === 'confirmed') return 'badge accent'
        if (status === 'awaiting_payment') return 'badge warn'

        return 'badge'
    }

    return (
        <div className="app">
            <button className="back-link" onClick={() => navigate('/Section/consultations')}>‹ Консультации</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>🗓 Мои записи</h2>
                <span className="muted">Консультации со специалистами АМГ</span>
            </div>

            <div className="tax-actions" style={{ marginBottom: 12 }}>
                <button className={`btn ${scope === 'upcoming' ? 'primary' : 'ghost'}`} onClick={() => setScope('upcoming')}>
                    Ближайшие
                </button>
                <button className={`btn ${scope === 'all' ? 'primary' : 'ghost'}`} onClick={() => setScope('all')}>
                    Все
                </button>
            </div>

            {loading && <p className="muted">Загрузка...</p>}
            {error && <div className="notice error">{error}</div>}
            {notice && <div className="notice">{notice}</div>}

            {!loading && !items.length && !error && (
                <div className="notice">Записей нет. Записаться можно в разделе «Консультации».</div>
            )}

            {items.map(booking => (
                <div key={booking.id} className="tax-item">
                    <div className="tax-head">
                        <span className="tax-title">
                            {booking.topic}
                            <span className="tax-line">{booking.specialist}</span>
                        </span>
                        <span className={badgeClass(booking.status)}>{booking.statusTitle}</span>
                    </div>

                    <div className="tax-line">{booking.when} – {booking.endTime} (мск)</div>
                    {booking.question && <div className="tax-line">Вопрос: {booking.question}</div>}
                    {booking.cancelReason && <div className="tax-line">Причина: {booking.cancelReason}</div>}

                    {/* Платная консультация: пока не оплачена, время держится */}
                    {booking.price !== null && (
                        <div className="tax-amount">
                            {booking.price.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                            {booking.paid ? ' · оплачено' : ' · ждёт оплаты'}
                        </div>
                    )}
                    {booking.paymentLink && !booking.paid && (
                        <div className="tax-line">
                            <a href={booking.paymentLink} target="_blank" rel="noreferrer">Ссылка на оплату</a>
                        </div>
                    )}

                    {booking.canChange && movingId !== booking.id && (
                        <div className="tax-actions">
                            <button className="btn ghost" onClick={() => startMove(booking)}>Перенести</button>
                            <button className="btn ghost" onClick={() => onCancel(booking.id)}>Отменить</button>
                        </div>
                    )}

                    {movingId === booking.id && (
                        <>
                            <div className="tax-line">Свободное время на {moveDate}:</div>
                            <div className="tax-actions" style={{ flexWrap: 'wrap' }}>
                                {slots.map(s => (
                                    <button key={s.start} className="btn ghost" onClick={() => onMove(booking.id, s.start)}>
                                        {s.time}
                                    </button>
                                ))}
                                {!slots.length && <span className="hint">На этот день окон нет</span>}
                                <button className="btn" onClick={() => setMovingId(0)}>Отмена</button>
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    )
}

export default MyBookings
