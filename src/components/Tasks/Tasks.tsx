import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/theme1c.css'
import '../Taxes/Taxes.css'

import { fetchAccountingTasks, IAccountingTask } from '../../api/client'

// Обращения к бухгалтеру. Пока сюда попадают расхождения по актам сверки
// (раздел 3.7 ТЗ); раздел «Задачи бухгалтерии» дорастит список до тикетов
// с перепиской
const Tasks = () => {
    const navigate = useNavigate()
    const [items, setItems] = useState<IAccountingTask[]>([])
    const [scope, setScope] = useState<'open' | 'all'>('open')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = useCallback(() => {
        setLoading(true)
        fetchAccountingTasks(scope)
            .then(setItems)
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить обращения'))
            .finally(() => setLoading(false))
    }, [scope])

    useEffect(() => load(), [load])

    const badgeClass = (status: string): string => {
        if (status === 'answered') return 'badge accent'
        if (status === 'closed') return 'badge'

        return 'badge warn'
    }

    return (
        <div className="app">
            <button className="back-link" onClick={() => navigate('/Section/reconciliation')}>‹ Сверки и взаиморасчёты</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>🧾 Мои обращения</h2>
                <span className="muted">Расхождения и вопросы бухгалтеру</span>
            </div>

            <div className="tax-actions" style={{ marginBottom: 12 }}>
                <button
                    className={`btn ${scope === 'open' ? 'primary' : 'ghost'}`}
                    onClick={() => setScope('open')}
                >
                    Открытые
                </button>
                <button
                    className={`btn ${scope === 'all' ? 'primary' : 'ghost'}`}
                    onClick={() => setScope('all')}
                >
                    Все
                </button>
            </div>

            {loading && <p className="muted">Загрузка...</p>}
            {error && <div className="notice error">{error}</div>}

            {!loading && !items.length && !error && (
                <div className="notice">
                    Обращений нет. Расхождения по акту сверки отправляются кнопкой «Есть расхождения».
                </div>
            )}

            {items.map(task => (
                <div key={task.id} className="tax-item">
                    <div className="tax-head">
                        <span className="tax-title">
                            №{task.id} · {task.subject}
                            <span className="tax-line">{task.kindTitle}</span>
                        </span>
                        <span className={badgeClass(task.status)}>{task.statusTitle}</span>
                    </div>

                    {task.amount !== null && (
                        <div className="tax-amount">
                            {task.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                        </div>
                    )}
                    {task.body && <div className="tax-line">{task.body}</div>}

                    {/* Ответ бухгалтера приходит и в чат, но пусть остается
                        и здесь: в переписке он потеряется */}
                    {task.answer && (
                        <div className="notice" style={{ marginTop: 8 }}>
                            <strong>Ответ бухгалтера:</strong> {task.answer}
                        </div>
                    )}

                    <div className="tax-line">
                        {new Date(task.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default Tasks
