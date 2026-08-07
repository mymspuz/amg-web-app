import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import './MainMenu.css'

import counterparties from '../../data/counterparty.json'
import { acceptConsent } from '../../api/client'
import { useAppState } from '../../hooks/useAppState'
import { useTelegram } from '../../hooks/useTelegram'

const MainMenu = () => {
    const [counterparty, setCounterparty] = useState<number>(counterparties[0].id)
    const [consentError, setConsentError] = useState<string>('')

    const navigate = useNavigate()
    const { onClose, hideMainButton } = useTelegram()
    const { state, loading, error, organization, selectOrganization, can, reload } = useAppState()

    hideMainButton()

    const onAcceptConsent = async () => {
        try {
            await acceptConsent()
            reload()
        } catch (e) {
            setConsentError(e instanceof Error ? e.message : String(e))
        }
    }

    if (loading) {
        return <div className="telegram-container"><div className="header"><h3>Загрузка...</h3></div></div>
    }

    if (error) {
        return (
            <div className="telegram-container">
                <div className="header"><h1>AMG</h1></div>
                <div className="error-message">{error}</div>
                <button className="main-action-button" onClick={reload}>Повторить</button>
            </div>
        )
    }

    const access = state?.user.accessStatus

    // Доступ еще не выдан или заблокирован - показываем понятный экран,
    // а не пустое меню с неработающими кнопками
    if (access !== 'active') {
        return (
            <div className="telegram-container">
                <div className="header">
                    <h1>AMG</h1>
                    <h3>{state?.fullName}</h3>
                </div>
                <div className="error-message">
                    {access === 'blocked'
                        ? 'Доступ заблокирован. Обратитесь в АМГ.'
                        : 'Доступ еще не выдан. Обратитесь в АМГ за ссылкой-приглашением или отправьте боту свой номер телефона.'}
                </div>
                <button className="main-action-button" onClick={onClose}>Закрыть</button>
            </div>
        )
    }

    if (!state?.user.hasConsent) {
        return (
            <div className="telegram-container">
                <div className="header">
                    <h1>AMG</h1>
                    <h3>{state?.fullName}</h3>
                </div>
                <p>Для работы с ботом требуется согласие на обработку персональных данных.</p>
                {consentError && <div className="error-message">{consentError}</div>}
                <button className="tg-button primary" onClick={onAcceptConsent}>Принимаю условия</button>
                <button className="main-action-button" onClick={onClose}>Закрыть</button>
            </div>
        )
    }

    if (!state.organizations.length) {
        return (
            <div className="telegram-container">
                <div className="header">
                    <h1>AMG</h1>
                    <h3>{state.fullName}</h3>
                </div>
                <div className="error-message">Вам пока не назначена ни одна организация. Обратитесь в АМГ.</div>
                <button className="main-action-button" onClick={onClose}>Закрыть</button>
            </div>
        )
    }

    return (
        <div className="telegram-container">
            <div className="header">
                <h1>AMG</h1>
                <h3>{state.fullName}</h3>
            </div>

            <div className="buttons-container">
                {/* Организация-плательщик. Выбор нужен тем, у кого их несколько */}
                {state.organizations.length > 1 && (
                    <div className="input-row">
                        <div className="input-group">
                            <label htmlFor="organization">Организация</label>
                            <select
                                id="organization"
                                value={organization?.id || ''}
                                onChange={(e) => selectOrganization(Number(e.target.value))}
                            >
                                {state.organizations.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
                {state.organizations.length === 1 && (
                    <p className="organization-name">{organization?.name}</p>
                )}

                <div className="input-row">
                    <div className="input-group half">
                        <select
                            id="counterparty"
                            value={counterparty}
                            onChange={(e) => setCounterparty(Number(e.target.value))}
                        >
                            {counterparties.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {can('create') && (
                    <button
                        className="tg-button primary"
                        onClick={() => navigate(`/InvoiceForPayment?counterpartyId=${counterparty}&fromFile=${state.hasItems ? 1 : 0}`)}
                    >
                        📝 Создать счет{state.hasItems ? ` (строк из файла: ${state.itemsCount})` : ''}
                    </button>
                )}

                {state.hasInvoice && can('confirm') && (
                    <button
                        className="tg-button primary"
                        onClick={() => navigate('/PaymentOrder')}
                    >
                        📝 Создать пп на {state.invoice.sum} руб.
                    </button>
                )}
            </div>

            <button className="main-action-button" onClick={onClose}>Закрыть</button>
        </div>
    )
}

export default MainMenu
