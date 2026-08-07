import React from 'react'
import {Routes, Route, HashRouter} from 'react-router-dom'

import './App.css'
import MainMenu from './components/MainMenu/MainMenu'
import InvoiceForPayment from './components/InvoiceForPayment/InvoiceForPayment'
import PaymentOrder from "./components/PaymentOrder/PaymentOrder";
import RequestCard from "./components/RequestCard/RequestCard";

function App() {
  return (
    <div className="App">
        <HashRouter>
            <Routes>
                <Route path={'/'} element={<MainMenu />} />
                <Route path={'/InvoiceForPayment'} element={<InvoiceForPayment />} />
                <Route path={'/PaymentOrder'} element={<PaymentOrder />} />
                <Route path={'/Request/:uuid'} element={<RequestCard />} />
            </Routes>
        </HashRouter>
    </div>
  );
}

export default App
