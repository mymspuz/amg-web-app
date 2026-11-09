import { IBankAccount } from '../api/client'

// Счет цифрового рубля не подходит для обычной оплаты: в печатной форме
// вместо банка и БИК оказывается идентификатор кошелька
export const isDigitalAccount = (account: Pick<IBankAccount, 'account' | 'bankName'>): boolean =>
    account.account.replace(/\s/g, '').length !== 20 || /цифров/i.test(account.bankName || '')

// В списке видно банк и последние цифры номера, а не двадцатизначную строку
export const accountLabel = (account: Pick<IBankAccount, 'account' | 'bankName'>): string => {
    const digits = account.account.replace(/\s/g, '')
    const tail = digits.length >= 4 ? digits.slice(-4) : digits
    const bank = isDigitalAccount(account) ? 'Цифровой рубль' : (account.bankName || 'Банк не указан')

    return `···${tail} · ${bank}`
}

// Обычные расчетные счета выше счетов цифрового рубля, основной - первым
export const sortAccounts = (accounts: IBankAccount[]): IBankAccount[] =>
    [...accounts].sort((a, b) => {
        const digital = Number(isDigitalAccount(a)) - Number(isDigitalAccount(b))
        if (digital) return digital
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1

        return a.account.localeCompare(b.account)
    })

// Какой счет подставить, пока человек сам не выбрал. Цифровой рубль
// не берем, даже если в 1С он записан основным
export const preferredAccount = (accounts: IBankAccount[]): IBankAccount | undefined => {
    const sorted = sortAccounts(accounts)

    return sorted.find(a => a.isDefault && !isDigitalAccount(a))
        || sorted.find(a => !isDigitalAccount(a))
        || sorted[0]
}
