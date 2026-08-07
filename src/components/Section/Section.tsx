import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import '../../theme/theme1c.css'

import { findSection, IMenuItem } from '../../data/menu'
import { useAppState } from '../../hooks/useAppState'

// Пункты выбранного раздела. Недоступное не прячем, а помечаем причиной:
// нет прав, нет данных или пункт еще не сделан
const Section = () => {
    const { key } = useParams<{ key: string }>()
    const navigate = useNavigate()
    const { state, organization, can, loading } = useAppState()

    const section = findSection(key || '')

    if (!section) {
        return (
            <div className="app">
                <button className="back-link" onClick={() => navigate('/')}>‹ Меню</button>
                <div className="notice error">Раздел не найден</div>
            </div>
        )
    }

    // Причина недоступности - или пусто, если пункт открыт
    const reason = (item: IMenuItem): string => {
        if (!item.route) return 'Скоро'
        if (item.permission && !can(item.permission)) return 'Нет прав'
        if (item.requiresInvoice && !state?.hasInvoice) return 'Нет счёта'

        return ''
    }

    const onSelect = (item: IMenuItem) => {
        if (reason(item)) return

        // Счет выставляется от выбранной организации
        if (item.route === '/InvoiceForPayment') {
            return navigate(`/InvoiceForPayment?counterpartyId=${organization?.id || 1}&fromFile=${state?.hasItems ? 1 : 0}`)
        }

        navigate(item.route as string)
    }

    return (
        <div className="app">
            <button className="back-link" onClick={() => navigate('/')}>‹ Меню</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>
                    <span style={{ marginRight: 8 }}>{section.icon}</span>
                    {section.title}
                </h2>
                <span className="muted">{section.hint}</span>
            </div>

            {loading && <p className="muted">Загрузка...</p>}

            <div className="list-card">
                {section.items.map(item => {
                    const blocked = reason(item)

                    return (
                        <button
                            key={item.key}
                            className="list-item"
                            disabled={Boolean(blocked)}
                            onClick={() => onSelect(item)}
                        >
                            <span>
                                {item.title}
                                {item.hint && <span className="tile-hint" style={{ display: 'block' }}>{item.hint}</span>}
                            </span>
                            {blocked
                                ? <span className={`badge ${blocked === 'Скоро' ? '' : 'warn'}`}>{blocked}</span>
                                : <span className="badge accent">Открыть</span>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default Section
