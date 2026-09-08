import React from 'react'
import {Routes, Route, HashRouter} from 'react-router-dom'

import './App.css'
import MainMenu from './components/MainMenu/MainMenu'
import InvoiceForPayment from './components/InvoiceForPayment/InvoiceForPayment'
import PaymentOrder from "./components/PaymentOrder/PaymentOrder";
import RequestCard from "./components/RequestCard/RequestCard";
import Section from "./components/Section/Section";
import Requests from "./components/Requests/Requests";
import PayInvoice from "./components/Payments/PayInvoice";
import NewPayment from "./components/Payments/NewPayment";
import Taxes from "./components/Taxes/Taxes";
import Reconciliation from "./components/Reconciliation/Reconciliation";
import Tasks from "./components/Tasks/Tasks";
import Consultation from "./components/Consultation/Consultation";
import MyBookings from "./components/Consultation/MyBookings";
import Admin from "./components/Admin/Admin";

function App() {
  return (
    <div className="App">
        <HashRouter>
            <Routes>
                <Route path={'/'} element={<MainMenu />} />
                <Route path={'/InvoiceForPayment'} element={<InvoiceForPayment />} />
                <Route path={'/PaymentOrder'} element={<PaymentOrder />} />
                <Route path={'/Request/:uuid'} element={<RequestCard />} />
                <Route path={'/Section/:key'} element={<Section />} />
                <Route path={'/Requests'} element={<Requests />} />
                <Route path={'/PayInvoice'} element={<PayInvoice />} />
                {/* Вид операции берется из адреса: себе на карту, поставщику,
                    между своими счетами, зарплата */}
                <Route path={'/Payment/:kind'} element={<NewPayment />} />
                {/* Раздел «Налоги и отчётность»: набор обязательств зависит
                    от налогового профиля организации. Вид списка идет путем,
                    а не запросом: в ссылке из бота хеш занимает телеграм */}
                <Route path={'/Taxes'} element={<Taxes />} />
                <Route path={'/Taxes/:scope'} element={<Taxes />} />
                {/* Сверки: акт с контрагентом и отчеты по счетам учета */}
                <Route path={'/Reconciliation/:mode'} element={<Reconciliation />} />
                <Route path={'/Tasks'} element={<Tasks />} />
                {/* Запись на консультацию: тема, специалист, свободные слоты */}
                <Route path={'/Consultation'} element={<Consultation />} />
                <Route path={'/MyBookings'} element={<MyBookings />} />
                {/* Административная панель: вкладка идет путем */}
                <Route path={'/Admin/:tab'} element={<Admin />} />
            </Routes>
        </HashRouter>
    </div>
  );
}

export default App
