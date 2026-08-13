import React, { useEffect, useState } from 'react'

import { fetchCounterparties, ICounterparty } from '../../api/client'

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
                    placeholder="Например, Техно или 7724727585"
                    autoComplete="off"
                    className={error ? 'error' : ''}
                />
                {error && <span className="error-message">{error}</span>}
            </div>

            {searching && <p className="muted">Ищем...</p>}

            {!searching && query.trim().length >= 2 && !found.length && (
                <p className="muted">Ничего не нашлось. Проверьте написание.</p>
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
