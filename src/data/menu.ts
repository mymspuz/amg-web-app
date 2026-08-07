import { TPermission } from '../api/client'

export interface IMenuItem {
    key: string
    title: string
    // Куда ведет: маршрут приложения. Пусто - пункт еще не реализован
    route?: string
    // Право, без которого пункт недоступен
    permission?: TPermission
    // Показывать только когда есть данные счета
    requiresInvoice?: boolean
    hint?: string
}

export interface IMenuSection {
    key: string
    title: string
    icon: string
    color: string
    hint: string
    items: IMenuItem[]
}

// Структура из раздела 5 ТЗ. Нереализованные пункты показываем неактивными,
// чтобы был виден общий объем сервиса, а не только готовые куски
export const MENU: IMenuSection[] = [
    {
        key: 'payments',
        title: 'Платежи',
        icon: '💳',
        color: '#1c67d9',
        hint: 'Оплата счетов и статусы',
        items: [
            { key: 'pay', title: 'Оплатить счёт', route: '/PaymentOrder', permission: 'confirm', requiresInvoice: true, hint: 'Пришлите счёт боту, затем подтвердите реквизиты' },
            { key: 'pending', title: 'Платежи на проверке', route: '/Requests' },
            { key: 'history', title: 'История', route: '/Requests' },
        ],
    },
    {
        key: 'documents-out',
        title: 'Выставить документы',
        icon: '🧾',
        color: '#4caf50',
        hint: 'Счета и закрывающие',
        items: [
            { key: 'invoice', title: 'Счёт', route: '/InvoiceForPayment', permission: 'create' },
            { key: 'act', title: 'Акт' },
            { key: 'upd', title: 'УПД' },
            { key: 'waybill', title: 'Накладная' },
            { key: 'facture', title: 'Счёт-фактура' },
        ],
    },
    {
        key: 'documents',
        title: 'Документы',
        icon: '📁',
        color: '#9c27b0',
        hint: 'Хранилище первички',
        items: [
            { key: 'upload', title: 'Загрузить', hint: 'Пока отправляйте файлы прямо в чат боту' },
            { key: 'incoming', title: 'Входящие' },
            { key: 'outgoing', title: 'Исходящие' },
            { key: 'missing', title: 'Не хватает документов' },
        ],
    },
    {
        key: 'taxes',
        title: 'Налоги и отчётность',
        icon: '📊',
        color: '#ff9b00',
        hint: 'Сроки и суммы',
        items: [
            { key: 'to-pay', title: 'К оплате' },
            { key: 'deadlines', title: 'Сроки' },
            { key: 'reports', title: 'Сданные отчёты' },
            { key: 'certificate', title: 'Запрос справки' },
        ],
    },
    {
        key: 'staff',
        title: 'Зарплата и кадры',
        icon: '👥',
        color: '#00897b',
        hint: 'Кадровые заявки',
        items: [
            { key: 'send-data', title: 'Передать данные' },
            { key: 'employees', title: 'Сотрудники' },
            { key: 'vacation', title: 'Отпуск' },
            { key: 'sick', title: 'Больничный' },
            { key: 'payroll', title: 'Расчёт' },
        ],
    },
    {
        key: 'tasks',
        title: 'Задачи бухгалтерии',
        icon: '💬',
        color: '#e91e63',
        hint: 'Обращения вместо чатов',
        items: [
            { key: 'new-request', title: 'Создать запрос' },
            { key: 'my-requests', title: 'Мои обращения' },
            { key: 'urgent', title: 'Срочный вопрос' },
        ],
    },
    {
        key: 'company',
        title: 'Моя компания',
        icon: '🏢',
        color: '#607d8b',
        hint: 'Реквизиты и доступы',
        items: [
            { key: 'requisites', title: 'Реквизиты', route: '/Company' },
            { key: 'contract', title: 'Договор' },
            { key: 'tariff', title: 'Тариф' },
            { key: 'contacts', title: 'Контакты' },
            { key: 'users', title: 'Пользователи' },
        ],
    },
    {
        key: 'help',
        title: 'Помощь',
        icon: '❓',
        color: '#795548',
        hint: 'Инструкции и поддержка',
        items: [
            { key: 'manuals', title: 'Инструкции' },
            { key: 'faq', title: 'Частые вопросы' },
            { key: 'human', title: 'Связаться с человеком' },
        ],
    },
]

export const findSection = (key: string): IMenuSection | undefined => MENU.find(s => s.key === key)
