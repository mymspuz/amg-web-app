import React, { useEffect, useRef, useState } from 'react'

import { fetchCashflowItems, fetchContracts, IContract, IPaymentDetails } from '../../api/client'

interface IProps {
    organizationId: number
    // Поставщик в справочнике базы: без него договоры не загрузить
    counterpartyId: number | null
    sum: number | null
    // НДС, распознанный в счете поставщика
    recognizedVat?: { rate: number | null, amount: number } | null
    onChange: (details: IPaymentDetails) => void
}

// Ставки, которые бывают в платежках. 22% - с 2026 года
const VAT_RATES = [22, 20, 10, 7, 5, 0]

// Договоры, по которым платят поставщику. Договоры с покупателем и займы
// в платежке поставщику не нужны
const SUPPLIER_KINDS = ['СПоставщиком', 'СКомиссионеромНаЗакупку', 'Прочее', '', null]

const money = (value: number): string => (Math.round(value * 100) / 100).toFixed(2)

// Договор, статья движения денежных средств и НДС платежки поставщику.
// Раньше этих полей не было: 1С брала первый попавшийся договор, ставила
// НДС ноль, а статью бухгалтер дописывал руками
const SupplierPaymentDetails = ({ organizationId, counterpartyId, sum, recognizedVat, onChange }: IProps) => {
    const [contracts, setContracts] = useState<IContract[]>([])
    const [contractId, setContractId] = useState<number>(0)
    const [items, setItems] = useState<{ id: number, name: string }[]>([])
    const [cashflowItemId, setCashflowItemId] = useState<number>(0)

    // '' - не указана, 'none' - без НДС, иначе ставка
    const [vatRate, setVatRate] = useState<string>('')
    const [vatSum, setVatSum] = useState<string>('')
    // Сумму налога пересчитываем сами, пока человек не поправил ее руками
    const vatSumTouched = useRef(false)

    // Распознанный НДС подставляем один раз: состояние приложения
    // обновляется в фоне и не должно затирать выбор человека
    const vatApplied = useRef(false)
    useEffect(() => {
        if (!recognizedVat || vatApplied.current) return

        vatApplied.current = true
        setVatRate(recognizedVat.rate === null ? 'none' : String(recognizedVat.rate))
        setVatSum(money(recognizedVat.amount))
        vatSumTouched.current = true
    }, [recognizedVat])

    useEffect(() => {
        if (!counterpartyId || !organizationId) {
            setContracts([])
            setContractId(0)

            return
        }

        fetchContracts(counterpartyId, organizationId)
            .then((data) => {
                const forSupplier = data.items.filter(c => SUPPLIER_KINDS.includes(c.kind))
                setContracts(forSupplier)
                // Основной договор с поставщиком подставляем сами
                const main = forSupplier.find(c => c.isMain && c.kind === 'СПоставщиком')
                    || forSupplier.find(c => c.kind === 'СПоставщиком')
                setContractId(main ? main.id : 0)
            })
            .catch(() => setContracts([]))
    }, [counterpartyId, organizationId])

    useEffect(() => {
        if (!organizationId) return

        fetchCashflowItems(organizationId)
            .then(setItems)
            .catch(() => setItems([]))
    }, [organizationId])

    useEffect(() => {
        if (vatSumTouched.current) return

        const rate = Number(vatRate)
        setVatSum(vatRate && vatRate !== 'none' && sum ? money(sum * rate / (100 + rate)) : '')
    }, [vatRate, sum])

    useEffect(() => {
        onChange({
            contractId: contractId || undefined,
            cashflowItemId: cashflowItemId || undefined,
            vatRate: vatRate === '' ? undefined : vatRate === 'none' ? 'none' : Number(vatRate),
            vatSum: vatRate && vatRate !== 'none' && vatSum !== '' ? Number(vatSum.replace(',', '.')) : undefined,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contractId, cashflowItemId, vatRate, vatSum])

    return (
        <fieldset className="form-section">
            <legend>📄 Договор, статья и НДС</legend>

            <div className="input-group">
                <label htmlFor="contract">Договор</label>
                <select id="contract" value={contractId} onChange={(e) => setContractId(Number(e.target.value))}>
                    <option value={0}>Основной договор с поставщиком (определит 1С)</option>
                    {contracts.map(c => (
                        <option key={c.id} value={c.id}>{c.title}{c.isMain ? ' · основной' : ''}</option>
                    ))}
                </select>
                {!counterpartyId && (
                    <span className="hint">Поставщика нет в справочнике 1С - договор подберет 1С</span>
                )}
            </div>

            <div className="input-group">
                <label htmlFor="cashflowItem">Статья движения денежных средств</label>
                <select id="cashflowItem" value={cashflowItemId} onChange={(e) => setCashflowItemId(Number(e.target.value))}>
                    <option value={0}>Как в прошлых платежах этому поставщику</option>
                    {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                </select>
            </div>

            <div className="input-group">
                <label htmlFor="vatRate">НДС</label>
                <select
                    id="vatRate"
                    value={vatRate}
                    onChange={(e) => {
                        vatSumTouched.current = false
                        setVatRate(e.target.value)
                    }}
                >
                    <option value="">Не указывать</option>
                    <option value="none">Без НДС</option>
                    {VAT_RATES.map(r => (
                        <option key={r} value={String(r)}>{r}%</option>
                    ))}
                </select>
                {recognizedVat && <span className="hint">Распознано в счете</span>}
            </div>

            {vatRate && vatRate !== 'none' && (
                <div className="input-group">
                    <label htmlFor="vatSum">Сумма НДС</label>
                    <input
                        id="vatSum"
                        type="number"
                        step="0.01"
                        min="0"
                        value={vatSum}
                        onChange={(e) => {
                            vatSumTouched.current = true
                            setVatSum(e.target.value)
                        }}
                    />
                </div>
            )}
        </fieldset>
    )
}

export default SupplierPaymentDetails
