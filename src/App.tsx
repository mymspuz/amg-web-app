import React from 'react'
import {Routes, Route, HashRouter} from 'react-router-dom'

import './App.css'
import MainMenu from './components/MainMenu/MainMenu'
import InvoiceForPayment from './components/InvoiceForPayment/InvoiceForPayment'
import PaymentOrder from "./components/PaymentOrder/PaymentOrder";

function App() {
  return (
    <div className="App">
        <HashRouter>
            <Routes>
                <Route path={'/'} element={<MainMenu />} />
                <Route path={'/InvoiceForPayment'} element={<InvoiceForPayment />} />
                <Route path={'/PaymentOrder'} element={<PaymentOrder />} />
            </Routes>
        </HashRouter>
    </div>
  );
}

export default App
