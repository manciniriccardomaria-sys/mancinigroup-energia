# Offerte MET nel preventivatore — 8 ottobre 2026

Fonti: 21 CTE originali del 24/09/2026 e 02/10/2026 e Provvigioni_offerte_MET.xlsx ricevuto il 07/10/2026. I codici ufficiali e il nome di ciascun PDF sono conservati in src/lib/met-offers.ts e nel catalogo Firestore.

Aggiornamento 29 ottobre 2026: aggiunte al percorso Variabile le CTE Family Power Flex e Family Gas Flex del 08/10/2026, ricevute il 13 ottobre, per clienti domestici. Luce: PUN × 1,10 + 0,0128 €/kWh (spread già comprensivo delle perdite), quota mensile 3,50 €; maggiorazione 0,003 €/kWh per contatore senza rilevazione oraria. Gas: PSV + 0,03 €/Smc nella stima del gestionale, su indicazione dell’utente del 29 ottobre 2026 (CTE originale: M-GAS + 0,03 €/Smc), adeguato al PCS locale / 0,03852, quota mensile 4,50 €. Restano le componenti capacità, dispacciamento e sbilanciamento domestico del simulatore. Condizioni a tempo indeterminato, senza fasi fisse o rinnovi. Provvigione per ciascuna Flex: 21 € una tantum, senza ricorrente, dal prospetto Provvigioni_Agenzie_AGF60 ricevuto il 13 ottobre. Bonus porta un amico escluso dalla stima. Il catalogo comprende ora 23 offerte MET. Su indicazione dell’utente del 29 ottobre 2026, le due Family Flex escludono dal preventivo il servizio app MET da 1 €/mese previsto dalle CTE: quota fissa luce 3,50 €/mese e gas 4,50 €/mese.

## Regole condivise

- Luce: quando la CTE indica i prezzi netti, si usano quei valori originali. Quando indica soltanto il prezzo comprensivo delle perdite, si conserva l’originale e si divide per il fattore perdite prima di applicare il modello del simulatore, evitando una seconda maggiorazione. Fattori: 1,10 BT e 1,038 MT/AT.
- Nessuna media preimpostata: F1/F2/F3 vengono pesati sui consumi effettivi del cliente. Tutte e tre le fasce sono obbligatorie per ogni mese delle sei business luce e della CER; lo zero deve essere dichiarato. Un prezzo unico vale per tutte le fasce.
- Capacità e dispacciamento mantengono le regole del simulatore concordate. Lo sbilanciamento domestico è 0,0014 €/kWh; per MET business è già incluso nel prezzo energia e non si aggiunge nuovamente. PUN monorario AGF senza maggiorazione per perdite.
- Solo le CTE MET che lo prevedono ricevono il costo finanziario: 2% del PUN mensile per la luce, 2% del PSV mensile per il gas, su indicazione dell’utente del 29 ottobre 2026. Per CALENDAR decorre dal 01/01/2028.
- Gas: prezzi, CSC e commercializzazione variabile si adeguano al PCS locale rispetto a 0,03852 GJ/Smc. Dal 29 ottobre 2026, su indicazione dell’utente, tutte le componenti indicizzate gas usano il solo PSV medio mensile inserito manualmente in €/Smc: prezzo variabile, fasi iniziali, rinnovi e costo finanziario. Si tratta della convenzione di stima scelta per il gestionale, anche quando la CTE originale richiama M-GAS o MGP-GAS. I prezzi fissi restano invariati; gli eventuali dati storici M-GAS/MGP-GAS restano archiviati ma non sono usati nei nuovi calcoli. Il PSV mancante blocca il preventivo; non si usano quotazioni giornaliere in sostituzione.
- Le quote mensili domestiche includono il servizio app da 1 €. La tabella sotto comprende tale servizio. Le provvigioni MET sono già dell’agenzia: quota fissa annua + quantità annua × quota variabile, senza ulteriore 60%.
- ProMETto luce: su indicazione dell’utente del 22 ottobre 2026, il preventivo e il risparmio annuo usano esclusivamente il prezzo fisso già scontato dei 24 mesi, anche per decorrenze anticipate. Le fasi indicizzate iniziale e dal 25° mese restano escluse dalla stima. ProMETto gas mantiene la proiezione delle fasi in funzione della decorrenza. Provvigioni da confermare, mai presentate come zero certo.
- CER: F1 fissa per 120 mesi, F2/F3 a PUN con perdite + 0,0088 €/kWh; richiede adesione a CER convenzionata e BT. La maggiorazione 0,003 €/kWh per contatore senza rilevazione oraria si applica ai consumi indicizzati domestici quando pertinente.
- La stima annua mantiene gli indici storici del periodo e la profilazione inserita; dal 20 ottobre 2026 la luce usa il consumo medio dei mesi selezionati × 12, sia nel percorso Variabile sia nel Fisso. Un mese resta invariato; con due mesi si usa la loro media, contando anche un mese dichiarato a zero. Il risparmio confronta le spese consumi complete e le quote fisse senza dividere nuovamente per le perdite. Gli snapshot precedenti restano immutati.

## Catalogo verificato

I prezzi luce in tabella sono quelli originali del PDF; il preventivatore mostra e utilizza la base netta. Importi esclusi IVA e imposte.

| Offerta | Prezzi originali | Base perdite | Fisso mesi | Quota mensile totale | Provvigione agenzia annua |
|---|---|---|---:|---:|---|
| MET FAMILY POWER FIX | 0,1871 €/kWh | Inclusa nel prezzo | 12 | 4,5 € | 20 € |
| MET HOME POWER FIX | 0,1991 €/kWh | Inclusa nel prezzo | 12 | 9 € | 35 € |
| MET 4 HOME POWER FIX | 0,1991 €/kWh | Inclusa nel prezzo | 12 | 12 € | 55 € |
| MET 4 HOME POWER FIX 24 | 0,1782 €/kWh | Inclusa nel prezzo | 24 | 12 € | 55 € |
| MET 4 HOME POWER FIX 36 | 0,1642 €/kWh | Inclusa nel prezzo | 36 | 12 € | 55 € |
| MET ONE POWER | F1 0,1703 / F2 0,1807 / F3 0,1591 €/kWh | Netta originale | 12 | 15 € | 30 € + 0,00025 €/kWh × consumo annuo |
| MET 2YOU POWER | F1 0,1703 / F2 0,1807 / F3 0,1591 €/kWh | Netta originale | 12 | 15 € | 30 € + 0,001 €/kWh × consumo annuo |
| MET 4YOU POWER | F1 0,1703 / F2 0,1807 / F3 0,1591 €/kWh | Netta originale | 12 | 15 € | 30 € + 0,0015 €/kWh × consumo annuo |
| MET BUSINESS POWER FIX | F1 0,1828 / F2 0,1932 / F3 0,1716 €/kWh | Netta originale | 12 | 18 € | 40 € + 0,002 €/kWh × consumo annuo |
| MET BUSINESS POWER FIX 24 MESI | F1 0,1651 / F2 0,1713 / F3 0,1519 €/kWh | Netta originale | 24 | 18 € | 40 € + 0,002 €/kWh × consumo annuo |
| MET CALENDAR FIX POWER 24 MESI | F1 0,1526 / F2 0,1588 / F3 0,1394 €/kWh | Netta originale | 24 | 0 € | 0 € + 0,005 €/kWh × consumo annuo |
| MET CER MAKE ENERGY TOGETHER | F1 0,1045; F2/F3 PUN × 1,10 + 0,0088 €/kWh | Inclusa nel prezzo | 120 | 10 € | 50 € |
| MET 4 HOME POWER FIX 24 ProMETto | 0,1247 €/kWh | Inclusa nel prezzo | 24 | 12 € | Da confermare |
| MET FAMILY GAS FIX | 0,744 €/Smc | — | 12 | 5,5 € | 20 € |
| MET HOME GAS FIX | 0,833 €/Smc | — | 12 | 9 € | 35 € |
| MET 4 HOME GAS FIX 24 | 0,695 €/Smc | — | 24 | 12 € | 55 € |
| MET 4 HOME GAS FIX 36 | 0,632 €/Smc | — | 36 | 12 € | 55 € |
| MET 4 HOME GAS FIX 24 ProMETto | 0,487 €/Smc | — | 24 | 12 € | Da confermare |
| MET BUSINESS GAS FIX | 0,803 €/Smc | — | 12 | 18 € | 50 € + 0,015 €/Smc × consumo annuo |
| MET BUSINESS GAS FIX 24 MESI | 0,664 €/Smc | — | 24 | 18 € | 50 € + 0,015 €/Smc × consumo annuo |
| MET SICURO GAS FIX | 0,823 €/Smc | — | 12 | 15 € | 30 € |

## Limiti dichiarati

Su indicazione dell’utente, ONE/2YOU/4YOU/CALENDAR omettono gli ulteriori costi rinviati alle CGF mancanti; l’esclusione è segnalata nel preventivo e nella stampa. La maggiorazione per decorrenza differita oltre tre mesi di ONE/2YOU/4YOU e i servizi opzionali Green non sono conteggiati. I bonus porta un amico non sono sottratti automaticamente.

ProMETto luce usa 0,1247 €/kWh dalla CTE principale (la scheda sintetica indica 0,12474), comprensivo delle perdite e senza applicare nuovamente lo sconto del 30%. Il preventivo riguarda il periodo fisso dei 24 mesi: l’eventuale fase indicizzata prima del 01/01/2027 e il PUN + spread dal 25° mese non incidono sui costi preventivati. Gli spread di rinnovo 4 HOME GAS FIX 24/36 sono da confermare; non servono per il primo anno della stima.

Ammissibilità: BUSINESS POWER FIX 12/24 senza limite massimo di consumo nel preventivatore, su indicazione dell’utente del 29 ottobre 2026 (anche per le offerte già salvate); ONE/2YOU/4YOU fino a 2.000.000; CALENDAR FIX fino a 5.000.000 kWh/anno, senza minimo di consumo su indicazione dell’utente del 29 ottobre 2026 (anche per le offerte già salvate); business gas fino a 50.000 Smc.

## Verifica e caricamento

Eseguire npm run test:operations, npm run test:met, npm run typecheck e npm run lint. Il test della bolletta La Deliziosa con input 0,226239, consumi F1 611,2 / F2 1271,6 / F3 859,3 e variabili luglio già nel gestionale produce per BUSINESS POWER FIX 24 MESI: quota consumi 607,04713459 €, risparmio annuo 159,87 €, provvigione annua 105,81 €.

Lo script npm run firebase:load-met mostra prima un dry run. Con -- --apply crea soltanto le offerte MET mancanti con ID uguale al codice ufficiale, salva un backup locale delle offerte esistenti e verifica i record scritti. Non modifica gli override già presenti, i clienti, gli archivi o le offerte AGF.
