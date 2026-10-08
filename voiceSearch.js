// ============================================================
// BUSQUEDA POR VOZ INTELIGENTE
// ============================================================

const voiceSearchBtn = document.getElementById("voiceSearchBtn");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;


// ------------------------------------------------------------
// CONFIGURACION
// ------------------------------------------------------------

const VOICE_MIN_SCORE = 0.68;


// ------------------------------------------------------------
// NORMALIZACION ESPECIAL PARA VOZ
// ------------------------------------------------------------

function normalizeVoice(value) {
  if (!value) return "";

  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}


// Esta versión elimina los espacios.
// Es importante para casos como:
//
// "media tarde" → "mediatarde"
// "o que bon"   → "okebon"
//
function compactVoice(value) {
  return normalizeVoice(value)
    .replace(/[^a-z0-9]/g, "");
}


// ------------------------------------------------------------
// DISTANCIA DE LEVENSHTEIN
// ------------------------------------------------------------

function levenshteinDistance(a, b) {

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {

    for (let j = 1; j <= a.length; j++) {

      if (b.charAt(i - 1) === a.charAt(j - 1)) {

        matrix[i][j] =
          matrix[i - 1][j - 1];

      } else {

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );

      }

    }
  }

  return matrix[b.length][a.length];
}


// ------------------------------------------------------------
// SIMILITUD
// ------------------------------------------------------------

function voiceSimilarity(a, b) {

  a = compactVoice(a);
  b = compactVoice(b);

  if (!a || !b) return 0;

  if (a === b) return 1;

  const distance =
    levenshteinDistance(a, b);

  const maxLength =
    Math.max(a.length, b.length);

  if (maxLength === 0) return 1;

  return 1 - (distance / maxLength);
}

// ------------------------------------------------------------
// VOICE SCORE
//
// Combina la similitud de voz con el tipo de campo.
// En esta primera etapa NO modifica ninguna búsqueda.
// Solo sirve para hacer pruebas.
// ------------------------------------------------------------

function calculateVoiceScore(query, candidate, type) {

  const queryCompact =
    compactVoice(query);

  const candidateCompact =
    compactVoice(candidate);


  if (!queryCompact || !candidateCompact) {
    return 0;
  }


  // ----------------------------------------------------------
  // SIMILITUD LEVENSHTEIN
  // ----------------------------------------------------------

  const similarity =
    voiceSimilarity(
      queryCompact,
      candidateCompact
    );


  // ----------------------------------------------------------
  // PRIORIDAD POR TIPO DE CAMPO
  //
  // BRAND tiene una pequeña ventaja porque sabemos que
  // los errores de reconocimiento aparecen especialmente
  // en nombres de marcas.
  // ----------------------------------------------------------

  let fieldBonus = 0;

  if (type === "brand") {
    fieldBonus = 0.08;
  }


  // ----------------------------------------------------------
  // COINCIDENCIA DE LONGITUD
  //
  // Evita favorecer demasiado palabras muy diferentes
  // solamente porque comparten algunas letras.
  // ----------------------------------------------------------

  const lengthDifference =
    Math.abs(
      queryCompact.length -
      candidateCompact.length
    );


  let lengthPenalty = 0;


  if (lengthDifference >= 5) {
    lengthPenalty = 0.10;

  } else if (lengthDifference >= 3) {
    lengthPenalty = 0.05;
  }


  // ----------------------------------------------------------
  // SCORE FINAL
  // ----------------------------------------------------------

  const score =
    similarity +
    fieldBonus -
    lengthPenalty;


  return Math.max(
    0,
    Math.min(1, score)
  );
}

// ------------------------------------------------------------
// REPRESENTACION FONETICA
//
// Convierte distintas formas de escritura que pueden venir
// del reconocimiento de voz en una representación comparable.
//
// IMPORTANTE:
// Esta función todavía NO modifica ninguna búsqueda.
// Es solamente para pruebas.
// ------------------------------------------------------------

function phoneticVoice(value) {

  let text =
    normalizeVoice(value);

  if (!text) {
    return "";
  }


  // ----------------------------------------------------------
  // REGLAS FONETICAS
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // REGLAS FONETICAS
  // ----------------------------------------------------------

  text = text

    // QU / QUI
    .replace(/que/g, "ke")
    .replace(/qui/g, "ki")

    // GUE / GUI
    .replace(/gue/g, "ge")
    .replace(/gui/g, "gi")

    // W inicial → sonido aproximado de GU
    .replace(/^w/g, "gu")

    // GUAY / GUAI
    .replace(/guay/g, "guai")
    .replace(/guai/g, "guai")

    // Y inicial → sonido aproximado de I
    .replace(/^y/g, "i");

  // ----------------------------------------------------------
  // COMPACTAR
  // ----------------------------------------------------------

  return compactVoice(text);
}

// ------------------------------------------------------------
// SIMILITUD FONETICA
//
// Compara dos textos después de aplicar las reglas fonéticas.
// Todavía NO interviene en la búsqueda real.
// ------------------------------------------------------------

function voicePhoneticSimilarity(a, b) {

  const phoneticA =
    phoneticVoice(a);

  const phoneticB =
    phoneticVoice(b);


  if (!phoneticA || !phoneticB) {
    return 0;
  }


  if (phoneticA === phoneticB) {
    return 1;
  }


  const distance =
    levenshteinDistance(
      phoneticA,
      phoneticB
    );


  const maxLength =
    Math.max(
      phoneticA.length,
      phoneticB.length
    );


  if (maxLength === 0) {
    return 1;
  }


  return 1 -
    (distance / maxLength);
}

// ------------------------------------------------------------
// COINCIDENCIA DEL INICIO
//
// Mide cuánto coincide el comienzo de dos textos.
// Pensado especialmente para marcas reconocidas por voz.
// ------------------------------------------------------------

function voicePrefixSimilarity(a, b) {

  const phoneticA =
    phoneticVoice(a);

  const phoneticB =
    phoneticVoice(b);


  if (!phoneticA || !phoneticB) {
    return 0;
  }


  const maxLength =
    Math.min(
      phoneticA.length,
      phoneticB.length
    );


  let matchingCharacters = 0;


  for (
    let i = 0;
    i < maxLength;
    i++
  ) {

    if (
      phoneticA[i] !== phoneticB[i]
    ) {

      break;
    }

    matchingCharacters++;

  }


  return matchingCharacters /
    Math.max(
      phoneticA.length,
      phoneticB.length
    );
}

// ------------------------------------------------------------
// SIMILITUD POR FRAGMENTO FONETICO
//
// Busca el fragmento consecutivo más largo que comparten
// la consulta y el candidato.
//
// Todavía NO interviene en la búsqueda real.
// ------------------------------------------------------------

function voiceFragmentSimilarity(a, b) {

  const phoneticA =
    phoneticVoice(a);

  const phoneticB =
    phoneticVoice(b);


  if (!phoneticA || !phoneticB) {
    return 0;
  }


  let longest = 0;


  for (let startA = 0; startA < phoneticA.length; startA++) {

    for (let startB = 0; startB < phoneticB.length; startB++) {

      let length = 0;


      while (
        startA + length < phoneticA.length &&
        startB + length < phoneticB.length &&
        phoneticA[startA + length] ===
        phoneticB[startB + length]
      ) {

        length++;

      }


      if (length > longest) {
        longest = length;
      }

    }

  }


  return longest /
    Math.max(
      phoneticA.length,
      phoneticB.length
    );
}

// --------------------------------------------------------
// SIMILITUD FLEXIBLE PARA RECONOCIMIENTO DE VOZ
// --------------------------------------------------------

function voiceLooseSimilarity(a, b) {

  const prepare = value =>
      compactVoice(value)
          .replace(/gh/g, "")
          .replace(/h/g, "")
          .replace(/y/g, "i")
          .replace(/w/g, "u");

  const aa = prepare(a);
  const bb = prepare(b);

  if (!aa || !bb) return 0;

  return voiceSimilarity(aa, bb);
}

// ------------------------------------------------------------
// MEJOR COINCIDENCIA DE TOKENS CONTRA UNA MARCA
//
// Analiza cada palabra de la consulta por separado.
// Todavía NO modifica el motor de búsqueda.
// ------------------------------------------------------------

function voiceBestTokenMatch(query, brand) {

  const queryTokens =
      tokenizeSearchValue(
          phoneticVoice(query)
      );

  const phoneticBrand =
      phoneticVoice(brand);


  if (
      !queryTokens.length ||
      !phoneticBrand
  ) {
      return 0;
  }


  let bestScore = 0;


  queryTokens.forEach(token => {

      if (!token) {
          return;
      }


      const score =
          voiceFragmentSimilarity(
              token,
              phoneticBrand
          );


      if (score > bestScore) {
          bestScore = score;
      }

  });


  return bestScore;
}

// ------------------------------------------------------------
// MEJOR TOKEN CONTRA FRAGMENTOS DE LA MARCA
//
// Divide la marca en fragmentos y busca la mejor coincidencia
// de cada token de la consulta contra esos fragmentos.
// Todavía NO modifica el buscador.
// ------------------------------------------------------------

function voiceTokenFragmentMatch(query, brand) {

  // Primero separamos la frase ORIGINAL.
  // Después aplicamos la transformación fonética
  // individualmente a cada palabra.
  const originalTokens =
      tokenizeSearchValue(query);


  const queryTokens =
      originalTokens.map(token =>
          phoneticVoice(token)
      );


  const phoneticBrand =
      phoneticVoice(brand);


  if (
      !queryTokens.length ||
      !phoneticBrand
  ) {
      return 0;
  }


  let bestScore = 0;


  queryTokens.forEach(token => {

      if (!token) {
          return;
      }


      // Probamos fragmentos de la marca.
      for (
          let start = 0;
          start < phoneticBrand.length;
          start++
      ) {

          for (
              let length = 3;
              start + length <= phoneticBrand.length;
              length++
          ) {

              const fragment =
                  phoneticBrand.substring(
                      start,
                      start + length
                  );


              const score =
                  voiceSimilarity(
                      token,
                      fragment
                  );


              if (score > bestScore) {
                  bestScore = score;
              }

          }

      }

  });


  return bestScore;

}




// ------------------------------------------------------------
// SCORE COMBINADO DE VOZ
// ------------------------------------------------------------

function combinedVoiceScore(query, candidate, type) {

  const textScore =
    voiceSimilarity(query, candidate);

  const phoneticScore =
    voicePhoneticSimilarity(query, candidate);

  const fragmentScore =
    voiceFragmentSimilarity(query, candidate);


  let score =
    (textScore * 0.30) +
    (phoneticScore * 0.45) +
    (fragmentScore * 0.25);


  // Las marcas tienen prioridad.
  if (type === "brand") {
    score += 0.05;
  }


  return Math.min(1, score);
}

// ------------------------------------------------------------
// CONSTRUCCION DEL DICCIONARIO
// ------------------------------------------------------------

function buildVoiceDictionary() {

  const dictionary = [];

  products.forEach(product => {

    if (!product) return;

    const fields = [

      {
        value: product.brand,
        type: "brand"
      },

      {
        value: product.category,
        type: "category"
      },

      {
        value: product.name,
        type: "name"
      },

      {
        value: product.keywords,
        type: "keywords"
      },

      {
        value: product.comestibles,
        type: "comestibles"
      },

      {
        value: product.limpieza,
        type: "limpieza"
      }

    ];


    fields.forEach(field => {

      if (!field.value) return;

      const original =
        field.value.toString().trim();

      const normalized =
        normalizeVoice(original);

      if (!normalized) return;


      dictionary.push({

        original: original,

        normalized: normalized,

        compact: compactVoice(original),

        type: field.type

      });

    });

  });


  // ----------------------------------------------------------
  // ELIMINAR DUPLICADOS
  // ----------------------------------------------------------

  const unique = [];

  const seen = new Set();

  dictionary.forEach(item => {

    const key =
      `${item.type}|${item.normalized}`;

    if (!seen.has(key)) {

      seen.add(key);

      unique.push(item);

    }

  });


  return unique;
}


// ------------------------------------------------------------
// CREAR DICCIONARIO
// ------------------------------------------------------------

const voiceDictionary =
  buildVoiceDictionary();


// ============================================================
// EVALUACION DE COINCIDENCIA DE MARCA POR VOZ
// ============================================================


function evaluateVoiceBrand(query, brand) {

    const normalizedQuery =
        normalizeVoice(query);

    const normalizedBrand =
        normalizeVoice(brand);


    if (
        !normalizedQuery ||
        !normalizedBrand
    ) {

        return {
            score: 0,
            method: "none"
        };

    }


    // --------------------------------------------------------
    // COINCIDENCIA EXACTA
    // --------------------------------------------------------

    if (
        normalizedQuery === normalizedBrand
    ) {

        return {
            score: 1,
            method: "exact"
        };

    }


    // --------------------------------------------------------
    // COMPARACIÓN FONÉTICA
    // --------------------------------------------------------

    const phoneticQuery =
        phoneticVoice(query);

    const phoneticBrand =
        phoneticVoice(brand);


    if (
        phoneticQuery === phoneticBrand
    ) {

        return {
            score: 0.99,
            method: "phonetic-exact"
        };

    }


    const phoneticScore =
        voiceSimilarity(
            phoneticQuery,
            phoneticBrand
        );


    // --------------------------------------------------------
    // SIMILITUD FLEXIBLE PARA VOZ
    // --------------------------------------------------------

    const looseScore =
        voiceLooseSimilarity(
            query,
            brand
        );


    // --------------------------------------------------------
    // FRAGMENTOS DE TOKENS
    // --------------------------------------------------------

    const tokenFragmentScore =
        voiceTokenFragmentMatch(
            query,
            brand
        );


    // --------------------------------------------------------
    // SCORE ORIGINAL
    //
    // Mantenemos la fórmula que ya funcionaba.
    // La métrica loose es una señal adicional,
    // no reemplaza el score original.
    // --------------------------------------------------------

    let score =
        (phoneticScore * 0.55) +
        (tokenFragmentScore * 0.45);


    // --------------------------------------------------------
    // MARCAS MUY CORTAS
    // --------------------------------------------------------

    if (
        phoneticBrand.length <= 4 &&
        phoneticQuery !== phoneticBrand
    ) {

        score *= 0.85;

    }


    return {

        score: score,

        method: "combined",

        phoneticScore:
            phoneticScore,

        looseScore:
            looseScore,

        tokenFragmentScore:
            tokenFragmentScore

    };

}



function findBestVoiceBrandMatch(query) {
  const brands = [...new Set(
      products
          .map(product => product.brand)
          .filter(Boolean)
  )];

  const candidates = brands.map(brand => {
      const evaluation = evaluateVoiceBrand(query, brand);

      return {
          brand: brand,
          score: evaluation.score,
          method: evaluation.method,
          phoneticScore: evaluation.phoneticScore || 0,
          tokenFragmentScore: evaluation.tokenFragmentScore || 0,
          looseScore: evaluation.looseScore || 0
      };
  });

  candidates.sort((a, b) => {
      // La coincidencia normal sigue teniendo prioridad,
      // pero una coincidencia loose muy superior puede imponerse.
      const scoreA = a.score + (a.looseScore * 0.25);
      const scoreB = b.score + (b.looseScore * 0.25);

      return scoreB - scoreA;
  });

  if (!candidates.length) {
      return null;
  }

  const best = candidates[0];
  const second = candidates[1] || null;

  const bestCombined =
      best.score + (best.looseScore * 0.25);

  const secondCombined = second
      ? second.score + (second.looseScore * 0.25)
      : 0;

  return {
      best: best,
      second: second,
      difference: bestCombined - secondCombined,
      candidates: candidates.slice(0, 8)
  };
}

function decideVoiceBrandMatch(query) {
  const result = findBestVoiceBrandMatch(query);

  if (!result || !result.best) {
      return {
          accepted: false,
          query: query,
          reason: "no-candidate"
      };
  }

  const best = result.best;

  // Coincidencia fuerte
  if (best.score >= 0.70 && result.difference >= 0.12) {
      return {
          accepted: true,
          query: query,
          brand: best.brand,
          score: best.score,
          difference: result.difference,
          reason: "strong-match"
      };
  }

  // Coincidencia de alta confianza
  if (best.score >= 0.80 && result.difference >= 0.08) {
      return {
          accepted: true,
          query: query,
          brand: best.brand,
          score: best.score,
          difference: result.difference,
          reason: "high-confidence"
      };
  }

  // Coincidencia fonética flexible
  if (best.looseScore >= 0.75 && result.difference >= 0.03) {
      return {
          accepted: true,
          query: query,
          brand: best.brand,
          score: best.score,
          difference: result.difference,
          looseScore: best.looseScore,
          reason: "voice-loose-match"
      };
  }

  return {
      accepted: false,
      query: query,
      brand: best.brand,
      score: best.score,
      difference: result.difference,
      looseScore: best.looseScore || 0,
      reason: "ambiguous"
  };
}

function splitVoiceBrandAndProduct(text) {

  if (!text) {
    return null;
  }


  // --------------------------------------------------------
  // Separar la frase ORIGINAL en palabras.
  // --------------------------------------------------------

  const tokens =
    tokenizeSearchValue(text);


  if (!tokens.length) {
    return null;
  }


  let bestMatch = null;


  // --------------------------------------------------------
  // Probar marcas de 1, 2 y 3 palabras.
  // Siempre desde el comienzo de la frase.
  // --------------------------------------------------------

  const maxBrandWords =
    Math.min(3, tokens.length);


  for (
    let wordCount = 1;
    wordCount <= maxBrandWords;
    wordCount++
  ) {

    const possibleBrand =
      tokens
        .slice(0, wordCount)
        .join(" ");


    const result =
      decideVoiceBrandMatch(
        possibleBrand
      );


    if (
      !result ||
      !result.accepted
    ) {
      continue;
    }


    // ------------------------------------------------------
    // Nos quedamos con la mejor coincidencia.
    // ------------------------------------------------------

    if (
      !bestMatch ||
      result.score > bestMatch.score
    ) {

      const remainingTokens =
        tokens.slice(wordCount);


      bestMatch = {

        original: text,

        brand: result.brand,

        brandScore: result.score,

        brandDifference:
          result.difference,

        remainingText:
          remainingTokens.join(" "),

        brandWords:
          wordCount

      };

    }

  }


  return bestMatch;

}

// ------------------------------------------------------------
// BUSCAR MEJOR COINCIDENCIA
// ------------------------------------------------------------

function findBestVoiceMatch(text) {

  const normalizedText =
    normalizeVoice(text);

  const compactText =
    compactVoice(text);


  if (!normalizedText) {
    return null;
  }


  // ========================================================
  // 1. MARCA + PRODUCTO
  // ========================================================

  const splitResult =
    splitVoiceBrandAndProduct(text);


  if (splitResult) {

    return {

      item: {
        original: splitResult.brand,
        normalized: normalizeVoice(splitResult.brand),
        compact: compactVoice(splitResult.brand),
        type: "brand"
      },

      score:
        splitResult.brandScore,

      brandMatch: true,

      brandDifference:
        splitResult.brandDifference,

      brandReason:
        "brand-plus-product",

      remainingText:
        splitResult.remainingText

    };

  }


  // ========================================================
  // 2. SI NO HAY MARCA + PRODUCTO:
  //    INTENTAR IDENTIFICAR UNA MARCA SOLA
  // ========================================================

  const brandResult =
    decideVoiceBrandMatch(text);


  if (
    brandResult &&
    brandResult.accepted
  ) {

    const brandItem =
      voiceDictionary.find(item =>
        item.type === "brand" &&
        normalizeVoice(item.original) ===
        normalizeVoice(brandResult.brand)
      );


    if (brandItem) {

      return {

        item: brandItem,

        score:
          brandResult.score,

        brandMatch: true,

        brandDifference:
          brandResult.difference,

        brandReason:
          brandResult.reason,

        remainingText: ""

      };

    }

  }


  // ========================================================
  // 3. BÚSQUEDA GENERAL EXISTENTE
  // ========================================================

  let bestMatch = null;

  let bestScore = 0;


  voiceDictionary.forEach(item => {

    // ------------------------------------------------------
    // COINCIDENCIA EXACTA
    // ------------------------------------------------------

    if (
      item.normalized === normalizedText
    ) {

      bestMatch = item;

      bestScore = 1;

      return;

    }


    // ------------------------------------------------------
    // COINCIDENCIA IGNORANDO ESPACIOS
    // ------------------------------------------------------

    if (
      item.compact === compactText
    ) {

      bestMatch = item;

      bestScore = 0.99;

      return;

    }


    // ------------------------------------------------------
    // COINCIDENCIA APROXIMADA
    // ------------------------------------------------------

    let score =
      voiceSimilarity(
        compactText,
        item.compact
      );


    if (item.type === "brand") {
      score += 0.03;
    }


    if (score > bestScore) {

      bestScore = score;

      bestMatch = item;

    }

  });


  if (!bestMatch) {
    return null;
  }


  return {

    item: bestMatch,

    score: bestScore,

    brandMatch: false,

    remainingText: ""

  };

}



// ------------------------------------------------------------
// CORRECCION DEL TEXTO RECONOCIDO
// ------------------------------------------------------------

function correctVoiceText(text) {

  const result =
    findBestVoiceMatch(text);


  if (!result) {
    return text;
  }


  // --------------------------------------------------------
  // MARCA + PRODUCTO
  // --------------------------------------------------------

  if (
    result.brandMatch &&
    result.remainingText
  ) {

    return (
      result.item.original +
      " " +
      result.remainingText
    );

  }


  // --------------------------------------------------------
  // CUALQUIER OTRA COINCIDENCIA
  // --------------------------------------------------------

  if (
    result.score >= VOICE_MIN_SCORE
  ) {

    return result.item.original;

  }


  return text;

}


// ------------------------------------------------------------
// RECONOCIMIENTO DE VOZ
// ------------------------------------------------------------

if (SpeechRecognition) {

  const recognition =
    new SpeechRecognition();


  recognition.lang = "es-AR";

  recognition.continuous = false;

  recognition.interimResults = false;


  // ----------------------------------------------------------
  // BOTON DEL MICROFONO
  // ----------------------------------------------------------

  voiceSearchBtn.addEventListener(
    "click",
    () => {
      searchInput.value = "";
      try {

        recognition.start();

      } catch (error) {

        console.log(
          "El reconocimiento ya está activo."
        );

      }

    }
  );


  // ----------------------------------------------------------
  // COMIENZA A ESCUCHAR
  // ----------------------------------------------------------

  recognition.onstart = () => {

    voiceSearchBtn.classList.add(
      "listening"
    );

    searchInput.placeholder =
      "Escuchando...";

  };


  // ----------------------------------------------------------
  // RESULTADO
  // ----------------------------------------------------------

 
  recognition.onresult = (event) => {
    const textoOriginal = event.results[0][0].transcript;

    console.log("🎤 Voz:", textoOriginal);

    const resultados = searchVoiceQuery(
        textoOriginal,
        window.searchIndex
    );

    console.log("🔎 Resultados:", resultados);

    // Si encontramos productos confiables,
    // los mostramos directamente.
    if (showVoiceResults(resultados, textoOriginal)) {
        return;
    }

    // Si no encontramos nada confiable,
    // dejamos que funcione la búsqueda normal escrita.
    searchInput.value = textoOriginal;
    searchInput.dispatchEvent(
        new Event("input", { bubbles: true })
    );
};

  // ----------------------------------------------------------
  // TERMINA
  // ----------------------------------------------------------

  recognition.onend = () => {

    voiceSearchBtn.classList.remove(
      "listening"
    );

    searchInput.placeholder =
      "Busca tus productos";

  };


  // ----------------------------------------------------------
  // ERROR
  // ----------------------------------------------------------

  recognition.onerror = (event) => {

    console.error(
      "Error de reconocimiento:",
      event.error
    );


    voiceSearchBtn.classList.remove(
      "listening"
    );

    searchInput.placeholder =
      "Busca tus productos";

  };

} else {

  voiceSearchBtn.style.display =
    "none";


  console.warn(
    "Este navegador no soporta reconocimiento de voz."
  );

}


// ============================================================
// FIN BUSQUEDA POR VOZ
// ============================================================


// =========================================================
// SIMULADOR TEMPORAL DE VOZ
// =========================================================

window.simularVoz = function(texto) {

  console.log("🎤 Voz simulada:", texto);

  const resultados = searchVoiceQuery(
    texto,
    window.searchIndex
  );

  console.log("🔎 Resultados:", resultados);

  return resultados;
};
