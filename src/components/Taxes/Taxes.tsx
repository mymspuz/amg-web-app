import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import '../../theme/theme1c.css'
import './Taxes.css'

import {
    approveTax,
    fetchTaxObligations,
    fetchTaxState,
    ITaxObligation,
    ITaxState,
    payTax,
    TTaxScope,
} from '../../api/client'
import { useAppState } from '../../hooks/useAppState'

// Раздел 3.5 ТЗ. Показываем данные только выбранной организации: набор
// обязательств и сроки зависят от ее налогового профиля, единого списка
// для всех клиентов тут быть не должно
const TITLES: Record<string, { title: string, hint: string }> = {
    to_pay: { title: '💳 К оплате', hint: 'Рассчитанные налоги и взносы' },
    upcoming: { title: '📅 Сроки', hint: 'Ближайшие платежи и отчеты' },
    reports: { title: '📗 Сданные отчёты', hint: 'Квитанции и протоколы' },
    overdue: { title: '‼️ Просрочено', hint: 'Сроки, которые уже прошли' },
    all: { title: '📊 Налоги и отчётность', hint: 'Все обязательства' },
}

const money = (amount: number | null): string =>
    amount === null ? 'сумма уточняется' : `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽`

const Taxes = () => {
    const navigate = useNavigate()
    const [search] = useSearchParams()
    const scope = (search.get('scope') || 'upcoming') as TTaxScope
    const { organization, can } = useAppState()

    const [state, setState] = useState<ITaxState | null>(null)
    const [items, setItems] = useState<ITaxObligation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState<number | null>(null)

    const load = useCallback(() => {
        if (!organization) return

        setLoading(true)
        Promise.all([
            fetchTaxState(organization.id),
            fetchTaxObligations(organization.id, scope),
        ])
            .then(([taxState, list]) => {
                setState(taxState)
                setItems(list)
                setError('')
            })
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить налоговые данные'))
            .finally(() => setLoading(false))
    }, [organization, scope])

    useEffect(() => load(), [load])

    const onPay = async (obligation: ITaxObligation) => {
        if (!organization) return

        setBusyId(obligation.id)
        setError('')
        try {
            const uuid = await payTax(obligation.id, organization.id)
            // Дальше - общая карточка подтверждения платежа
            navigate(`/Request/${uuid}`)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setBusyId(null)
        }
    }

    const onApprove = async (obligation: ITaxObligation) => {
        if (!organization) return

        setBusyId(obligation.id)
        setError('')
        try {
            await approveTax(obligation.id, organization.id)
            load()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setBusyId(null)
        }
    }

    const header = TITLES[scope] || TITLES.all

    // Срок словами: «через 3 дня» понятнее даты, но и дату оставляем
    const dueLine = (o: ITaxObligation): string => {
        if (o.status === 'submitted' || o.status === 'accepted') return `Сдано, срок был ${o.dueTitle}`
        if (o.status === 'paid') return `Оплачено, срок ${o.dueTitle}`
        if (o.overdue) return `Срок ${o.dueTitle} - просрочен на ${Math.abs(o.daysLeft)} дн.`
        if (o.daysLeft === 0) return `Срок сегодня, ${o.dueTitle}`

        return `Срок ${o.dueTitle} - через ${o.daysLeft} дн.`
    }

    return (
        <div className="app">
            <button className="back-link" onClick={() => navigate('/Section/taxes')}>‹ Налоги и отчётность</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>{header.title}</h2>
                <span className="muted">{header.hint}</span>
                {organization && <span className="muted">{organization.name}</span>}
            </div>

            {loading && <p className="muted">Загрузка...</p>}
            {error && <div className="notice error">{error}</div>}

            {/* Система налогообложения: по ней и построен весь список ниже */}
            {state?.profile && (
                <div className="tax-profile">
                    <div className="tax-regime">{state.profile.regimeTitle}</div>
                    <div className="tax-line muted">{state.profile.summary}</div>
                    {state.profile.comment && <div className="tax-line muted">{state.profile.comment}</div>}
                </div>
            )}

            {/* Профиль заводит бухгалтер: без него календарь построить не из чего */}
            {state && !state.profile && !loading && (
                <div className="notice">{state.message}</div>
            )}

            {state?.note && <div className="notice">{state.note}</div>}

            {state?.stats && scope !== 'reports' && (
                <div className="tax-stats">
                    <div className="tax-stat">
                        <b>{state.stats.to_pay_count}</b>
                        <span className="muted">к оплате</span>
                    </div>
                    <div className="tax-stat">
                        <b>{Number(state.stats.to_pay_amount).toLocaleString('ru-RU')} ₽</b>
                        <span className="muted">сумма</span>
                    </div>
                    <div className={`tax-stat${state.stats.overdue_count ? ' warn' : ''}`}>
                        <b>{state.stats.overdue_count}</b>
                        <span className="muted">просрочено</span>
                    </div>
                </div>
            )}

            {!loading && !items.length && state?.profile && (
                <div className="notice">
                    {scope === 'to_pay'
                        ? 'Рассчитанных налогов к оплате нет. Суммы появятся здесь, когда их подтвердит бухгалтер.'
                        : scope === 'reports'
                            ? 'Сданных отчётов пока нет.'
                            : 'Ближайших обязательств не найдено.'}
                </div>
            )}

            {items.map(item => (
                <div key={item.id} className={`tax-item${item.overdue ? ' overdue' : ''}`}>
                    <div className="tax-head">
                        <span className="tax-title">
                            {item.title}
                            {item.periodName && <span className="tax-line">за {item.periodName}</span>}
                        </span>
                        <span className={`badge${item.overdue ? ' warn' : item.canPay ? ' accent' : ''}`}>
                            {item.statusTitle}
                        </span>
                    </div>

                    <div className="tax-line">{dueLine(item)}</div>

                    {item.kind === 'payment' && (
                        <div className="tax-amount">{money(item.amount)}</div>
                    )}

                    {item.receipt && <div className="tax-line">Квитанция: {item.receipt}</div>}
                    {item.comment && <div className="tax-line">{item.comment}</div>}
                    {item.note && <div className="tax-line">⚠️ {item.note}</div>}

                    {/* Что прислать бухгалтеру, чтобы отчет ушел вовремя */}
                    {item.kind === 'report' && item.status === 'planned' && item.dataItems.length > 0 && (
                        <ul className="tax-data">
                            {item.dataItems.map(data => <li key={data}>{data}</li>)}
                        </ul>
                    )}

                    <div className="tax-actions">
                        {item.canPay && can('create') && (
                            <button
                                className="btn primary"
                                disabled={busyId === item.id}
                                onClick={() => onPay(item)}
                            >
                                {busyId === item.id ? 'Создаем...' : 'Оплатить налог'}
                            </button>
                        )}
                        {item.canApprove && can('confirm') && (
                            <button
                                className="btn ghost"
                                disabled={busyId === item.id}
                                onClick={() => onApprove(item)}
                            >
                                Согласовать
                            </button>
                        )}
                    </div>
                </div>
            ))}

            {/* Сроки и состав обязательств зависят от профиля, а суммы - от
                бухгалтера: обещать точность расчета мы не вправе */}
            {state?.profile && (
                <p className="muted" style={{ marginTop: 12 }}>
                    Сроки построены по вашей системе налогообложения. Суммы показываются только после
                    расчета бухгалтером или 1С.
                </p>
            )}
        </div>
    )
}

export default Taxes
