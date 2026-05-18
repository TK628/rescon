import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCIBxNvfpaSV3sBS-VKtDob4zYhZJ7djIk",
    authDomain: "hidamari-pj-8b4bb.firebaseapp.com",
    databaseURL: "https://hidamari-pj-8b4bb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hidamari-pj-8b4bb",
    storageBucket: "hidamari-pj-8b4bb.firebasestorage.app",
    messagingSenderId: "293093126367",
    appId: "1:293093126367:web:151cce22308352fa5ff96a",
    measurementId: "G-7NNBEZBNXZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

function saveGameState(stateRef, state) {
    return set(stateRef, state);
}

function getSnapshotValue(snapshot) {
    return snapshot.val();
}

function listenGameState(stateRef, callback) {
    onValue(stateRef, (snapshot) => {
        callback(snapshot);
    });
}

export {
    db,
    ref,
    set,
    onValue,
    onDisconnect,
    remove,
    get,
    saveGameState,
    getSnapshotValue,
    listenGameState
};