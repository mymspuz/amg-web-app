import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/forms1c.css'
import '../InvoiceForPayment/InvoiceForPayment.css'
import '../Taxes/Taxes.css'

import {
    createBooking,
    fetchConsultationDays,
    fetchConsultationSlots,
    fetchConsultationTopics,
    IBookingRules,
    IConsultationDay,
    IConsultationSlot,
    IConsultationTopic,
} from '../../api/client'
import { useAppState } from '../../hooks/useAppState'
import { useTelegram } from '../../hooks/useTelegram'

// Раздел 3.8 ТЗ. Клиент выбирает тему, при необходимости специалиста, потом
// день и время. Показываем только реально свободные окна: занятость, обед
// и отпуск считает сервер, вручную ничего подбирать не нужно
const Consultation = () => {
    const navigate = useNavigate()
    const { onClose } = useTelegram()
    const { organization, loading: stateLoading, error: stateError } = useAppState()

    const [topics, setTopics] = useState<IConsultationTopic[]>([])
    const [rules, setRules] = useState<IBookingRules | null>(null)
    const [topicId, setTopicId] = useState<number>(0)
    const [specialistId, setSpecialistId] = useState<number>(0)

    const [days, setDays] = useState<IConsultationDay[]>([])
    const [date, setDate] = useState('')
    const [slots, setSlots] = useState<IConsultationSlot[]>([])
    const [slot, setSlot] = useState<IConsultationSlot | null>(null)
    const [question, setQuestion] = useState('')

    const [loading, setLoading] = useState(true)
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState('')

    const topic = topics.find(t => t.id === topicId) || null

    useEffect(() => {
        fetchConsultationTopics()
            .then(({ topics: list, rules: loaded }) => {
                setTopics(list)
                setRules(loaded)
                if (list.length) setTopicId(list[0].id)
            })
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить темы консультаций'))
            .finally(() => setLoading(false))
    }, [])

    // Дни пересчитываем при смене темы или специалиста: у разных тем
    // разная длительность, и свободные окна отличаются
    const loadDays = useCallback(() => {
        if (!topicId) return

        setDate('')
        setSlots([])
        setSlot(null)
        fetchConsultationDays(topicId, specialistId || undefined)
            .then((list) => {
                setDays(list)
                if (list.length) setDate(list[0].date)
            })
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить свободные дни'))
    }, [topicId, specialistId])

    useEffect(() => loadDays(), [loadDays])

    useEffect(() => {
        if (!topicId || !date) return

        setLoadingSlots(true)
        setSlot(null)
        fetchConsultationSlots(topicId, date, specialistId || undefined)
            .then(setSlots)
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить свободное время'))
            .finally(() => setLoadingSlots(false))
    }, [topicId, date, specialistId])

    const onBook = async () => {
        if (!organization) return setError('Не выбрана организация')
        if (!slot) return setError('Выберите время')

        setSending(true)
        setError('')
        try {
            const result = await createBooking({
                organizationId: organization.id,
                topicId,
                // Если специалист не выбран, сервер подберет свободного
                specialistId: specialistId || slot.specialistId,
                start: slot.start,
                question,
            })

            setDone(result.awaitingPayment
                ? `Время ${result.when} забронировано за вами. Запись подтвердится после оплаты — счёт пришлёт бухгалтер.`
                : `Вы записаны на ${result.when}, специалист — ${result.specialist}.`)
            setSlot(null)
            loadDays()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="form-container">
            <div className="form-header">
                <button type="button" className="back-button" onClick={() => navigate('/Section/consultations')} aria-label="Назад">‹</button>
                <h1>📅 Запись на консультацию</h1>
                <p>Показываем только свободное время специалистов</p>
            </div>

            <form className="adaptive-form" onSubmit={(e) => e.preventDefault()}>
                {(loading || stateLoading) && <p className="muted">Загрузка...</p>}
                {stateError && <div className="error-message">{stateError}</div>}
                {error && <div className="error-message">{error}</div>}
                {done && <div className="notice">{done}</div>}

                {!loading && !topics.length && (
                    <div className="notice">Темы консультаций пока не заведены. Обратитесь в АМГ.</div>
                )}

                {Boolean(topics.length) && (
                    <>
                        <fieldset className="form-section">
                            <legend>💬 Тема</legend>
                            <div className="input-group">
                                <select value={topicId} onChange={(e) => { setTopicId(Number(e.target.value)); setSpecialistId(0) }}>
                                    {topics.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.title} · {t.durationMin} мин{t.price ? ` · ${t.price.toLocaleString('ru-RU')} ₽` : ' · бесплатно'}
                                        </option>
                                    ))}
                                </select>
                                {topic?.hint && <span className="hint">{topic.hint}</span>}
                            </div>

                            {/* Платная тема: слот держится до оплаты */}
                            {Boolean(topic?.price) && rules && (
                                <div className="notice">
                                    Консультация платная. Время забронируется за вами на {rules.paymentHoldHours} часа,
                                    запись подтвердится после оплаты счёта.
                                </div>
                            )}
                        </fieldset>

                        {/* Выбор специалиста разрешен не для всех тем */}
                        {topic?.allowChoice && topic.specialists.length > 1 && (
                            <fieldset className="form-section">
                                <legend>👤 Специалист</legend>
                                <div className="input-group">
                                    <select value={specialistId} onChange={(e) => setSpecialistId(Number(e.target.value))}>
                                        <option value={0}>Любой свободный</option>
                                        {topic.specialists.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}{s.position ? ` · ${s.position}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </fieldset>
                        )}

                        <fieldset className="form-section">
                            <legend>📆 День</legend>
                            {!days.length && <span className="hint">Свободных дней не найдено. Напишите нам — подберём время вручную.</span>}
                            {Boolean(days.length) && (
                                <div className="input-group">
                                    <select value={date} onChange={(e) => setDate(e.target.value)}>
                                        {days.map(d => (
                                            <option key={d.date} value={d.date}>{d.title} · окон: {d.count}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </fieldset>

                        {Boolean(date) && (
                            <fieldset className="form-section">
                                <legend>🕑 Время</legend>
                                {loadingSlots && <span className="hint">Смотрим расписание...</span>}
                                {!loadingSlots && !slots.length && <span className="hint">На этот день окон не осталось</span>}

                                <div className="tax-actions" style={{ flexWrap: 'wrap' }}>
                                    {slots.map(s => (
                                        <button
                                            key={s.start}
                                            type="button"
                                            className={`btn ${slot?.start === s.start ? 'primary' : 'ghost'}`}
                                            onClick={() => setSlot(s)}
                                        >
                                            {s.time}
                                        </button>
                                    ))}
                                </div>

                                {slot && !specialistId && (
                                    <span className="hint">Проведёт: {slot.specialistName}</span>
                                )}
                            </fieldset>
                        )}

                        <fieldset className="form-section">
                            <legend>📝 Вопрос</legend>
                            <div className="input-group">
                                <input
                                    type="text"
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="Коротко о чём хотите поговорить"
                                />
                                <span className="hint">Специалист увидит вопрос заранее и подготовится</span>
                            </div>
                        </fieldset>

                        <button type="button" className="tg-button primary" onClick={onBook} disabled={sending || !slot}>
                            {sending ? 'Записываем...' : slot ? `Записаться на ${slot.time}` : 'Выберите время'}
                        </button>
                    </>
                )}

                {rules && (
                    <p className="muted" style={{ marginTop: 12 }}>
                        Перенести или отменить запись можно не позже чем за {rules.changeHours} часа до начала.
                    </p>
                )}

                <button type="button" className="main-action-button" onClick={onClose}>Закрыть</button>
            </form>
        </div>
    )
}

export default Consultation
