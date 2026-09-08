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

// --- Запись на консультацию, раздел 3.8 ТЗ ---

export interface ISpecialistOption {
    id: number
    name: string
    position: string | null
}

export interface IConsultationTopic {
    id: number
    code: string
    title: string
    hint: string | null
    durationMin: number
    // Пусто - консультация бесплатная
    price: number | null
    // Разрешен ли выбор специалиста: по узким темам его подбирают за клиента
    allowChoice: boolean
    specialists: ISpecialistOption[]
}

export interface IBookingRules {
    changeHours: number
    leadMinutes: number
    paymentHoldHours: number
}

export interface IConsultationDay {
    date: string
    title: string
    count: number
}

export interface IConsultationSlot {
    start: string
    time: string
    end: string
    specialistId: number
    specialistName: string
}

export interface IBooking {
    id: number
    topic: string
    specialist: string
    startsAt: string
    when: string
    endTime: string
    status: string
    statusTitle: string
    price: number | null
    paid: boolean
    paymentLink: string | null
    question: string | null
    cancelReason: string | null
    // Правила АМГ: менять запись можно не позже чем за N часов до начала
    canChange: boolean
}

export const fetchConsultationTopics = async (): Promise<{ topics: IConsultationTopic[], rules: IBookingRules }> => {
    const { data } = await api.get<{ status: boolean, topics: IConsultationTopic[], rules: IBookingRules }>(
        '/consultations/topics'
    )

    return { topics: data.topics, rules: data.rules }
}

// Дни, где есть хотя бы одно свободное окно
export const fetchConsultationDays = async (topicId: number, specialistId?: number): Promise<IConsultationDay[]> => {
    const { data } = await api.get<{ status: boolean, days: IConsultationDay[] }>('/consultations/days', {
        params: { topicId, specialistId },
    })

    return data.days
}

export const fetchConsultationSlots = async (
    topicId: number,
    date: string,
    specialistId?: number
): Promise<IConsultationSlot[]> => {
    const { data } = await api.get<{ status: boolean, slots: IConsultationSlot[] }>('/consultations/slots', {
        params: { topicId, date, specialistId },
    })

    return data.slots
}

export const createBooking = async (input: {
    organizationId: number
    topicId: number
    specialistId?: number
    start: string
    question?: string
}): Promise<{ id: number, when: string, specialist: string, awaitingPayment: boolean }> => {
    try {
        const { data } = await api.post<{
            status: boolean, id: number, when: string, specialist: string, awaitingPayment: boolean
        }>('/consultations', input)

        return data
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const fetchBookings = async (scope: 'upcoming' | 'past' | 'all' = 'upcoming'): Promise<IBooking[]> => {
    const { data } = await api.get<{ status: boolean, items: IBooking[] }>('/consultations/my', { params: { scope } })

    return data.items
}

export const cancelBooking = async (id: number, reason?: string): Promise<void> => {
    try {
        await api.post(`/consultations/${id}/cancel`, { reason })
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const moveBooking = async (id: number, start: string): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, when: string }>(`/consultations/${id}/move`, { start })

        return data.when
    } catch (error) {
        throw new Error(errorText(error))
    }
}

// --- Административная панель, раздел 13 ТЗ ---

export interface IAdminOverview {
    bases: number
    bases_online: number
    organizations: number
    users_active: number
    users_pending: number
    requests_today: number
    errors_open: number
    tasks_open: number
    bookings_upcoming: number
}

export interface IAdminBase {
    id: number
    name: string
    isActive: boolean
    online: boolean
    lastSeenAt: string | null
    organizations: number
    counterparties: number
    accounts: number
    // Что уже приехало из базы: видно, на каком шаге остановилось подключение
    synced: {
        organizations: string | null
        counterparties: string | null
        taxProfiles: string | null
    }
}

export interface IAdminOrganization {
    id: number
    name: string
    inn: string
    kpp: string | null
    base_id: number | null
    base_name: string | null
    is_active: boolean
    payment_limit: number | null
    reportAccounts: string[]
    reportAccountsCustom: boolean
    users_count: number
    tax_regime: string | null
    synced_at: string | null
}

export interface IAdminUser {
    id: number
    telegram_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
    global_role: string
    status: string
    organizations: { id: number, name: string, permissions: string[], isDefault: boolean }[]
}

export interface IAdminQueueItem {
    uuid: string
    type: string
    status: string
    attempts: number
    last_error: string | null
    created_at: string
    title: string | null
    sum: string | null
    organization_name: string | null
    base_name: string | null
    username: string | null
    first_name: string | null
}

export interface IAdminStats {
    period_days: number
    by_type: { type: string, total: number, done: number, failed: number }[]
    avg_minutes: number | null
    active_users: number
    top_actions: { action: string, total: number }[]
}

export const fetchAdminOverview = async (): Promise<IAdminOverview> => {
    const { data } = await api.get<{ status: boolean, overview: IAdminOverview }>('/admin/overview')

    return data.overview
}

export const fetchAdminBases = async (): Promise<IAdminBase[]> => {
    const { data } = await api.get<{ status: boolean, items: IAdminBase[] }>('/admin/bases')

    return data.items
}

// Токен новой базы показывается один раз: дальше только перевыпуск
export const createAdminBase = async (name: string, adopt = false): Promise<{ token: string, instruction: string[] }> => {
    try {
        const { data } = await api.post<{ status: boolean, token: string, instruction: string[] }>(
            '/admin/bases', { name, adopt }
        )

        return { token: data.token, instruction: data.instruction }
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const rotateAdminBaseToken = async (id: number): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, token: string }>(`/admin/bases/${id}/token`, {})

        return data.token
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const syncAdminBase = async (id: number, kind = 'all'): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, msg: string }>(`/admin/bases/${id}/sync`, { kind })

        return data.msg
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const fetchAdminOrganizations = async (baseId?: number): Promise<IAdminOrganization[]> => {
    const { data } = await api.get<{ status: boolean, items: IAdminOrganization[] }>('/admin/organizations', {
        params: { baseId },
    })

    return data.items
}

export const updateAdminOrganization = async (
    id: number,
    patch: { paymentLimit?: number | null, reportAccounts?: string[] | null, isActive?: boolean }
): Promise<void> => {
    try {
        await api.patch(`/admin/organizations/${id}`, patch)
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const fetchAdminUsers = async (search?: string): Promise<{ items: IAdminUser[], roles: string[], permissions: string[] }> => {
    const { data } = await api.get<{ status: boolean, items: IAdminUser[], roles: string[], permissions: string[] }>(
        '/admin/users', { params: { search: search || undefined } }
    )

    return { items: data.items, roles: data.roles, permissions: data.permissions }
}

export const updateAdminUser = async (id: number, patch: { role?: string, status?: string }): Promise<void> => {
    try {
        await api.patch(`/admin/users/${id}`, patch)
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const grantAdminAccess = async (
    userId: number,
    organizationId: number,
    permissions: string[]
): Promise<void> => {
    try {
        await api.post(`/admin/users/${userId}/grant`, { organizationId, permissions })
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const revokeAdminAccess = async (userId: number, organizationId: number): Promise<void> => {
    try {
        await api.post(`/admin/users/${userId}/revoke`, { organizationId })
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const createAdminInvite = async (input: {
    organizationId?: number
    role?: string
    permissions?: string[]
    days?: number
}): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, link: string }>('/admin/invites', input)

        return data.link
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const fetchAdminQueue = async (scope: 'errors' | 'active' | 'recent'): Promise<IAdminQueueItem[]> => {
    const { data } = await api.get<{ status: boolean, items: IAdminQueueItem[] }>('/admin/queue', { params: { scope } })

    return data.items
}

export const retryAdminRequest = async (uuid: string): Promise<string> => {
    try {
        const { data } = await api.post<{ status: boolean, msg: string }>(`/admin/queue/${uuid}/retry`, {})

        return data.msg
    } catch (error) {
        throw new Error(errorText(error))
    }
}

export const fetchAdminStats = async (days = 30): Promise<IAdminStats> => {
    const { data } = await api.get<{ status: boolean, stats: IAdminStats }>('/admin/stats', { params: { days } })

    return data.stats
}
