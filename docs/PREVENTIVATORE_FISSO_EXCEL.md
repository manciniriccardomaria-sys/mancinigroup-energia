# Calcolo fisso conforme al simulatore Excel

Dal 20 ottobre 2026 il pulsante **Fisso** usa le offerte fisse attive del catalogo e le variabili mensili del gestionale (`calculationModel: catalog_fixed`). È possibile partire da una bolletta variabile: prezzo medio quota consumi, PCV e consumi restano compilati passando da Variabile a Fisso. Per le offerte a fasce servono F1/F2/F3 esplicite; si applicano condizioni, componenti accessorie, servizio app, fasi e requisiti del catalogo MET.

Il percorso **Fisso Excel storico** resta disponibile riaprendo un preventivo salvato con `calculationModel: fixed_excel`. Usa le formule e i valori del file `SIMULATORE PER FASCE BOLLETTE NUOVE DIC 25.xlsx`, fogli `SIMULATORE_LUCE FISSO` e `SIMULATORE_GAS FISSO`, con le dipendenze del foglio `PUN`. Le sezioni successive descrivono questo modello storico.

## Verifica catalogo contro Excel

`pnpm test:fixed-catalog` confronta 68 risultati con le formule originali H50/G33, mantenute intatte in memoria e alimentate con parametri equivalenti al catalogo: prezzi netti/lordi, PCV completa, perdite, indici e componenti accessorie. Il confronto riguarda offerte statiche luce/gas RES/BUS, uno/due mesi e PCV zero/non zero. Fasi ProMETto, CER, costi differiti e requisiti sono verificati separatamente da `pnpm test:met`. Non si tratta di un nuovo ricalcolo del file in Excel/LibreOffice: il motore delle formule originali è già verificato dalle 44 uscite delle fixture indipendenti (`pnpm test:fixed-excel`).

Il catalogo non deve riprodurre gli stessi euro del vecchio listino quando cambiano le condizioni. Esempio della fixture `luce-res-1-mese`, FAMILY, 100 kWh, indici originali: risparmio annuo Excel 222,85 €, catalogo corrente 202,39 €. Differenza 20,46 €: prezzo lordo da 0,1825 a 0,1871 €/kWh (5,52 €/anno), servizio app da 1 €/mese (12 €/anno), perdite sul dispacciamento (1,26 €/anno), sbilanciamento domestico (1,68 €/anno).

Le differenze strutturali sono esplicite:

- Il modello storico usa 1,104 per le perdite; il catalogo usa 1,10 in BT o 1,038 in MT/AT, sulle componenti configurate. I prezzi già lordi non vengono maggiorati di nuovo.
- Nel ramo luce a fasce l'Excel limita a zero il residuo degli altri costi. Con un residuo negativo, il confronto diretto fra spese effettive del catalogo può differire anche allineando il listino. I 68 confronti usano un residuo positivo.
- Nel ramo monorario H50:H52 del foglio storico alcune celle dei consumi a fasce restano nel calcolo; il prezzo proposto può non influire sul risultato. Il test documenta questa anomalia. Il catalogo moltiplica il prezzo per i consumi reali.
- Nel gas il foglio storico sottrae 0,015 €/Smc dal prezzo medio attuale. Il nuovo confronto usa la spesa effettiva e tutte le componenti dell'offerta; nei confronti delle formule questa rettifica viene neutralizzata nei dati di ingresso.
- Per la luce sia il nuovo Fisso sia Variabile annualizzano il consumo totale del periodo diviso per i mesi selezionati, come il foglio fisso. La media include anche i mesi dichiarati a consumo zero. Il modello storico Excel e gli snapshot salvati restano invariati.

I preventivi salvati conservano modello, input e snapshot dei risultati. Aggiornare il catalogo cambia i nuovi calcoli, mentre i risultati archiviati restano invariati. Le offerte variabili vengono escluse dal nuovo percorso Fisso anche nel motore condiviso con il server.

`src/lib/fixed-excel-reference.ts` conserva le celle originali (incluse formule), il nome del file e il suo SHA-256. La modalità storica non usa gli override del catalogo corrente o le variabili Firestore, perché differenze di listino/indici impedirebbero la parità col file ricevuto. I nuovi preventivi della modalità Variabile mostrano le offerte variabili del catalogo; il fisso aggiornato si prepara dalla modalità Fisso. I vecchi snapshot conservano il loro modello e i valori archiviati.

## Risultato di riferimento

- Luce: `H50:H53`, oppure `H50:H52` per business.
- Gas: `G33:G38`; le righe business utilizzabili sono `G33:G34`.
- `annualDifferenceExact` conserva il valore calcolato prima dell’arrotondamento. `annualDifference` è la differenza a due decimali; `annualSaving` ne inverte il segno. La schermata mostra anche “Differenza annua” con il segno del foglio.
- Il risparmio sulla bolletta luce, nel riepilogo e nella stampa, è `annualSaving / (12 / mesi in bolletta)`: con due mesi si divide per 6, con un mese per 12. Non richiede la quota proposta, che resta da verificare secondo la fonte. Il gas del modello usa il solo consumo annuo: la stampa indica il confronto su base annua.
- Annualizzazione luce: consumi dell’intero periodo / mesi selezionati × 12. Il fattore perdite è quello originale della cella E21 (1,104).
- Gas: rettifica originale di 0,015 €/Smc e consumo annuo E8. Il PSV non è necessario per queste formule.
- I nomi dei mesi nel file non contengono l’anno. La CER conserva la media PUN delle celle originali, senza sostituirla con gli indici correnti.

## Corrispondenza input

| Dato | Luce | Gas |
|---|---|---|
| Prezzo medio quota consumi | E4 | E4 |
| PCV mensile attuale | F4 | F4 |
| Mesi | E6, F6 | Non necessari |
| Tipologia tariffa attuale | E8 | Non necessaria |
| Prezzi attuali F1/F2/F3 | E14:E16 | Non necessari |
| Consumi F1/F2/F3 dell’intero periodo | F14:F16 | Non necessari |
| Prezzo/consumo monorario | E11/F11 | Non necessari |
| Consumo annuo | Dal periodo selezionato | E8 |

I dati dei due modelli sono conservati separatamente quando si cambia modalità. Per distinguere un dato mancante dallo zero, le nuove fasce devono essere compilate esplicitamente; la PCV zero è ammessa nel percorso Excel.

## Incompletezze della fonte

Le quote consumi luce G50:G52 utilizzano prezzi business anche quando le etichette indicano residenziale; non sono un totale coerente con le differenze annue della colonna H. Nel gas le provvigioni H33:H38 e la personalizzata G39/H39 hanno riferimenti `#REF!`. La riga gas 38 usa celle di listino vuote; è bloccata. La CER monoraria restituisce `#VALUE!` quando il foglio restituisce una stringa vuota in un’operazione numerica.

Questi risultati vengono mostrati come non disponibili/da verificare, anziché come importi zero. Anche stampa e dettaglio dei preventivi salvati rispettano gli indicatori `quotaConsumiKnown` e `commissionKnown`. Le formule valide della differenza annua restano quelle originali, incluse le particolarità del ramo monorario e della tabella PUN; nessuna correzione al file è implicita.

## Verifica della parità

`pnpm test:fixed-excel` confronta 44 risultati su 12 scenari (RES/BUS, uno/due mesi, fasce/monoraria, fasce a zero, residuo a zero, PCV zero, luce/gas). I risultati di riferimento sono stati ottenuti ricalcolando copie temporanee delle formule originali con LibreOfficeDev 26.8, dopo la rimozione delle cache delle formule. Il file originale non è stato modificato. La stessa suite verifica gli errori della fonte e confronta sei scenari variabili con la versione precedente: cinque restano identici, mentre il caso luce a due mesi con consumi diversi usa aspettative esplicite aggiornate alla media mensile, senza modificare la fixture storica. `pnpm test:operations` verifica inoltre consumi 100 + 300 kWh in monoraria e a fasce, ordine invertito dei mesi e un mese a zero.

Le fixture sono in `scripts/fixtures/fixed-excel-cases.json` e `scripts/fixtures/variable-before-fixed.json`. I test non dipendono dall’installazione di Excel/LibreOffice o dal file presente in Downloads. In caso di sostituzione del file di riferimento, rigenerare insieme celle, hash e casi numerici mediante un ricalcolo indipendente delle nuove formule; non usare le vecchie cache come risultati attesi.
