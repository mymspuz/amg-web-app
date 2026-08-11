import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/theme1c.css'

import { uploadInvoice } from '../../api/client'
import { useAppState } from '../../hooks/useAppState'

// Оплата счета начинается с документа: загрузить прямо здесь или прислать
// боту в чат. Дальше в обоих случаях - карточка подтверждения реквизитов
const PayInvoice = () => {
    const navigate = useNavigate()
    const { state, organization, loading } = useAppState()
    const fileInput = useRef<HTMLInputElement>(null)

    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !organization) return

        setUploading(true)
        setError('')
        try {
            const uuid = await uploadInvoice(file, organization.id)
            navigate(`/Request/${uuid}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setUploading(false)
            // Сбрасываем, иначе повторный выбор того же файла не сработает
            if (fileInput.current) fileInput.current.value = ''
        }
    }

    return (
        <div className="app">
            <button className="back-link" onClick={() => navigate('/Section/payments')}>‹ Платежи</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>💳 Оплатить счёт</h2>
                <span className="muted">{organization?.name}</span>
            </div>

            {error && <div className="notice error">{error}</div>}

            {/* Счет уже проверен в 1С - можно сразу к платежке */}
            {state?.hasInvoice && (
                <div className="list-card" style={{ marginBottom: 16 }}>
                    <button className="list-item" onClick={() => navigate('/PaymentOrder')}>
                        <span>
                            Готовый счёт к оплате
                            <span className="tile-hint" style={{ display: 'block' }}>
                                ИНН {state.invoice.supplierINN} · {state.invoice.sum} ₽
                            </span>
                        </span>
                        <span className="badge accent">Создать пп</span>
                    </button>
                </div>
            )}

            <div className="list-card">
                <button
                    className="list-item"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading || loading || !organization}
                >
                    <span>
                        Загрузить счёт
                        <span className="tile-hint" style={{ display: 'block' }}>
                            PDF, скан или фотография. Изображение распознаём, это занимает несколько секунд
                        </span>
                    </span>
                    <span className="badge accent">{uploading ? 'Разбираем...' : 'Выбрать файл'}</span>
                </button>

                <button className="list-item" disabled>
                    <span>
                        Отправить счёт боту в чат
                        <span className="tile-hint" style={{ display: 'block' }}>
                            Можно переслать документ из другого чата
                        </span>
                    </span>
                    <span className="badge">В чате</span>
                </button>
            </div>

            <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={onFile}
            />
        </div>
    )
}

export default PayInvoice
