/**
 * Zumbido App (Filtrado por destinatario y multi-dispositivo)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    onSnapshot,
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    limit,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAl_jrOOxnMuBpWGRB_dxdvao39GMhlV-Y",
    authDomain: "studio-1888292451-fc60d.firebaseapp.com",
    projectId: "studio-1888292451-fc60d",
    storageBucket: "studio-1888292451-fc60d.firebasestorage.app",
    messagingSenderId: "873003768289",
    appId: "1:873003768289:web:5e3d7a85ebaea725469aa0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Identificador único para esta pestaña/dispositivo para evitar auto-zumbidos
const sessionDeviceId = Math.random().toString(36).substring(7);

let audioContext = null;
let currentUser = null;
let userPrefs = { sound: 'classic', vibration: true };

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const settingsBtn = document.getElementById('settings-btn');
const backBtn = document.getElementById('back-btn');
const pickContactBtn = document.getElementById('pick-contact-btn');
const vibrationToggle = document.getElementById('vibration-toggle');
const soundSelect = document.getElementById('sound-select');
const userDisplayName = document.getElementById('user-display-name');
const userAvatar = document.getElementById('user-avatar');
const userStatusText = document.getElementById('user-status-text');

const showSection = (id) => {
    ['auth-section', 'contacts-section', 'settings-section'].forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

function initAudio() {
    if (!audioContext || audioContext.state === 'suspended') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const b = audioContext.createBuffer(1, 1, 22050);
        const s = audioContext.createBufferSource();
        s.buffer = b; s.connect(audioContext.destination); s.start(0);
    }
}

getRedirectResult(auth).catch(console.error);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userDisplayName.innerText = user.displayName;
        userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        userStatusText.innerText = "Disponible";
        await setDoc(doc(db, "users", user.uid), { uid: user.uid, displayName: user.displayName, lastSeen: serverTimestamp() }, { merge: true });
        listenForBuzzes();
        showSection('contacts-section');
    } else {
        currentUser = null;
        userDisplayName.innerText = "Zumbido";
        userStatusText.innerText = "Inicia sesión para conectar";
        userAvatar.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=Zumbido";
        showSection('auth-section');
    }
});

loginBtn.addEventListener('click', () => { initAudio(); signInWithRedirect(auth, provider); });
logoutBtn.addEventListener('click', () => signOut(auth));
settingsBtn.addEventListener('click', () => { initAudio(); showSection('settings-section'); });
backBtn.addEventListener('click', () => showSection('contacts-section'));

pickContactBtn.addEventListener('click', async () => {
    initAudio();
    if (!('contacts' in navigator)) {
        const n = prompt("Ingresa el nombre de tu amigo (debe ser su nombre de Google):");
        if (n) addContactToList({ name: [n] });
    } else {
        try {
            const c = await navigator.contacts.select(['name'], { multiple: false });
            if (c.length) addContactToList(c[0]);
        } catch {
            const n = prompt("Ingresa el nombre de tu amigo:"); if (n) addContactToList({ name: [n] });
        }
    }
});

function addContactToList(contact) {
    const list = document.getElementById('contacts-list');
    const empty = list.querySelector('.empty-msg');
    if (empty) empty.remove();
    const name = contact.name ? contact.name[0] : "Sin nombre";
    const el = document.createElement('div');
    el.className = 'contact-item';
    el.innerHTML = `<div class="status-badge" style="position:static; width:12px; height:12px; border:none;"></div><span class="contact-name">${name}</span><button class="buzz-btn-icon">🔔</button>`;
    el.querySelector('.buzz-btn-icon').addEventListener('click', (e) => { e.stopPropagation(); initAudio(); sendBuzz(name); });
    list.appendChild(el);
}

async function sendBuzz(to) {
    if (!currentUser) return;
    try {
        await addDoc(collection(db, "buzzes"), {
            from: currentUser.displayName,
            fromId: currentUser.uid,
            toName: to,
            deviceId: sessionDeviceId,
            timestamp: serverTimestamp(),
            sound: userPrefs.sound,
            vibration: userPrefs.vibration
        });
        triggerShake(); // Feedback visual inmediato para quien envía
    } catch (e) { console.error(e); }
}

function listenForBuzzes() {
    // Filtramos para que SOLO lleguen zumbidos dirigidos a nuestro nombre
    const q = query(
        collection(db, "buzzes"),
        where("toName", "==", currentUser.displayName),
        orderBy("timestamp", "desc"),
        limit(1)
    );

    let first = true;
    onSnapshot(q, (snap) => {
        if (first) { first = false; return; }
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const data = change.doc.data();
                // Solo reaccionamos si NO lo enviamos nosotros desde este mismo dispositivo
                if (data.deviceId !== sessionDeviceId) {
                    onBuzzReceived(data);
                }
            }
        });
    });
}

function onBuzzReceived(data) {
    triggerShake();
    if (audioContext) {
        if (audioContext.state === 'suspended') audioContext.resume();
        const o = audioContext.createOscillator(); const g = audioContext.createGain();
        o.connect(g); g.connect(audioContext.destination);
        let f = 880; if (data.sound === 'alert') f = 1200; if (data.sound === 'magic') f = 1500; if (data.sound === 'echo') f = 440;
        o.type = 'sine'; o.frequency.setValueAtTime(f, audioContext.currentTime);
        o.frequency.exponentialRampToValueAtTime(f / 2, audioContext.currentTime + 0.4);
        g.gain.setValueAtTime(0.1, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        o.start(); o.stop(audioContext.currentTime + 0.5);
    }
    if (data.vibration && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    const n = document.createElement('div'); n.className = 'buzz-notification';
    n.innerHTML = `<div class="notif-content"><strong>${data.from}</strong><span>¡Te ha enviado un zumbido!</span></div>`;
    document.body.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 500); }, 4000);
}

function triggerShake() {
    document.getElementById('app').classList.add('shake');
    setTimeout(() => document.getElementById('app').classList.remove('shake'), 500);
}

vibrationToggle.addEventListener('change', (e) => userPrefs.vibration = e.target.checked);
soundSelect.addEventListener('change', (e) => userPrefs.sound = e.target.value);

// PWA Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    });
}
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}
