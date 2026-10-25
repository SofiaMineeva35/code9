import React from 'react'
import { createRoot } from 'react-dom/client'
import BriefApp from './components/BriefApp.jsx'
import '../stylesheets/brief.css'
createRoot(document.getElementById('brief-root')).render(<BriefApp />)
