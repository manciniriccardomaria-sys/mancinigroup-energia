export function QuoteInstructions({ id, commodity, legacy }: {
  id: string;
  commodity: "luce" | "gas";
  legacy: boolean;
}) {
  const light = commodity === "luce";

  return (
    <section id={id} className="quote-instructions print-hidden" aria-label="Istruzioni preventivatore">
      <h3>Come preparare il preventivo {light ? "luce" : "gas"}</h3>
      {legacy ? <>
        <p>Stai riaprendo un preventivo con il modello Excel storico. Per un nuovo confronto con le offerte del catalogo scegli <strong>Variabile</strong> o <strong>Fisso</strong>.</p>
        <p>Nel modello storico inserisci prezzo medio quota consumi e PCV mensile attuale. {light
          ? "Seleziona i mesi e il tipo di tariffa attuale; riporta prezzi e consumi monorari oppure F1/F2/F3 dell’intero periodo, inserendo anche gli zeri."
          : "Inserisci il consumo annuo gas in Smc: il confronto è su base annua."} Controlla le segnalazioni “Da verificare” prima di usare il risultato.</p>
      </> : <>
        <div className="quote-instructions-grid">
          <div>
            <h4>1. Scegli l’offerta da proporre</h4>
            <p>Seleziona <strong>Luce o Gas</strong>, poi <strong>RES</strong> per un cliente residenziale o <strong>BUS</strong> per un cliente business.</p>
            <p><strong>Variabile</strong> e <strong>Fisso</strong> indicano l’offerta che vuoi proporre. La bolletta attuale può essere di entrambi i tipi. Scegli la tariffa nel menu “Tariffa preventivata”.</p>
          </div>
          <div>
            <h4>2. Copia i dati della bolletta attuale</h4>
            <p><strong>Quota Consumi:</strong> inserisci il prezzo medio della vendita {light ? "energia in €/kWh" : "gas in €/Smc"}. Se hai solo la spesa consumi in euro, dividila per i consumi del periodo. La PCV va conteggiata a parte.</p>
            <p><strong>Quota Fissa:</strong> inserisci la PCV attuale in €/mese. Se è indicata come totale di due mesi, dividila per due. Seleziona i mesi effettivi della bolletta.</p>
          </div>
        </div>
        {light ? <>
          <h4>3. Scegli come inserire i consumi luce</h4>
          <div className="quote-instructions-table-wrap">
            <table>
              <thead><tr><th scope="col">Bolletta attuale</th><th scope="col">Offerta proposta</th><th scope="col">Cosa inserire</th></tr></thead>
              <tbody>
                <tr><td>Monoraria</td><td>Monoraria</td><td>“Totale mensile”: kWh totali di ogni mese.</td></tr>
                <tr><td>Monoraria</td><td>A fasce</td><td>“Fasce F1/F2/F3”: servono i consumi delle tre fasce, anche se il prezzo attuale è unico.</td></tr>
                <tr><td>A fasce</td><td>Monoraria</td><td>“Totale mensile”: inserisci la somma F1 + F2 + F3 di ogni mese.</td></tr>
                <tr><td>A fasce</td><td>A fasce</td><td>“Fasce F1/F2/F3”: riporta ogni fascia separatamente per ciascun mese.</td></tr>
              </tbody>
            </table>
          </div>
          <p>Scegliendo le fasce si apre il blocco <strong>“Consumi per fascia (kWh)”</strong>, con F1, F2 e F3 per ciascun mese selezionato. Queste combinazioni valgono sia per i prezzi fissi sia per i variabili. Compila anche gli <strong>zeri</strong>. Se hai soltanto il totale o F2/F3 aggregate, recupera la ripartizione prima di proporre una tariffa a tre fasce. Seleziona anche la tensione corretta nel campo “Perdite”.</p>
        </> : <>
          <h4>3. Inserisci i consumi gas</h4>
          <p>Riporta gli <strong>Smc di ciascun mese</strong> e il <strong>consumo annuo</strong> della bolletta. Per il gas non ci sono fasce F1/F2/F3. Per le offerte MET verifica anche il <strong>PCS</strong> della bolletta e gli eventuali requisiti indicati dall’offerta.</p>
        </>}
        <h4>4. Controlla il risultato e salva</h4>
        <p>{light
          ? "La stima annua usa il consumo medio dei mesi inseriti × 12, sia nel Variabile sia nel Fisso."
          : "La stima annua usa il consumo annuo gas inserito."} Gli indici del periodo restano costanti nella proiezione. Nel risultato, <strong>− indica una riduzione della spesa</strong> e <strong>+ un maggior costo</strong>.</p>
        <p>Verifica avvisi, requisiti e dati mancanti, poi usa <strong>Salva</strong> o <strong>Stampa</strong>. Il confronto riguarda vendita {light ? "energia" : "gas"} e PCV. Conguagli, ricalcoli, bonus o periodi irregolari richiedono una verifica separata.</p>
      </>}
    </section>
  );
}
