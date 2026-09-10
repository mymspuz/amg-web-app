import React, { useEffect, useState } from 'react'

import {
    counterpartyStatus,
    createCounterparty,
    fetchCounterparties,
    ICounterparty,
    ILookupResult,
    lookupCounterparty,
} from '../../api/client'

interface IProps {
    organizationId?: number
    selected: ICounterparty | null
    onSelect: (item: ICounterparty) => void
    onClear: () => void
    // Подпись над полем поиска: в счете это покупатель, в платеже - получатель
    label?: string
    error?: string
}

// Подбор контрагента из справочника базы: по наименованию или по ИНН -
// человек помнит либо название, либо цифры из документа.
// Поиск идет на сервере, справочник в приложение не тянем
const CounterpartyPicker = ({ organizationId, selected, onSelect, onClear, label, error }: IProps) => {
    const [query, setQuery] = useState('')
    const [found, setFound] = useState<ICounterparty[]>([])
    const [searching, setSearching] = useState(false)

    // Заведение нового контрагента: по ИНН смотрим свои базы и внешний
    // источник, дальше карточку заводит 1С
    const [creating, setCreating] = useState(false)
    const [inn, setInn] = useState('')
    const [lookup, setLookup] = useState<ILookupResult | null>(null)
    const [draft, setDraft] = useState({ name: '', kpp: '', address: '' })
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState('')
    const [createError, setCreateError] = useState('')

    const onLookup = async () => {
        if (!organizationId) return

        setBusy(true)
        setCreateError('')
        setNotice('')
        try {
            const result = await lookupCounterparty(inn, organizationId)
            setLookup(result)

            // Реквизиты из внешнего источника или из соседней базы:
            // набирать руками ничего не придется
            const known = result.external || result.found[0]
            if (known) {
                setDraft({
                    name: known.name || '',
                    kpp: known.kpp || '',
                    address: (known as { address?: string | null }).address || '',
                })
            }
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : 'Не удалось проверить ИНН')
        } finally {
            setBusy(false)
        }
    }

    const onCreate = async () => {
        if (!organizationId) return

        setBusy(true)
        setCreateError('')
        try {
            const created = await createCounterparty({
                organizationId,
                inn,
                kpp: draft.kpp,
                name: draft.name,
                address: draft.address,
            })
            setNotice(created.msg)
            setLookup(null)

            // 1С отвечает через несколько секунд. Дожидаемся и сразу
            // подставляем контрагента: искать его заново неудобно
            for (let attempt = 0; attempt < 12; attempt += 1) {
                await new Promise(resolve => window.setTimeout(resolve, 2000))

                const state = await counterpartyStatus(created.uuid)

                if (state.failed) {
                    setCreateError(state.error || 'Не удалось завести контрагента в 1С')
                    setNotice('')

                    return
                }

                if (state.ready && state.counterparty) {
                    onSelect(state.counterparty)
                    setCreating(false)
                    setNotice('')
                    setQuery('')
                    setFound([])

                    return
                }
            }

            // Не дождались: заявка не потеряна, ответ придет в чат
            setNotice('Заявка ушла в 1С. Как только контрагент появится, выберите его в поиске')
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : String(e))
        } finally {
            setBusy(false)
        }
    }

    useEffect(() => {
        if (selected) return

        const text = query.trim()
        if (text.length < 2) {
            setFound([])

            return
        }

        // Не дергаем сервер на каждую букву - ждем, пока допечатают
        setSearching(true)
        const timer = window.setTimeout(() => {
            fetchCounterparties(text, organizationId)
                .then(setFound)
                .catch(() => setFound([]))
                .finally(() => setSearching(false))
        }, 350)

        return () => {
            window.clearTimeout(timer)
            setSearching(false)
        }
    }, [query, organizationId, selected])

    if (selected) {
        return (
            <div className="party-card">
                <div className="party-line"><strong>{selected.name}</strong></div>
                <div className="party-line muted">
                    ИНН {selected.inn || '—'}{selected.kpp ? ` · КПП ${selected.kpp}` : ''}
                </div>
                {selected.address && <div className="party-line muted">{selected.address}</div>}
                <button
                    type="button"
                    className="tg-button secondary"
                    onClick={() => { onClear(); setQuery(''); setFound([]) }}
                >
                    Выбрать другого
                </button>
            </div>
        )
    }

    return (
        <>
            <div className="input-group">
                <label htmlFor="counterpartySearch" className="required">
                    {label || 'Найдите контрагента по названию или ИНН'}
                </label>
                <input
                    id="counterpartySearch"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Например, Техно или 7707083893"
                    autoComplete="off"
                    className={error ? 'error' : ''}
                />
                {error && <span className="error-message">{error}</span>}
            </div>

            {searching && <p className="muted">Ищем...</p>}

            {!searching && query.trim().length >= 2 && !found.length && !creating && (
                <>
                    <p className="muted">Ничего не нашлось. Проверьте написание.</p>
                    <button type="button" className="tg-button secondary" onClick={() => setCreating(true)}>
                        Контрагента нет в 1С — завести по ИНН
                    </button>
                </>
            )}

            {creating && (
                <div className="party-card">
                    <div className="input-group">
                        <label htmlFor="newInn" className="required">ИНН контрагента</label>
                        <input
                            id="newInn"
                            type="text"
                            inputMode="numeric"
                            value={inn}
                            onChange={(e) => setInn(e.target.value)}
                            placeholder="10 цифр у организации, 12 у предпринимателя"
                        />
                    </div>

                    {createError && <div className="error-message">{createError}</div>}
                    {notice && <div className="notice">{notice}</div>}

                    {!lookup && (
                        <button type="button" className="tg-button primary" disabled={busy || !inn.trim()} onClick={onLookup}>
                            {busy ? 'Проверяем...' : 'Проверить ИНН'}
                        </button>
                    )}

                    {lookup && !lookup.valid && <div className="error-message">{lookup.error}</div>}

                    {/* Контрагент уже заведен у соседнего клиента: реквизиты
                        выверены бухгалтером, набирать заново незачем */}
                    {lookup && lookup.found.map(item => (
                        <div key={item.baseId + '-' + item.id} className="party-line muted">
                            {item.sameBase
                                ? 'Уже есть в вашей базе: ' + item.name
                                : 'Есть в базе «' + item.baseName + '»: ' + item.name}
                        </div>
                    ))}

                    {lookup && lookup.external && (
                        <div className="party-line muted">
                            Данные из реестра: {lookup.external.name}
                            {lookup.external.status && lookup.external.status !== 'ACTIVE'
                                ? ' · внимание: организация не действующая'
                                : ''}
                        </div>
                    )}
                    {lookup && lookup.externalError && (
                        <div className="party-line muted">{lookup.externalError}</div>
                    )}

                    {lookup && lookup.valid && (
                        <>
                            <div className="input-group">
                                <label htmlFor="newName" className="required">Наименование</label>
                                <input
                                    id="newName"
                                    type="text"
                                    value={draft.name}
                                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    placeholder="ООО «Ромашка»"
                                />
                            </div>

                            {lookup.kind === 'legal' && (
                                <div className="input-group">
                                    <label htmlFor="newKpp">КПП</label>
                                    <input
                                        id="newKpp"
                                        type="text"
                                        inputMode="numeric"
                                        value={draft.kpp}
                                        onChange={(e) => setDraft({ ...draft, kpp: e.target.value })}
                                        placeholder="9 цифр"
                                    />
                                </div>
                            )}

                            <div className="input-group">
                                <label htmlFor="newAddress">Адрес</label>
                                <input
                                    id="newAddress"
                                    type="text"
                                    value={draft.address}
                                    onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                                    placeholder="Город, улица, дом"
                                />
                            </div>

                            <button
                                type="button"
                                className="tg-button primary"
                                disabled={busy || !draft.name.trim()}
                                onClick={onCreate}
                            >
                                {busy ? 'Заводим в 1С, подождите...' : 'Завести контрагента'}
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        className="tg-button secondary"
                        onClick={() => { setCreating(false); setLookup(null); setNotice(''); setCreateError('') }}
                    >
                        Отмена
                    </button>
                </div>
            )}

            {found.length > 0 && (
                <div className="search-results">
                    {found.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            className="search-result"
                            onClick={() => { onSelect(item); setFound([]); setQuery('') }}
                        >
                            <span className="search-result-name">{item.name}</span>
                            <span className="search-result-inn">
                                ИНН {item.inn || '—'}{item.kpp ? ` · КПП ${item.kpp}` : ''}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </>
    )
}

export default CounterpartyPicker
