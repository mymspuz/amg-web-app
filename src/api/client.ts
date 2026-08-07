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
    permissions: TPermission[]
    isDefault: boolean
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
    counterpartyId: number
    fromFile: boolean
    items: { name: string, amount: number, price: number }[]
    buyerName: string
    buyerInn: number
    buyerKpp: number
    buyerInd: number
    buyerAddress: string
    buyerPhone: string | null
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
    values: { supplierINN: string, buyerINN: string, sum: number }
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
