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
            </Routes>
        </HashRouter>
    </div>
  );
}

export default App
