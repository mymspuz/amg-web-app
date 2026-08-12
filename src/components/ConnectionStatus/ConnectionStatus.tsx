import React from 'react'

import { IBaseState, IOneCState } from '../../api/client'

interface IProps {
    oneC: IOneCState
    bases: IBaseState[]
}

// «5 минут назад» - когда связи нет, важно, давно ли она пропала:
// пара минут это перезапуск обработки, час - обработку закрыли
const sinceText = (iso: string | null): string => {
    if (!iso) return 'обмена еще не было'

    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 1) return 'меньше минуты назад'
    if (minutes < 60) return `${minutes} мин назад`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} ч назад`

    return new Date(iso).toLocaleString('ru-RU')
}

// Индикатор связи с 1С. Зеленый - обработка обмена опрашивает очередь,
// красный - задачи копятся в очереди и уйдут, когда обмен восстановится
const ConnectionStatus = ({ oneC, bases }: IProps) => {
    const online = oneC.online
    // Когда баз несколько, важно, сколько из них на связи
    const title = bases.length > 1
        ? bases.map(b => `${b.name}: ${b.online ? 'на связи' : sinceText(b.lastSeenAt)}`).join('\n')
        : `Последний обмен: ${sinceText(oneC.lastSeenAt)}`

    return (
        <span className={`conn ${online ? 'online' : 'offline'}`} title={title}>
            <span className="conn-dot" />
            {online
                ? (bases.length > 1 ? `1С на связи (${oneC.onlineCount} из ${oneC.total})` : '1С на связи')
                : `Нет связи с 1С · ${sinceText(oneC.lastSeenAt)}`}
        </span>
    )
}

export default ConnectionStatus
