import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import '../../theme/theme1c.css'
import '../Taxes/Taxes.css'
import './Admin.css'

import {
    createAdminBase,
    createAdminInvite,
    fetchAdminBases,
    fetchAdminOrganizations,
    fetchAdminOverview,
    fetchAdminQueue,
    fetchAdminStats,
    fetchAdminUsers,
    grantAdminAccess,
    IAdminBase,
    IAdminOrganization,
    IAdminOverview,
    IAdminQueueItem,
    IAdminStats,
    IAdminUser,
    retryAdminRequest,
    revokeAdminAccess,
    rotateAdminBaseToken,
    syncAdminBase,
    updateAdminOrganization,
    updateAdminUser,
} from '../../api/client'
import { useAppState } from '../../hooks/useAppState'

// Административная панель, раздел 13 ТЗ. Раньше все это было доступно
// только через ssh: администрировать мог один человек с ключом от сервера

const TABS: Record<string, string> = {
    bases: '🗄 Базы 1С',
    orgs: '🏢 Организации',
    users: '👥 Пользователи',
    queue: '⚙️ Очередь и ошибки',
    stats: '📈 Статистика',
}

const ROLE_TITLES: Record<string, string> = {
    client_owner: 'Владелец',
    client_employee: 'Сотрудник клиента',
    accountant: 'Бухгалтер АМГ',
    admin: 'Администратор',
    head: 'Руководитель',
}

const STATUS_TITLES: Record<string, string> = {
    pending: 'Ждет доступа',
    active: 'Активен',
    blocked: 'Заблокирован',
}

const TYPE_TITLES: Record<string, string> = {
    check: 'Проверка счета',
    payment_order: 'Платежка',
    invoice: 'Счет покупателю',
    reconciliation: 'Акт сверки',
    account_report: 'Отчет по счету',
    sync_organizations: 'Выгрузка организаций',
    sync_counterparties: 'Выгрузка контрагентов',
    sync_tax_profiles: 'Выгрузка профилей',
}

const when = (value: string | null): string =>
    value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : 'не было'

const Admin = () => {
    const navigate = useNavigate()
    const { tab } = useParams<{ tab: string }>()
    const { state, loading: stateLoading } = useAppState()

    const [overview, setOverview] = useState<IAdminOverview | null>(null)
    const [bases, setBases] = useState<IAdminBase[]>([])
    const [orgs, setOrgs] = useState<IAdminOrganization[]>([])
    const [users, setUsers] = useState<IAdminUser[]>([])
    const [roles, setRoles] = useState<string[]>([])
    const [queue, setQueue] = useState<IAdminQueueItem[]>([])
    const [queueScope, setQueueScope] = useState<'errors' | 'active' | 'recent'>('errors')
    const [stats, setStats] = useState<IAdminStats | null>(null)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    // Токен базы показывается ровно один раз - держим его в состоянии,
    // пока администратор не перенесет в 1С
    const [token, setToken] = useState<{ name: string, value: string, instruction: string[] } | null>(null)
    const [newBaseName, setNewBaseName] = useState('')
    const [search, setSearch] = useState('')
    const [grantFor, setGrantFor] = useState<number>(0)

    const isStaff = state?.user.role === 'admin' || state?.user.role === 'head'

    const load = useCallback(async () => {
        if (!isStaff) return

        setLoading(true)
        setError('')
        try {
            setOverview(await fetchAdminOverview())

            if (tab === 'bases') setBases(await fetchAdminBases())
            if (tab === 'orgs') setOrgs(await fetchAdminOrganizations())
            if (tab === 'users') {
                const data = await fetchAdminUsers(search)
                setUsers(data.items)
                setRoles(data.roles)
                setOrgs(await fetchAdminOrganizations())
            }
            if (tab === 'queue') setQueue(await fetchAdminQueue(queueScope))
            if (tab === 'stats') setStats(await fetchAdminStats(30))
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Не удалось получить данные')
        } finally {
            setLoading(false)
        }
    }, [tab, isStaff, queueScope, search])

    useEffect(() => { load() }, [load])

    const act = async (action: () => Promise<string | void>) => {
        setError('')
        setNotice('')
        try {
            const msg = await action()
            if (msg) setNotice(msg)
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }

    if (!stateLoading && !isStaff) {
        return (
            <div className="app">
                <button className="back-link" onClick={() => navigate('/')}>‹ Меню</button>
                <div className="notice error">Раздел доступен только сотрудникам АМГ</div>
            </div>
        )
    }

    return (
        <div className="app">
            <button className="back-link" onClick={() => navigate('/Section/admin')}>‹ Администрирование</button>

            <div className="app-header">
                <h2 style={{ margin: 0 }}>{TABS[tab || 'bases'] || 'Администрирование'}</h2>
                {overview && (
                    <span className="muted">
                        Баз на связи: {overview.bases_online}/{overview.bases} · организаций: {overview.organizations}
                        {' '}· пользователей: {overview.users_active}
                        {overview.errors_open > 0 && ` · ошибок: ${overview.errors_open}`}
                    </span>
                )}
            </div>

            <div className="admin-tabs">
                {Object.entries(TABS).map(([key, title]) => (
                    <button
                        key={key}
                        className={`btn ${tab === key ? 'primary' : 'ghost'}`}
                        onClick={() => navigate(`/Admin/${key}`)}
                    >
                        {title}
                    </button>
                ))}
            </div>

            {loading && <p className="muted">Загрузка...</p>}
            {error && <div className="notice error">{error}</div>}
            {notice && <div className="notice">{notice}</div>}

            {/* Токен виден один раз: показываем крупно и с инструкцией */}
            {token && (
                <div className="notice">
                    <strong>Токен базы «{token.name}»</strong>
                    <div className="admin-token">{token.value}</div>
                    <ol className="admin-steps">
                        {token.instruction.map(step => <li key={step}>{step}</li>)}
                    </ol>
                    <button className="btn ghost" onClick={() => setToken(null)}>Скрыть</button>
                </div>
            )}

            {tab === 'bases' && (
                <>
                    <div className="tax-item">
                        <div className="tax-title">Новая база</div>
                        <div className="input-group">
                            <input
                                type="text"
                                value={newBaseName}
                                onChange={(e) => setNewBaseName(e.target.value)}
                                placeholder="Например: Бухгалтерия Ромашка"
                            />
                        </div>
                        <div className="tax-actions">
                            <button
                                className="btn primary"
                                disabled={!newBaseName.trim()}
                                onClick={() => act(async () => {
                                    const created = await createAdminBase(newBaseName.trim())
                                    setToken({ name: newBaseName.trim(), value: created.token, instruction: created.instruction })
                                    setNewBaseName('')

                                    return 'База создана. Перенесите токен в обработку 1С'
                                })}
                            >
                                Создать и получить токен
                            </button>
                        </div>
                    </div>

                    {bases.map(base => (
                        <div key={base.id} className="tax-item">
                            <div className="tax-head">
                                <span className="tax-title">
                                    {base.name}
                                    <span className="tax-line">
                                        организаций {base.organizations} · контрагентов {base.counterparties} · счетов {base.accounts}
                                    </span>
                                </span>
                                <span className={`badge ${base.online ? 'accent' : 'warn'}`}>
                                    {base.online ? 'на связи' : 'нет связи'}
                                </span>
                            </div>

                            <div className="tax-line">Последний опрос: {when(base.lastSeenAt)}</div>
                            {/* По этим отметкам видно, на каком шаге подключение */}
                            <div className="tax-line">
                                Организации: {base.synced.organizations ? '✓' : '—'} ·
                                контрагенты: {base.synced.counterparties ? '✓' : '—'} ·
                                налоговые профили: {base.synced.taxProfiles ? '✓' : '—'}
                            </div>

                            <div className="tax-actions">
                                <button className="btn ghost" onClick={() => act(() => syncAdminBase(base.id))}>
                                    Обновить справочники
                                </button>
                                <button
                                    className="btn ghost"
                                    onClick={() => act(async () => {
                                        const fresh = await rotateAdminBaseToken(base.id)
                                        setToken({
                                            name: base.name,
                                            value: fresh,
                                            instruction: ['Старый токен больше не действует', 'Подставьте новый в КлючОбмена() и перезапустите обработку'],
                                        })

                                        return 'Токен перевыпущен'
                                    })}
                                >
                                    Новый токен
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {tab === 'orgs' && orgs.map(org => (
                <div key={org.id} className="tax-item">
                    <div className="tax-head">
                        <span className="tax-title">
                            {org.name}
                            <span className="tax-line">
                                ИНН {org.inn}{org.kpp ? ` · КПП ${org.kpp}` : ''} · база: {org.base_name || 'не привязана'}
                            </span>
                        </span>
                        <span className="badge">{org.users_count} польз.</span>
                    </div>

                    <div className="tax-line">
                        Лимит платежа: {org.payment_limit === null ? 'без ограничения' : `${org.payment_limit.toLocaleString('ru-RU')} ₽`}
                        {' · '}счета отчётов: {org.reportAccounts.join(', ')}
                        {!org.reportAccountsCustom && ' (по умолчанию)'}
                    </div>
                    {org.tax_regime && <div className="tax-line">Налоговый режим: {org.tax_regime}</div>}

                    <div className="tax-actions">
                        <button
                            className="btn ghost"
                            onClick={() => {
                                const value = window.prompt('Лимит платежа в рублях (пусто — без ограничения)',
                                    org.payment_limit === null ? '' : String(org.payment_limit))
                                if (value === null) return

                                act(() => updateAdminOrganization(org.id, {
                                    paymentLimit: value.trim() === '' ? null : Number(value),
                                }))
                            }}
                        >
                            Лимит платежа
                        </button>
                        <button
                            className="btn ghost"
                            onClick={() => {
                                const value = window.prompt('Счета учёта через запятую (пусто — вернуть список по умолчанию)',
                                    org.reportAccountsCustom ? org.reportAccounts.join(',') : '')
                                if (value === null) return

                                act(() => updateAdminOrganization(org.id, {
                                    reportAccounts: value.trim() === '' ? null : value.split(',').map(a => a.trim()),
                                }))
                            }}
                        >
                            Счета отчётов
                        </button>
                    </div>
                </div>
            ))}

            {tab === 'users' && (
                <>
                    <div className="input-group">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Поиск по имени, телефону или telegram id"
                        />
                    </div>

                    <div className="tax-item">
                        <div className="tax-title">Пригласить клиента</div>
                        <span className="hint">
                            Ссылка сама выдаст роль, права и привязку к организации — telegram id знать не нужно
                        </span>
                        <div className="tax-actions">
                            {orgs.slice(0, 6).map(org => (
                                <button
                                    key={org.id}
                                    className="btn ghost"
                                    onClick={() => act(async () => {
                                        const link = await createAdminInvite({
                                            organizationId: org.id,
                                            permissions: ['view', 'create', 'confirm'],
                                        })

                                        return `Ссылка для «${org.name}»: ${link}`
                                    })}
                                >
                                    {org.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {users.map(user => (
                        <div key={user.id} className="tax-item">
                            <div className="tax-head">
                                <span className="tax-title">
                                    {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени'}
                                    <span className="tax-line">
                                        {user.username ? `@${user.username} · ` : ''}tg {user.telegram_id}
                                        {user.phone ? ` · ${user.phone}` : ''}
                                    </span>
                                </span>
                                <span className={`badge ${user.status === 'active' ? 'accent' : 'warn'}`}>
                                    {STATUS_TITLES[user.status] || user.status}
                                </span>
                            </div>

                            <div className="tax-line">Роль: {ROLE_TITLES[user.global_role] || user.global_role}</div>
                            <div className="tax-line">
                                Организации: {user.organizations.length
                                    ? user.organizations.map(o => `${o.name} (${o.permissions.join(', ')})`).join('; ')
                                    : 'нет доступа'}
                            </div>

                            <div className="tax-actions">
                                <select
                                    value={user.global_role}
                                    onChange={(e) => act(() => updateAdminUser(user.id, { role: e.target.value }))}
                                >
                                    {roles.map(role => (
                                        <option key={role} value={role}>{ROLE_TITLES[role] || role}</option>
                                    ))}
                                </select>

                                {user.status !== 'blocked' ? (
                                    <button className="btn ghost" onClick={() => act(() => updateAdminUser(user.id, { status: 'blocked' }))}>
                                        Заблокировать
                                    </button>
                                ) : (
                                    <button className="btn ghost" onClick={() => act(() => updateAdminUser(user.id, { status: 'active' }))}>
                                        Разблокировать
                                    </button>
                                )}

                                <button className="btn ghost" onClick={() => setGrantFor(grantFor === user.id ? 0 : user.id)}>
                                    Доступ к организации
                                </button>
                            </div>

                            {grantFor === user.id && (
                                <div className="tax-actions" style={{ flexWrap: 'wrap' }}>
                                    {orgs.map(org => {
                                        const has = user.organizations.some(o => o.id === org.id)

                                        return (
                                            <button
                                                key={org.id}
                                                className={`btn ${has ? '' : 'ghost'}`}
                                                onClick={() => act(() => has
                                                    ? revokeAdminAccess(user.id, org.id)
                                                    : grantAdminAccess(user.id, org.id, ['view', 'create', 'confirm']))}
                                            >
                                                {has ? '✓ ' : '+ '}{org.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}

            {tab === 'queue' && (
                <>
                    <div className="tax-actions" style={{ marginBottom: 12 }}>
                        {(['errors', 'active', 'recent'] as const).map(scope => (
                            <button
                                key={scope}
                                className={`btn ${queueScope === scope ? 'primary' : 'ghost'}`}
                                onClick={() => setQueueScope(scope)}
                            >
                                {scope === 'errors' ? 'Ошибки' : scope === 'active' ? 'В работе' : 'Последние'}
                            </button>
                        ))}
                    </div>

                    {!queue.length && !loading && <div className="notice">Заявок нет</div>}

                    {queue.map(item => (
                        <div key={item.uuid} className={`tax-item${item.last_error ? ' overdue' : ''}`}>
                            <div className="tax-head">
                                <span className="tax-title">
                                    {TYPE_TITLES[item.type] || item.type}
                                    <span className="tax-line">
                                        {item.organization_name || 'без организации'}
                                        {item.base_name ? ` · ${item.base_name}` : ''}
                                        {item.title ? ` · ${item.title}` : ''}
                                    </span>
                                </span>
                                <span className={`badge ${item.last_error ? 'warn' : ''}`}>{item.status}</span>
                            </div>

                            <div className="tax-line">
                                {when(item.created_at)}
                                {item.attempts > 0 && ` · попыток: ${item.attempts}`}
                                {item.sum ? ` · ${item.sum} ₽` : ''}
                            </div>
                            {item.last_error && <div className="tax-line">⚠️ {item.last_error}</div>}

                            {item.last_error && (
                                <div className="tax-actions">
                                    <button className="btn ghost" onClick={() => act(() => retryAdminRequest(item.uuid))}>
                                        Повторить
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}

            {tab === 'stats' && stats && (
                <>
                    <div className="tax-stats">
                        <div className="tax-stat">
                            <b>{stats.active_users}</b>
                            <span className="muted">активных за {stats.period_days} дн.</span>
                        </div>
                        <div className="tax-stat">
                            <b>{stats.by_type.reduce((sum, t) => sum + t.total, 0)}</b>
                            <span className="muted">операций</span>
                        </div>
                        <div className="tax-stat">
                            <b>{stats.avg_minutes === null ? '—' : `${stats.avg_minutes} мин`}</b>
                            <span className="muted">среднее время</span>
                        </div>
                    </div>

                    <div className="tax-item">
                        <div className="tax-title">Операции по видам</div>
                        {stats.by_type.map(row => (
                            <div key={row.type} className="tax-line">
                                {TYPE_TITLES[row.type] || row.type}: {row.total}
                                {row.done > 0 && ` · выполнено ${row.done}`}
                                {row.failed > 0 && ` · с ошибкой ${row.failed}`}
                            </div>
                        ))}
                        {!stats.by_type.length && <div className="tax-line">За период операций не было</div>}
                    </div>

                    <div className="tax-item">
                        <div className="tax-title">Что делают чаще всего</div>
                        {stats.top_actions.map(row => (
                            <div key={row.action} className="tax-line">{row.action}: {row.total}</div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default Admin
