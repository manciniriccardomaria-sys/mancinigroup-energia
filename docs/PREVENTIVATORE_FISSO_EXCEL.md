# Preventivatore fisso: costi e risparmio

La modalità **Fisso** usa il listino e le componenti dei fogli `SIMULATORE_LUCE FISSO`, `SIMULATORE_GAS FISSO` e `PUN` del file `SIMULATORE PER FASCE BOLLETTE NUOVE DIC 25.xlsx`. Le celle originali, le formule e l’hash restano in `src/lib/fixed-excel-reference.ts`.

Il calcolo parte dai due costi, non dalla formula della differenza dell’Excel:

1. Quota consumi attuale = prezzo medio della bolletta × consumo del confronto.
2. Quota proposta = consumi × prezzi dell’offerta + componenti tariffarie del simulatore.
3. Costo attuale/proposto = rispettiva quota consumi + PCV mensile × mesi del confronto.
4. Risparmio annuo = (costo attuale − costo proposto) × 12 / mesi del confronto.

Luce usa il periodo selezionato (uno/due mesi); gas usa il consumo annuo e 12 mensilità di PCV. `source.costBasis` distingue `period` da `annual`. I costi sono mostrati nel riepilogo, nella tabella offerte, nel dettaglio salvato e nella stampa. La quota consumi resta separata dal costo comprensivo di PCV. La precisione interna viene conservata fino alla visualizzazione in euro; `annualDifferenceExact` conserva la differenza annua non arrotondata.

Esempio luce: 100 kWh, prezzo medio attuale 0,30 €/kWh, PCV attuale 12 €/mese, Family Power Fix, agosto, un mese. Costo attuale 42,00 €; quota proposta 19,9289 €; PCV proposta 3,50 €; costo proposto 23,4289 €; risparmio annuo 222,85 €.

Esempio gas: 1.000 Smc annui, prezzo medio attuale 0,90 €/Smc, PCV attuale 10 €/mese, Family Gas Fix. Costo annuo attuale 1.020 €; quota proposta 747 €; PCV annua proposta 54 €; costo annuo proposto 801 €; risparmio annuo 219 €.

## Componenti e input

- Luce: prezzi delle righe tariffarie E27:G30, perdite E21 (1,104), componenti G24/G25 e sbilanciamento I27:I30. E27:G29 dividono già i prezzi comprensivi di perdite per E21: la moltiplicazione nel costo ripristina il prezzo lordo una sola volta. Per la CER lo sbilanciamento si applica a F2/F3, con le perdite del file.
- I prezzi uniformi residenziali si possono calcolare anche con il solo consumo monorario. Business e CER richiedono F1/F2/F3: non viene inventata una ripartizione delle fasce. Le fasce eventualmente rimaste da un preventivo precedente non entrano nel calcolo monorario.
- Gas: prezzo F33:F37 più la componente originale di 0,015 €/Smc. Il prezzo medio attuale resta quello effettivamente inserito dalla bolletta. La componente viene imputata al costo proposto, mantenendo la stessa differenza delle formule originali.
- Consumo annuo luce = consumo del periodo / mesi × 12. Gas usa direttamente il consumo annuo inserito.
- Listino e indici restano quelli del file, senza override da Firestore. I mesi del file non contengono l’anno; la CER conserva la media PUN originale.
- I dati Fisso/Variabile rimangono separati. Le fasce devono essere compilate esplicitamente, inclusi gli zeri; PCV zero è ammessa.

## Correzioni rispetto alla differenza originale

Le colonne G50:G52 del foglio luce usavano prezzi business anche per le offerte residenziali e applicavano perdite incoerenti. Ora il costo deriva dalla riga tariffaria dell’offerta selezionata.

Le formule H50:H52 del ramo monorario usavano celle di consumo delle fasce vuote o residue; ora usano il consumo monorario per le offerte con prezzo uniforme. Il residuo attuale E17 veniva troncato a zero e poteva far confrontare un costo attuale maggiore di quello realmente inserito. Ora il riferimento è sempre prezzo medio attuale × consumo. Il risparmio può quindi cambiare in questi casi; la parità con le formule incoerenti non è più un obiettivo.

Per le righe gas 35:37 i nomi sono ricavati dalle stesse righe di listino dei prezzi, evitando le vecchie etichette HOME BASIC/STANDARD/PLUS. Resta l’avviso di verifica della corrispondenza delle condizioni del file.

La riga gas 38 ha condizioni vuote e resta bloccata. Le provvigioni incomplete non vengono presentate come zero certo (`commissionKnown: false`). Un’offerta senza le fasce necessarie è indisponibile e non salvabile/stampabile. I vecchi preventivi conservano gli snapshot originali: per ottenere i nuovi costi si usa **Crea nuovo da questi dati**.

## Verifica

`pnpm test:fixed-excel` verifica dieci esempi numerici di costi e risparmi, 31 differenze coerenti con il foglio originale, sei scenari variabili invariati, la relazione tra costi e risparmio in tutti gli scenari validi, snapshot salvati, dati mancanti, fasce residue e offerte incomplete.

Le fixture originali in `scripts/fixtures/fixed-excel-cases.json` restano invariate come documentazione del simulatore. I rami corretti vengono verificati con importi espliciti ricavati dalle componenti tariffarie, senza usare la differenza originale come origine del costo.
