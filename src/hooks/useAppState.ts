import { useCallback, useEffect, useState } from 'react'

import { fetchState, IChatState, IOrganization, TPermission } from '../api/client'

const STORAGE_KEY = 'amg.organizationId'

// Выбранная организация переживает переходы между экранами и перезапуск приложения
const readStored = (): number | null => {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    return raw ? Number(raw) : null
}

export interface IAppState {
    state: IChatState | null
    loading: boolean
    error: string
    organization: IOrganization | null
    selectOrganization: (id: number) => void
    can: (permission: TPermission) => boolean
    reload: () => void
}

export const useAppState = (): IAppState => {
    const [state, setState] = useState<IChatState | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string>('')
    const [organizationId, setOrganizationId] = useState<number | null>(readStored)

    const load = useCallback(() => {
        setLoading(true)
        fetchState()
            .then((data) => {
                setState(data)
                setError('')

                // Если сохраненная организация больше недоступна - берем по умолчанию
                const stored = readStored()
                const known = data.organizations.find(o => o.id === stored)
                if (!known) {
                    const fallback = data.organizations.find(o => o.isDefault) || data.organizations[0]
                    if (fallback) {
                        window.localStorage.setItem(STORAGE_KEY, String(fallback.id))
                        setOrganizationId(fallback.id)
                    } else {
                        setOrganizationId(null)
                    }
                }
            })
            .catch((e) => setError(e?.response?.data?.error || 'Не удалось получить данные от бота'))
            .finally(() => setLoading(false))
    }, [])

    useEffect(load, [load])

    const selectOrganization = useCallback((id: number) => {
        window.localStorage.setItem(STORAGE_KEY, String(id))
        setOrganizationId(id)
    }, [])

    const organization = state?.organizations.find(o => o.id === organizationId) || null

    // Права проверяет и сервер, но кнопку лучше не показывать заранее
    const can = useCallback(
        (permission: TPermission): boolean => Boolean(organization?.permissions.includes(permission)),
        [organization]
    )

    return { state, loading, error, organization, selectOrganization, can, reload: load }
}
