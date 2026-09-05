import axios from 'axios'

// Адрес бота. На проде приложение и api на одном домене, поэтому переменная
// пустая и запросы идут относительно текущего адреса. Локально - отдельный порт.
// Именно ?? , а не ||: пустая строка тут осмысленное значение
const API_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:3001'

const api = axios.create({ baseURL: `${API_URL}/api` })

// initData подписан телеграмом - по нему сервер понимает, что за пользователь пришел.
// Ни chatId, ни имя больше не передаем: подделать подпись нельзя
api.interceptors.request.use((config) => {
    const initData = window.Telegram?.WebApp?.initData || process.env.REACT_APP_DEV_INIT_DATA || ''
    if (initData) config.headers.Authorization = `tma ${initData}`

    return config
})

export type TAccessStatus = 'pending' | 'active' | 'blocked'
export type TPermission = 'view' | 'create' | 'confirm' | 'approve'

export interface IOrganization {
    id: number
    name: string
    inn: string
    // Из какой базы 1С организация
    baseId: number | null
    permissions: TPermission[]
    isDefault: boolean
}

export interface IBaseState {
    id: number
    name: string
    isDefault: boolean
    // Справочники выгружены - стороны счета проверяются без обращения к 1С
    catalogReady: boolean
    // База опрашивала очередь только что
    online: boolean
    lastSeenAt: string | null
}

// Связь с 1С: обработка обмена опрашивает очередь непрерывно, поэтому
// свежая отметка опроса и означает живое соединение
export interface IOneCState {
    online: boolean
    total: number
    onlineCount: number
    lastSeenAt: string | null
}

export interface IChatState {
    status: boolean
    fullName: string
    user: {
        role: string
        accessStatus: TAccessStatus
        hasConsent: boolean
    }
    organizations: IOrganization[]
    bases: IBaseState[]
    oneC: IOneCState
    // Загружены строки товаров из файла
    hasItems: boolean
    itemsCount: number
    // Данные счета подтверждены 1С - можно делать платежку
    hasInvoice: boolean
    invoice: {
        supplierINN: string | null
        buyerINN: string | null
        sum: number | null
    }
}

export interface IInvoiceRequest {
    organizationId: number
    // Контрагент из базы 1С. Ноль - покупателя вводят вручную
    counterpartyId: number
    fromFile: boolean
    // Основание печатается в шапке счета: договор или разовая поставка
    basis: string
    items: { name: string, amount: number, price: number, unit: string }[]
    buyerName: string
    buyerInn: string
    buyerKpp: string
    buyerInd: string
    buyerAddress: string
    buyerPhone: string | null
}

// Контрагент базы: покупатель в счете
export interface ICounterparty {
    id: number
    name: string
    inn: string | null
    kpp: string | null
    address: string | null
    phone: string | null
}

export interface IBankAccount {
    account: string
    bik: string | null
    bankName: string | null
    corrAccount: string | null
    isDefault: boolean
}

// Организация со всеми реквизитами: поставщик в счете
export interface IOrganizationDetails extends IOrganization {
    kpp: string | null
    address: string | null
    phone: string | null
    accounts: IBankAccount[]
}

// Виды операций из ТЗ. Файл можно приложить не ко всем: перевод себе
// и между своими счетами вводят только руками
export type TPaymentKind = 'self_card' | 'supplier' | 'between_accounts' | 'salary'

export interface IPaymentDraft {
    kind: TPaymentKind
    organizationId: number
    sum?: string
    comment?: string
    counterpartyId?: number
    supplierINN?: string
    supplierAccount?: string
    fromAccount?: string
    toAccount?: string
    employeeName?: string
    employeeAccount?: string
}

// Возвращает uuid заявки: дальше открывается карточка подтверждения -
// та же, что и после распознавания счета
export const createPayment = async (draft: IPaymentDraft, file?: File | null): Promise<string> => {
    const form = new FormData()
    Object.entries(draft).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') form.append(key, String(value))
    })
    if (file) form.append('file', file)

    try {
        const { data } = await api.post<{ status: boolean, uuid: string }>('/payments', form)

        return data.uuid
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const fetchOrganizations = async (): Promise<IOrganizationDetails[]> => {
    const { data } = await api.get<{ status: boolean, items: IOrganizationDetails[] }>('/organizations')

    return data.items
}

// Поиск идет на сервере: справочник в базе, а не в приложении
export const fetchCounterparties = async (
    search: string,
    organizationId?: number
): Promise<ICounterparty[]> => {
    const { data } = await api.get<{ status: boolean, items: ICounterparty[] }>('/counterparties', {
        params: { search: search || undefined, organizationId, limit: 30 },
    })

    return data.items
}

// Текст ошибки от сервера, а не «Request failed with status code 409»
const errorText = (error: any): string =>
    error?.response?.data?.error || error?.message || 'Не удалось связаться с ботом'

export const fetchState = async (): Promise<IChatState> => {
    const { data } = await api.get<IChatState>('/state')
    return data
}

export const acceptConsent = async (): Promise<void> => {
    try {
        await api.post('/consent')
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const sendPaymentOrder = async (comment: string, organizationId: number): Promise<void> => {
    try {
        await api.post('/payment-order', { comment, organizationId })
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const sendInvoice = async (invoice: IInvoiceRequest): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, invoiceNumber: string }>('/invoice', invoice)
        return data.invoiceNumber
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const resetData = async (): Promise<void> => {
    try {
        await api.post('/reset')
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export interface ICheckWarning {
    code: string
    // strong - потребуется согласование бухгалтером
    level: 'warning' | 'strong'
    message: string
}

export interface IRequestCard {
    uuid: string
    type: string
    // Вид операции у платежей: от него зависят поля карточки
    paymentKind: TPaymentKind | null
    status: string
    statusTitle: string
    // После отправки в 1С править поздно
    editable: boolean
    payload: { supplierINN?: string, buyerINN?: string, sum?: number, [key: string]: any }
    warnings: ICheckWarning[]
    recognized: { supplierINN?: string, buyerINN?: string, sum?: number } | null
    organizationId: number | null
    createdAt: string
}

export const fetchRequest = async (uuid: string): Promise<IRequestCard> => {
    const { data } = await api.get<{ status: boolean, request: IRequestCard }>(`/requests/${uuid}`)
    return data.request
}

// Подтверждение карточки: сюда же уходят правки пользователя
export const confirmRequest = async (
    uuid: string,
    values: { supplierINN: string, buyerINN: string, sum: number, comment?: string }
): Promise<string[]> => {
    try {
        const { data } = await api.post<{ status: boolean, corrected: string[] }>(`/requests/${uuid}/confirm`, values)
        return data.corrected
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const cancelRequest = async (uuid: string): Promise<void> => {
    try {
        await api.post(`/requests/${uuid}/cancel`)
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export interface IRequestListItem {
    uuid: string
    type: string
    status: string
    statusTitle: string
    // Заголовок заявки: платеж, акт сверки или отчет
    title?: string | null
    sum: number | null
    supplierINN: string | null
    doc: string | null
    error: string | null
    createdAt: string
}

export type TRequestScope = 'active' | 'completed' | 'all'

export const fetchRequests = async (scope: TRequestScope = 'all', type?: string): Promise<IRequestListItem[]> => {
    const { data } = await api.get<{ status: boolean, requests: IRequestListItem[] }>('/requests', {
        params: { scope, type },
    })
    return data.requests
}

export interface IRequestEvent {
    status: string
    statusTitle: string
    comment: string | null
    // user, 1c, accountant или system
    actor: string
    createdAt: string
}

export const fetchRequestEvents = async (uuid: string): Promise<IRequestEvent[]> => {
    const { data } = await api.get<{ status: boolean, events: IRequestEvent[] }>(`/requests/${uuid}/events`)
    return data.events
}

// Загрузка счета из приложения: файл уходит на разбор, дальше - карточка
export const uploadInvoice = async (file: File, organizationId: number): Promise<string> => {
    const form = new FormData()
    form.append('file', file)
    form.append('organizationId', String(organizationId))

    try {
        const { data } = await api.post<{ status: boolean, uuid: string }>('/payments/upload', form)
        return data.uuid
    } catch (error) {
        throw new Error(errorText(error))
    }
}

// --- Налоги и отчетность, раздел 3.5 ТЗ ---

export type TTaxRegime = 'osno' | 'usn_income' | 'usn_income_expenses' | 'ausn' | 'psn' | 'eshn' | 'npd'

// Профиль налогоплательщика: от него зависит весь календарь обязательств,
// поэтому показываем его в шапке раздела
export interface ITaxProfile {
    regime: TTaxRegime
    regimeTitle: string
    form: 'ip' | 'ooo'
    formTitle: string
    taxRate: number | null
    vat: boolean
    hasEmployees: boolean
    employeesCount: number | null
    fixedContributions: boolean
    extraTaxes: string[]
    summary: string
    comment: string | null
}

export interface ITaxObligation {
    id: number
    // payment - деньги в бюджет, report - отчет
    kind: 'payment' | 'report'
    title: string
    period: string
    periodName: string | null
    dueOn: string
    dueTitle: string
    daysLeft: number
    overdue: boolean
    // Пусто, пока налог не рассчитан бухгалтером или 1С
    amount: number | null
    amountSource: string | null
    status: string
    statusTitle: string
    kbk: string | null
    purpose: string | null
    receipt: string | null
    comment: string | null
    canPay: boolean
    canApprove: boolean
    note: string | null
    dataItems: string[]
}

export interface ITaxState {
    status: boolean
    profile: ITaxProfile | null
    message?: string
    note: string | null
    stats: {
        to_pay_count: number
        to_pay_amount: string
        overdue_count: number
        upcoming_count: number
    } | null
    obligations: ITaxObligation[]
}

export type TTaxScope = 'upcoming' | 'to_pay' | 'reports' | 'overdue' | 'all'

export const fetchTaxState = async (organizationId: number): Promise<ITaxState> => {
    const { data } = await api.get<ITaxState>('/taxes', { params: { organizationId } })

    return data
}

export const fetchTaxObligations = async (
    organizationId: number,
    scope: TTaxScope
): Promise<ITaxObligation[]> => {
    const { data } = await api.get<{ status: boolean, items: ITaxObligation[] }>('/taxes/obligations', {
        params: { organizationId, scope },
    })

    return data.items
}

// Кнопка «Оплатить налог»: возвращает uuid заявки - дальше открывается
// та же карточка подтверждения, что и у остальных платежей
export const payTax = async (
    obligationId: number,
    organizationId: number,
    fromAccount?: string
): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, uuid: string }>(
            `/taxes/${obligationId}/pay`,
            { organizationId, fromAccount }
        )

        return data.uuid
    } catch (error) {
        throw new Error(errorText(error))
    }
}

// Ответ на уведомление «требуется согласование»
export const approveTax = async (obligationId: number, organizationId: number): Promise<void> => {
    try {
        await api.post(`/taxes/${obligationId}/approve`, { organizationId })
    } catch (error) {
        throw new Error(errorText(error))
    }
}

// --- Сверки и взаиморасчеты, раздел 3.7 ТЗ ---

export interface IReportOption {
    key: 'turnover' | 'card'
    title: string
    hint: string
    requiresAccount: boolean
}

export interface IAccountOption {
    code: string
    title: string
}

export interface IReportOptions {
    reports: IReportOption[]
    // Счета, которые организации разрешено запрашивать
    accounts: IAccountOption[]
    restricted: boolean
}

export const fetchReportOptions = async (organizationId: number): Promise<IReportOptions> => {
    const { data } = await api.get<{ status: boolean } & IReportOptions>('/reports/options', {
        params: { organizationId },
    })

    return { reports: data.reports, accounts: data.accounts, restricted: data.restricted }
}

// Акт сверки формирует 1С, PDF придет в чат
export const requestReconciliation = async (input: {
    organizationId: number
    counterpartyId: number
    from: string
    to: string
    comment?: string
}): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, title: string }>('/reconciliation', input)

        return data.title
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const requestAccountReport = async (input: {
    organizationId: number
    report: string
    account?: string
    counterpartyId?: number
    from: string
    to: string
}): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, title: string }>('/reports/account', input)

        return data.title
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export interface IAccountingTask {
    id: number
    kind: string
    kindTitle: string
    subject: string
    body: string | null
    amount: number | null
    status: string
    statusTitle: string
    answer: string | null
    organizationId: number
    createdAt: string
}

// Расхождения по сверке уходят задачей бухгалтеру, а не сообщением в чат
export const createAccountingTask = async (input: {
    organizationId: number
    subject: string
    body?: string
    amount?: string
    uuid?: string
}): Promise<number> => {
    try {
        const { data } = await api.post<{ status: boolean, id: number }>('/tasks', input)

        return data.id
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const fetchAccountingTasks = async (scope: 'open' | 'closed' | 'all' = 'open'): Promise<IAccountingTask[]> => {
    const { data } = await api.get<{ status: boolean, items: IAccountingTask[] }>('/tasks', { params: { scope } })

    return data.items
}
