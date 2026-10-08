# Offerte MET nel preventivatore — 8 ottobre 2026

Fonti: 21 CTE originali del 24/09/2026 e 02/10/2026 e Provvigioni_offerte_MET.xlsx ricevuto il 07/10/2026. I codici ufficiali e il nome di ciascun PDF sono conservati in src/lib/met-offers.ts e nel catalogo Firestore.

## Regole condivise

- Luce: quando la CTE indica i prezzi netti, si usano quei valori originali. Quando indica soltanto il prezzo comprensivo delle perdite, si conserva l’originale e si divide per il fattore perdite prima di applicare il modello del simulatore, evitando una seconda maggiorazione. Fattori: 1,10 BT e 1,038 MT/AT.
- Nessuna media preimpostata: F1/F2/F3 vengono pesati sui consumi effettivi del cliente. Tutte e tre le fasce sono obbligatorie per ogni mese delle sei business luce e della CER; lo zero deve essere dichiarato. Un prezzo unico vale per tutte le fasce.
- Capacità, dispacciamento e sbilanciamento mantengono le regole del simulatore concordate; sbilanciamento 0,0014 €/kWh. PUN monorario AGF senza maggiorazione per perdite.
- Solo le CTE MET che lo prevedono ricevono il costo finanziario: 2% del PUN mensile per la luce, 2% di MGP-GAS per il gas. Per CALENDAR decorre dal 01/01/2028.
- Gas: prezzi, CSC e commercializzazione variabile si adeguano al PCS locale rispetto a 0,03852 GJ/Smc. M-GAS e MGP-GAS sono variabili separate dal PSV, da inserire in €/Smc (valori GME in €/MWh × 0,0107). Gli indici necessari mancanti bloccano il preventivo per l’offerta interessata.
- Le quote mensili domestiche includono il servizio app da 1 €. La tabella sotto comprende tale servizio. Le provvigioni MET sono già dell’agenzia: quota fissa annua + quantità annua × quota variabile, senza ulteriore 60%.
- ProMETto: fase a indice + spread prima del 01/01/2027, poi prezzo fisso già scontato. La proiezione annua combina le due fasi in funzione della decorrenza. Provvigioni da confermare, mai presentate come zero certo.
- CER: F1 fissa per 120 mesi, F2/F3 a PUN con perdite + 0,0088 €/kWh; richiede adesione a CER convenzionata e BT. La maggiorazione 0,003 €/kWh per contatore senza rilevazione oraria si applica ai consumi indicizzati domestici quando pertinente.
- La stima annua mantiene gli indici storici del periodo e la profilazione inserita; per la luce resta l’annualizzazione del primo mese × 12. Il risparmio confronta le spese consumi complete e le quote fisse senza dividere nuovamente per le perdite. Gli snapshot precedenti restano immutati.

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

ProMETto luce usa 0,1247 dalla CTE principale (la scheda sintetica indica 0,12474); per attivazioni anticipate si assume il periodo fisso dal 01/01/2027. Gli spread di rinnovo 4 HOME GAS FIX 24/36 sono da confermare; non servono per il primo anno della stima.

Ammissibilità: BUSINESS POWER FIX 12/24 fino a 50.000 kWh/anno; ONE/2YOU/4YOU fino a 2.000.000; CALENDAR da 200.000 a 5.000.000; business gas fino a 50.000 Smc.

## Verifica e caricamento

Eseguire npm run test:operations, npm run test:met, npm run typecheck e npm run lint. Il test della bolletta La Deliziosa con input 0,226239, consumi F1 611,2 / F2 1271,6 / F3 859,3 e variabili luglio già nel gestionale produce per BUSINESS POWER FIX 24 MESI: quota consumi 610,88607459 €, risparmio annuo 113,81 €, provvigione annua 105,81 €.

Lo script npm run firebase:load-met mostra prima un dry run. Con -- --apply crea soltanto le offerte MET mancanti con ID uguale al codice ufficiale, salva un backup locale delle offerte esistenti e verifica i record scritti. Non modifica gli override già presenti, i clienti, gli archivi o le offerte AGF.
