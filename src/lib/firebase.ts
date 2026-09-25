import { initializeApp, getApps, getApp } from "firebase/app";

// Web app's Firebase configuration
export const firebaseConfig = {
  apiKey:
    (typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_FIREBASE_API_KEY) ||
    "",
  authDomain: "nyayamitra-509713.firebaseapp.com",
  projectId: "nyayamitra-509713",
  storageBucket: "nyayamitra-509713.firebasestorage.app",
  messagingSenderId: "644087406496",
  appId: "1:644087406496:web:f5dfc9c59af315dfbf4ec5",
};

// Initialize Firebase safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
