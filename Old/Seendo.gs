function sendSeendo(imageUrl) {
  
  // --- SELETTORE MODELLO ---
  var model = 'g'; 
  // -------------------------

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

  var responseText;
  var statusCode;
  var response;

  try {
    if (model === 'o') {
      // --- LOGICA OPENAI (invariata) ---
      Logger.log("Utilizzo di OpenAI (model 'o')...");
      var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
      if (!apiKey) { throw new Error("OPENAI_API_KEY non configurata."); }
      var payload = {
        model: 'gpt-4o',
        temperature: 1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      };
      response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      responseText = response.getContentText();
      statusCode = response.getResponseCode();
      if (statusCode < 200 || statusCode >= 300) {
        throw new Error("OpenAI ha risposto con stato " + statusCode + ": " + responseText);
      }
      var data = JSON.parse(responseText);
      if (!data.choices || !data.choices.length || !data.choices[0].message) {
        throw new Error("Risposta OpenAI senza contenuto utile.");
      }
      var content = data.choices[0].message.content;
      return content.trim(); 

    } else if (model === 'g') {
      // --- LOGICA GEMINI (OCR IMMAGINE) ---
      Logger.log("Utilizzo di Gemini (gemini-2.5-flash)...");
      var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
      if (!apiKey) { throw new Error("GEMINI_API_KEY non configurata."); }
      
      var imageBlob = UrlFetchApp.fetch(imageUrl).getBlob();
      var base64Data = Utilities.base64Encode(imageBlob.getBytes());
      var mimeType = imageBlob.getContentType();

      // *** ECCO LA CORREZIONE ***
      // Se il server non fornisce un MIME type (solo 'octet-stream'),
      // forziamo 'image/jpeg', che è quello che Gemini si aspetta.
      if (mimeType === "application/octet-stream") {
        Logger.log("MIME type 'application/octet-stream' rilevato. Conversione forzata a 'image/jpeg'.");
        mimeType = "image/jpeg";
      }
      // *** FINE CORREZIONE ***

      var fullPrompt = systemPrompt + "\n\n" + userPrompt;

      var geminiPayload = {
        "contents": [
          {
            "parts": [
              { "text": fullPrompt },
              {
                "inlineData": {
                  "mimeType": mimeType, // Ora mimeType è corretto
                  "data": base64Data
                }
              }
            ]
          }
        ],
        "generationConfig": {
          "responseMimeType": "application/json", 
          "temperature": 1.0 
        }
      };

      var modelName = "gemini-2.5-flash"; 
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;

      response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(geminiPayload),
        muteHttpExceptions: true
      });

      responseText = response.getContentText();
      statusCode = response.getResponseCode();

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error("Gemini (OCR) ha risposto con stato " + statusCode + ": " + responseText);
      }

      var geminiData = JSON.parse(responseText);
      if (!geminiData.candidates || !geminiData.candidates.length || !geminiData.candidates[0].content) {
        if (geminiData.promptFeedback && geminiData.promptFeedback.blockReason) {
            throw new Error("Richiesta bloccata da Gemini per: " + geminiData.promptFeedback.blockReason);
        }
        throw new Error("Risposta Gemini senza contenuto utile: " + responseText);
      }
      
      var geminiContent = geminiData.candidates[0].content.parts[0].text;
      return geminiContent.trim();

    } else {
      throw new Error("Valore 'model' non valido. Usare 'o' o 'g'.");
    }

  } catch (err) {
    Logger.log("Errore in sendSeendo: " + err.message);
    throw err;
  }
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
  
  // --- SELETTORE MODELLO ---
  // Imposta il modello da TESTARE: 'o' = OpenAI, 'g' = Gemini
  var model = 'g'; 
  // -------------------------

  var response;
  var responseText;
  var statusCode;

  try {
    if (model === 'o') {
      // --- TEST OPENAI (invariato) ---
      Logger.log("Esecuzione check su OpenAI...");
      var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
      if (!apiKey) { throw new Error("OPENAI_API_KEY non configurata."); }
      var payload = {
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Sei un assistente di diagnostica. Rispondi solo in formato JSON.' },
          { role: 'user', content: [{ type: 'text', text: 'Rispondi con un oggetto JSON: {"status": "ok", "service": "openai"}' }] }
        ]
      };
      response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      responseText = response.getContentText();
      statusCode = response.getResponseCode();
      if (statusCode < 200 || statusCode >= 300) {
        throw new Error("OpenAI (check) ha risposto con stato " + statusCode + ": " + responseText);
      }
      var data = JSON.parse(responseText);
      var content = data.choices[0].message.content;
      Logger.log("Risposta OpenAI OK: " + content);
      return content.trim();

    } else if (model === 'g') {
      // --- TEST GEMINI (SOLO TESTO) ---
      Logger.log("Esecuzione check su Gemini (gemini-2.5-flash)...");
      var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
      if (!apiKey) { throw new Error("GEMINI_API_KEY non configurata."); }

      var geminiPayload = {
        "contents": [
          {
            "parts": [
              { "text": "Sei un assistente di diagnostica. Rispondi solo in formato JSON. Rispondi con un oggetto JSON: {\"status\": \"ok\", \"service\": \"gemini\"}" }
            ]
          }
        ],
        "generationConfig": {
          "responseMimeType": "application/json", // Questi modelli lo supportano!
          "temperature": 0.0
        }
      };
      
      // *** MODELLO CORRETTO DALLA TUA LISTA ***
      var modelName = "gemini-2.5-flash"; 
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;

      response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(geminiPayload),
        muteHttpExceptions: true
      });

      responseText = response.getContentText();
      statusCode = response.getResponseCode();

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error("Gemini (check) ha risposto con stato " + statusCode + ": " + responseText);
      }

      var geminiData = JSON.parse(responseText);
      if (!geminiData.candidates || !geminiData.candidates.length || !geminiData.candidates[0].content) {
         if (geminiData.promptFeedback && geminiData.promptFeedback.blockReason) {
            throw new Error("Richiesta bloccata da Gemini per: " + geminiData.promptFeedback.blockReason);
        }
        throw new Error("Risposta Gemini (check) senza contenuto utile: " + responseText);
      }
      var geminiContent = geminiData.candidates[0].content.parts[0].text;
      
      Logger.log("Risposta Gemini OK: " + geminiContent);
      return geminiContent.trim();
    
    } else {
      throw new Error("Valore 'model' non valido. Usare 'o' o 'g'.");
    }

  } catch (e) {
    Logger.log("Errore in sendSeendo_check: " + e.message);
    throw e;
  }
}
