import React from 'react'
import { Routes, Route } from 'react-router-dom'

import './App.css'
import MainMenu from './components/MainMenu/MainMenu'
import InvoiceForPayment from './components/InvoiceForPayment/InvoiceForPayment'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path={'/'} element={<MainMenu />} />
        <Route path={'/InvoiceForPayment'} element={<InvoiceForPayment />} />
      </Routes>
    </div>
  );
}

export default App
