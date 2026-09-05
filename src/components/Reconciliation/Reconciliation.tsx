import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import '../../theme/forms1c.css'
import '../InvoiceForPayment/InvoiceForPayment.css'
import '../Taxes/Taxes.css'

import {
    createAccountingTask,
    fetchReportOptions,
    fetchRequests,
    ICounterparty,
    IReportOptions,
    IRequestListItem,
    requestAccountReport,
    requestReconciliation,
} from '../../api/client'
import { useAppState } from '../../hooks/useAppState'
import { useTelegram } from '../../hooks/useTelegram'
import CounterpartyPicker from '../Counterparty/CounterpartyPicker'

// Раздел 3.7 ТЗ. Два запроса к 1С - акт сверки с контрагентом и отчет по
// счету учета - плюс фиксация расхождений задачей бухгалтеру. Документы
// формирует база: своих цифр мы не показываем, сверять надо с учетом

// Период по умолчанию - с начала года по сегодня: чаще всего просят именно так
const startOfYear = (): string => `${new Date().getFullYear()}-01-01`
const today = (): string => new Date().toISOString().slice(0, 10)

const Reconciliation = () => {
    const navigate = useNavigate()
    const { mode } = useParams<{ mode: string }>()
    const { onClose } = useTelegram()
    const { organization, loading: stateLoading, error: stateError } = useAppState()

    const isReport = mode === 'report'

    const [counterparty, setCounterparty] = useState<ICounterparty | null>(null)
    const [from, setFrom] = useState(startOfYear)
    const [to, setTo] = useState(today)
    const [comment, setComment] = useState('')
    const [options, setOptions] = useState<IReportOptions | null>(null)
    const [report, setReport] = useState<'turnover' | 'card'>('turnover')
    const [account, setAccount] = useState('')

    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState('')

    // Последние сверки: по ним фиксируются расхождения
    const [acts, setActs] = useState<IRequestListItem[]>([])
    const [disputeFor, setDisputeFor] = useState<string>('')
    const [disputeAmount, setDisputeAmount] = useState('')
    const [disputeBody, setDisputeBody] = useState('')
    const [disputeDone, setDisputeDone] = useState('')

    const loadActs = useCallback(() => {
        fetchRequests('all', 'reconciliation')
            .then(setActs)
            .catch(() => setActs([]))
    }, [])

    useEffect(() => {
        if (!organization) return

        if (isReport) {
            fetchReportOptions(organization.id)
                .then((data) => {
                    setOptions(data)
                    // Первый разрешенный счет подставляем сразу: чаще всего
                    // запрашивают расчеты с поставщиками или покупателями
                    setAccount(data.accounts[0]?.code || '')
                })
                .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        } else {
            loadActs()
        }
    }, [organization, isReport, loadActs])

    const onSend = async () => {
        if (!organization) return setError('Не выбрана организация')

        setSending(true)
        setError('')
        setDone('')
        try {
            if (isReport) {
                const title = await requestAccountReport({
                    organizationId: organization.id,
                    report,
                    account: report === 'card' || account ? account : undefined,
                    counterpartyId: counterparty?.id,
                    from,
                    to,
                })
                setDone(title)
            } else {
                if (!counterparty) throw new Error('Не выбран контрагент')

                const title = await requestReconciliation({
                    organizationId: organization.id,
                    counterpartyId: counterparty.id,
                    from,
                    to,
                    comment,
                })
                setDone(title)
                loadActs()
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSending(false)
        }
    }

    const onDispute = async (uuid: string, title: string) => {
        if (!organization) return

        setError('')
        try {
            const id = await createAccountingTask({
                organizationId: organization.id,
                uuid,
                subject: `Расхождения: ${title}`,
                body: disputeBody,
                amount: disputeAmount,
            })
            setDisputeFor('')
            setDisputeAmount('')
            setDisputeBody('')
            setDisputeDone(`Обращение №${id} передано бухгалтеру`)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }

    const requiresAccount = report === 'card'

    return (
        <div className="form-container">
            <div className="form-header">
                <button type="button" className="back-button" onClick={() => navigate('/Section/reconciliation')} aria-label="Назад">‹</button>
                <h1>{isReport ? '📑 Оборотка и карточка счёта' : '🔄 Акт сверки'}</h1>
                <p>
                    {isReport
                        ? 'Отчёт формирует 1С по данным учёта'
                        : 'Акт формирует 1С и присылает в этот чат'}
                </p>
            </div>

            <form className="adaptive-form" onSubmit={(e) => e.preventDefault()}>
                {stateLoading && <p className="muted">Загрузка...</p>}
                {stateError && <div className="error-message">{stateError}</div>}
                {error && <div className="error-message">{error}</div>}
                {done && (
                    <div className="notice">
                        Запрос принят: {done}. Документ придёт в этот чат, как только 1С его сформирует.
                    </div>
                )}

                <fieldset className="form-section">
                    <legend>🏢 Организация</legend>
                    <div className="input-group">
                        <strong>{organization?.name || 'не выбрана'}</strong>
                        <span className="hint">Организация меняется в главном меню</span>
                    </div>
                </fieldset>

                {isReport && (
                    <fieldset className="form-section">
                        <legend>📑 Отчёт</legend>
                        <div className="input-group">
                            <label htmlFor="report">Что запросить</label>
                            <select
                                id="report"
                                value={report}
                                onChange={(e) => setReport(e.target.value as 'turnover' | 'card')}
                            >
                                {options?.reports.map(r => (
                                    <option key={r.key} value={r.key}>{r.title}</option>
                                ))}
                            </select>
                            <span className="hint">
                                {options?.reports.find(r => r.key === report)?.hint}
                            </span>
                        </div>

                        <div className="input-group">
                            <label htmlFor="account" className={requiresAccount ? 'required' : ''}>Счёт учёта</label>
                            <select id="account" value={account} onChange={(e) => setAccount(e.target.value)}>
                                {!requiresAccount && <option value="">Все счета (сводная)</option>}
                                {options?.accounts.map(a => (
                                    <option key={a.code} value={a.code}>{a.code} · {a.title}</option>
                                ))}
                            </select>
                            {/* Открыт не весь план счетов: зарплату и налоги
                                видят не все сотрудники клиента */}
                            <span className="hint">
                                Доступны счета, разрешённые вашей организации. Нужен другой - напишите в АМГ
                            </span>
                        </div>
                    </fieldset>
                )}

                <fieldset className="form-section">
                    <legend>{isReport ? '🏭 Отбор по контрагенту' : '🏭 Контрагент'}</legend>
                    <CounterpartyPicker
                        organizationId={organization?.id}
                        selected={counterparty}
                        onSelect={setCounterparty}
                        onClear={() => setCounterparty(null)}
                        label={isReport ? 'Необязательно: оставьте пустым для всех' : 'С кем сверяемся'}
                    />
                </fieldset>

                <fieldset className="form-section">
                    <legend>📆 Период</legend>
                    <div className="input-group">
                        <label htmlFor="from" className="required">С</label>
                        <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="to" className="required">По</label>
                        <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                </fieldset>

                {!isReport && (
                    <fieldset className="form-section">
                        <legend>💬 Комментарий</legend>
                        <div className="input-group">
                            <input
                                type="text"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Например: только по договору поставки"
                            />
                        </div>
                    </fieldset>
                )}

                <button type="button" className="tg-button primary" onClick={onSend} disabled={sending}>
                    {sending ? 'Отправляем...' : isReport ? 'Запросить отчёт' : 'Запросить акт сверки'}
                </button>

                {/* Расхождения фиксируются задачей: у нее есть номер и статус,
                    в отличие от сообщения в чате */}
                {!isReport && acts.length > 0 && (
                    <fieldset className="form-section">
                        <legend>🧾 Последние сверки</legend>
                        {disputeDone && <div className="notice">{disputeDone}</div>}

                        {acts.slice(0, 5).map(act => (
                            <div key={act.uuid} className="tax-item">
                                <div className="tax-head">
                                    <span className="tax-title">{act.title || 'Акт сверки'}</span>
                                    <span className="badge">{act.statusTitle}</span>
                                </div>

                                {disputeFor === act.uuid ? (
                                    <>
                                        <div className="input-group">
                                            <label htmlFor={`amount-${act.uuid}`}>Сумма расхождения</label>
                                            <input
                                                id={`amount-${act.uuid}`}
                                                type="number"
                                                step="0.01"
                                                value={disputeAmount}
                                                onChange={(e) => setDisputeAmount(e.target.value)}
                                                placeholder="0,00"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor={`body-${act.uuid}`}>В чём расхождение</label>
                                            <input
                                                id={`body-${act.uuid}`}
                                                type="text"
                                                value={disputeBody}
                                                onChange={(e) => setDisputeBody(e.target.value)}
                                                placeholder="Не учтён платёж от 12.03 на 15 000"
                                            />
                                        </div>
                                        <div className="tax-actions">
                                            <button
                                                type="button"
                                                className="btn primary"
                                                onClick={() => onDispute(act.uuid, act.title || 'акт сверки')}
                                            >
                                                Отправить бухгалтеру
                                            </button>
                                            <button type="button" className="btn ghost" onClick={() => setDisputeFor('')}>
                                                Отмена
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="tax-actions">
                                        <button type="button" className="btn ghost" onClick={() => setDisputeFor(act.uuid)}>
                                            Есть расхождения
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </fieldset>
                )}

                <button type="button" className="main-action-button" onClick={onClose}>Закрыть</button>
            </form>
        </div>
    )
}

export default Reconciliation
