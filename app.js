/**
 * Zumbido App - Versión Final con Directorio Global
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
provider.setCustomParameters({ prompt: 'select_account' });

const sessionDeviceId = Math.random().toString(36).substring(7);
let audioContext = null;
let currentUser = null;
let userPrefs = { sound: 'classic', vibration: true };

// Elementos del DOM
const appContainer = document.getElementById('app');
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
const contactsList = document.getElementById('contacts-list');

const showSection = (id) => {
    ['auth-section', 'contacts-section', 'settings-section'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
};

function initAudio() {
    if (!audioContext || audioContext.state === 'suspended') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const b = audioContext.createBuffer(1, 1, 22050);
        const s = audioContext.createBufferSource();
        s.buffer = b; s.connect(audioContext.destination); s.start(0);
    }
}

// Manejar redirección
getRedirectResult(auth).catch(console.error);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userDisplayName.innerText = user.displayName;
        userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        userStatusText.innerText = "Disponible";

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastSeen: serverTimestamp()
        }, { merge: true });

        listenForBuzzes();
        listenForUsers(); // Cargar directorio de usuarios
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
    const n = prompt("Ingresa el nombre de usuario de tu amigo:");
    if (n) addContactToList({ name: [n] }, true);
});

// Directorio en tiempo real
function listenForUsers() {
    const q = query(collection(db, "users"), limit(50));
    onSnapshot(q, (snap) => {
        contactsList.innerHTML = ''; // Limpiamos la lista para reconstruirla

        if (snap.empty) {
            contactsList.innerHTML = '<p class="empty-msg" style="text-align:center; color:var(--text-secondary); padding:20px;">No hay usuarios conectados aún.</p>';
            return;
        }

        snap.forEach(doc => {
            const userData = doc.data();
            const isMe = userData.uid === currentUser.uid;
            addContactToList({
                name: [userData.displayName + (isMe ? ' (Tú)' : '')],
                photo: userData.photoURL,
                realName: userData.displayName
            }, false);
        });
    });
}

function addContactToList(contact, isManual = false) {
    const name = contact.name ? contact.name[0] : "Sin nombre";
    const realName = contact.realName || name;

    // Evitar duplicados visuales si es manual y ya está en la lista de firestore
    if (isManual) {
        const items = Array.from(contactsList.querySelectorAll('.contact-name'));
        if (items.some(i => i.innerText.includes(realName))) return;
    }

    const el = document.createElement('div');
    el.className = 'contact-item';
    el.style.animation = 'slideDown 0.3s ease-out';
    el.innerHTML = `
        <div style="position:relative;">
            <img src="${contact.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + realName}" 
                 style="width:40px; height:40px; border-radius:12px; background:#fff; border:1px solid #eee;">
            <div class="status-badge" style="position:absolute; bottom:-2px; right:-2px; width:12px; height:12px; border:2px solid #fff;"></div>
        </div>
        <span class="contact-name" style="flex:1; font-weight:500; font-size:15px; margin-left:12px;">${name}</span>
        <button class="buzz-btn-icon" style="background:var(--msn-blue-light); border:none; padding:8px; border-radius:8px; cursor:pointer; font-size:18px;">🔔</button>
    `;

    el.querySelector('.buzz-btn-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        sendBuzz(realName);
    });

    contactsList.appendChild(el);
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
        triggerShake();
    } catch (e) { console.error("Error enviando zumbido:", e); }
}

function listenForBuzzes() {
    const q = query(
        collection(db, "buzzes"),
        where("toName", "==", currentUser.displayName),
        limit(5)
    );

    let appStartTime = Date.now();
    onSnapshot(q, (snap) => {
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const data = change.doc.data();
                const buzzTime = data.timestamp?.toMillis() || Date.now();

                // Solo si es nuevo y de otro dispositivo
                if (buzzTime > appStartTime - 10000 && data.deviceId !== sessionDeviceId) {
                    onBuzzReceived(data);
                }
            }
        });
    });
}

function onBuzzReceived(data) {
    triggerShake();
    playMsnSound(data.sound);

    if (data.vibration && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);

    const n = document.createElement('div');
    n.className = 'buzz-notification';
    n.innerHTML = `
        <div class="notif-content">
            <strong>${data.from}</strong>
            <span>¡Te ha enviado un zumbido!</span>
        </div>
    `;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0';
        setTimeout(() => n.remove(), 500);
    }, 4000);
}

function playMsnSound(type) {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.connect(g);
    g.connect(audioContext.destination);

    let f = 880;
    if (type === 'alert') f = 1200;
    if (type === 'magic') f = 1500;
    if (type === 'echo') f = 440;

    o.type = 'sine';
    o.frequency.setValueAtTime(f, audioContext.currentTime);
    o.frequency.exponentialRampToValueAtTime(f / 2, audioContext.currentTime + 0.4);

    g.gain.setValueAtTime(0.1, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

    o.start();
    o.stop(audioContext.currentTime + 0.5);
}

function triggerShake() {
    appContainer.classList.add('shake');
    setTimeout(() => appContainer.classList.remove('shake'), 500);
}

vibrationToggle.addEventListener('change', (e) => userPrefs.vibration = e.target.checked);
soundSelect.addEventListener('change', (e) => userPrefs.sound = e.target.value);

// PWA e iOS
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    });
}
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}
