/**
 * Zumbido App - Core Logic
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, serverTimestamp, query, where, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAl_jrOOxnMuBpWGRB_dxdvao39GMhlV-Y",
    authDomain: "studio-1888292451-fc60d.firebaseapp.com",
    projectId: "studio-1888292451-fc60d",
    storageBucket: "studio-1888292451-fc60d.firebasestorage.app",
    messagingSenderId: "873003768289",
    appId: "1:873003768289:web:5e3d7a85ebaea725469aa0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const authSection = document.getElementById('auth-section');
const contactsSection = document.getElementById('contacts-section');
const settingsSection = document.getElementById('settings-section');

const loginBtn = document.getElementById('login-btn');
const settingsBtn = document.getElementById('settings-btn');
const backBtn = document.getElementById('back-btn');
const pickContactBtn = document.getElementById('pick-contact-btn');
const vibrationToggle = document.getElementById('vibration-toggle');
const soundSelect = document.getElementById('sound-select');

// State
let currentUser = null;
let userPrefs = {
    sound: 'classic',
    vibration: true
};

// Navigation Logic
const showSection = (sectionId) => {
    [authSection, contactsSection, settingsSection].forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
};

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.displayName);

        // Save/Sync user in Firestore
        await syncUser();

        // Listen for incoming buzzes
        listenForBuzzes();

        showSection('contacts-section');
    } else {
        currentUser = null;
        showSection('auth-section');
    }
});

async function syncUser() {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        email: currentUser.email,
        photoURL: currentUser.photoURL,
        lastSeen: serverTimestamp()
    }, { merge: true });
}

// Event Listeners
settingsBtn.addEventListener('click', () => showSection('settings-section'));
backBtn.addEventListener('click', () => showSection('contacts-section'));

loginBtn.addEventListener('click', async () => {
    if (window.location.protocol === 'file:') {
        alert("¡Atención! Firebase Authentication no funciona abriendo el archivo directamente (protocolo file://). \n\nPara probar el logueo, necesitas usar un servidor local. Como tienes Python instalado, puedes ejecutar este comando en tu terminal:\n\npython -m http.server 8000\n\nY luego abrir: http://localhost:8000");
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerText = "Cargando...";

    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Auth error:", error);
        alert("Error al iniciar sesión: " + error.message + "\n\nVerifica que hayas agregado 'localhost' a los 'Dominios autorizados' en la consola de Firebase (Authentication -> Settings).");
        loginBtn.disabled = false;
        loginBtn.innerText = "Ingresar con Google";
    }
});

pickContactBtn.addEventListener('click', async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
        alert("Tu navegador no soporta el selector de contactos nativo. En móviles funciona mejor.");
        const demoName = prompt("Ingresa el nombre de un contacto para simular:");
        if (demoName) addContactToList({ name: [demoName], tel: ["1234567"] });
        return;
    }

    try {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        const contacts = await navigator.contacts.select(props, opts);

        if (contacts.length) {
            addContactToList(contacts[0]);
        }
    } catch (err) {
        console.error("Error al elegir contacto:", err);
    }
});

function addContactToList(contact) {
    const list = document.getElementById('contacts-list');
    const emptyMsg = list.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const name = contact.name ? contact.name[0] : (contact.tel ? contact.tel[0] : "Sin nombre");

    const contactEl = document.createElement('div');
    contactEl.className = 'btn secondary contact-item';
    contactEl.innerHTML = `
        <span style="flex: 1; text-align: left;">${name}</span>
        <button class="buzz-btn" style="background: var(--secondary); border: none; color: white; padding: 8px 15px; border-radius: 20px; font-weight: 600; cursor: pointer;">Zumbido!</button>
    `;
    contactEl.style.display = 'flex';
    contactEl.style.alignItems = 'center';
    contactEl.style.marginBottom = '10px';

    contactEl.querySelector('.buzz-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        sendBuzz(name);
    });

    list.appendChild(contactEl);
}

async function sendBuzz(name) {
    console.log(`Enviando zumbido a ${name}...`);

    try {
        await addDoc(collection(db, "buzzes"), {
            from: currentUser.displayName,
            fromId: currentUser.uid,
            toName: name,
            timestamp: serverTimestamp(),
            sound: userPrefs.sound,
            vibration: userPrefs.vibration
        });

        // Local feedback
        if (navigator.vibrate && userPrefs.vibration) {
            navigator.vibrate([100, 50, 100]);
        }
    } catch (e) {
        console.error("Error sending buzz:", e);
    }
}

function listenForBuzzes() {
    // Listen for new buzzes
    // For this simple POC, we listen to all new buzzes in the collection
    // and filter in memory if they are for us (based on name or global)
    const q = query(
        collection(db, "buzzes"),
        orderBy("timestamp", "desc"),
        limit(1)
    );

    let firstLoad = true;
    onSnapshot(q, (snapshot) => {
        if (firstLoad) {
            firstLoad = false;
            return;
        }
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                if (data.fromId !== currentUser.uid) {
                    triggerBuzzReceived(data);
                }
            }
        });
    });
}

function triggerBuzzReceived(data) {
    console.log("¡Zumbido recibido de!", data.from);

    // 1. Vibration
    if (data.vibration && navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500]);
    }

    // 2. Sound
    playBuzzSound(data.sound);

    // 3. UI Alert
    const notification = document.createElement('div');
    notification.className = 'buzz-notification';
    notification.innerHTML = `
        <div class="notif-content">
            <span class="icon">📢</span>
            <div class="text">
                <strong>${data.from}</strong> te envió un zumbido!
            </div>
        </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

function playBuzzSound(type) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    let freq = 440;
    if (type === 'classic') {
        osc.type = 'square';
        freq = 300;
    } else if (type === 'alert') {
        osc.type = 'sawtooth';
        freq = 800;
    } else if (type === 'magic') {
        osc.type = 'sine';
        freq = 1200;
    } else {
        osc.type = 'triangle';
        freq = 600;
    }

    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.start();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
    osc.stop(ctx.currentTime + 1.5);
}

// Prefs Save
vibrationToggle.addEventListener('change', (e) => {
    userPrefs.vibration = e.target.checked;
});

soundSelect.addEventListener('change', (e) => {
    userPrefs.sound = e.target.value;
});
