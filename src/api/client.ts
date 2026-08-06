import axios from 'axios'

// Адрес бота. Локально - http://localhost:3001, на проде должен быть https,
// иначе браузер заблокирует запросы со страницы gh-pages как mixed content
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001'

const api = axios.create({ baseURL: `${API_URL}/api` })

// initData подписан телеграмом - по нему сервер понимает, что за пользователь пришел.
// Ни chatId, ни имя больше не передаем: подделать подпись нельзя
api.interceptors.request.use((config) => {
    const initData = window.Telegram?.WebApp?.initData || process.env.REACT_APP_DEV_INIT_DATA || ''
    if (initData) config.headers.Authorization = `tma ${initData}`

    return config
})

export interface IChatState {
    status: boolean
    fullName: string
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

export const sendPaymentOrder = async (comment: string): Promise<void> => {
    try {
        await api.post('/payment-order', { comment })
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
