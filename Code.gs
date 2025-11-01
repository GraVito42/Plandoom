var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');; 
var telegramUrl = "https://api.telegram.org/bot" + token; 
var webAppUrl = "https://script.google.com/macros/s/AKfycbylRBQRa_VU-S1iJyRZLzw2BgPDOh51DD8rLYtFJlmXCK3CdEeBqDuzlF77furGfi5b/exec"; 

function isJson(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return true;
  if (typeof value === 'string') {
    var t = value.trim();
    if (!t) return false;
    try {
      JSON.parse(t);
      return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}


function sendMessage(chat_id, text) {
  var url = telegramUrl + "/sendMessage?chat_id=" + chat_id + "&text=" + encodeURIComponent(text);
  var response = UrlFetchApp.fetch(url);
}


function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  var message = contents.message || contents.edited_message || contents.channel_post || {};
  var chat = message.chat || {};
  var chat_id = chat.id || (message.from && message.from.id);
  var text = "";
  if (typeof message.text === "string") {
    text = message.text;
  } else if (typeof message.caption === "string") {
    text = message.caption;
  }
  var document = message.document || (message.reply_to_message && message.reply_to_message.document);

  if (document) {
    var fileName = document.file_name || "";
    var mimeType = document.mime_type || "";
    var looksJson = fileName.toLowerCase().endsWith(".json") || mimeType.indexOf("json") !== -1;

    if (!looksJson) {
      sendMessage(chat_id, "❌ Il file deve essere in formato JSON.");
      return;
    }

    try {
      var payload = fetchTelegramFile(document.file_id);
      if (!isJson(payload)) {
        sendMessage(chat_id, "❌ Il file JSON non è valido: controlla il contenuto e riprova.");
        return;
      }

      var resFile = sendGlando(payload);
      if (resFile && resFile.ok) {
        sendMessage(chat_id, "✅ " + (resFile.summary || "Eventi caricati! Controlla Google Calendar e Notion."));
      } else {
        sendMessage(chat_id, "❌ Import fallito: " + (resFile && resFile.error ? resFile.error : "errore sconosciuto"));
      }
    } catch (err) {
      sendMessage(chat_id, "❌ Impossibile leggere il file: " + (err && err.message ? err.message : err));
    }
    return;
  }

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
      var risposta = "È l'ora di Plan---do!📒😄   " + (typeof text === "string" ? text : "");
      sendMessage(chat_id, risposta);
    }
  }  // Comando /start → disattiva mute e invia messaggio di attivazione
  
}

function fetchTelegramFile(fileId) {
  var fileResp = UrlFetchApp.fetch(telegramUrl + "/getFile?file_id=" + encodeURIComponent(fileId));
  var fileData = JSON.parse(fileResp.getContentText());
  if (!fileData.ok || !(fileData.result && fileData.result.file_path)) {
    throw new Error("Risposta non valida da Telegram.");
  }

  var filePath = fileData.result.file_path;
  var downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;
  var contentResp = UrlFetchApp.fetch(downloadUrl);
  return contentResp.getContentText();
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
