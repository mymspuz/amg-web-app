import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/theme1c.css'

import { fetchOrganizations, IOrganizationDetails, uploadInvoice } from '../../api/client'
import { useAppState } from '../../hooks/useAppState'

// Оплата счета начинается с документа: загрузить прямо здесь или прислать
// боту в чат. Дальше в обоих случаях - карточка подтверждения реквизитов
const PayInvoice = () => {
    const navigate = useNavigate()
    const { state, organization, loading } = useAppState()
    const fileInput = useRef<HTMLInputElement>(null)

    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    // Плательщика выбирают здесь: организаций у клиента бывает несколько,
    // и платить надо с той, которую он назовет, а не с выбранной в шапке
    const [organizations, setOrganizations] = useState<IOrganizationDetails[]>([])
    const [payerId, setPayerId] = useState<number>(0)
    const [account, setAccount] = useState<string>('')

    useEffect(() => {
        fetchOrganizations()
            .then((list) => {
                setOrganizations(list)
                const preferred = list.find(o => o.id === organization?.id) || list.find(o => o.isDefault) || list[0]
                if (preferred) {
                    setPayerId(preferred.id)
                    const first = preferred.accounts.find(a => a.isDefault) || preferred.accounts[0]
                    setAccount(first ? first.account : '')
                }
            })
            .catch(e => setError(e instanceof Error ? e.message : String(e)))
    }, [organization])

    const payer = organizations.find(o => o.id === payerId) || null

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !payerId) return

        setUploading(true)
        setError('')
        try {
            const uuid = await uploadInvoice(file, payerId, account)
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
            {/* Назад - на шаг назад, а не в общее меню */}
            <button className="back-link" onClick={() => navigate(-1)}>‹ Назад</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>💳 Оплата поставщику</h2>
                <span className="muted">Сначала выберите, с какой организации и с какого счёта платим</span>
            </div>

            {error && <div className="notice error">{error}</div>}

            <div className="list-card" style={{ marginBottom: 16 }}>
                <div className="input-group" style={{ padding: '10px 12px' }}>
                    <label htmlFor="payer">Плательщик</label>
                    <select
                        id="payer"
                        value={payerId}
                        onChange={(e) => {
                            const id = Number(e.target.value)
                            setPayerId(id)
                            const next = organizations.find(o => o.id === id)
                            const first = next?.accounts.find(a => a.isDefault) || next?.accounts[0]
                            setAccount(first ? first.account : '')
                        }}
                    >
                        {!organizations.length && <option value={0}>Организации не загружены</option>}
                        {organizations.map(o => (
                            <option key={o.id} value={o.id}>{o.name} · ИНН {o.inn}</option>
                        ))}
                    </select>
                </div>

                {Boolean(payer?.accounts.length) && (
                    <div className="input-group" style={{ padding: '0 12px 10px' }}>
                        <label htmlFor="payerAccount">Счёт списания</label>
                        <select id="payerAccount" value={account} onChange={(e) => setAccount(e.target.value)}>
                            {payer?.accounts.map(a => (
                                <option key={a.account} value={a.account}>
                                    {a.account}{a.bankName ? ` · ${a.bankName}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {payer && !payer.accounts.length && (
                    <div className="notice error" style={{ margin: '0 12px 10px' }}>
                        У организации нет расчётного счёта в 1С
                    </div>
                )}
            </div>

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
                    disabled={uploading || loading || !payerId}
                >
                    <span>
                        Загрузить счёт
                        <span className="tile-hint" style={{ display: 'block' }}>
                            PDF, скан или фотография. Изображение распознаём, это занимает несколько секунд
                        </span>
                    </span>
                    <span className="badge accent">{uploading ? 'Разбираем...' : 'Выбрать файл'}</span>
                </button>

                <button
                    className="list-item"
                    onClick={() => navigate(`/Payment/supplier?org=${payerId}&account=${encodeURIComponent(account)}`)}
                >
                    <span>
                        Ввести реквизиты вручную
                        <span className="tile-hint" style={{ display: 'block' }}>
                            Получателя можно выбрать из справочника 1С
                        </span>
                    </span>
                    <span className="badge accent">Заполнить</span>
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
