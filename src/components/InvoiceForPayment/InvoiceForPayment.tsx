import React, {useState, FormEvent, ChangeEvent, useEffect, useCallback} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useTelegram } from '../../hooks/useTelegram'

import './InvoiceForPayment.css'

import counterpartiesJson from '../../data/counterparty.json'

interface IItem {
    id: number
    name: string
    amount: number
    price: number
}
interface IFormData {
    buyerName: string
    buyerInn: number
    buyerKpp: number
    buyerInd: number
    buyerAddress: string
    buyerPhone: string | null
    counterpartyId: number
    items: IItem[]
    fromFile: boolean
}

interface IFormErrors {
    buyerName: string
    buyerInn: string
    buyerKpp: string
    buyerInd: string
    buyerAddress: string
    buyerPhone: string
    items: string
}

interface ICounterparty {
    id: number
    name: string
    inn: number
    kpp: number
    ind: number
    address: string
    phone: string | null
    bank: {
        name: string
        bik: string
        check1: string
        check2: string
    },
    items: string[]
}

type TPermittedOperations = 'none' | 'add' | 'edit'

const InvoiceForPayment = () => {
    const { tg, queryId, user, chat} = useTelegram()

    const [errors, setErrors] = useState<IFormErrors>({} as IFormErrors);

    const navigate = useNavigate()
    const [search, setSearch] = useSearchParams()
    const counterpartyId = Number(search.get('counterpartyId'))
    const fromFile = search.get('fromFile')
    const counterparties = [...counterpartiesJson]
    if (!counterparties.find(i => i.id === 0)) {
        counterparties.push({
            id: 0,
            name: 'Ввести вручную',
            phone: null,
            kpp: 0,
            address: '',
            ind: 0,
            inn: 0,
            bank: {
                name: '',
                bik: '',
                check1: '',
                check2: ''
            },
            items: []
        })
    }

    const counterparty: ICounterparty = counterparties.find(i => i.id === counterpartyId) ? counterparties.filter(i => i.id === counterpartyId)[0] : {} as ICounterparty
    const [buyer, setBuyer] = useState<number>(counterparties[0].id)
    const [buyerItems, setBuyerItems] = useState<{ id: number, label: string }[]>([])
    const [buyerItemsSelected, setBuyerItemsSelected] = useState<number>(-1)
    const [formData, setFormData] = useState<IFormData>({
        buyerName: '',
        buyerInn: 0,
        buyerKpp: 0,
        buyerInd: 0,
        buyerAddress: '',
        buyerPhone: null,
        counterpartyId: counterpartyId,
        items: [],
        fromFile: fromFile ? fromFile === 'true' : false
    } as IFormData)
    const [selectedItem, setSelectedItem] = useState<IItem>({} as IItem)
    const [newItem, setNewItem] = useState<IItem>({ id: 0, name: '', price: 1, amount: 1})
    const [permittedOperations, setPermittedOperations] = useState<TPermittedOperations>('none')

    function onChangeBuyer(e: { target: { value: any } }) {
        setBuyer(Number(e.target.value))
    }

    function onChangeBuyerItems(e: { target: { value: any } }) {
        setBuyerItemsSelected(Number(e.target.value))
    }

    function handleItemNameChange(e: ChangeEvent<HTMLInputElement>) {
        setNewItem({ ...newItem, name: e.target.value.trim() })
    }

    function handleItemAmountChange(e: ChangeEvent<HTMLInputElement>) {
        setNewItem({ ...newItem, amount: Number(e.target.value) })
    }

    function handleItemPriceChange(e: ChangeEvent<HTMLInputElement>) {
        setNewItem({ ...newItem, price: Number(e.target.value) })
    }

    const handleBack = (): void => {
        navigate(-1)
    }

    const handleSelectedItem = (item: IItem) => {
        if (item.id === selectedItem.id) {
            setSelectedItem({ id: 0, name: '', price: 1, amount: 1 })
        } else {
            setSelectedItem(item)
        }
    }

    const handleAddNewItem = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        const lastId = formData?.items?.length ? formData.items[formData.items.length - 1].id : 0
        const copyItems = formData?.items?.length ? [...formData.items] : []
        copyItems.push({ id: lastId + 1, name: newItem.name, amount: newItem.amount, price: newItem.price })
        setFormData({ ...formData, items: copyItems })
        setNewItem({ id: 0, name: '', price: 1, amount: 1})
        setBuyerItemsSelected(-1)
    }

    const handleEditNewItem = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        const copyItems = formData?.items?.length ? [...formData.items] : []
        copyItems.forEach(i => {
            if (i.id === selectedItem.id) {
                i.name = newItem.name
                i.amount = newItem.amount
                i.price = newItem.price
            }
        })
        setFormData({ ...formData, items: copyItems })
    }

    const handleRemoveNewItem = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        const copyItems = formData.items.filter(i => i.id !== selectedItem.id)
        setFormData({ ...formData, items: copyItems })
        setNewItem({ id: 0, name: '', price: 1, amount: 1})
    }

    const handleInputChange = (
        field: keyof FormData,
        value: string | boolean | string[]
    ): void => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Очищаем ошибку при изменении поля
        if (errors[field as keyof IFormErrors]) {
            setErrors(prev => ({
                ...prev,
                [field]: undefined
            }));
        }
    }

    const handleTextInputChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ): void => {
        const { id, value } = e.target
        handleInputChange(id as keyof FormData, value)
    }

    const validateForm = (): boolean => {
        if (!Object.keys(formData).length) return false

        const newErrors: IFormErrors = {} as IFormErrors

        if (!formData.buyerName.trim().length) {
            newErrors.buyerName = 'Наименование обязательно к заполнению'
        }

        if (!formData.buyerInn) {
            newErrors.buyerInn = 'ИНН обязательно к заполнению'
        }

        if (!formData.buyerKpp) {
            newErrors.buyerKpp = 'КПП обязательно к заполнению'
        }

        if (!formData.buyerInd) {
            newErrors.buyerInd = 'Индекс обязательно к заполнению'
        }

        if (!formData.buyerAddress) {
            newErrors.buyerAddress = 'Адрес обязательно к заполнению'
        }

        if (formData.fromFile && !formData?.items?.length) {
            newErrors.items = 'Нет ни одной строчки товаров/услуг'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const onSendData = useCallback(async () => {
        tg.sendData(JSON.stringify({
            type: 'invent',
            data: formData,
            counterpartyId
        }));
    }, [formData, counterpartyId])

    useEffect(() => {
        const selectedBuyer = counterparties.filter(b => b.id === buyer)[0]
        const res = selectedBuyer.items.map((i, ind) => ({ id: ind, label: i }))
        res.unshift({ id: -1, label: '' })
        setBuyerItems(res)
    }, [buyer])

    useEffect(() => {
        const selectedBuyer = counterparties.filter(b => b.id === buyer)[0]
        setFormData({
            ...formData,
            buyerName: selectedBuyer.name,
            buyerInn: selectedBuyer.inn,
            buyerKpp: selectedBuyer.kpp,
            buyerInd: selectedBuyer.ind,
            buyerAddress: selectedBuyer.address,
            buyerPhone: selectedBuyer.phone
        })
    }, [buyerItems])

    useEffect(() => {
        if (buyerItemsSelected !== undefined) {
            if (buyerItemsSelected !== -1) {
                const selectedBuyerItem = buyerItems.filter(b => b.id === buyerItemsSelected)[0]
                setNewItem({ ...newItem, name: selectedBuyerItem.label })
            } else {
                if (newItem) setNewItem({ ...newItem, name: '' })
            }
        }
    }, [buyerItemsSelected])

    useEffect(() => {
        if (selectedItem.id !== undefined) setNewItem(selectedItem)
    }, [selectedItem])

    useEffect(() => {
        if (newItem.amount <= 0 || newItem.price <= 0 || newItem.name.trim().length === 0) {
            setPermittedOperations('none')
        } else {
            setPermittedOperations(newItem.id ? 'edit' : 'add')
        }
    }, [newItem])

    useEffect(() => {
        if (formData?.items?.length) setErrors({ ...errors, items: '' })
        console.log('formData - ', formData)
        validateForm() ? tg.MainButton.show() : tg.MainButton.hide()
    }, [formData])

    useEffect(() => {
        tg.onEvent('mainButtonClicked', onSendData)
        return () => {
            tg.offEvent('mainButtonClicked', onSendData)
        }
    }, [onSendData])

    useEffect(() => {
        tg.MainButton.setParams({
            text: 'Отправить данные'
        })
    }, [])

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
                <p>Заполните форму для создания нового счета от {counterparty.name}</p>
            </div>

            <form className="adaptive-form">
                {/* Основная информация */}
                <fieldset className="form-section">
                    <legend>👤 Покупатель</legend>

                    <div className="input-group">
                        <label htmlFor="buyer" className="required">
                            Укажите покупателя
                        </label>
                        <select
                            id="buyer"
                            value={buyer}
                            onChange={onChangeBuyer}
                            className={''}
                        >
                            {counterparties.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                        </select>
                    </div>
                    {buyer === 0 &&
                        <>
                            <div className="input-group">
                                <label htmlFor="buyerName" className="required">
                                    Наименование
                                </label>
                                <input
                                    id="buyerName"
                                    type="text"
                                    value={formData.buyerName}
                                    onChange={handleTextInputChange}
                                    placeholder="ООО Техно"
                                    required
                                    className={errors.buyerName ? 'error' : ''}
                                />
                                {errors.buyerName && <span className="error-message">{errors.buyerName}</span>}
                            </div>

                            <div className="input-row">
                                <div className="input-group half">
                                    <label htmlFor="buyerInn" className="required">
                                        ИНН
                                    </label>
                                    <input
                                        id="buyerInn"
                                        type="number"
                                        value={formData.buyerInn}
                                        onChange={handleTextInputChange}
                                        placeholder="ИНН"
                                        required
                                        className={errors.buyerInn ? 'error' : ''}
                                    />
                                    {errors.buyerInn && <span className="error-message">{errors.buyerInn}</span>}
                                </div>
                                <div className="input-group half">
                                    <label htmlFor="buyerKpp" className="required">
                                        КПП
                                    </label>
                                    <input
                                        id="buyerKpp"
                                        type="number"
                                        value={formData.buyerKpp}
                                        onChange={handleTextInputChange}
                                        placeholder="КПП"
                                        required
                                        className={errors.buyerKpp ? 'error' : ''}
                                    />
                                    {errors.buyerKpp && <span className="error-message">{errors.buyerKpp}</span>}
                                </div>
                            </div>

                            <div className="input-row">
                                <div className="input-group half">
                                    <label htmlFor="buyerInd" className="required">
                                        Индекс
                                    </label>
                                    <input
                                        id="buyerInd"
                                        type="number"
                                        value={formData.buyerInd}
                                        onChange={handleTextInputChange}
                                        placeholder="Индекс"
                                        required
                                        className={errors.buyerInd ? 'error' : ''}
                                    />
                                    {errors.buyerInd && <span className="error-message">{errors.buyerInd}</span>}
                                </div>
                                <div className="input-group half">
                                    <label htmlFor="buyerPhone">
                                        Телефон
                                    </label>
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
                                <label htmlFor="buyerAddress" className="required">
                                    Адрес
                                </label>
                                <input
                                    id="buyerAddress"
                                    type="text"
                                    value={formData.buyerAddress}
                                    onChange={handleTextInputChange}
                                    placeholder="Адрес"
                                    required
                                    className={errors.buyerAddress ? 'error' : ''}
                                />
                                {errors.buyerAddress && <span className="error-message">{errors.buyerAddress}</span>}
                            </div>
                        </>
                    }
                </fieldset>

                {!formData.fromFile &&
                    <fieldset className="form-section">
                        <legend>📄 Список работ/услуг</legend>
                        <div className="input-group">
                            {formData?.items?.length
                                ?
                                <div className="priority-buttons" style={{flexDirection: 'column'}}>
                                    {formData.items.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`priority-btn ${
                                                selectedItem.id === item.id ? 'active' : ''
                                            }`}
                                            onClick={() => handleSelectedItem(item)}
                                        >
                                            {item.name} ** {item.amount} ** {item.price}
                                        </button>
                                    ))}
                                </div>

                                :
                                null
                            }
                            {errors.items && <span className="error-message">{errors.items}</span>}
                        </div>
                        {buyerItems?.length > 1 &&
                            <div className="input-group">
                                <label htmlFor="buyerItems" className="required">
                                    Можете использовать существующие
                                </label>
                                <select
                                    id="buyerItems"
                                    value={buyerItemsSelected as number}
                                    onChange={onChangeBuyerItems}
                                    className={''}
                                >
                                    {buyerItems.map(i => (
                                        <option key={i.id} value={i.id}>{i.label}</option>
                                    ))}
                                </select>
                            </div>
                        }

                        <div className="input-group">
                            <input
                                id="itemName"
                                type="text"
                                value={newItem.name}
                                onChange={handleItemNameChange}
                                placeholder="Наименование товара/услуги"
                                className={''}
                            />
                        </div>

                        <div className="input-row">
                            <div className="input-group half">
                                <label htmlFor="itemAmount" className="required">
                                    Количество
                                </label>
                                <input
                                    id="itemAmount"
                                    type="number"
                                    value={newItem.amount}
                                    onChange={handleItemAmountChange}
                                    placeholder="Количество"
                                    min={1}
                                    step="0.01"
                                    required
                                    className={''}
                                />
                            </div>
                            <div className="input-group half">
                                <label htmlFor="itemPrice" className="required">
                                    Цена
                                </label>
                                <input
                                    id="itemPrice"
                                    type="number"
                                    min={0.01}
                                    step="0.01"
                                    value={newItem.price}
                                    onChange={handleItemPriceChange}
                                    placeholder="Цена"
                                    required
                                    className={''}
                                />
                            </div>
                        </div>

                        <div className="input-group" style={{display: 'flex', justifyContent: 'center', gap: '5px'}}>
                            {permittedOperations !== 'none' &&
                                <button
                                    id="buttonAddItem"
                                    className="tg-button secondary"
                                    style={{fontSize: '14px'}}
                                    onClick={(e) => handleAddNewItem(e)}
                                >
                                    Добавить
                                </button>
                            }
                            {permittedOperations === 'edit' &&
                                <>
                                    <button
                                        id="buttonEditItem"
                                        className="tg-button primary"
                                        style={{fontSize: '14px'}}
                                        onClick={(e) => handleEditNewItem(e)}
                                    >
                                        Изменить
                                    </button>
                                    <button
                                        id="buttonRemoveItem"
                                        className="tg-button danger"
                                        style={{fontSize: '14px'}}
                                        onClick={(e) => handleRemoveNewItem(e)}
                                    >
                                        Удалить
                                    </button>
                                </>
                            }
                        </div>
                    </fieldset>
                }

                {/* Кнопки действий */}
                {/*<div className="form-actions">*/}
                {/*    /!*<button type="button" className="btn-secondary" onClick={handleBack}>*!/*/}
                {/*    /!*    Отмена*!/*/}
                {/*    /!*</button>*!/*/}
                {/*    <button type="submit" className="btn-primary">*/}
                {/*        Создать документ*/}
                {/*    </button>*/}
                {/*</div>*/}
            </form>
        </div>
    )
}

export default InvoiceForPayment