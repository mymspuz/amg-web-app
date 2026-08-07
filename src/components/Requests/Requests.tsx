import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/theme1c.css'

import { fetchRequests, IRequestListItem } from '../../api/client'

// Раздел «Мои заявки» из MVP: статусы и результат обработки
const Requests = () => {
    const navigate = useNavigate()
    const [items, setItems] = useState<IRequestListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        fetchRequests()
            .then(setItems)
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить заявки'))
            .finally(() => setLoading(false))
    }, [])

    const typeTitle = (type: string): string => {
        if (type === 'check') return 'Проверка счёта'
        if (type === 'payment_order') return 'Платёжное поручение'

        return 'Счёт покупателю'
    }

    // Цвет статуса: завершенные зеленым, проблемные красным, остальные нейтрально
    const badgeClass = (status: string): string => {
        if (['done', 'created_in_1c'].includes(status)) return 'badge accent'
        if (['rejected', 'integration_error'].includes(status)) return 'badge warn'

        return 'badge'
    }

    return (
        <div className="app">
            <button className="back-link" onClick={() => navigate('/')}>‹ Меню</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>📋 Мои заявки</h2>
                <span className="muted">Статусы обработки в 1С</span>
            </div>

            {loading && <p className="muted">Загрузка...</p>}
            {error && <div className="notice error">{error}</div>}

            {!loading && !items.length && !error && (
                <div className="notice">Заявок пока нет. Пришлите счёт боту, чтобы создать первую.</div>
            )}

            <div className="list-card">
                {items.map(item => (
                    <button
                        key={item.uuid}
                        className="list-item"
                        onClick={() => navigate(`/Request/${item.uuid}`)}
                    >
                        <span>
                            {typeTitle(item.type)}
                            <span className="tile-hint" style={{ display: 'block' }}>
                                {item.sum ? `${item.sum} ₽` : ''}
                                {item.supplierINN ? ` · ИНН ${item.supplierINN}` : ''}
                                {item.doc ? ` · документ ${item.doc}` : ''}
                                {item.error ? ` · ${item.error}` : ''}
                            </span>
                        </span>
                        <span className={badgeClass(item.status)}>{item.statusTitle}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

export default Requests
