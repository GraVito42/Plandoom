function sendSeendo(file_photo) {
  if (!file_photo || !file_photo.file_id) {
    throw new Error("Foto non valida o file_id mancante.");
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY non configurata nelle proprietà dello script.");
  }

  var photoData = _downloadTelegramPhotoAsBase64(file_photo.file_id);
  if (!photoData || !photoData.base64) {
    throw new Error("Impossibile scaricare la foto da Telegram.");
  }

  var mimeType = photoData.mimeType || 'image/jpeg';
  var dataUrl = 'data:' + mimeType + ';base64,' + photoData.base64;

  var systemPrompt = "Sei un assistente OCR esperto di agende Moleskine. " +
    "Devi restituire solo JSON valido seguendo le istruzioni.";

  var userPrompt = [
    "Trascrivi gli eventi presenti nella foto di un'agenda settimanale Moleskine standard.",
    "Ogni evento deve essere trasformato in un oggetto JSON con almeno questi campi:",
    "- title: titolo sintetico dell'evento (stringa)",
    "- start: data e ora di inizio in formato ISO 8601 con timezone UTC (es. 2024-05-20T09:00:00Z)",
    "- end: data e ora di fine in formato ISO 8601 con timezone UTC se disponibile, altrimenti ometti",
    "- due: usa lo stesso valore di start se non c'è un termine distinto",
    "- location: luogo dell'evento se indicato",
    "- notes: testo libero con eventuali dettagli",
    "- source: imposta sempre 'Seendo OCR'",
    "- scope: imposta sempre 'Personal'",
    "- kind: imposta sempre 'Event'",
    "- external_id: genera un identificativo stabile partendo da data e titolo (slug minuscolo senza spazi)",
    "Restituisci un oggetto JSON con la forma {\"events\": [ ... ]} compatibile con Glando.gs.",
    "Se non rilevi eventi validi restituisci {\"events\": []}.",
    "Non aggiungere testo extra fuori dal JSON."
  ].join('\n');

  var payload = {
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: userPrompt },
          {
            type: 'input_image',
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ]
  };

  var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var responseText = response.getContentText();
  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("OpenAI ha risposto con stato " + statusCode + ": " + responseText);
  }

  var data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    throw new Error("Risposta OpenAI non valida: " + responseText);
  }

  if (!data.choices || !data.choices.length || !data.choices[0].message) {
    throw new Error("Risposta OpenAI senza contenuto utile.");
  }

  var content = data.choices[0].message.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    var parts = content.map(function(item) {
      return typeof item === 'string' ? item : (item && item.text ? item.text : '');
    }).join('').trim();
    if (parts) {
      return parts;
    }
  }

  throw new Error("Impossibile interpretare la risposta OpenAI.");
}

function _downloadTelegramPhotoAsBase64(fileId) {
  var fileResp = UrlFetchApp.fetch(telegramUrl + '/getFile?file_id=' + encodeURIComponent(fileId));
  var fileData = JSON.parse(fileResp.getContentText());
  if (!fileData.ok || !(fileData.result && fileData.result.file_path)) {
    throw new Error('Risposta non valida da Telegram durante il recupero del file.');
  }

  var filePath = fileData.result.file_path;
  var downloadUrl = 'https://api.telegram.org/file/bot' + token + '/' + filePath;
  var contentResp = UrlFetchApp.fetch(downloadUrl);
  var blob = contentResp.getBlob();
  return {
    base64: Utilities.base64Encode(blob.getBytes()),
    mimeType: blob.getContentType()
  };
}

function sendSeendo_check() {
  var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY non configurata nelle proprietà dello script.");
  }

  var payload = {
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: 'Sei un assistente di diagnostica.' },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Rispondi con la stringa "ok".' }
        ]
      }
    ]
  };

  var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var responseText = response.getContentText();
  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("OpenAI ha risposto con stato " + statusCode + ": " + responseText);
  }

  var data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    throw new Error("Risposta OpenAI non valida: " + responseText);
  }

  if (!data.choices || !data.choices.length || !data.choices[0].message) {
    throw new Error("Risposta OpenAI senza contenuto utile.");
  }

  var content = data.choices[0].message.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    var parts = content.map(function(item) {
      return typeof item === 'string' ? item : (item && item.text ? item.text : '');
    }).join('').trim();
    if (parts) {
      return parts;
    }
  }

  throw new Error("Impossibile interpretare la risposta OpenAI.");
}
