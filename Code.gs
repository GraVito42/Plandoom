/**
 * =================================================================
 * FILE: Code.gs
 * RUOLO: Entry-point e Router.
 * =================================================================
 */

/**
 * FUNZIONE 1: UI WEB (HTML)
 */
function doGet(e) {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Plando - Carica Agenda');
}

/**
 * FUNZIONE 2: WEBHOOK PER TELEGRAM
 */
function doPost(e) {
  // Delega tutta la gestione al modulo Plando
  return Plando.handleTelegramPost(e);
}

/**
 * FUNZIONE 3: GESTORE UPLOAD DA UI
 */
function processUpload(formObject) {
  // Delega tutta la gestione al modulo Glando
  return Glando.handleUIUpload(formObject);
}
