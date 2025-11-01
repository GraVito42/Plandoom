var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');; 
var telegramUrl = "https://api.telegram.org/bot" + token; 
var webAppUrl = "https://script.google.com/macros/s/AKfycbylRBQRa_VU-S1iJyRZLzw2BgPDOh51DD8rLYtFJlmXCK3CdEeBqDuzlF77furGfi5b/exec"; 

function isJson(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return true;
  if (typeof value === 'string') {
    var t = value.trim();
    if (!t) return false;
    if (!(t.startsWith('{') && t.endsWith('}')) && !(t.startsWith('[') && t.endsWith(']'))) return false;
    try { JSON.parse(t); return true; } catch (_) { return false; }
  }
  return false;
}


function sendMessage(chat_id, text) {
  var url = telegramUrl + "/sendMessage?chat_id=" + chat_id + "&text=" + encodeURIComponent(text);
  var response = UrlFetchApp.fetch(url);
}


function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  var chat_id = contents.message.from.id;
  var user_message = contents.message.text
  var text = user_message;

  if (isJson(text)) {
      var res = sendGlando(text);

      if (res && res.ok) {
        sendMessage(chat_id, "✅ " + (res.summary || "Eventi caricati! Controlla Google Calendar e Notion."));
      } 
      else {
        sendMessage(chat_id, "❌ Import fallito: " + (res && res.error ? res.error : "errore sconosciuto"));
      }
  } 
  else{
    if (text === "/start") {
      var attivazione = "✅ Bot attivato!\n\nInviami un file .json via 📎 oppure incolla il contenuto JSON direttamente nel messaggio.\n\nTi guiderò passo passo per importare eventi in Notion e Google Calendar.";
      sendMessage(chat_id, attivazione);
    } 
    else{
      var risposta = "È l'ora di Plan---do!📒😄   "+ text;
      sendMessage(chat_id, risposta);
    }
  }  // Comando /start → disattiva mute e invia messaggio di attivazione
  
}

function setWebhook() {
  const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxab_nYFDG5-gBWZqmSm0zdXgN9uc3X6h7RJZ2Kv8fIG55wVh3xJ8a-CrV-7-cvPpf4/exec';
  const del = `https://api.telegram.org/bot${token}/deleteWebhook`;
  const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(WEBAPP_URL)}&drop_pending_updates=true`;
  const respdel = UrlFetchApp.fetch(del);
  const resp = UrlFetchApp.fetch(url);
  Logger.log(respdel.getContentText());
  Logger.log(resp.getContentText());
}
