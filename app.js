/**
 * Zumbido App - Neo MSN Edition (Multi-device & iOS fix)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
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

// Audio Context for iOS
let audioContext = null;

// DOM Elements
const appContainer = document.getElementById('app');
const authSection = document.getElementById('auth-section');
const contactsSection = document.getElementById('contacts-section');
const settingsSection = document.getElementById('settings-section');

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

// State
let currentUser = null;
let userPrefs = {
    sound: 'classic',
    vibration: true
};

// Navigation
const showSection = (sectionId) => {
    [authSection, contactsSection, settingsSection].forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
};

// Unlock Audio for iOS
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        console.log("Audio Context initialized");
    }
}

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userDisplayName.innerText = user.displayName;
        userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        userStatusText.innerText = "Disponible";

        await syncUser();
        listenForBuzzes();
        showSection('contacts-section');
    } else {
        currentUser = null;
        userDisplayName.innerText = "Zumbido";
        userStatusText.innerText = "Inicia sesión para conectar";
        userAvatar.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=MSN";
        showSection('auth-section');
    }
});

async function syncUser() {
    if (!currentUser) return;
    await setDoc(doc(db, "users", currentUser.uid), {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        lastSeen: serverTimestamp()
    }, { merge: true });
}

// Event Listeners
loginBtn.addEventListener('click', async () => {
    initAudio();
    if (window.location.protocol === 'file:') {
        alert("¡Error! Debes usar un servidor web (http://localhost:8000).");
        return;
    }
    try {
        await signInWithPopup(auth, provider);
    } catch (e) {
        console.error(e);
        alert("Error de login. Revisa la consola.");
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));
settingsBtn.addEventListener('click', () => {
    initAudio();
    showSection('settings-section');
});
backBtn.addEventListener('click', () => showSection('contacts-section'));

pickContactBtn.addEventListener('click', async () => {
    initAudio();
    if (!('contacts' in navigator)) {
        const name = prompt("Nombre del contacto para zumbar:");
        if (name) addContactToList({ name: [name] });
        return;
    }
    try {
        const contacts = await navigator.contacts.select(['name'], { multiple: false });
        if (contacts.length) addContactToList(contacts[0]);
    } catch (e) {
        const name = prompt("Nombre del contacto:");
        if (name) addContactToList({ name: [name] });
    }
});

function addContactToList(contact) {
    const list = document.getElementById('contacts-list');
    const empty = list.querySelector('.empty-msg');
    if (empty) empty.remove();

    const name = contact.name ? contact.name[0] : "Sin nombre";
    const el = document.createElement('div');
    el.className = 'contact-item';
    el.innerHTML = `
        <div class="status-badge" style="position:static; width:12px; height:12px; border:none;"></div>
        <span class="contact-name">${name}</span>
        <button class="buzz-btn-icon" title="¡Enviar Zumbido!">🔔</button>
    `;

    el.querySelector('.buzz-btn-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        sendBuzz(name);
    });

    list.appendChild(el);
}

async function sendBuzz(toName) {
    if (!currentUser) return;
    try {
        await addDoc(collection(db, "buzzes"), {
            from: currentUser.displayName,
            fromId: currentUser.uid,
            toName: toName,
            timestamp: serverTimestamp(),
            sound: userPrefs.sound,
            vibration: userPrefs.vibration
        });
        triggerShake();
    } catch (e) { console.error(e); }
}

function listenForBuzzes() {
    // Listen for buzzes created after the current moment
    const q = query(collection(db, "buzzes"), orderBy("timestamp", "desc"), limit(1));
    let firstLoad = true;

    onSnapshot(q, (snap) => {
        if (firstLoad) {
            firstLoad = false;
            return;
        }
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const data = change.doc.data();
                // We play it even if it's from us for testing purposes
                onBuzzReceived(data);
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

function triggerShake() {
    appContainer.classList.add('shake');
    setTimeout(() => appContainer.classList.remove('shake'), 500);
}

function playMsnSound(type) {
    if (!audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);

    let freq = 880;
    if (type === 'alert') freq = 1200;
    if (type === 'magic') freq = 1500;
    if (type === 'echo') freq = 440;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, audioContext.currentTime + 0.4);

    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
}

vibrationToggle.addEventListener('change', (e) => userPrefs.vibration = e.target.checked);
soundSelect.addEventListener('change', (e) => userPrefs.sound = e.target.value);
