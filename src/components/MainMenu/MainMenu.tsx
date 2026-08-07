import React from 'react'
import { useNavigate } from 'react-router-dom'

import '../../theme/theme1c.css'

import { acceptConsent } from '../../api/client'
import { MENU } from '../../data/menu'
import { useAppState } from '../../hooks/useAppState'
import { useTelegram } from '../../hooks/useTelegram'

// Главное меню по разделу 5 ТЗ: разделы плитками, внутри - пункты.
// Нереализованные пункты видны, но неактивны - так понятен объем сервиса
const MainMenu = () => {
    const navigate = useNavigate()
    const { onClose, hideMainButton } = useTelegram()
    const { state, loading, error, organization, selectOrganization, reload } = useAppState()
    const [consentError, setConsentError] = React.useState('')

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
        return <div className="app"><p className="muted">Загрузка...</p></div>
    }

    if (error) {
        return (
            <div className="app">
                <div className="notice error">{error}</div>
                <button className="btn primary" onClick={reload}>Повторить</button>
            </div>
        )
    }

    const access = state?.user.accessStatus

    if (access !== 'active') {
        return (
            <div className="app">
                <h1>АМГ</h1>
                <div className="notice">
                    {access === 'blocked'
                        ? 'Доступ заблокирован. Обратитесь в АМГ.'
                        : 'Доступ ещё не выдан. Обратитесь в АМГ за ссылкой-приглашением или отправьте боту свой номер телефона.'}
                </div>
                <button className="btn ghost" onClick={onClose}>Закрыть</button>
            </div>
        )
    }

    if (!state?.user.hasConsent) {
        return (
            <div className="app">
                <h1>АМГ</h1>
                <div className="notice">Для работы с сервисом требуется согласие на обработку персональных данных.</div>
                {consentError && <div className="notice error">{consentError}</div>}
                <button className="btn primary" onClick={onAcceptConsent}>Принимаю условия</button>
                <button className="btn ghost" onClick={onClose}>Закрыть</button>
            </div>
        )
    }

    if (!state.organizations.length) {
        return (
            <div className="app">
                <h1>АМГ</h1>
                <div className="notice">Вам пока не назначена ни одна организация. Обратитесь в АМГ.</div>
                <button className="btn ghost" onClick={onClose}>Закрыть</button>
            </div>
        )
    }

    return (
        <div className="app">
            <div className="app-header">
                <h1>АМГ</h1>
                <span className="muted">{state.fullName}</span>

                <div className="org-row">
                    {state.organizations.length > 1
                        ? (
                            <select
                                value={organization?.id || ''}
                                onChange={(e) => selectOrganization(Number(e.target.value))}
                                aria-label="Организация"
                            >
                                {state.organizations.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                        )
                        : <strong>{organization?.name}</strong>
                    }
                </div>

                {state.hasInvoice && (
                    <p className="muted" style={{ marginTop: 8 }}>
                        Готов счёт к оплате: ИНН {state.invoice.supplierINN}, {state.invoice.sum} ₽
                    </p>
                )}
            </div>

            <div className="tiles">
                {MENU.map(section => (
                    <button
                        key={section.key}
                        className="tile"
                        onClick={() => navigate(`/Section/${section.key}`)}
                    >
                        <span
                            className="tile-icon"
                            style={{ background: `${section.color}20`, color: section.color }}
                        >
                            {section.icon}
                        </span>
                        <span className="tile-title">{section.title}</span>
                        <span className="tile-hint">{section.hint}</span>
                    </button>
                ))}
            </div>

            <button className="btn ghost" style={{ marginTop: 16 }} onClick={onClose}>Закрыть</button>
        </div>
    )
}

export default MainMenu
