# Calcolo fisso conforme al simulatore Excel

La modalità **Fisso** nella pagina Preventivatore usa le formule e i valori del file `SIMULATORE PER FASCE BOLLETTE NUOVE DIC 25.xlsx`, fogli `SIMULATORE_LUCE FISSO` e `SIMULATORE_GAS FISSO`, con le dipendenze del foglio `PUN`.

`src/lib/fixed-excel-reference.ts` conserva le celle originali (incluse formule), il nome del file e il suo SHA-256. La modalità non usa gli override del catalogo corrente o le variabili Firestore, perché differenze di listino/indici impedirebbero la parità col file ricevuto. I nuovi preventivi della modalità Variabile mostrano le offerte variabili del catalogo; il fisso si prepara dalla modalità Fisso. Le funzioni di calcolo esistenti del catalogo rimangono invariate; i vecchi snapshot conservano il loro modello e i valori archiviati.

## Risultato di riferimento

- Luce: `H50:H53`, oppure `H50:H52` per business.
- Gas: `G33:G38`; le righe business utilizzabili sono `G33:G34`.
- `annualDifferenceExact` conserva il valore calcolato prima dell’arrotondamento. `annualDifference` è la differenza a due decimali; `annualSaving` ne inverte il segno. La schermata mostra anche “Differenza annua Excel” con il segno del foglio.
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

`pnpm test:fixed-excel` confronta 44 risultati su 12 scenari (RES/BUS, uno/due mesi, fasce/monoraria, fasce a zero, residuo a zero, PCV zero, luce/gas). I risultati di riferimento sono stati ottenuti ricalcolando copie temporanee delle formule originali con LibreOfficeDev 26.8, dopo la rimozione delle cache delle formule. Il file originale non è stato modificato. La stessa suite verifica gli errori della fonte e confronta sei scenari variabili con i risultati della versione pubblicata prima dell’integrazione.

Le fixture sono in `scripts/fixtures/fixed-excel-cases.json` e `scripts/fixtures/variable-before-fixed.json`. I test non dipendono dall’installazione di Excel/LibreOffice o dal file presente in Downloads. In caso di sostituzione del file di riferimento, rigenerare insieme celle, hash e casi numerici mediante un ricalcolo indipendente delle nuove formule; non usare le vecchie cache come risultati attesi.
