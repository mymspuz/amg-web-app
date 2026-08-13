import React, { useState, ChangeEvent, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useTelegram } from '../../hooks/useTelegram'
import { useAppState } from '../../hooks/useAppState'

import '../../theme/forms1c.css'
import './InvoiceForPayment.css'

import {
    fetchCounterparties,
    fetchOrganizations,
    ICounterparty,
    IOrganizationDetails,
    sendInvoice,
} from '../../api/client'

interface IItem {
    id: number
    name: string
    amount: number
    price: number
    unit: string
}

interface IFormData {
    // Основание печатается в шапке счета
    basis: string
    buyerName: string
    buyerInn: string
    buyerKpp: string
    buyerInd: string
    buyerAddress: string
    buyerPhone: string | null
    items: IItem[]
    fromFile: boolean
}

interface IFormErrors {
    buyer: string
    buyerName: string
    buyerInn: string
    buyerKpp: string
    buyerInd: string
    buyerAddress: string
    items: string
}

type TPermittedOperations = 'none' | 'add' | 'edit'

// Счет выставляется от организации базы контрагенту из нее же: обе стороны
// берутся из 1С, поэтому реквизиты в печатной форме заведомо совпадают
// с учетом. Ручной ввод покупателя оставлен для разовых сделок
const InvoiceForPayment = () => {
    const { onClose, showMainButton, hasMainButton } = useTelegram()
    const { organization } = useAppState()

    const navigate = useNavigate()
    const [search] = useSearchParams()
    const fromFile = search.get('fromFile')

    const [errors, setErrors] = useState<IFormErrors>({} as IFormErrors)
    const [sendError, setSendError] = useState<string>('')

    // Поставщик - организация из базы
    const [organizations, setOrganizations] = useState<IOrganizationDetails[]>([])
    const [supplierId, setSupplierId] = useState<number>(0)

    // Покупатель - контрагент из базы либо ручной ввод
    const [query, setQuery] = useState<string>('')
    const [found, setFound] = useState<ICounterparty[]>([])
    const [searching, setSearching] = useState<boolean>(false)
    const [buyer, setBuyer] = useState<ICounterparty | null>(null)
    const [manual, setManual] = useState<boolean>(false)

    const [formData, setFormData] = useState<IFormData>({
        basis: '',
        buyerName: '',
        buyerInn: '',
        buyerKpp: '',
        buyerInd: '',
        buyerAddress: '',
        buyerPhone: null,
        items: [],
        fromFile: fromFile ? fromFile === '1' : false,
    })

    const [selectedItem, setSelectedItem] = useState<IItem>({} as IItem)
    const [newItem, setNewItem] = useState<IItem>({ id: 0, name: '', price: 1, amount: 1, unit: 'шт' })
    const [permittedOperations, setPermittedOperations] = useState<TPermittedOperations>('none')

    const supplier = organizations.find(o => o.id === supplierId) || null
    const account = supplier?.accounts[0] || null

    useEffect(() => {
        fetchOrganizations()
            .then((list) => {
                setOrganizations(list)
                // Подставляем ту организацию, что выбрана в шапке приложения
                const preferred = list.find(o => o.id === organization?.id) || list.find(o => o.isDefault) || list[0]
                if (preferred) setSupplierId(preferred.id)
            })
            .catch(e => setSendError(e instanceof Error ? e.message : String(e)))
    }, [organization])

    // Поиск контрагентов идет на сервере, поэтому не дергаем его на каждую
    // букву: ждем, пока человек допечатает
    useEffect(() => {
        if (manual || buyer) return

        const text = query.trim()
        if (text.length < 2) {
            setFound([])

            return
        }

        setSearching(true)
        const timer = window.setTimeout(() => {
            fetchCounterparties(text, supplierId || undefined)
                .then(setFound)
                .catch(() => setFound([]))
                .finally(() => setSearching(false))
        }, 350)

        return () => {
            window.clearTimeout(timer)
            setSearching(false)
        }
    }, [query, supplierId, manual, buyer])

    const selectBuyer = (item: ICounterparty) => {
        setBuyer(item)
        setFound([])
        setQuery('')
        setErrors(prev => ({ ...prev, buyer: '' }))
    }

    const resetBuyer = () => {
        setBuyer(null)
        setManual(false)
        setQuery('')
    }

    const handleItemNameChange = (e: ChangeEvent<HTMLInputElement>) => setNewItem({ ...newItem, name: e.target.value })
    const handleItemAmountChange = (e: ChangeEvent<HTMLInputElement>) => setNewItem({ ...newItem, amount: Number(e.target.value) })
    const handleItemPriceChange = (e: ChangeEvent<HTMLInputElement>) => setNewItem({ ...newItem, price: Number(e.target.value) })

    const handleBack = (): void => {
        navigate(-1)
    }

    const handleSelectedItem = (item: IItem) => {
        if (item.id === selectedItem.id) {
            setSelectedItem({ id: 0, name: '', price: 1, amount: 1, unit: 'шт' })
        } else {
            setSelectedItem(item)
        }
    }

    const handleAddNewItem = (e: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
        e.stopPropagation()
        const lastId = formData.items.length ? formData.items[formData.items.length - 1].id : 0
        const copyItems = [...formData.items]
        copyItems.push({ id: lastId + 1, name: newItem.name.trim(), amount: newItem.amount, price: newItem.price, unit: newItem.unit || 'шт' })
        setFormData({ ...formData, items: copyItems })
        setNewItem({ id: 0, name: '', price: 1, amount: 1, unit: 'шт' })
    }

    const handleEditNewItem = (e: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
        e.stopPropagation()
        const copyItems = formData.items.map(i => (
            i.id === selectedItem.id
                ? { ...i, name: newItem.name.trim(), amount: newItem.amount, price: newItem.price, unit: newItem.unit || 'шт' }
                : i
        ))
        setFormData({ ...formData, items: copyItems })
    }

    const handleRemoveNewItem = (e: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
        e.stopPropagation()
        setFormData({ ...formData, items: formData.items.filter(i => i.id !== selectedItem.id) })
        setNewItem({ id: 0, name: '', price: 1, amount: 1, unit: 'шт' })
    }

    const handleTextInputChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ): void => {
        const { id, value } = e.target
        setFormData(prev => ({ ...prev, [id]: value }))

        if (errors[id as keyof IFormErrors]) {
            setErrors(prev => ({ ...prev, [id]: '' }))
        }
    }

    const validateForm = (): boolean => {
        const newErrors: IFormErrors = {} as IFormErrors

        if (!supplier) newErrors.buyer = 'Не выбрана организация-поставщик'
        if (!buyer && !manual) newErrors.buyer = 'Не выбран покупатель'

        if (manual) {
            if (!formData.buyerName.trim()) newErrors.buyerName = 'Наименование обязательно к заполнению'
            if (!formData.buyerInn.trim()) newErrors.buyerInn = 'ИНН обязателен к заполнению'
            if (!formData.buyerAddress.trim()) newErrors.buyerAddress = 'Адрес обязателен к заполнению'
        }

        if (!formData.fromFile && !formData.items.length) {
            newErrors.items = 'Нет ни одной строчки товаров/услуг'
        }

        setErrors(newErrors)

        return Object.keys(newErrors).length === 0
    }

    const onSendData = useCallback(async () => {
        if (!validateForm()) return

        setSendError('')
        try {
            await sendInvoice({
                organizationId: supplierId,
                counterpartyId: buyer ? buyer.id : 0,
                fromFile: formData.fromFile,
                basis: formData.basis,
                items: formData.items.map(i => ({ name: i.name, amount: i.amount, price: i.price, unit: i.unit || 'шт' })),
                buyerName: buyer ? buyer.name : formData.buyerName,
                buyerInn: buyer ? (buyer.inn || '') : formData.buyerInn,
                buyerKpp: buyer ? (buyer.kpp || '') : formData.buyerKpp,
                buyerInd: buyer ? '' : formData.buyerInd,
                buyerAddress: buyer ? (buyer.address || '') : formData.buyerAddress,
                buyerPhone: buyer ? buyer.phone : formData.buyerPhone,
            })
            onClose()
        } catch (e) {
            setSendError(e instanceof Error ? e.message : String(e))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, supplierId, buyer, manual])

    useEffect(() => {
        if (selectedItem.id !== undefined) setNewItem(selectedItem)
    }, [selectedItem])

    useEffect(() => {
        if (newItem.amount <= 0 || newItem.price <= 0 || !newItem.name.trim().length) {
            setPermittedOperations('none')
        } else {
            setPermittedOperations(newItem.id ? 'edit' : 'add')
        }
    }, [newItem])

    useEffect(() => {
        if (formData.items.length) setErrors(prev => ({ ...prev, items: '' }))
    }, [formData.items.length])

    // Отправка по главной кнопке Telegram
    useEffect(() => {
        return showMainButton('Выставить счет', onSendData)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onSendData])

    const total = formData.items.reduce((sum, i) => sum + i.amount * i.price, 0)

    return (
        <div className="form-container">
            <div className="form-header">
                <button
                    type="button"
                    className="back-button"
                    onClick={handleBack}
                    aria-label="Назад"
                >
                    ‹
                </button>
                <h1>📋 Создание <strong>счета</strong></h1>
                <p>Поставщик и покупатель берутся из базы 1С</p>
            </div>

            <form className="adaptive-form">
                <fieldset className="form-section">
                    <legend>🏢 Поставщик</legend>

                    <div className="input-group">
                        <label htmlFor="supplier" className="required">Организация</label>
                        <select
                            id="supplier"
                            value={supplierId}
                            onChange={(e) => setSupplierId(Number(e.target.value))}
                        >
                            {!organizations.length && <option value={0}>Организации не загружены</option>}
                            {organizations.map(o => (
                                <option key={o.id} value={o.id}>{o.name} · ИНН {o.inn}</option>
                            ))}
                        </select>
                    </div>

                    {/* Показываем реквизиты, которые уйдут в счет: их правка -
                        в 1С, поэтому здесь они только для проверки */}
                    {supplier && (
                        <div className="party-card">
                            <div className="party-line">ИНН {supplier.inn}{supplier.kpp ? ` · КПП ${supplier.kpp}` : ''}</div>
                            {supplier.address && <div className="party-line muted">{supplier.address}</div>}
                            {account
                                ? (
                                    <div className="party-line muted">
                                        Р/с {account.account}
                                        {account.bankName ? ` · ${account.bankName}` : ''}
                                        {account.bik ? ` · БИК ${account.bik}` : ''}
                                    </div>
                                )
                                : <div className="party-line error-message">В 1С нет банковского счета - счет выставить не получится</div>
                            }
                        </div>
                    )}
                </fieldset>

                <fieldset className="form-section">
                    <legend>👤 Покупатель</legend>

                    {buyer
                        ? (
                            <div className="party-card">
                                <div className="party-line"><strong>{buyer.name}</strong></div>
                                <div className="party-line muted">
                                    ИНН {buyer.inn || '—'}{buyer.kpp ? ` · КПП ${buyer.kpp}` : ''}
                                </div>
                                {buyer.address && <div className="party-line muted">{buyer.address}</div>}
                                <button type="button" className="tg-button secondary" onClick={resetBuyer}>
                                    Выбрать другого
                                </button>
                            </div>
                        )
                        : manual
                            ? (
                                <>
                                    <div className="input-group">
                                        <label htmlFor="buyerName" className="required">Наименование</label>
                                        <input
                                            id="buyerName"
                                            type="text"
                                            value={formData.buyerName}
                                            onChange={handleTextInputChange}
                                            placeholder="ООО Техно"
                                            className={errors.buyerName ? 'error' : ''}
                                        />
                                        {errors.buyerName && <span className="error-message">{errors.buyerName}</span>}
                                    </div>

                                    <div className="input-row">
                                        <div className="input-group half">
                                            <label htmlFor="buyerInn" className="required">ИНН</label>
                                            <input
                                                id="buyerInn"
                                                type="text"
                                                inputMode="numeric"
                                                value={formData.buyerInn}
                                                onChange={handleTextInputChange}
                                                placeholder="ИНН"
                                                className={errors.buyerInn ? 'error' : ''}
                                            />
                                            {errors.buyerInn && <span className="error-message">{errors.buyerInn}</span>}
                                        </div>
                                        <div className="input-group half">
                                            <label htmlFor="buyerKpp">КПП</label>
                                            <input
                                                id="buyerKpp"
                                                type="text"
                                                inputMode="numeric"
                                                value={formData.buyerKpp}
                                                onChange={handleTextInputChange}
                                                placeholder="КПП"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-row">
                                        <div className="input-group half">
                                            <label htmlFor="buyerInd">Индекс</label>
                                            <input
                                                id="buyerInd"
                                                type="text"
                                                inputMode="numeric"
                                                value={formData.buyerInd}
                                                onChange={handleTextInputChange}
                                                placeholder="Индекс"
                                            />
                                        </div>
                                        <div className="input-group half">
                                            <label htmlFor="buyerPhone">Телефон</label>
                                            <input
                                                id="buyerPhone"
                                                type="text"
                                                value={formData.buyerPhone || ''}
                                                onChange={handleTextInputChange}
                                                placeholder="+7 (999) 999-99-99"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="buyerAddress" className="required">Адрес</label>
                                        <input
                                            id="buyerAddress"
                                            type="text"
                                            value={formData.buyerAddress}
                                            onChange={handleTextInputChange}
                                            placeholder="Адрес"
                                            className={errors.buyerAddress ? 'error' : ''}
                                        />
                                        {errors.buyerAddress && <span className="error-message">{errors.buyerAddress}</span>}
                                    </div>

                                    <button type="button" className="tg-button secondary" onClick={resetBuyer}>
                                        Выбрать из базы
                                    </button>
                                </>
                            )
                            : (
                                <>
                                    <div className="input-group">
                                        <label htmlFor="buyerSearch" className="required">
                                            Найдите контрагента по названию или ИНН
                                        </label>
                                        <input
                                            id="buyerSearch"
                                            type="text"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Например, Техно или 7724727585"
                                            autoComplete="off"
                                            className={errors.buyer ? 'error' : ''}
                                        />
                                        {errors.buyer && <span className="error-message">{errors.buyer}</span>}
                                    </div>

                                    {searching && <p className="muted">Ищем...</p>}

                                    {!searching && query.trim().length >= 2 && !found.length && (
                                        <p className="muted">Ничего не нашлось. Проверьте написание или введите покупателя вручную.</p>
                                    )}

                                    {found.length > 0 && (
                                        <div className="search-results">
                                            {found.map(item => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className="search-result"
                                                    onClick={() => selectBuyer(item)}
                                                >
                                                    <span className="search-result-name">{item.name}</span>
                                                    <span className="search-result-inn">
                                                        ИНН {item.inn || '—'}{item.kpp ? ` · КПП ${item.kpp}` : ''}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <button type="button" className="tg-button secondary" onClick={() => setManual(true)}>
                                        Ввести вручную
                                    </button>
                                </>
                            )
                    }
                </fieldset>

                <fieldset className="form-section">
                    <legend>📑 Основание</legend>
                    <div className="input-group">
                        <label htmlFor="basis">Договор или основание поставки</label>
                        <input
                            id="basis"
                            type="text"
                            value={formData.basis}
                            onChange={handleTextInputChange}
                            placeholder="Основной договор 26/09 от 26.09.2022"
                        />
                        {/* В 1С это ссылка на договор, у нас - текст: договоров
                            в справочниках бота нет, а строка печатается как есть */}
                        <span className="muted">Если оставить пустым, в счете будет «Без договора»</span>
                    </div>
                </fieldset>

                {!formData.fromFile &&
                    <fieldset className="form-section">
                        <legend>📄 Список работ/услуг</legend>
                        <div className="input-group">
                            {formData.items.length
                                ? (
                                    <div className="priority-buttons" style={{ flexDirection: 'column' }}>
                                        {formData.items.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`priority-btn ${selectedItem.id === item.id ? 'active' : ''}`}
                                                onClick={() => handleSelectedItem(item)}
                                            >
                                                {item.name} · {item.amount} {item.unit} × {item.price}
                                            </button>
                                        ))}
                                    </div>
                                )
                                : null
                            }
                            {errors.items && <span className="error-message">{errors.items}</span>}
                        </div>

                        <div className="input-group">
                            <input
                                id="itemName"
                                type="text"
                                value={newItem.name}
                                onChange={handleItemNameChange}
                                placeholder="Наименование товара/услуги"
                            />
                        </div>

                        <div className="input-row">
                            <div className="input-group half">
                                <label htmlFor="itemAmount" className="required">Количество</label>
                                <input
                                    id="itemAmount"
                                    type="number"
                                    value={newItem.amount}
                                    onChange={handleItemAmountChange}
                                    placeholder="Количество"
                                    min={1}
                                    step="0.01"
                                />
                            </div>
                            <div className="input-group half">
                                <label htmlFor="itemUnit">Ед. изм.</label>
                                <input
                                    id="itemUnit"
                                    type="text"
                                    value={newItem.unit}
                                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                                    placeholder="шт"
                                />
                            </div>
                        </div>

                        <div className="input-row">
                            <div className="input-group half">
                                <label htmlFor="itemPrice" className="required">Цена</label>
                                <input
                                    id="itemPrice"
                                    type="number"
                                    min={0.01}
                                    step="0.01"
                                    value={newItem.price}
                                    onChange={handleItemPriceChange}
                                    placeholder="Цена"
                                />
                            </div>
                        </div>

                        <div className="input-group" style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                            {permittedOperations !== 'none' &&
                                <input
                                    type="button"
                                    id="buttonAddItem"
                                    className="tg-button secondary"
                                    style={{ fontSize: '14px' }}
                                    onClick={handleAddNewItem}
                                    value="Добавить"
                                />
                            }
                            {permittedOperations === 'edit' &&
                                <>
                                    <input
                                        id="buttonEditItem"
                                        type="button"
                                        className="tg-button primary"
                                        style={{ fontSize: '14px' }}
                                        onClick={handleEditNewItem}
                                        value="Изменить"
                                    />
                                    <input
                                        id="buttonRemoveItem"
                                        type="button"
                                        className="tg-button danger"
                                        style={{ fontSize: '14px' }}
                                        onClick={handleRemoveNewItem}
                                        value="Удалить"
                                    />
                                </>
                            }
                        </div>

                        {total > 0 && <p className="muted">Итого: {total.toLocaleString('ru-RU')} ₽</p>}
                    </fieldset>
                }

                {errors.buyer && !manual && !buyer && <span className="error-message">{errors.buyer}</span>}
                {sendError && <span className="error-message">{sendError}</span>}

                {/* В Telegram отправку делает родная кнопка внизу окна -
                    своя нужна только в браузере */}
                {!hasMainButton && (
                    <button type="button" className="tg-button primary" onClick={onSendData}>
                        Выставить счет
                    </button>
                )}
            </form>
        </div>
    )
}

export default InvoiceForPayment
