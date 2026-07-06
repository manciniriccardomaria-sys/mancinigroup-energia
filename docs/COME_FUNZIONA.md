# Gestionale Energia - Funzionamento

## Scopo

Il gestionale sostituisce progressivamente i fogli energia di Mancini Group.
La logica centrale e: POD/PDR pre-associato a una fonte, caricamenti importati dal file operativo, calcolo provvigionale basato su regole versionate, pagamenti manuali separati dal maturato.

## Dati principali

- `Fonti`: collaboratori, frontline e sedi MG.
- `Utenti`: accessi admin, frontline e agenti; agenti/frontline vengono collegati a una fonte.
- `Pre-associazioni`: POD/PDR, nome cliente e fonte assegnata prima che il contratto appaia nei caricamenti.
- `Caricamenti`: righe importate dal file con stato, cliente, offerta, tipo fornitura e match fonte.
- `Provvigioni agenzia`: righe mensili importate dai CSV luce/gas con fattura, consumo, offerta, provvigione agenzia e provvigione fonte generata.
- `Offerte`: catalogo interno copiato dal tab `Tabella Offerte`, usato sia dalla pagina `/offers` sia dal parser dei CSV mensili.
- `Variabili preventivatore`: valori mensili PUN, PSV, dispacciamento e mercato capacita, aggiornabili da `/preventivatore`.
- `Regole provvigionali`: storico/nota delle regole con data `valida da`; l'import mensile applica la struttura ricostruita dall'Apps Script.
- `Provvigioni maturate`: righe calcolate/importate a partire dalle provvigioni agenzia e dalle regole.
- `Pagamenti`: importi inseriti manualmente e sottratti dal maturato.
- `Produzione`: andamento mensile luce/gas, in validazione, bloccati e usciti.

## Regola del pregresso

Le regole provvigionali non vanno sovrascritte.
Quando cambia il sistema provvigionale si crea una nuova regola con una nuova data `valida da`.
Le righe provvigionali gia calcolate restano legate alla regola valida al momento del calcolo.

## Flusso caricamenti

1. Si inserisce manualmente solo la memoria `POD/PDR -> Fonte`.
2. Quando il file caricamenti viene caricato dalla home, il sistema legge il foglio Excel e normalizza il POD/PDR.
3. Se il POD/PDR esiste nelle pre-associazioni, la riga importata viene abbinata alla fonte gia scelta.
4. Se non esiste, la riga resta `Da abbinare` nella pagina `Caricamenti`.

Per i PDR gas numerici il match ignora gli zeri iniziali, per restare compatibile con il vecchio Google Sheet dove alcuni PDR erano stati salvati come numeri.

Il file caricamenti aggiorna produzione, stato, offerta e fonte. Non contiene la provvigione agenzia necessaria per calcolare tutti i business variabili.

## Regole provvigionali ricostruite

Dal foglio `Margine Agenzia` risultano queste regole iniziali:

- `Home Family`: gettone fisso 15 euro dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi.
- `Home Fidelity`: gettone fisso 20 euro dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi.
- Altre offerte `Home`: gettone fisso 25 euro dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi.
- `Business`/`Condomini` per collaboratori: 50% della provvigione agenzia mensile, dal primo mese in cui il cliente appare nelle provvigioni agenzia.
- `Business`/`Condomini` per frontline: gettone dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi, a scaglioni sulla provvigione agenzia mensile.

Il gestionale marca come `in_maturazione` i gettoni sotto i 10 mesi e come `anticipata` i mesi non pagabili perche un gettone e gia stato riconosciuto negli ultimi 12 mesi.

## Upload file

L'upload `Caricamenti` importa davvero le righe e tenta il match su POD/PDR.

L'upload `Provvigioni agenzia per calcolo fonti` legge i CSV mensili `PROV_LUCE...` e `PROV_GAS...`.
Luce e gas si caricano come due pacchetti separati per mese, selezionando la tipologia corretta.
Non indica un foglio provvigioni collaboratori o frontline: e il dato da cui parte il calcolo.
Quando si carica un file `Provvigioni agenzia`, il gestionale richiede mese/anno e tipologia `luce` o `gas`: questi due dati vengono salvati sul file caricato e applicati a tutte le righe del pacchetto, senza dipendere dal nome file.

Le colonne usate sono:

- `Fornitura`: POD/PDR da abbinare alla fonte.
- `Rag. soc.`: cliente.
- `Emissione`: mese economico.
- `Totale`, `Pagato`, `Saldo`: importi fattura cliente, salvati ma non usati come provvigione fonte.
- `Consumo`: quantita su cui calcolare la quota variabile.
- `Offerta`: regola provvigionale agenzia da applicare.

La colonna D del vecchio foglio viene ricostruita cosi:

- luce: `D = PCV + Consumo * (spread - 0,006)`.
- gas: `D = PCV + Consumo * (spread - 0,05)`.

La provvigione mensile agenzia usata per calcolare le fonti e il 60% della colonna D ricostruita.
La fonte ufficiale per PCV e spread e il foglio `Provv. continuative`, tab `Tabella Offerte`; nel gestionale e visibile dalla pagina `Offerte`.

Componenti luce:

- Business Basic: 12 + 0,020 per kWh.
- Business Fidelity: 12 + 0,018 per kWh.
- Business Fidelity 15 / 12_2025: 12 + 0,015 per kWh.
- Condomini Standard: 14 + 0,030 per kWh.
- Home Family: 6 + 0,015 per kWh.
- Home Fidelity: 8,50 + 0,020 per kWh.
- Home Basic: 10 + 0,025 per kWh.
- Home Plus: 12 + 0,035 per kWh.
- Home Standard: 12 + 0,030 per kWh.
- Ris Studi Professionali: 10 + 0,020 per kWh.

Componenti gas:

- Home Family: 8 + 0,080 per Smc.
- Home Fidelity: 8 + 0,109 per Smc.
- Home Basic: 10 + 0,129 per Smc.
- Home Light: 8 + 0,129 per Smc.
- Home Plus: 12 + 0,149 per Smc.
- Home Standard: 12 + 0,129 per Smc.
- Business Basic: 10 + 0,129 per Smc.
- Ragno Home Family Plus 2025: 12 + 0,080 per Smc.
- Condomini Standard gas: 16 + 0,200 per Smc.

Se una tariffa non e riconosciuta, la riga viene salvata ma non genera provvigione.

La provvigione fonte viene generata cosi:

- Home Family/Home Family Plus: 15 euro per POD dopo 10 mesi di presenza, poi ogni 12 mesi.
- Home Fidelity: 20 euro per POD dopo 10 mesi di presenza, poi ogni 12 mesi.
- Home Basic/Home Standard: 25 euro per POD dopo 10 mesi di presenza, poi ogni 12 mesi.
- Business/Condomini collaboratore: 50% della provvigione agenzia mensile, dal primo mese in `Provvigioni agenzia`.
- Business/Condomini frontline: gettone dopo 10 mesi, poi ogni 12 mesi, con scaglioni: 25 euro se provvigione agenzia 0-150, 30 euro se 150-500, 50 euro se 500-1000, 100 euro oltre 1000.

Per calcolare i 10 mesi il sistema usa la prima presenza reale del POD/PDR tra caricamenti importati e provvigioni agenzia; se non trova altro, usa la data di pre-associazione cliente come fallback.

## Preventivatore

La pagina `/preventivatore` contiene il preventivatore luce/gas e la tabella centrale delle variabili mensili usate dai calcoli.

Il preventivatore riprende solo le formule dei fogli `SIMULATORE_LUCE` e `SIMULATORE_GAS`.
Il foglio `SIMULATORE_LUCE_VELOCE CASA` non viene usato come sorgente regole.

- anagrafica: data, fonte, nome cliente, cognome cliente e cellulare.
- dati bolletta: tipologia luce/gas, tipo cliente, mese 1, mese 2, PCV mensile attuale e prezzo medio.
- luce: consumo totale mensile oppure consumi F1/F2/F3, con perdite bassa tensione o media/alta tensione.
- gas: consumo mese 1, consumo mese 2 e consumo annuo.
- risultati: spread attuale stimato, quota consumi dell'offerta, PCV attuale/proposto, risparmio annuo e tabella confronto tariffe.

La formula luce ricostruisce lo spread attuale togliendo dal costo energia i componenti PUN, corrispettivo mercato capacita, dispacciamento e sbilanciamento. Le offerte vengono confrontate con `PCV + spread`, mentre PUN e componenti di mercato restano uguali tra offerta attuale e nuova offerta.

La formula gas ricostruisce lo spread attuale togliendo PSV e componente fissa di sistema `0,026`; poi confronta le offerte con `PCV + spread`.

La provvigione stimata segue il simulatore:

- luce: `30% * (PCV annua + (spread - 0,006) * consumo annuo)`.
- gas: `30% * (PCV annua + (spread - 0,060) * consumo annuo)`.

Il pulsante `Salva preventivo` salva il preventivo nello store ricalcolandolo lato server.
Il pulsante `Stampa preventivo` genera un onepager A4 stampabile con riepilogo cliente, risparmio, confronto attuale/proposto e alternative.

La stessa pagina contiene anche le variabili:

- luce: corrispettivo mercato capacita, dispacciamento, PUN mono orario, PUN F1, PUN F2 e PUN F3.
- gas: PSV.

I valori iniziali sono stati importati dai fogli `PUN` e `PSV` del simulatore Excel.
Un admin puo aggiungere o aggiornare un mese da due riquadri separati:

- `Luce`: salva nello stesso invio mercato capacita, dispacciamento, PUN mono, PUN F1, PUN F2 e PUN F3.
- `Gas`: salva nello stesso invio il PSV.

Il recap storico e consultabile in accordion e filtrabile per tipologia e mese.
Il motore del preventivatore legge questi valori dallo store.

## Firebase

Il codice supporta due backend:

- `DATA_BACKEND=local`: usa `data/store.json`.
- `DATA_BACKEND=firebase`: usa Firestore nel progetto Firebase Energia.

Il progetto Firebase previsto e separato da quello assicurativo: `mancinigroup-energia`.
Il documento operativo e `appState/gestionaleEnergia`.

Per il primo seed produzione:

1. Compilare `.env.production.local` o le env del provider con service account Firebase.
2. Eseguire `pnpm firebase:deploy-rules` per pubblicare le regole Firestore.
3. Eseguire `pnpm firebase:push-store -- --yes` per caricare lo store locale verificato su Firestore.
4. Pianificare `pnpm firebase:backup` o un export Firestore ricorrente prima di ogni ciclo provvigionale.

## Storage upload

Per il primo go-live usiamo `UPLOAD_STORAGE=metadata_only`: il file caricato viene letto subito dal server, importato e poi non viene archiviato come originale.
Restano salvati in Firestore metadata upload, righe importate, match, totali e provvigioni generate.

`UPLOAD_STORAGE=local` resta disponibile per sviluppo locale e salva gli originali in `data/uploads`.
Firebase Storage va aggiunto solo se diventa necessario conservare una copia legale o storica dei file originali.

## Cosa manca

- Creare il progetto Firebase reale nella console Firebase e configurare `DATA_BACKEND=firebase`.
- Inserire in ambiente `AUTH_SECRET` e credenziali service account Firebase.
- Importare almeno un mese reale di caricamenti e i due file `PROV_LUCE`/`PROV_GAS`, verificando totali e righe da abbinare.
- Creare utenti reali per admin, frontline e agenti, con fonti collegate.
- Fare un passaggio finale su sicurezza dominio, HTTPS, backup Firestore e regole di accesso.
- Aggiungere audit log puntuale su modifiche regole, pagamenti e riassegnazioni.
