/**
 * Zumbido App - MSN Edition
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM
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

const showSection = (sectionId) => {
    [authSection, contactsSection, settingsSection].forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
};

// Auth
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

loginBtn.addEventListener('click', async () => {
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
settingsBtn.addEventListener('click', () => showSection('settings-section'));
backBtn.addEventListener('click', () => showSection('contacts-section'));

pickContactBtn.addEventListener('click', async () => {
    if (!('contacts' in navigator)) {
        const name = prompt("Nombre del contacto:");
        if (name) addContactToList({ name: [name] });
        return;
    }
    try {
        const contacts = await navigator.contacts.select(['name'], { multiple: false });
        if (contacts.length) addContactToList(contacts[0]);
    } catch (e) { console.error(e); }
});

function addContactToList(contact) {
    const list = document.getElementById('contacts-list');
    const empty = list.querySelector('.empty-msg');
    if (empty) empty.remove();

    const name = contact.name ? contact.name[0] : "Sin nombre";
    const el = document.createElement('div');
    el.className = 'contact-item';
    el.innerHTML = `
        <div class="status-dot"></div>
        <span class="contact-name">${name}</span>
        <button class="buzz-btn-icon" title="¡Enviar Zumbido!"></button>
    `;

    el.querySelector('.buzz-btn-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        sendBuzz(name);
    });

    list.appendChild(el);
}

async function sendBuzz(toName) {
    try {
        await addDoc(collection(db, "buzzes"), {
            from: currentUser.displayName,
            fromId: currentUser.uid,
            toName: toName,
            timestamp: serverTimestamp(),
            sound: userPrefs.sound,
            vibration: userPrefs.vibration
        });
        // Visual feedback
        triggerShake();
    } catch (e) { console.error(e); }
}

function listenForBuzzes() {
    const q = query(collection(db, "buzzes"), orderBy("timestamp", "desc"), limit(1));
    let first = true;
    onSnapshot(q, (snap) => {
        if (first) { first = false; return; }
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const data = change.doc.data();
                if (data.fromId !== currentUser.uid) {
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
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${data.from}" style="width:30px; border-radius:3px;">
        <div class="notif-content">
            <strong>${data.from}</strong>
            <span>te ha enviado un zumbido.</span>
        </div>
    `;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 5000);
}

function triggerShake() {
    appContainer.classList.add('shake');
    setTimeout(() => appContainer.classList.remove('shake'), 500);
}

function playMsnSound(type) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Simple synthesis for that "ding" feeling
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
}

vibrationToggle.addEventListener('change', (e) => userPrefs.vibration = e.target.checked);
soundSelect.addEventListener('change', (e) => userPrefs.sound = e.target.value);
