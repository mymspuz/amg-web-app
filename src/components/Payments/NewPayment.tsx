import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import '../../theme/forms1c.css'
import '../InvoiceForPayment/InvoiceForPayment.css'

import {
    createPayment,
    fetchOrganizations,
    ICounterparty,
    IOrganizationDetails,
    TPaymentKind,
} from '../../api/client'
import { useAppState } from '../../hooks/useAppState'
import { useTelegram } from '../../hooks/useTelegram'
import CounterpartyPicker from '../Counterparty/CounterpartyPicker'

interface IKindInfo {
    title: string
    icon: string
    hint: string
    allowsFile: boolean
}

// Виды операций из ТЗ. Себе на карту и перевод между своими счетами
// заполняются только руками: прикладывать там нечего
const KINDS: Record<TPaymentKind, IKindInfo> = {
    self_card: {
        title: 'Себе на карту',
        icon: '💰',
        hint: 'Перевод собственных средств предпринимателя',
        allowsFile: false,
    },
    supplier: {
        title: 'Оплата поставщику',
        icon: '🏭',
        hint: 'Выберите получателя из справочника 1С',
        allowsFile: true,
    },
    between_accounts: {
        title: 'Между своими счетами',
        icon: '🔁',
        hint: 'Перевод с одного счета организации на другой',
        allowsFile: false,
    },
    salary: {
        title: 'Выплата зарплаты',
        icon: '👥',
        hint: 'По сотруднику или ведомостью',
        allowsFile: true,
    },
}

const NewPayment = () => {
    const navigate = useNavigate()
    const { kind } = useParams<{ kind: TPaymentKind }>()
    const { onClose, showMainButton, hasMainButton } = useTelegram()
    const { organization } = useAppState()
    const fileInput = useRef<HTMLInputElement>(null)

    const info = kind && KINDS[kind] ? KINDS[kind] : null

    const [organizations, setOrganizations] = useState<IOrganizationDetails[]>([])
    const [organizationId, setOrganizationId] = useState<number>(0)
    const [counterparty, setCounterparty] = useState<ICounterparty | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')

    const [form, setForm] = useState({
        sum: '',
        comment: '',
        supplierINN: '',
        supplierAccount: '',
        fromAccount: '',
        toAccount: '',
        employeeName: '',
        employeeAccount: '',
    })

    const payer = organizations.find(o => o.id === organizationId) || null

    useEffect(() => {
        fetchOrganizations()
            .then((list) => {
                setOrganizations(list)
                const preferred = list.find(o => o.id === organization?.id) || list.find(o => o.isDefault) || list[0]
                if (preferred) {
                    setOrganizationId(preferred.id)
                    // Счет списания по умолчанию - основной счет организации
                    setForm(f => ({ ...f, fromAccount: preferred.accounts[0]?.account || '' }))
                }
            })
            .catch(e => setError(e instanceof Error ? e.message : String(e)))
    }, [organization])

    const onSend = useCallback(async () => {
        if (!kind || !organizationId) return setError('Не выбрана организация')

        setSending(true)
        setError('')
        try {
            const uuid = await createPayment({
                kind,
                organizationId,
                sum: form.sum,
                comment: form.comment,
                counterpartyId: counterparty?.id,
                supplierINN: counterparty ? undefined : form.supplierINN,
                supplierAccount: form.supplierAccount,
                fromAccount: form.fromAccount,
                toAccount: form.toAccount,
                employeeName: form.employeeName,
                employeeAccount: form.employeeAccount,
            }, file)

            // Дальше - общая карточка подтверждения
            navigate(`/Request/${uuid}`)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSending(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, organizationId, form, counterparty, file])

    useEffect(() => {
        return showMainButton('Продолжить', onSend)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onSend])

    if (!info) {
        return (
            <div className="form-container">
                <div className="adaptive-form">
                    <div className="error-message">Неизвестный вид платежа</div>
                    <button className="main-action-button" onClick={() => navigate('/Section/payments')}>К платежам</button>
                </div>
            </div>
        )
    }

    const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm({ ...form, [field]: e.target.value })

    return (
        <div className="form-container">
            <div className="form-header">
                <button type="button" className="back-button" onClick={() => navigate('/Section/payments')} aria-label="Назад">‹</button>
                <h1>{info.icon} {info.title}</h1>
                <p>{info.hint}</p>
            </div>

            <form className="adaptive-form">
                {error && <div className="error-message">{error}</div>}

                <fieldset className="form-section">
                    <legend>🏢 Плательщик</legend>
                    <div className="input-group">
                        <label htmlFor="payer" className="required">Организация</label>
                        <select
                            id="payer"
                            value={organizationId}
                            onChange={(e) => {
                                const id = Number(e.target.value)
                                setOrganizationId(id)
                                const next = organizations.find(o => o.id === id)
                                setForm(f => ({ ...f, fromAccount: next?.accounts[0]?.account || '' }))
                            }}
                        >
                            {!organizations.length && <option value={0}>Организации не загружены</option>}
                            {organizations.map(o => (
                                <option key={o.id} value={o.id}>{o.name} · ИНН {o.inn}</option>
                            ))}
                        </select>
                    </div>

                    {/* Счет списания нужен всем видам: с него уйдут деньги */}
                    {Boolean(payer?.accounts.length) && (
                        <div className="input-group">
                            <label htmlFor="fromAccount">Счет списания</label>
                            <select id="fromAccount" value={form.fromAccount} onChange={set('fromAccount')}>
                                {payer?.accounts.map(a => (
                                    <option key={a.account} value={a.account}>
                                        {a.account}{a.bankName ? ` · ${a.bankName}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {!payer?.accounts.length && payer && (
                        <div className="error-message">У организации нет банковского счета в 1С</div>
                    )}
                </fieldset>

                {kind === 'supplier' && (
                    <fieldset className="form-section">
                        <legend>🏭 Получатель</legend>
                        <CounterpartyPicker
                            organizationId={organizationId}
                            selected={counterparty}
                            onSelect={setCounterparty}
                            onClear={() => setCounterparty(null)}
                            label="Найдите получателя по названию или ИНН"
                        />
                        {!counterparty && (
                            <div className="input-group">
                                <label htmlFor="supplierINN">Либо впишите ИНН вручную</label>
                                <input
                                    id="supplierINN"
                                    type="text"
                                    inputMode="numeric"
                                    value={form.supplierINN}
                                    onChange={set('supplierINN')}
                                    placeholder="7724727585"
                                />
                                <span className="hint">Если контрагента еще нет в 1С, реквизиты проверит бухгалтер</span>
                            </div>
                        )}
                    </fieldset>
                )}

                {kind === 'between_accounts' && (
                    <fieldset className="form-section">
                        <legend>🔁 Счет зачисления</legend>
                        <div className="input-group">
                            <label htmlFor="toAccount" className="required">Куда переводим</label>
                            <select id="toAccount" value={form.toAccount} onChange={set('toAccount')}>
                                <option value="">Выберите счет</option>
                                {payer?.accounts
                                    .filter(a => a.account !== form.fromAccount)
                                    .map(a => (
                                        <option key={a.account} value={a.account}>
                                            {a.account}{a.bankName ? ` · ${a.bankName}` : ''}
                                        </option>
                                    ))}
                            </select>
                            {payer && payer.accounts.length < 2 && (
                                <span className="hint">
                                    В 1С у организации только один счет - переводить не на что
                                </span>
                            )}
                        </div>
                    </fieldset>
                )}

                {kind === 'salary' && (
                    <fieldset className="form-section">
                        <legend>👥 Сотрудник</legend>
                        <div className="input-group">
                            <label htmlFor="employeeName" className={file ? '' : 'required'}>ФИО</label>
                            <input
                                id="employeeName"
                                type="text"
                                value={form.employeeName}
                                onChange={set('employeeName')}
                                placeholder="Иванов Иван Иванович"
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="employeeAccount">Счет или карта</label>
                            <input
                                id="employeeAccount"
                                type="text"
                                inputMode="numeric"
                                value={form.employeeAccount}
                                onChange={set('employeeAccount')}
                                placeholder="40817810..."
                            />
                        </div>
                    </fieldset>
                )}

                <fieldset className="form-section">
                    <legend>💳 Платеж</legend>
                    <div className="input-group">
                        <label htmlFor="sum" className={file ? '' : 'required'}>Сумма</label>
                        <input
                            id="sum"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.sum}
                            onChange={set('sum')}
                            placeholder="0,00"
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="comment">Назначение платежа</label>
                        <input
                            id="comment"
                            type="text"
                            value={form.comment}
                            onChange={set('comment')}
                            placeholder={kind === 'self_card' ? 'Перевод собственных средств' : 'Оплата по договору'}
                        />
                    </div>
                </fieldset>

                {/* Ведомость и счет читает бухгалтер: разбирать такие файлы
                    мы пока не умеем, поэтому заявка уйдет ему на проверку */}
                {info.allowsFile && (
                    <fieldset className="form-section">
                        <legend>📎 Документ</legend>
                        <button
                            type="button"
                            className="tg-button secondary"
                            onClick={() => fileInput.current?.click()}
                        >
                            {file ? `Приложено: ${file.name}` : 'Приложить файл'}
                        </button>
                        <span className="hint">
                            {kind === 'salary'
                                ? 'Ведомость: суммы и сотрудников проверит бухгалтер'
                                : 'Счет на оплату: если он в PDF, лучше загрузить его в «Оплатить счёт» - там реквизиты распознаются'}
                        </span>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="application/pdf,image/*,.xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </fieldset>
                )}

                {!hasMainButton && (
                    <button type="button" className="tg-button primary" onClick={onSend} disabled={sending}>
                        {sending ? 'Создаем...' : 'Продолжить'}
                    </button>
                )}
                <button type="button" className="main-action-button" onClick={onClose}>Закрыть</button>
            </form>
        </div>
    )
}

export default NewPayment
