import React, { useState, ChangeEvent, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios, {AxiosProgressEvent} from 'axios'

// import { useTelegram } from '../../hooks/useTelegram'

import './PaymentOrder.css'

// import counterpartiesJson from '../../data/counterparty.json'

interface IFormData {
    clientId: string
    comment: string
}

// interface ICounterparty {
//     id: number
//     name: string
//     inn: number
//     kpp: number
//     ind: number
//     address: string
//     phone: string | null
//     bank: {
//         name: string
//         bik: string
//         check1: string
//         check2: string
//     },
//     items: string[]
// }

const PaymentOrder = () => {
    // const { tg, queryId, user, chat} = useTelegram()

    const navigate = useNavigate()
    const [search, setSearch] = useSearchParams()

    // const counterpartyId = Number(search.get('counterpartyId'))
    // const counterparties = [...counterpartiesJson]
    // const counterparty: ICounterparty = counterparties.find(i => i.id === counterpartyId) ? counterparties.filter(i => i.id === counterpartyId)[0] : {} as ICounterparty
    const clients = [
        { id: '1', name: 'Себе на карту' },
        { id: '2', name: 'Перевести на счет' },
    ]
    const [formData, setFormData] = useState<IFormData>({
        clientId: clients[0].id,
        comment: '',
    })

    function axiosDownloadFile() {
        return axios({
            url: 'http://localhost:3001/tasks/download',
            method: 'GET',
            responseType: 'blob',
        })
            .then(response => {
                const href = window.URL.createObjectURL(response.data);

                const anchorElement = document.createElement('a');

                anchorElement.href = href;
                anchorElement.download = 'c7a3d780d80682c18d3027c4e072df07';

                document.body.appendChild(anchorElement);
                anchorElement.click();

                document.body.removeChild(anchorElement);
                window.URL.revokeObjectURL(href);
            })
            .catch(error => {
                console.log('error: ', error);
            });
    }

    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: any) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://localhost:3001/tasks/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / (progressEvent.total ? progressEvent.total : 0)
                    );
                    console.log(`Upload progress: ${percentCompleted}%`);
                },
            });

            console.log('Success:', response.data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setUploading(false);
        }
        // try {
        //     const response = await fetch('http://localhost:3001/tasks/upload', {
        //         method: 'POST',
        //         body: formData,
        //         // Не устанавливайте Content-Type вручную - браузер сам добавит boundary
        //     });
        //     console.log('Success:', response);
        //
        //     const data = await response.json();
        //     console.log('Success:', data);
        // } catch (error) {
        //     console.error('Error:', error);
        // } finally {
        //     setUploading(false);
        // }
    };
    const handleBack = (): void => {
        navigate(-1)
    }

    function onChangeClient(e: { target: { value: any } }) {
        setFormData({ ...formData, clientId: e.target.value })
    }

    // function handleSumChange(e: ChangeEvent<HTMLInputElement>) {
    //     setFormData({ ...formData, sum: Number(e.target.value) })
    // }

    function handleCommentChange(e: ChangeEvent<HTMLInputElement>) {
        setFormData({ ...formData, comment: e.target.value })
    }

    const onSendData = useCallback(async () => {
        // tg.sendData(JSON.stringify({
        //     type: 'paymentOrder',
        //     data: formData,
        // }));
    }, [formData])

    useEffect(() => {
        // tg.MainButton.show()
    }, [formData])

    useEffect(() => {
        // tg.onEvent('mainButtonClicked', onSendData)
        // return () => {
        //     tg.offEvent('mainButtonClicked', onSendData)
        // }
    }, [onSendData])

    useEffect(() => {
        // tg.MainButton.setParams({
        //     text: 'Отправить данные'
        // })
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
                <h1>📋 Создание <strong>пп</strong></h1>
                <p>Заполните форму для создания нового платежного поручения</p>
            </div>

            <form className="adaptive-form">
                {/* Основная информация */}
                {/*<fieldset className="form-section">*/}
                {/*    <legend>👤 Получатель</legend>*/}

                {/*    <div className="input-group">*/}
                {/*        <h3>ИНН 7728706427</h3>*/}
                {/*        <h4>На сумму 7 150.00</h4>*/}
                {/*    </div>*/}
                {/*</fieldset>*/}

                <fieldset className="form-section">
                    <div className="input-group">
                        <input
                            id="itemName"
                            type="text"
                            value={formData.comment}
                            onChange={handleCommentChange}
                            placeholder="Назначение платежа"
                            className={''}
                        />
                    </div>
                    <label htmlFor="buyer" className="required">
                        Тип платежа
                    </label>
                    <select
                        id="buyer"
                        value={formData.clientId}
                        onChange={onChangeClient}
                        className={''}
                    >
                        {clients.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                    </select>
                    <div>
                        <input type="file" onChange={handleFileChange} />
                        <button onClick={handleUpload} disabled={!file || uploading}>
                            {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>
                    <div>
                        <button onClick={axiosDownloadFile}>
                            Скачать
                        </button>
                    </div>
                    {/*<div className="input-row">*/}
                    {/*    <div className="input-group half">*/}
                    {/*        <label htmlFor="itemAmount" className="required">*/}
                    {/*            7 150.00*/}
                    {/*        </label>*/}
                    {/*        <input*/}
                    {/*            id="itemAmount"*/}
                    {/*            type="number"*/}
                    {/*            value={formData.sum}*/}
                    {/*            onChange={handleSumChange}*/}
                    {/*            placeholder="Сумма"*/}
                    {/*            min={1}*/}
                    {/*            step="0.01"*/}
                    {/*            required*/}
                    {/*            className={''}*/}
                    {/*        />*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                </fieldset>
            </form>
        </div>
    )
}

export default PaymentOrder