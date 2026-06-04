const STORAGE_KEY = 'lens_care_data_v2';
let lenses = [];

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setDefaultDate();
    renderApp();
    checkNotificationPermission();
    
    // Sprawdzaj powiadomienia przy każdym otwarciu/odświeżeniu widoku
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkAndNotify();
        }
    });
});

// --- Zarządzanie Danymi ---

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    lenses = stored ? JSON.parse(stored) : [];
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lenses));
}

function setDefaultDate() {
    // Ustaw dzisiejszą datę jako domyślną w kalendarzu
    document.getElementById('startDate').valueAsDate = new Date();
}

// --- Logika Biznesowa i Daty ---

function addLens(startDateStr, durationDays) {
    const newLens = {
        id: Date.now().toString(),
        startDate: startDateStr,
        duration: parseInt(durationDays)
    };
    
    lenses.unshift(newLens); // Dodaj na początek (najnowsza pierwsza)
    saveData();
    renderApp();
}

function deleteLens(id) {
    if (confirm("Usunąć ten wpis z historii?")) {
        lenses = lenses.filter(l => l.id !== id);
        saveData();
        renderApp();
    }
}

function calculateDaysLeft(startDateStr, durationDays) {
    const start = new Date(startDateStr);
    start.setHours(12, 0, 0, 0); // Unikamy problemów ze strefami czasowymi/DST
    
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + durationDays);
    
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
        daysLeft: diffDays,
        expiryDate: expiry,
        isOverdue: diffDays < 0,
        isWarning: diffDays >= 0 && diffDays <= 3,
        isOk: diffDays > 3
    };
}

// --- Renderowanie UI ---

function renderApp() {
    const statusCard = document.getElementById('statusCard');
    const historyList = document.getElementById('historyList');
    
    historyList.innerHTML = '';

    if (lenses.length === 0) {
        statusCard.classList.add('hidden');
        historyList.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:0.9rem;">Brak historii</p>';
        return;
    }

    // Renderuj główną kartę na podstawie najnowszych soczewek (indeks 0)
    const activeLens = lenses[0];
    const status = calculateDaysLeft(activeLens.startDate, activeLens.duration);
    
    statusCard.classList.remove('hidden', 'success', 'warning', 'danger');
    
    const daysDisplay = document.getElementById('daysDisplay');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');
    const statusIcon = document.getElementById('statusIcon');
    const dateInfo = document.getElementById('dateInfo');

    dateInfo.textContent = `Założono: ${formatDate(activeLens.startDate)} | Termin: ${formatDate(status.expiryDate.toISOString())}`;

    if (status.isOverdue) {
        statusCard.classList.add('danger');
        statusIcon.textContent = '⚠️';
        statusTitle.textContent = 'Przeterminowane!';
        daysDisplay.textContent = `${Math.abs(status.daysLeft)} dni`;
        statusSubtitle.textContent = 'Natychmiastowa wymiana zalecana';
    } else if (status.isWarning) {
        statusCard.classList.add('warning');
        statusIcon.textContent = '⏳';
        statusTitle.textContent = status.daysLeft === 1 ? 'Jutro wymiana!' : 'Zbliża się termin';
        daysDisplay.textContent = `${status.daysLeft} dni`;
        statusSubtitle.textContent = 'Przygotuj nowe soczewki';
    } else {
        statusCard.classList.add('success');
        statusIcon.textContent = '✅';
        statusTitle.textContent = 'Wszystko w porządku';
        daysDisplay.textContent = `${status.daysLeft} dni`;
        statusSubtitle.textContent = 'Do następnej wymiany';
    }

    // Renderuj historię
    lenses.forEach(lens => {
        const lStatus = calculateDaysLeft(lens.startDate, lens.duration);
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-info">
                <span class="history-date">${formatDate(lens.startDate)}</span>
                <span class="history-duration">Na ${lens.duration} dni (Koniec: ${formatDate(lStatus.expiryDate.toISOString())})</span>
            </div>
            <button class="btn-delete" onclick="deleteLens('${lens.id}')" aria-label="Usuń">×</button>
        `;
        historyList.appendChild(div);
    });
    
    // Sprawdź powiadomienia po wyrenderowaniu
    checkAndNotify();
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- Obsługa Formularza ---

document.getElementById('lensForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const startDate = document.getElementById('startDate').value;
    const duration = document.getElementById('duration').value;
    
    if (startDate) {
        addLens(startDate, duration);
        // Opcjonalnie: zresetuj formularz lub zostaw datę
    }
});

// --- System Powiadomień (Lokalny) ---

function checkNotificationPermission() {
    if ("Notification" in window) {
        const btn = document.getElementById('notifyBtn');
        if (Notification.permission === "default") {
            btn.style.display = "block";
            btn.onclick = () => {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        btn.style.display = "none";
                        new Notification("LensCare", { body: "Powiadomienia włączone!" });
                    }
                });
            };
        } else if (Notification.permission === "granted") {
            btn.style.display = "none";
        }
    }
}

function checkAndNotify() {
    if (Notification.permission !== "granted" || lenses.length === 0) return;

    const activeLens = lenses[0];
    const status = calculateDaysLeft(activeLens.startDate, activeLens.duration);

    // Powiadomienie, jeśli został dokładnie 1 dzień (lub 0 dni, czyli dzisiaj jest ostatni dzień)
    if (status.daysLeft === 1 || status.daysLeft === 0) {
        // Sprawdź, czy nie wysłaliśmy już powiadomienia dzisiaj (prosta ochrona przed spamem)
        const lastNotif = sessionStorage.getItem('last_notif_date');
        const todayStr = new Date().toDateString();
        
        if (lastNotif !== todayStr) {
            const msg = status.daysLeft === 1 
                ? "Jutro kończy się czas noszenia soczewek. Przygotuj nowe!" 
                : "Dzisiaj jest ostatni dzień noszenia tych soczewek!";
                
            new Notification("LensCare: Wymiana soczewek", {
                body: msg,
                icon: "icon-192.png",
                badge: "icon-192.png",
                tag: "lens-reminder" // Nadpisuje poprzednie powiadomienie tego typu
            });
            
            sessionStorage.setItem('last_notif_date', todayStr);
        }
    }
}
