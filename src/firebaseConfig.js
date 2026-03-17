
// Firebase (SDK modular v9+)
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'


console.log(
  'Firebase Project:',
  import.meta.env.VITE_FIREBASE_PROJECT_ID
)


// ⚠️ Coloca aquí tus variables de entorno (Vite) con prefijo VITE_
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app
try {
  app = initializeApp(firebaseConfig)
} catch (err) {
  // En dev, si la app ya estaba inicializada, ignoramos
  if (!/already exists/i.test(String(err?.message || ''))) throw err
}

export const db = (() => {
  try {
    return getFirestore()
  } catch (_) {
    return null
  }
})()
