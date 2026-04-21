// Stromrechner App - Hauptanwendungslogik

class StromrechnerApp {
    constructor() {
        this.messwerte = [];
        this.zusatzdaten = {};
        this.tarife = [];
        this.aktuellerTag = null;
        this.bearbeitungsModus = false;
        this.bearbeitungsTarifId = null;
        this.debounceTimer = null;
        this.expertenmodus = false;

        // Undo-Funktion: History-Array für Snapshots
        this.history = [];
        this.maxHistory = 10;

        // Monatsansicht: Aktueller Monat (Format: YYYY-MM)
        this.aktuellerMonat = new Date().toISOString().substring(0, 7);

        this.ladeDaten();
        this.bindEvents();
        this.zeigeTabelle();
        this.zeigeTarife();
        this.registriereServiceWorker();
    }

    // Snapshot-Funktion: Deep Copy des aktuellen Datenzustands erstellen
    erstelleSnapshot() {
        return {
            messwerte: JSON.parse(JSON.stringify(this.messwerte)),
            zusatzdaten: JSON.parse(JSON.stringify(this.zusatzdaten)),
            tarife: JSON.parse(JSON.stringify(this.tarife))
        };
    }

    // Snapshot vor jeder Änderung speichern
    speichereSnapshot() {
        const snapshot = this.erstelleSnapshot();
        this.history.push(snapshot);

        // Max 10 Zustände behalten (FIFO)
        if (this.history.length > this.maxHistory) {
            this.history.shift(); // Ältesten Snapshot entfernen
        }
    }

    // Undo-Funktion: Letzten Zustand wiederherstellen
    undo() {
        if (this.history.length === 0) {
            this.zeigeFehler('Keine Änderungen zum Rückgängig machen.');
            return;
        }

        // Letzten Snapshot aus History holen und entfernen
        const snapshot = this.history.pop();

        // Daten wiederherstellen
        this.messwerte = snapshot.messwerte;
        this.zusatzdaten = snapshot.zusatzdaten;
        this.tarife = snapshot.tarife;

        // Daten speichern (ohne neuen Snapshot zu erstellen)
        this.speichereDaten();

        // UI neu rendern
        this.zeigeTabelle();
        this.zeigeTarife();

        this.zeigeFehler('Änderung rückgängig gemacht.', 'success');
    }

    // Debounce-Funktion: Verzögert die Ausführung einer Funktion
    debounce(func, delay) {
        return (...args) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Service Worker registrieren
    registriereServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('Service Worker registriert:', registration.scope);
                    })
                    .catch(error => {
                        console.log('Service Worker Registrierung fehlgeschlagen:', error);
                    });
            });
        }
    }

    // Initialisierung der App
    init() {
        this.ladeDaten();
        this.bindEvents();
        this.zeigeTabelle();
        this.zeigeTarife();
    }

    // Daten aus localStorage laden
    ladeDaten() {
        try {
            const messwerteData = localStorage.getItem('stromrechner_messwerte');
            const zusatzdatenData = localStorage.getItem('stromrechner_zusatzdaten');
            const tarifeData = localStorage.getItem('stromrechner_tarife');

            if (messwerteData) {
                this.messwerte = JSON.parse(messwerteData);
            }
            if (zusatzdatenData) {
                this.zusatzdaten = JSON.parse(zusatzdatenData);
            }
            if (tarifeData) {
                this.tarife = JSON.parse(tarifeData);
            } else {
                // Standardtarif erstellen, falls keiner vorhanden
                this.tarife = [{
                    id: this.generateId(),
                    von: '2024-01-01',
                    bis: null,
                    grundpreis: 9.90,
                    htPreis: 0.2850,
                    ntPreis: 0.2075
                }];
                this.speichereDaten();
            }
        } catch (error) {
            this.zeigeFehler('Fehler beim Laden der Daten: ' + error.message);
        }
    }

    // Daten im localStorage speichern
    speichereDaten() {
        try {
            localStorage.setItem('stromrechner_messwerte', JSON.stringify(this.messwerte));
            localStorage.setItem('stromrechner_zusatzdaten', JSON.stringify(this.zusatzdaten));
            localStorage.setItem('stromrechner_tarife', JSON.stringify(this.tarife));
        } catch (error) {
            this.zeigeFehler('Fehler beim Speichern der Daten: ' + error.message);
        }
    }

    // Event-Listener binden
    bindEvents() {
        // Tab-Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.wechsleTab(e.target.dataset.tab));
        });

        // Floating Action Button
        document.getElementById('add-btn').addEventListener('click', () => this.oeffneDetailModal());

        // Modal Events
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.schliesseModal(e.target.closest('.modal')));
        });

        // Detail Modal
        document.getElementById('detail-speichern').addEventListener('click', () => this.speichereDetail());
        document.getElementById('detail-loeschen').addEventListener('click', () => this.loescheDetail());

        // Backup Modal
        document.getElementById('backup-btn').addEventListener('click', () => this.oeffneBackupModal());

        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => location.reload());

        // Expertenmodus
        document.getElementById('tarife-btn').addEventListener('click', () => this.toggleExpertenmodus());
        document.getElementById('backup-erstellen').addEventListener('click', () => this.erstelleBackup());
        document.getElementById('backup-laden').addEventListener('click', () => this.ladeBackup());
        document.getElementById('backup-file').addEventListener('change', (e) => this.verarbeiteBackupDatei(e));

        // Monatsnavigation
        document.getElementById('monat-vorher').addEventListener('click', () => {
            alert('Monat vorher Button geklickt');
            this.wechsleMonat('vorher');
        });
        document.getElementById('monat-naechster').addEventListener('click', () => {
            alert('Monat nächster Button geklickt');
            this.wechsleMonat('naechster');
        });

        // Mobile: Kalender-Icon löst nativen Picker aus
        document.getElementById('monat-picker-btn').addEventListener('click', () => {
            document.getElementById('monat-picker').showPicker();
        });

        // Nativer Picker (Mobile)
        document.getElementById('monat-picker').addEventListener('change', (e) => this.setzeMonat(e.target.value));

        // Desktop: Select-Boxen für Monat und Jahr
        document.getElementById('monat-select-monat').addEventListener('change', (e) => {
            const jahr = document.getElementById('monat-select-jahr').value;
            const monat = String(parseInt(e.target.value) + 1).padStart(2, '0');
            this.setzeMonat(`${jahr}-${monat}`);
        });

        document.getElementById('monat-select-jahr').addEventListener('change', (e) => {
            const jahr = e.target.value;
            const monat = String(parseInt(document.getElementById('monat-select-monat').value) + 1).padStart(2, '0');
            this.setzeMonat(`${jahr}-${monat}`);
        });

        // Jahre-Select-Box initialisieren
        this.initialisiereJahreSelect();

        // Swipe-Gesten für Mobile (Monatswechsel) - nur im Monats-Header
        const monatsHeader = document.querySelector('.monats-header');
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        let touchStartTime = 0;

        monatsHeader.addEventListener('touchstart', (e) => {
            // Prüfen ob das Touch auf einem Button passiert ist
            const target = e.target;
            if (target.tagName === 'BUTTON' || target.closest('button')) {
                // Swipe-Logik überspringen - Button soll funktionieren
                return;
            }

            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
            touchStartTime = Date.now();
        }, { passive: true });

        monatsHeader.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;

            // Prüfen ob das Touch auf einem Button passiert ist
            const target = e.target;
            if (target.tagName === 'BUTTON' || target.closest('button')) {
                // Nicht preventDefault - Click-Event auf Button soll funktionieren
                return;
            }

            this.handleSwipe();
            e.preventDefault(); // Bubbling verhindern
        }, { passive: false });

        this.handleSwipe = () => {
            const swipeThreshold = 50; // Mindest-Swipe-Distanz horizontal
            const verticalThreshold = 10; // Max vertikale Bewegung für Swipe (strenger)
            const timeThreshold = 300; // Max Dauer für Swipe (ms)

            const diffX = touchStartX - touchEndX;
            const diffY = Math.abs(touchStartY - touchEndY);
            const timeDiff = Date.now() - touchStartTime;

            // Nur Swipe erkennen, wenn Bewegung überwiegend horizontal und schnell (kein langsames Scrollen)
            if (Math.abs(diffX) > swipeThreshold && diffY < verticalThreshold && timeDiff < timeThreshold) {
                if (diffX > 0) {
                    // Swipe links -> nächster Monat
                    this.wechsleMonat('naechster');
                } else {
                    // Swipe rechts -> vorheriger Monat
                    this.wechsleMonat('vorher');
                }
            }
        };

        // Undo-Button (Desktop: Klick, Mobile: Long-Press) mit Pointer Events
        const undoBtn = document.getElementById('undo-btn');
        const undoCircle = document.getElementById('undo-circle');
        let pressTimer = null;
        let longPressTriggered = false;

        undoBtn.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') {
                longPressTriggered = false;
                undoCircle.classList.add('active');

                pressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    this.undo();
                    undoCircle.classList.remove('active');
                }, 2000); // 2 Sekunden Long-Press
            }
        });

        undoBtn.addEventListener('pointerup', (e) => {
            clearTimeout(pressTimer);
            undoCircle.classList.remove('active');

            if (e.pointerType === 'mouse') {
                this.undo(); // Klick nur für Maus
            }
        });

        undoBtn.addEventListener('pointerleave', () => {
            clearTimeout(pressTimer);
            undoCircle.classList.remove('active');
        });

        // Tarifverwaltung
        document.getElementById('tarif-hinzufuegen').addEventListener('click', () => this.fuegeTarifHinzu());
        document.getElementById('tarif-speichern').addEventListener('click', () => this.speichereTarif());

        // Modal Hintergrund schließen
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.schliesseModal(modal);
                }
            });
        });

        // Echtzeit-Updates in Detailansicht mit Debouncing
        const debouncedBerechneDetail = this.debounce(() => this.berechneDetail(), 300);
        const debouncedPruefeDatum = this.debounce(() => this.pruefeDatumExistiert(), 300);

        ['detail-ht', 'detail-nt', 'detail-datum-input', 'detail-heizungen', 'detail-temperatur'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                if (id === 'detail-datum-input') {
                    this.bearbeitungsModus = false; // Datum geändert = neuer Eintrag
                    this.aktuellerTag = document.getElementById('detail-datum-input').value;
                    // Zum Monat des gewählten Datums wechseln
                    const neuesDatum = document.getElementById('detail-datum-input').value;
                    if (neuesDatum) {
                        this.aktuellerMonat = neuesDatum.substring(0, 7);
                        this.zeigeTabelle();
                    }
                    debouncedPruefeDatum(); // Prüfung beim Datumseingabe mit Debouncing
                }
                debouncedBerechneDetail(); // Berechnung mit Debouncing
            });

            // Enter-Taste zum Springen zum nächsten Feld
            document.getElementById(id).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const feldReihenfolge = ['detail-datum-input', 'detail-ht', 'detail-nt', 'detail-heizungen', 'detail-temperatur', 'detail-notiz'];
                    const currentIndex = feldReihenfolge.indexOf(id);
                    if (currentIndex < feldReihenfolge.length - 1) {
                        const naechstesFeld = document.getElementById(feldReihenfolge[currentIndex + 1]);
                        naechstesFeld.focus();
                    }
                }
            });
        });
    }

    // Tab wechseln
    wechsleTab(tabName) {
        // Tab-Buttons aktualisieren
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Tab-Inhalte aktualisieren
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
    }

    // Monats-Anzeige aktualisieren
    aktualisiereMonatsAnzeige() {
        const datum = new Date(this.aktuellerMonat + '-01');
        const monatName = this.formatiereMonat(datum);
        document.getElementById('monat-name').textContent = monatName;
        document.getElementById('monat-picker').value = this.aktuellerMonat;

        // Desktop: Select-Boxen aktualisieren
        const jahr = this.aktuellerMonat.substring(0, 4);
        const monat = parseInt(this.aktuellerMonat.substring(5, 7)) - 1;
        document.getElementById('monat-select-monat').value = monat;
        document.getElementById('monat-select-jahr').value = jahr;
    }

    // Jahre-Select-Box initialisieren
    initialisiereJahreSelect() {
        const jahrSelect = document.getElementById('monat-select-jahr');
        const aktuellesJahr = new Date().getFullYear();
        const startJahr = 2020; // Startjahr
        const endJahr = aktuellesJahr + 5; // Bis 5 Jahre in der Zukunft

        jahrSelect.innerHTML = '';
        for (let jahr = startJahr; jahr <= endJahr; jahr++) {
            const option = document.createElement('option');
            option.value = jahr;
            option.textContent = jahr;
            jahrSelect.appendChild(option);
        }
    }

    // Monat wechseln (vorheriger/nächster Monat)
    wechsleMonat(richtung) {
        const datum = new Date(this.aktuellerMonat + '-01');
        if (richtung === 'vorher') {
            datum.setMonth(datum.getMonth() - 1);
        } else {
            datum.setMonth(datum.getMonth() + 1);
        }
        this.aktuellerMonat = datum.toISOString().substring(0, 7);
        this.zeigeTabelle();
    }

    // Monat über Picker ändern
    setzeMonat(monat) {
        this.aktuellerMonat = monat;
        this.zeigeTabelle();
    }

    // Tabelle anzeigen
    zeigeTabelle() {
        const tbody = document.getElementById('tabelle-body');
        tbody.innerHTML = '';

        // Monats-Anzeige aktualisieren
        this.aktualisiereMonatsAnzeige();

        if (this.messwerte.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">Keine Daten vorhanden. Klicken Sie auf + um den ersten Eintrag hinzuzufügen.</td></tr>';
            return;
        }

        // Sortieren nach Datum
        const sortierteWerte = [...this.messwerte].sort((a, b) => new Date(a.datum) - new Date(b.datum));

        // Interpolierte Werte berechnen
        const interpolierteDaten = this.berechneInterpolation(sortierteWerte);

        // Nur Daten des aktuellen Monats filtern
        const monatsDaten = interpolierteDaten.filter(eintrag => eintrag.datum.startsWith(this.aktuellerMonat));

        if (monatsDaten.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">Keine Daten für diesen Monat vorhanden.</td></tr>';
            return;
        }

        // Monatliche Zusammenfassungen berechnen
        const monatsZusammenfassungen = this.berechneMonatlicheZusammenfassung(interpolierteDaten);
        const zusammenfassung = monatsZusammenfassungen.find(z => z.monat === this.aktuellerMonat);

        // Alle Einträge des Monats anzeigen
        monatsDaten.forEach(eintrag => {
            const row = this.erstelleTabellenZeile(eintrag);
            tbody.appendChild(row);
        });

        // Zusammenfassungszeile für den Monat hinzufügen
        if (zusammenfassung) {
            const zusammenfassungRow = this.erstelleMonatZusammenfassungZeile(zusammenfassung);
            tbody.appendChild(zusammenfassungRow);
        }
    }

    // Monatliche Zusammenfassungszeile erstellen
    erstelleMonatZusammenfassungZeile(zusammenfassung) {
        const row = document.createElement('tr');
        row.classList.add('monat-zusammenfassung');

        // Datum: Monatsname
        const datumCell = document.createElement('td');
        datumCell.textContent = zusammenfassung.monatName + ' Gesamt';
        row.appendChild(datumCell);

        // HT: -
        const htCell = document.createElement('td');
        htCell.textContent = '-';
        row.appendChild(htCell);

        // NT: -
        const ntCell = document.createElement('td');
        ntCell.textContent = '-';
        row.appendChild(ntCell);

        // Expertenmodus: Zusätzliche Spalten nach NT
        if (this.expertenmodus) {
            // HT/Tag Summe
            const htTagCell = document.createElement('td');
            htTagCell.textContent = zusammenfassung.htKwhGesamt.toFixed(1).replace('.', ',') + ' kWh';
            row.appendChild(htTagCell);

            // NT/Tag Summe
            const ntTagCell = document.createElement('td');
            ntTagCell.textContent = zusammenfassung.ntKwhGesamt.toFixed(1).replace('.', ',') + ' kWh';
            row.appendChild(ntTagCell);
        }

        // kWh: Gesamtverbrauch
        const kwhCell = document.createElement('td');
        kwhCell.textContent = (zusammenfassung.htKwhGesamt + zusammenfassung.ntKwhGesamt).toFixed(1).replace('.', ',') + ' kWh';
        row.appendChild(kwhCell);

        // Expertenmodus: Zusätzliche Spalten nach Verbrauch Gesamt
        if (this.expertenmodus) {
            // Grundpreis Summe
            const grundpreisCell = document.createElement('td');
            grundpreisCell.textContent = zusammenfassung.grundpreisMonat.toFixed(2).replace('.', ',') + ' €';
            row.appendChild(grundpreisCell);

            // HT Kosten Summe
            const htKostenCell = document.createElement('td');
            htKostenCell.textContent = zusammenfassung.htKostenGesamt.toFixed(2).replace('.', ',') + ' €';
            row.appendChild(htKostenCell);

            // NT Kosten Summe
            const ntKostenCell = document.createElement('td');
            ntKostenCell.textContent = zusammenfassung.ntKostenGesamt.toFixed(2).replace('.', ',') + ' €';
            row.appendChild(ntKostenCell);
        }

        // Kosten: Gesamtkosten
        const kostenCell = document.createElement('td');
        kostenCell.textContent = zusammenfassung.gesamtkosten.toFixed(2).replace('.', ',') + ' €';
        row.appendChild(kostenCell);

        // Expertenmodus: Zusätzliche Spalten nach Kosten Gesamt
        if (this.expertenmodus) {
            // Heizungen Durchschnitt
            const heizungenCell = document.createElement('td');
            if (zusammenfassung.heizungenDurchschnitt !== null) {
                heizungenCell.textContent = zusammenfassung.heizungenDurchschnitt.toFixed(1).replace('.', ',');
            } else {
                heizungenCell.textContent = '-';
            }
            row.appendChild(heizungenCell);

            // Temperatur Durchschnitt
            const temperaturCell = document.createElement('td');
            if (zusammenfassung.temperaturDurchschnitt !== null) {
                temperaturCell.textContent = zusammenfassung.temperaturDurchschnitt.toFixed(1).replace('.', ',') + '°C';
            } else {
                temperaturCell.textContent = '-';
            }
            row.appendChild(temperaturCell);

            // Notiz: leer (keine Monats-Notiz)
            const notizCell = document.createElement('td');
            notizCell.textContent = '-';
            row.appendChild(notizCell);
        }

        // Klick-Event für Monatszusammenfassung
        row.addEventListener('click', () => this.oeffneMonatZusammenfassungModal(zusammenfassung));

        return row;
    }

    // Monatliches Zusammenfassungs-Modal öffnen
    oeffneMonatZusammenfassungModal(zusammenfassung) {
        const modal = document.getElementById('monat-zusammenfassung-modal');
        modal.classList.add('active');

        // Daten im Modal anzeigen
        document.getElementById('monat-zusammenfassung-titel').textContent = zusammenfassung.monatName + ' Gesamt';
        document.getElementById('monat-tage').textContent = zusammenfassung.tage;
        document.getElementById('monat-heizungen-durchschnitt').textContent =
            zusammenfassung.heizungenDurchschnitt !== null
                ? zusammenfassung.heizungenDurchschnitt.toFixed(1).replace('.', ',')
                : '-';
        document.getElementById('monat-temperatur-durchschnitt').textContent =
            zusammenfassung.temperaturDurchschnitt !== null
                ? zusammenfassung.temperaturDurchschnitt.toFixed(1).replace('.', ',') + ' °C'
                : '-';
        document.getElementById('monat-ht-gesamt').textContent =
            zusammenfassung.htKwhGesamt.toFixed(1).replace('.', ',') + ' kWh';
        document.getElementById('monat-nt-gesamt').textContent =
            zusammenfassung.ntKwhGesamt.toFixed(1).replace('.', ',') + ' kWh';
        document.getElementById('monat-grundpreis').textContent =
            zusammenfassung.grundpreisMonat.toFixed(2).replace('.', ',') + ' €';
        document.getElementById('monat-ht-kosten').textContent =
            zusammenfassung.htKostenGesamt.toFixed(2).replace('.', ',') + ' €';
        document.getElementById('monat-nt-kosten').textContent =
            zusammenfassung.ntKostenGesamt.toFixed(2).replace('.', ',') + ' €';
        document.getElementById('monat-gesamtkosten').textContent =
            zusammenfassung.gesamtkosten.toFixed(2).replace('.', ',') + ' €';
    }

    // Tabellenzeile erstellen
    erstelleTabellenZeile(eintrag) {
        const row = document.createElement('tr');

        // Klasse für interpolierte Zeilen
        if (eintrag.interpoliert) {
            row.classList.add('interpolated');
        }

        // Datum
        const datumCell = document.createElement('td');
        if (eintrag.interpoliert) {
            datumCell.textContent = '~ ' + this.formatiereDatum(eintrag.datum);
        } else {
            datumCell.textContent = this.formatiereDatum(eintrag.datum);
        }
        row.appendChild(datumCell);

        // HT (nur bei echten Messwerten anzeigen)
        const htCell = document.createElement('td');
        if (!eintrag.interpoliert && eintrag.ht !== null) {
            htCell.textContent = eintrag.ht.toFixed(1).replace('.', ',') + ' kWh';
        }
        row.appendChild(htCell);

        // NT (nur bei echten Messwerten anzeigen)
        const ntCell = document.createElement('td');
        if (!eintrag.interpoliert && eintrag.nt !== null) {
            ntCell.textContent = eintrag.nt.toFixed(1).replace('.', ',') + ' kWh';
        }
        row.appendChild(ntCell);

        // Expertenmodus: Zusätzliche Spalten nach NT
        if (this.expertenmodus) {
            const kosten = this.berechneKosten(eintrag.datum, eintrag.ht, eintrag.nt);

            // HT/Tag
            const htTagCell = document.createElement('td');
            if (kosten.htProTag > 0) {
                htTagCell.textContent = kosten.htProTag.toFixed(1).replace('.', ',') + ' kWh';
            } else {
                htTagCell.textContent = '-';
            }
            row.appendChild(htTagCell);

            // NT/Tag
            const ntTagCell = document.createElement('td');
            if (kosten.ntProTag > 0) {
                ntTagCell.textContent = kosten.ntProTag.toFixed(1).replace('.', ',') + ' kWh';
            } else {
                ntTagCell.textContent = '-';
            }
            row.appendChild(ntTagCell);
        }

        // kWh (Tagesverbrauch)
        const kwhCell = document.createElement('td');
        kwhCell.textContent = eintrag.tagesverbrauch.toFixed(1).replace('.', ',') + ' kWh';
        row.appendChild(kwhCell);

        // Expertenmodus: Zusätzliche Spalten nach Verbrauch Gesamt
        if (this.expertenmodus) {
            const kosten = this.berechneKosten(eintrag.datum, eintrag.ht, eintrag.nt);

            // Grundpreis
            const grundpreisCell = document.createElement('td');
            if (kosten.tarif) {
                grundpreisCell.textContent = kosten.grundpreisProTag.toFixed(2).replace('.', ',') + ' €';
            } else {
                grundpreisCell.textContent = 'Kein Tarif';
            }
            row.appendChild(grundpreisCell);

            // HT Kosten
            const htKostenCell = document.createElement('td');
            if (kosten.tarif && kosten.htKosten > 0) {
                htKostenCell.textContent = kosten.htKosten.toFixed(2).replace('.', ',') + ' €';
            } else {
                htKostenCell.textContent = '-';
            }
            row.appendChild(htKostenCell);

            // NT Kosten
            const ntKostenCell = document.createElement('td');
            if (kosten.tarif && kosten.ntKosten > 0) {
                ntKostenCell.textContent = kosten.ntKosten.toFixed(2).replace('.', ',') + ' €';
            } else {
                ntKostenCell.textContent = '-';
            }
            row.appendChild(ntKostenCell);
        }

        // Kosten
        const kostenCell = document.createElement('td');
        kostenCell.textContent = eintrag.tageskosten.toFixed(2).replace('.', ',') + ' €';
        row.appendChild(kostenCell);

        // Expertenmodus: Zusätzliche Spalten nach Kosten Gesamt
        if (this.expertenmodus) {
            const zusatz = this.zusatzdaten[eintrag.datum];

            // Heizungen
            const heizungenCell = document.createElement('td');
            if (zusatz && zusatz.heizungen !== null) {
                heizungenCell.textContent = zusatz.heizungen;
            }
            row.appendChild(heizungenCell);

            // Temperatur
            const temperaturCell = document.createElement('td');
            if (zusatz && zusatz.temperatur !== null) {
                temperaturCell.textContent = zusatz.temperatur + '°C';
            }
            row.appendChild(temperaturCell);

            // Notiz (gekürzt auf 20 Zeichen)
            const notizCell = document.createElement('td');
            if (zusatz && zusatz.notiz) {
                const gekuerzteNotiz = zusatz.notiz.length > 20 ? zusatz.notiz.substring(0, 20) + '...' : zusatz.notiz;
                notizCell.textContent = gekuerzteNotiz;
                notizCell.classList.add('notiz-zelle');
            }
            row.appendChild(notizCell);
        }

        // Klick-Event für Detailansicht
        row.addEventListener('click', () => this.oeffneDetailModal(eintrag.datum));

        return row;
    }

    // Lazy Loading: Max 100 Einträge auf einmal anzeigen
    MAX_EINTRAEGE_ANZEIGEN = 100;

    // Interpolation berechnen
    berechneInterpolation(messwerte) {
        if (messwerte.length === 0) return [];

        const interpolierteDaten = [];
        
        for (let i = 0; i < messwerte.length; i++) {
            const aktuellerWert = messwerte[i];
            const naechsterWert = messwerte[i + 1];

            // Aktuellen Messwert hinzufügen
            interpolierteDaten.push({
                ...aktuellerWert,
                tagesverbrauch: this.berechneTagesverbrauch(aktuellerWert),
                tageskosten: this.berechneTageskosten(aktuellerWert),
                htProTag: 0,
                ntProTag: 0,
                interpoliert: false
            });

            // Wenn es einen nächsten Wert gibt, interpolieren
            if (naechsterWert) {
                const tageDiff = this.tageZwischen(aktuellerWert.datum, naechsterWert.datum);
                
                if (tageDiff > 1) {
                    const htDiff = naechsterWert.ht - aktuellerWert.ht;
                    const ntDiff = naechsterWert.nt - aktuellerWert.nt;
                    const htProTag = htDiff / tageDiff;
                    const ntProTag = ntDiff / tageDiff;

                    // Interpolierte Tage hinzufügen
                    for (let tag = 1; tag < tageDiff; tag++) {
                        const interpoliertesDatum = this.addiereTage(aktuellerWert.datum, tag);
                        const interpoliertesDatumObj = new Date(interpoliertesDatum);

                        interpolierteDaten.push({
                            datum: interpoliertesDatum,
                            ht: null,
                            nt: null,
                            tagesverbrauch: htProTag + ntProTag,
                            tageskosten: this.berechneTageskostenFuerVerbrauch(htProTag, ntProTag, interpoliertesDatumObj),
                            htProTag: htProTag,
                            ntProTag: ntProTag,
                            interpoliert: true
                        });
                    }
                }
            }
        }

        return interpolierteDaten;
    }

    // Monatliche Zusammenfassung berechnen
    berechneMonatlicheZusammenfassung(interpolierteDaten) {
        const monatsZusammenfassungen = [];
        const monatsDaten = {};

        // Daten nach Monat gruppieren
        interpolierteDaten.forEach(eintrag => {
            const datum = new Date(eintrag.datum);
            const monatKey = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`;

            if (!monatsDaten[monatKey]) {
                monatsDaten[monatKey] = {
                    monat: monatKey,
                    tage: 0,
                    htGesamt: 0,
                    ntGesamt: 0,
                    heizungen: [],
                    temperaturen: [],
                    kosten: 0
                };
            }

            monatsDaten[monatKey].tage++;
            monatsDaten[monatKey].htGesamt += eintrag.tagesverbrauch * (eintrag.htProTag || 0);
            monatsDaten[monatKey].ntGesamt += eintrag.tagesverbrauch * (eintrag.ntProTag || 0);
            monatsDaten[monatKey].kosten += eintrag.tageskosten;

            if (this.zusatzdaten[eintrag.datum]) {
                if (this.zusatzdaten[eintrag.datum].heizungen) {
                    monatsDaten[monatKey].heizungen.push(this.zusatzdaten[eintrag.datum].heizungen);
                }
                if (this.zusatzdaten[eintrag.datum].temperatur !== null && this.zusatzdaten[eintrag.datum].temperatur !== undefined) {
                    monatsDaten[monatKey].temperaturen.push(this.zusatzdaten[eintrag.datum].temperatur);
                }
            }
        });

        // Zusammenfassungen berechnen
        Object.values(monatsDaten).forEach(monat => {
            const datum = new Date(monat.monat + '-01');
            const tarif = this.getTarifFuerDatum(datum);
            const tageImMonat = this.tageImMonat(datum);
            const grundpreisMonat = tarif ? tarif.grundpreis : 0;

            // Durchschnittswerte berechnen (nur Tage mit Werten)
            const heizungenDurchschnitt = monat.heizungen.length > 0
                ? monat.heizungen.reduce((a, b) => a + b, 0) / monat.heizungen.length
                : null;
            const temperaturDurchschnitt = monat.temperaturen.length > 0
                ? monat.temperaturen.reduce((a, b) => a + b, 0) / monat.temperaturen.length
                : null;

            // HT/NT kWh gesamt berechnen (Summe aller Tage - dynamisch wie in Tabelle)
            const monatsEintraege = interpolierteDaten.filter(e => e.datum.startsWith(monat.monat));
            let htKwhGesamt = 0;
            let ntKwhGesamt = 0;
            let htKostenGesamt = 0;
            let ntKostenGesamt = 0;

            monatsEintraege.forEach(eintrag => {
                const kosten = this.berechneKosten(eintrag.datum, eintrag.ht, eintrag.nt);
                htKwhGesamt += kosten.htProTag;
                ntKwhGesamt += kosten.ntProTag;
                htKostenGesamt += kosten.htKosten;
                ntKostenGesamt += kosten.ntKosten;
            });

            monatsZusammenfassungen.push({
                monat: monat.monat,
                monatName: this.formatiereMonat(datum),
                tage: tageImMonat,
                heizungenDurchschnitt: heizungenDurchschnitt,
                temperaturDurchschnitt: temperaturDurchschnitt,
                htKwhGesamt: htKwhGesamt,
                ntKwhGesamt: ntKwhGesamt,
                grundpreisMonat: grundpreisMonat,
                htKostenGesamt: htKostenGesamt,
                ntKostenGesamt: ntKostenGesamt,
                gesamtkosten: monat.kosten
            });
        });

        return monatsZusammenfassungen;
    }

    // Monat formatieren (z.B. "Februar 2024")
    formatiereMonat(datum) {
        const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        return `${monate[datum.getMonth()]} ${datum.getFullYear()}`;
    }

    // Tagesverbrauch berechnen
    berechneTagesverbrauch(wert) {
        if (!wert.ht || !wert.nt) return 0;
        
        const vorherigerWert = this.getVorherigenMesswert(wert.datum);
        if (!vorherigerWert) return 0;

        const htDiff = wert.ht - vorherigerWert.ht;
        const ntDiff = wert.nt - vorherigerWert.nt;
        const tageDiff = this.tageZwischen(vorherigerWert.datum, wert.datum);

        return (htDiff + ntDiff) / tageDiff;
    }

    // Tageskosten berechnen
    berechneTageskosten(wert) {
        const tagesverbrauch = this.berechneTagesverbrauch(wert);
        const datum = new Date(wert.datum);
        const tarif = this.getTarifFuerDatum(datum);

        if (!tarif) return 0;

        const vorherigerWert = this.getVorherigenMesswert(wert.datum);
        if (!vorherigerWert) {
            // Ohne vorherigen Wert nur Grundpreis zurückgeben
            const grundpreisProTag = tarif.grundpreis / this.tageImMonat(datum);
            return grundpreisProTag;
        }

        const htDiff = wert.ht - vorherigerWert.ht;
        const ntDiff = wert.nt - vorherigerWert.nt;
        const tageDiff = this.tageZwischen(vorherigerWert.datum, wert.datum);

        const htProTag = htDiff / tageDiff;
        const ntProTag = ntDiff / tageDiff;
        const grundpreisProTag = tarif.grundpreis / this.tageImMonat(datum);

        return (htProTag * tarif.htPreis) + (ntProTag * tarif.ntPreis) + grundpreisProTag;
    }

    // Tageskosten für Verbrauch berechnen
    berechneTageskostenFuerVerbrauch(htProTag, ntProTag, datum) {
        const tarif = this.getTarifFuerDatum(datum);
        if (!tarif) return 0;

        const grundpreisProTag = tarif.grundpreis / this.tageImMonat(datum);
        return (htProTag * tarif.htPreis) + (ntProTag * tarif.ntPreis) + grundpreisProTag;
    }

    // Hilfsfunktionen
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatiereDatum(datumString) {
        const datum = new Date(datumString);
        return datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    tageZwischen(startDatum, endDatum) {
        const start = new Date(startDatum);
        const ende = new Date(endDatum);
        const diffTime = Math.abs(ende - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    addiereTage(datumString, tage) {
        const datum = new Date(datumString);
        datum.setDate(datum.getDate() + tage);
        return datum.toISOString().split('T')[0];
    }

    tageImMonat(datum) {
        return new Date(datum.getFullYear(), datum.getMonth() + 1, 0).getDate();
    }

    getVorherigenMesswert(datumString) {
        const datum = new Date(datumString);
        const vorherigeWerte = this.messwerte
            .filter(w => new Date(w.datum) < datum)
            .sort((a, b) => new Date(b.datum) - new Date(a.datum));

        return vorherigeWerte.length > 0 ? vorherigeWerte[0] : null;
    }

    getNaechstenMesswert(datumString) {
        const datum = new Date(datumString);
        const naechsteWerte = this.messwerte
            .filter(w => new Date(w.datum) > datum)
            .sort((a, b) => new Date(a.datum) - new Date(b.datum));

        return naechsteWerte.length > 0 ? naechsteWerte[0] : null;
    }

    getTarifFuerDatum(datum) {
        return this.tarife.find(tarif => {
            const vonDatum = new Date(tarif.von);
            const bisDatum = tarif.bis ? new Date(tarif.bis) : new Date('2099-12-31');
            return datum >= vonDatum && datum <= bisDatum;
        });
    }

    // Prüft, ob sich ein Tarif mit existierenden Tarifen überschneidet
    pruefeTarifUeberschneidung(von, bis, ausserId = null) {
        const neuerVon = new Date(von);
        const neuerBis = bis ? new Date(bis) : new Date('2099-12-31');

        return this.tarife.some(tarif => {
            // Überspringe den Tarif selbst bei Bearbeitung
            if (ausserId && tarif.id === ausserId) return false;

            const existierenderVon = new Date(tarif.von);
            const existierenderBis = tarif.bis ? new Date(tarif.bis) : new Date('2099-12-31');

            // Prüfe auf Überschneidung
            return !(neuerBis < existierenderVon || neuerVon > existierenderBis);
        });
    }

    // Prüft, ob ein Datum bereits als echter oder interpolierter Tag vorhanden ist
    istDatumBereitsBelegt(datumString) {
        // Echte Messwerte
        if (this.messwerte.some(w => w.datum === datumString)) {
            return true;
        }

        // Interpolierte Tage zwischen Messpunkten
        if (this.messwerte.length < 2) {
            return false;
        }

        const sortierteWerte = [...this.messwerte].sort((a, b) => new Date(a.datum) - new Date(b.datum));
        const interpolierteDaten = this.berechneInterpolation(sortierteWerte);
        return interpolierteDaten.some(eintrag => eintrag.interpoliert && eintrag.datum === datumString);
    }

    // Prüft, ob Datum bereits existiert und zeigt Warnung an
    pruefeDatumExistiert() {
        if (!this.bearbeitungsModus) {
            const datumIstBelegt = this.istDatumBereitsBelegt(this.aktuellerTag);
            const datumInput = document.getElementById('detail-datum-input');
            const datumWarnung = document.getElementById('datum-warnung');
            
            if (datumIstBelegt) {
                datumInput.style.borderColor = '#dc2626'; // Rot markieren
                datumWarnung.textContent = 'Datum existiert bereits';
                datumWarnung.classList.add('aktiv');
            } else {
                datumInput.style.borderColor = '#d1d5db'; // Normal zurücksetzen
                datumWarnung.textContent = '';
                datumWarnung.classList.remove('aktiv');
            }
        }
    }

    // Modal-Funktionen
    oeffneDetailModal(datum = null) {
        const modal = document.getElementById('detail-modal');
        modal.classList.add('active');

        if (datum) {
            this.aktuellerTag = datum;
            this.bearbeitungsModus = true; // Bearbeitung durch Anklicken
            this.ladeDetailDaten(datum);
            // Zum Monat des Eintrags wechseln
            this.aktuellerMonat = datum.substring(0, 7);
            this.zeigeTabelle();
        } else {
            this.aktuellerTag = new Date().toISOString().split('T')[0];
            this.bearbeitungsModus = false; // Neuer Eintrag
            this.leereDetailFormular();
        }

        document.getElementById('detail-datum').textContent = this.formatiereDatum(this.aktuellerTag);
        document.getElementById('detail-datum-input').value = this.aktuellerTag;
    }

    schliesseModal(modal) {
        modal.classList.remove('active');
        this.aktuellerTag = null;
        this.bearbeitungsModus = false; // Zurücksetzen beim Schließen
        
        // Warnung zurücksetzen
        const datumWarnung = document.getElementById('datum-warnung');
        if (datumWarnung) {
            datumWarnung.textContent = '';
            datumWarnung.classList.remove('aktiv');
        }
    }

    ladeDetailDaten(datum) {
        const messwert = this.messwerte.find(w => w.datum === datum);
        const zusatz = this.zusatzdaten[datum] || {};

        document.getElementById('detail-datum-input').value = datum;
        // input[type="number"] erwartet Dezimalpunkt; Komma würde das Feld leeren.
        document.getElementById('detail-ht').value = (messwert && messwert.ht !== null && messwert.ht !== undefined) ? String(messwert.ht) : '';
        document.getElementById('detail-nt').value = (messwert && messwert.nt !== null && messwert.nt !== undefined) ? String(messwert.nt) : '';
        document.getElementById('detail-heizungen').value = zusatz.heizungen || '';
        document.getElementById('detail-temperatur').value = (zusatz.temperatur !== null && zusatz.temperatur !== undefined) ? String(zusatz.temperatur) : '';
        document.getElementById('detail-notiz').value = zusatz.notiz || '';

        // Datum-Eingabefeld zurücksetzen (im Bearbeitungsmodus)
        const datumInput = document.getElementById('detail-datum-input');
        const datumWarnung = document.getElementById('datum-warnung');
        datumInput.style.borderColor = '#d1d5db';
        datumWarnung.textContent = '';
        datumWarnung.classList.remove('aktiv');

        this.berechneDetail();
    }

    leereDetailFormular() {
        const heute = new Date().toISOString().split('T')[0];
        document.getElementById('detail-datum-input').value = heute;
        document.getElementById('detail-ht').value = '';
        document.getElementById('detail-nt').value = '';
        document.getElementById('detail-heizungen').value = '';
        document.getElementById('detail-temperatur').value = '';
        document.getElementById('detail-notiz').value = '';

        // Prüfung für das heutige Datum
        this.aktuellerTag = heute;
        this.pruefeDatumExistiert();

        // Datum-Eingabefeld fokussieren
        document.getElementById('detail-datum-input').focus();

        // Berechnete Werte zurücksetzen
        document.getElementById('detail-ht-tag').textContent = '0,0 kWh';
        document.getElementById('detail-nt-tag').textContent = '0,0 kWh';
        document.getElementById('detail-grundpreis').textContent = '0,00 €';
        document.getElementById('detail-ht-kosten').textContent = '0,00 €';
        document.getElementById('detail-nt-kosten').textContent = '0,00 €';
        document.getElementById('detail-gesamtkosten').textContent = '0,00 €';
    }

    berechneDetail() {
        const htStr = document.getElementById('detail-ht').value;
        const ntStr = document.getElementById('detail-nt').value;
        const ht = htStr === '' ? null : (parseFloat(htStr.replace(',', '.')) || null);
        const nt = ntStr === '' ? null : (parseFloat(ntStr.replace(',', '.')) || null);
        const datumInput = document.getElementById('detail-datum-input').value;

        // Datum aktualisieren
        this.aktuellerTag = datumInput;
        document.getElementById('detail-datum').textContent = this.formatiereDatum(this.aktuellerTag);

        // Gemeinsame Berechnungsfunktion verwenden
        const kosten = this.berechneKosten(this.aktuellerTag, ht, nt);

        // Werte im Modal anzeigen
        if (kosten.htProTag > 0) {
            document.getElementById('detail-ht-tag').textContent = kosten.htProTag.toFixed(1).replace('.', ',') + ' kWh';
        } else {
            document.getElementById('detail-ht-tag').textContent = '0,0 kWh';
        }

        if (kosten.ntProTag > 0) {
            document.getElementById('detail-nt-tag').textContent = kosten.ntProTag.toFixed(1).replace('.', ',') + ' kWh';
        } else {
            document.getElementById('detail-nt-tag').textContent = '0,0 kWh';
        }

        if (kosten.tarif) {
            document.getElementById('detail-grundpreis').textContent = kosten.grundpreisProTag.toFixed(2).replace('.', ',') + ' €';
            document.getElementById('detail-ht-kosten').textContent = kosten.htKosten.toFixed(2).replace('.', ',') + ' €';
            document.getElementById('detail-nt-kosten').textContent = kosten.ntKosten.toFixed(2).replace('.', ',') + ' €';
            document.getElementById('detail-gesamtkosten').textContent = kosten.gesamtkosten.toFixed(2).replace('.', ',') + ' €';
        } else {
            document.getElementById('detail-grundpreis').textContent = 'Kein Tarif';
            document.getElementById('detail-ht-kosten').textContent = '-';
            document.getElementById('detail-nt-kosten').textContent = '-';
            document.getElementById('detail-gesamtkosten').textContent = '-';
        }
    }

    // Gemeinsame Berechnungsfunktion für Tabelle und Modal
    berechneKosten(datum, ht, nt) {
        const tarif = this.getTarifFuerDatum(new Date(datum));
        const vorherigerWert = this.getVorherigenMesswert(datum);

        let htProTag = 0;
        let ntProTag = 0;
        let grundpreisProTag = 0;
        let htKosten = 0;
        let ntKosten = 0;
        let gesamtkosten = 0;

        // Grundpreis berechnen (aus Tarif)
        if (tarif) {
            grundpreisProTag = tarif.grundpreis / this.tageImMonat(new Date(datum));
        }

        // HT/Tag und NT/Tag berechnen oder interpolieren
        if (ht !== null && nt !== null && vorherigerWert) {
            const htDiff = ht - vorherigerWert.ht;
            const ntDiff = nt - vorherigerWert.nt;
            const tageDiff = this.tageZwischen(vorherigerWert.datum, datum);

            if (tageDiff > 0) {
                htProTag = htDiff / tageDiff;
                ntProTag = ntDiff / tageDiff;
            }
        } else if (ht !== null && nt !== null) {
            // Ohne vorherigen Wert: HT/Tag und NT/Tag auf 0 setzen
            htProTag = 0;
            ntProTag = 0;
        } else if (ht === null && nt === null) {
            // Werte fehlen: Interpolieren
            const naechsterWert = this.getNaechstenMesswert(datum);
            if (vorherigerWert && naechsterWert) {
                const htDiff = naechsterWert.ht - vorherigerWert.ht;
                const ntDiff = naechsterWert.nt - vorherigerWert.nt;
                const tageDiff = this.tageZwischen(vorherigerWert.datum, naechsterWert.datum);
                const tageBisDatum = this.tageZwischen(vorherigerWert.datum, datum);

                if (tageDiff > 0 && tageBisDatum > 0) {
                    const interpoliertHt = vorherigerWert.ht + (htDiff / tageDiff) * tageBisDatum;
                    const interpoliertNt = vorherigerWert.nt + (ntDiff / tageDiff) * tageBisDatum;
                    htProTag = htDiff / tageDiff;
                    ntProTag = ntDiff / tageDiff;
                }
            }
        }

        // Kosten berechnen (aus HT/Tag und NT/Tag)
        if (tarif) {
            htKosten = htProTag * tarif.htPreis;
            ntKosten = ntProTag * tarif.ntPreis;
            gesamtkosten = htKosten + ntKosten + grundpreisProTag;
        }

        return {
            htProTag,
            ntProTag,
            grundpreisProTag,
            htKosten,
            ntKosten,
            gesamtkosten,
            tarif
        };
    }

    speichereDetail() {
        // Snapshot VOR der Änderung erstellen
        this.speichereSnapshot();

        const htStr = document.getElementById('detail-ht').value;
        const ntStr = document.getElementById('detail-nt').value;
        const heizungenStr = document.getElementById('detail-heizungen').value;
        const temperaturStr = document.getElementById('detail-temperatur').value;

        const ht = htStr === '' ? null : parseFloat(htStr.replace(',', '.'));
        const nt = ntStr === '' ? null : parseFloat(ntStr.replace(',', '.'));
        const heizungen = heizungenStr === '' ? null : parseInt(heizungenStr, 10);
        const temperatur = temperaturStr === '' ? null : parseFloat(temperaturStr.replace(',', '.'));
        const notiz = document.getElementById('detail-notiz').value.trim();

        // Validierung
        if (ht !== null && nt !== null) {
            const vorherigerWert = this.getVorherigenMesswert(this.aktuellerTag);
            if (vorherigerWert && (ht < vorherigerWert.ht || nt < vorherigerWert.nt)) {
                this.zeigeFehler('HT oder NT darf nicht kleiner als der vorherige Wert sein.');
                return;
            }
        }

        // Prüfen, ob Datum bereits als echter oder interpolierter Tag vorhanden ist
        if (!this.bearbeitungsModus && this.istDatumBereitsBelegt(this.aktuellerTag)) {
            this.zeigeFehler('Dieses Datum existiert bereits (inkl. interpolierter Tage). Bitte klicke direkt auf die Zeile in der Tabelle, um sie zu bearbeiten.');
            return;
        }

        // Messwert speichern
        let messwert = this.messwerte.find(w => w.datum === this.aktuellerTag);
        if (messwert) {
            messwert.ht = ht;
            messwert.nt = nt;
        } else if (ht !== null && nt !== null) {
            messwert = {
                datum: this.aktuellerTag,
                ht: ht,
                nt: nt
            };
            this.messwerte.push(messwert);
        }

        // Zusatzdaten speichern
        if (heizungen !== null || temperatur !== null || notiz) {
            this.zusatzdaten[this.aktuellerTag] = {
                heizungen: heizungen,
                temperatur: temperatur,
                notiz: notiz
            };
        } else {
            delete this.zusatzdaten[this.aktuellerTag];
        }

        this.speichereDaten();
        // Zum Monat des Datums wechseln
        this.aktuellerMonat = this.aktuellerTag.substring(0, 7);
        this.zeigeTabelle();
        this.schliesseModal(document.getElementById('detail-modal'));
    }

    loescheDetail() {
        if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) {
            return;
        }

        // Snapshot VOR der Änderung erstellen
        this.speichereSnapshot();

        // Messwert löschen
        this.messwerte = this.messwerte.filter(w => w.datum !== this.aktuellerTag);

        // Zusatzdaten löschen
        delete this.zusatzdaten[this.aktuellerTag];

        this.speichereDaten();
        this.zeigeTabelle();
        this.schliesseModal(document.getElementById('detail-modal'));
    }

    // Backup-Funktionen
    oeffneBackupModal() {
        document.getElementById('backup-modal').classList.add('active');
    }

    erstelleBackup() {
        const backup = {
            version: '1.0',
            datum: new Date().toISOString(),
            messwerte: this.messwerte,
            zusatzdaten: this.zusatzdaten,
            tarife: this.tarife
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Dateiname im gewünschten Format
        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `Stromrechner backup ${timestamp}.json`;
        
        a.click();
        URL.revokeObjectURL(url);
        
        // Modal nach erfolgreichem Download schließen
        setTimeout(() => {
            const modal = document.getElementById('backup-modal');
            modal.classList.remove('active');
            this.zeigeFehler('Backup erfolgreich erstellt.', 'success');
        }, 2000);
    }

    ladeBackup() {
        document.getElementById('backup-file').click();
    }

    verarbeiteBackupDatei(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);
                
                if (!backup.version || !backup.messwerte || !backup.tarife) {
                    throw new Error('Ungültiges Backup-Format');
                }

                if (confirm('Soll das aktuelle Backup überschrieben werden? Alle vorhandenen Daten gehen verloren.')) {
                    // Snapshot VOR der Änderung erstellen
                    this.speichereSnapshot();

                    this.messwerte = backup.messwerte;
                    this.zusatzdaten = backup.zusatzdaten || {};
                    this.tarife = backup.tarife;

                    this.speichereDaten();
                    this.zeigeTabelle();
                    this.zeigeTarife();
                    this.schliesseModal(document.getElementById('backup-modal'));
                    this.zeigeFehler('Backup erfolgreich geladen.', 'success');
                }
            } catch (error) {
                this.zeigeFehler('Fehler beim Laden des Backups: ' + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset für erneutes Laden
    }

    // Tarifverwaltung
    zeigeTarife() {
        const container = document.getElementById('tarife-liste');
        container.innerHTML = '';

        // Tarife nach von-Datum sortieren
        const sortierteTarife = [...this.tarife].sort((a, b) => {
            return new Date(a.von) - new Date(b.von);
        });

        sortierteTarife.forEach(tarif => {
            const tarifElement = this.erstelleTarifElement(tarif);
            container.appendChild(tarifElement);
        });
    }

erstelleTarifElement(tarif) {
    const div = document.createElement('div');
    div.className = 'tarif-item';
    div.innerHTML = `
        <div class="tarif-header">
            <div class="tarif-datum">
                ${this.formatiereDatum(tarif.von)} ${tarif.bis ? 'bis ' + this.formatiereDatum(tarif.bis) : 'bis heute'}
            </div>
            <div>
                <button class="btn-secondary" onclick="app.bearbeiteTarif('${tarif.id}')">Bearbeiten</button>
                <button class="btn-danger" onclick="app.loescheTarif('${tarif.id}')">Löschen</button>
            </div>
        </div>
        <div class="tarif-preise">
            <div>Grundpreis: ${tarif.grundpreis.toFixed(2).replace('.', ',')} €/Monat</div>
            <div>HT Preis: ${tarif.htPreis.toFixed(3).replace('.', ',')} €/kWh</div>
            <div>NT Preis: ${tarif.ntPreis.toFixed(3).replace('.', ',')} €/kWh</div>
        </div>
    `;
    return div;
}

    fuegeTarifHinzu() {
        this.oeffneTarifModal();
    }

    oeffneTarifModal(tarif = null) {
        const modal = document.getElementById('tarif-modal');
        modal.classList.add('active');

        if (tarif) {
            // Bearbeitung
            document.getElementById('tarif-modal-titel').textContent = 'Tarif bearbeiten';
            document.getElementById('tarif-von').value = tarif.von;
            document.getElementById('tarif-bis').value = tarif.bis || '';
            document.getElementById('tarif-grundpreis').value = tarif.grundpreis;
            document.getElementById('tarif-grundpreis-einheit').value = 'monat';
            document.getElementById('tarif-ht-preis').value = tarif.htPreis;
            document.getElementById('tarif-nt-preis').value = tarif.ntPreis;
            this.bearbeitungsTarifId = tarif.id;
        } else {
            // Neuer Tarif
            document.getElementById('tarif-modal-titel').textContent = 'Tarif hinzufügen';
            document.getElementById('tarif-von').value = new Date().toISOString().split('T')[0];
            document.getElementById('tarif-bis').value = '';
            document.getElementById('tarif-grundpreis').value = '';
            document.getElementById('tarif-grundpreis-einheit').value = 'monat';
            document.getElementById('tarif-ht-preis').value = '';
            document.getElementById('tarif-nt-preis').value = '';
            this.bearbeitungsTarifId = null;
        }
    }

    speichereTarif() {
        // Snapshot VOR der Änderung erstellen
        this.speichereSnapshot();

        const von = document.getElementById('tarif-von').value;
        const bis = document.getElementById('tarif-bis').value || null;
        let grundpreis = parseFloat(document.getElementById('tarif-grundpreis').value);
        const grundpreisEinheit = document.getElementById('tarif-grundpreis-einheit').value;
        const htPreis = parseFloat(document.getElementById('tarif-ht-preis').value);
        const ntPreis = parseFloat(document.getElementById('tarif-nt-preis').value);

        // Umrechnung Jahr→Monat
        if (grundpreisEinheit === 'jahr') {
            grundpreis = grundpreis / 12;
        }

        // Validierung
        if (!von || isNaN(grundpreis) || isNaN(htPreis) || isNaN(ntPreis)) {
            this.zeigeFehler('Bitte alle Pflichtfelder ausfüllen.');
            return;
        }

        // Überschneidungs-Prüfung
        if (this.pruefeTarifUeberschneidung(von, bis, this.bearbeitungsTarifId)) {
            this.zeigeFehler('Dieser Tarif überschneidet sich mit einem existierenden Tarif.');
            return;
        }

        if (this.bearbeitungsTarifId) {
            // Bearbeitung
            const tarif = this.tarife.find(t => t.id === this.bearbeitungsTarifId);
            if (tarif) {
                tarif.von = von;
                tarif.bis = bis;
                tarif.grundpreis = grundpreis;
                tarif.htPreis = htPreis;
                tarif.ntPreis = ntPreis;
            }
        } else {
            // Neuer Tarif
            const neuerTarif = {
                id: this.generateId(),
                von: von,
                bis: bis,
                grundpreis: grundpreis,
                htPreis: htPreis,
                ntPreis: ntPreis
            };
            this.tarife.push(neuerTarif);
        }

        this.speichereDaten();
        this.zeigeTarife();
        this.schliesseModal(document.getElementById('tarif-modal'));
        this.zeigeFehler('Tarif erfolgreich gespeichert.', 'success');
    }

    bearbeiteTarif(id) {
        const tarif = this.tarife.find(t => t.id === id);
        if (tarif) {
            this.oeffneTarifModal(tarif);
        }
    }

    loescheTarif(id) {
        if (this.tarife.length <= 1) {
            this.zeigeFehler('Es muss mindestens ein Tarif vorhanden sein.');
            return;
        }

        if (confirm('Möchten Sie diesen Tarif wirklich löschen?')) {
            // Snapshot VOR der Änderung erstellen
            this.speichereSnapshot();

            this.tarife = this.tarife.filter(t => t.id !== id);
            this.speichereDaten();
            this.zeigeTarife();
        }
    }

    // Fehlermeldung anzeigen
    zeigeFehler(nachricht, typ = 'error') {
        const fehlerElement = document.getElementById('fehlermeldung');
        fehlerElement.textContent = nachricht;
        fehlerElement.style.background = typ === 'success' ? '#16a34a' : '#dc2626';
        fehlerElement.classList.add('active');

        setTimeout(() => {
            fehlerElement.classList.remove('active');
        }, 3000);
    }

    toggleExpertenmodus() {
        this.expertenmodus = !this.expertenmodus;

        const table = document.getElementById('strom-tabelle');
        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        if (this.expertenmodus) {
            // Expertenmodus aktivieren
            document.getElementById('tarife-btn').classList.add('active');
            // Tabelle komplett neu aufbauen
            thead.innerHTML = '';
            thead.innerHTML = `
                <th>Datum</th>
                <th>HT</th>
                <th>NT</th>
                <th>HT/Tag</th>
                <th>NT/Tag</th>
                <th>Verbrauch Gesamt</th>
                <th>Grundpreis/Tag</th>
                <th>HT Kosten</th>
                <th>NT Kosten</th>
                <th>Kosten Gesamt</th>
                <th>Heizungen</th>
                <th>Temp</th>
                <th>Notiz</th>
            `;
            table.classList.add('expertenmodus');
            this.zeigeTabelle(); // Tabelle neu rendern mit zusätzlichen Spalten
        } else {
            // Expertenmodus deaktivieren
            document.getElementById('tarife-btn').classList.remove('active');
            // Tabelle zurücksetzen
            thead.innerHTML = '';
            thead.innerHTML = `
                <th>Datum</th>
                <th>HT</th>
                <th>NT</th>
                <th>Verbrauch Gesamt</th>
                <th>Kosten Gesamt</th>
            `;
            table.classList.remove('expertenmodus');
            this.zeigeTabelle(); // Tabelle neu rendern ohne zusätzliche Spalten
        }
    }
}

// App initialisieren
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StromrechnerApp();
});
