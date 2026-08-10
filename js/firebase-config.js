// Inicialización de Firebase (Realtime Database)
// Este archivo se importa desde todas las páginas (login, board, panel docente)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCtUGa3QM9ozy3FTImdyMdMCbX6ZLH2Zc",
  authDomain: "tv2roles.firebaseapp.com",
  databaseURL: "https://tv2roles-default-rtdb.firebaseio.com",
  projectId: "tv2roles",
  storageBucket: "tv2roles.firebasestorage.app",
  messagingSenderId: "860475467797",
  appId: "1:860475467797:web:5f416ebdafe1dc33ddc61c",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
