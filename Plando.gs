/**
 * =================================================================
 * FILE: Plando.gs
 * RUOLO: Gestore della logica di Telegram.
 * =================================================================
 */
var Plando = (function() {

  /**
   * Gestisce la richiesta POST in arrivo da Telegram (chiamata da doPost).
   */
  function handleTelegramPost(e) {
    let results;
    let data;

    try {
      // 1. Ottieni l'input grezzo (stringa JSON)
      const rawInput = e.postData.contents;
      
      // 2. Passalo direttamente a Glando.sendGlando,
      //    che ha la sua logica di normalizzazione e parsing.
      //    Non facciamo JSON.parse qui.
      results = Glando.sendGlando(rawInput);

    } catch (err) {
      console.error('Errore in Plando.handleTelegramPost:', err.message, err.stack);
      // Costruisci un output di errore compatibile
      results = {
        ok: false,
        error: "Errore interno del server: " + err.message
      };
    }
    
    // 3. Ritorna la risposta JSON (es. {ok: true, results: [...]}) al bot
    return ContentService
      .createTextOutput(JSON.stringify(results))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Espone la funzione pubblica
  return {
    handleTelegramPost: handleTelegramPost
  };

})();
