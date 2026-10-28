// ============================================================
// MOTOR DE BÚSQUEDA V1
// ETAPA 1 — CONSTRUCCIÓN DEL ÍNDICE
// ============================================================

const SEARCH_FIELDS = [
    "brand",
    "category",
    "name",
    "keywords",
    "Atributo1",
    "Atributo2",
    "Atributo3",
    "Atributo4"
];


// ------------------------------------------------------------
// NORMALIZACIÓN
// ------------------------------------------------------------

function normalizeSearchValue(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return value
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}


// ------------------------------------------------------------
// VERSIÓN COMPACTA
//
// "Oke Bon" → "okebon"
// "Oke-Bon" → "okebon"
// "OkeBon"  → "okebon"
// ------------------------------------------------------------

function compactSearchValue(value) {

    return normalizeSearchValue(value)
        .replace(/[^a-z0-9]/g, "");
}


// ------------------------------------------------------------
// SEPARAR EN TÉRMINOS
//
// "Ayudin lavandina 1 litro"
// → ["ayudin", "lavandina", "1", "litro"]
// ------------------------------------------------------------

function tokenizeSearchValue(value) {

    const normalized = normalizeSearchValue(value);

    if (!normalized) {
        return [];
    }

    return normalized
        .split(/\s+/)
        .filter(Boolean);
}


// ------------------------------------------------------------
// CONSTRUCCIÓN DEL ÍNDICE
// ------------------------------------------------------------

function buildSearchIndex(products) {

    const index = [];

    if (!Array.isArray(products)) {
        return index;
    }


    products.forEach(product => {

        if (!product) {
            return;
        }


        SEARCH_FIELDS.forEach(fieldName => {

            const value = product[fieldName];

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return;
            }


            const original =
                value.toString().trim();


            if (!original) {
                return;
            }


            const normalized =
                normalizeSearchValue(original);


            if (!normalized) {
                return;
            }


            const compact =
                compactSearchValue(original);


            const tokens =
                tokenizeSearchValue(original);


            index.push({

                productId: product.Id,

                product: product,

                field: fieldName,

                original: original,

                normalized: normalized,

                compact: compact,

                tokens: tokens

            });

        });

    });


    return index;
}

// ============================================================
// ETAPA 2 — GENERACIÓN DE CANDIDATOS
// V1 — BÚSQUEDA POR TOKENS
// ============================================================

// ------------------------------------------------------------
// SIMILITUD APROXIMADA
// ------------------------------------------------------------

function searchSimilarity(a, b) {

    if (!a || !b) {
        return 0;
    }

    if (a === b) {
        return 1;
    }

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {

        for (let j = 1; j <= a.length; j++) {

            if (
                b.charAt(i - 1) === a.charAt(j - 1)
            ) {

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

    const distance =
        matrix[b.length][a.length];

    const maxLength =
        Math.max(a.length, b.length);

    if (maxLength === 0) {
        return 1;
    }

    return 1 - (
        distance / maxLength
    );
}

function getSearchCandidates(query, searchIndex) {

    const normalizedQuery =
        normalizeSearchValue(query);

    if (!normalizedQuery) {
        return [];
    }

    const queryTerms =
        tokenizeSearchValue(normalizedQuery);

    if (!queryTerms.length) {
        return [];
    }

    if (queryTerms.length > 1) {

        const termResults =
            queryTerms.map(term =>
                getSearchCandidates(
                    term,
                    searchIndex
                )
            );

        if (
            termResults.some(
                results => !results.length
            )
        ) {
            return [];
        }

        const productSets =
            termResults.map(results =>
                new Set(
                    results.map(
                        result =>
                            String(result.productId)
                    )
                )
            );

        const commonProductIds =
            [...productSets[0]].filter(
                productId =>
                    productSets.every(
                        productSet =>
                            productSet.has(productId)
                    )
            );

        if (!commonProductIds.length) {
            return [];
        }

        const commonIds =
            new Set(commonProductIds);

        return termResults
            .flat()
            .filter(candidate =>
                commonIds.has(
                    String(candidate.productId)
                )
            );
    }

    const compactQuery =
        compactSearchValue(normalizedQuery);

    const candidates = [];

    searchIndex.forEach(entry => {

        let bestScore = 0;

        if (
            entry.normalized === normalizedQuery
        ) {

            bestScore = 1;

        }
        else if (
            entry.compact === compactQuery
        ) {

            bestScore = 0.98;

        }
        else if (
            entry.normalized.includes(
                normalizedQuery
            )
        ) {

            bestScore = 0.90;

        }

        entry.tokens.forEach(token => {

            const tokenCompact =
                compactSearchValue(token);

            if (!tokenCompact) {
                return;
            }

            if (
                token === normalizedQuery
            ) {

                bestScore =
                    Math.max(
                        bestScore,
                        1
                    );

                return;
            }

            if (
                tokenCompact === compactQuery
            ) {

                bestScore =
                    Math.max(
                        bestScore,
                        0.98
                    );

                return;
            }

            if (
                token.includes(normalizedQuery)
            ) {

                bestScore =
                    Math.max(
                        bestScore,
                        0.92
                    );

                return;
            }

            let prefixSimilarity = 0;

            if (
                compactQuery.length >= 2 &&
                tokenCompact.length >=
                    compactQuery.length
            ) {

                const tokenPrefix =
                    tokenCompact.substring(
                        0,
                        compactQuery.length
                    );

                prefixSimilarity =
                    searchSimilarity(
                        compactQuery,
                        tokenPrefix
                    );

            }

            const similarity =
                searchSimilarity(
                    compactQuery,
                    tokenCompact
                );

            const queryLength =
                compactQuery.length;

            let minimumSimilarity;

            if (queryLength <= 3) {

                minimumSimilarity = 0.80;

            }
            else if (queryLength === 4) {

                minimumSimilarity = 0.70;

            }
            else if (queryLength === 5) {

                minimumSimilarity = 0.68;

            }
            else if (queryLength === 6) {

                minimumSimilarity = 0.65;

            }
            else {

                minimumSimilarity = 0.60;

            }

            if (
                prefixSimilarity >=
                minimumSimilarity
            ) {

                bestScore =
                    Math.max(
                        bestScore,
                        prefixSimilarity
                    );

            }

            if (
                similarity >=
                minimumSimilarity
            ) {

                bestScore =
                    Math.max(
                        bestScore,
                        similarity
                    );

            }

        });

        if (bestScore > 0) {

            candidates.push({

                product: entry.product,

                productId: entry.productId,

                field: entry.field,

                original: entry.original,

                score: bestScore

            });

        }

    });

    return candidates;
}
// ============================================================
// SEARCH RULES COMO CANDIDATOS ALTERNATIVOS
// ============================================================

const getSearchCandidatesBase = getSearchCandidates;

getSearchCandidates = function(query, searchIndex) {

    if (
        !query ||
        !Array.isArray(searchIndex)
    ) {
        return [];
    }

    const normalizedQuery =
        normalizeSearchValue(query);

    if (!normalizedQuery) {
        return [];
    }

    const queryTerms =
        tokenizeSearchValue(normalizedQuery);

    if (!queryTerms.length) {
        return [];
    }

    if (queryTerms.length > 1) {

        const termResults =
            queryTerms.map(term =>
                getSearchCandidates(
                    term,
                    searchIndex
                )
            );

        if (
            termResults.some(
                results => !results.length
            )
        ) {
            return [];
        }

        const productSets =
            termResults.map(results =>
                new Set(
                    results.map(
                        result =>
                            String(result.productId)
                    )
                )
            );

        const commonProductIds =
            [...productSets[0]].filter(
                productId =>
                    productSets.every(
                        productSet =>
                            productSet.has(productId)
                    )
            );

        if (!commonProductIds.length) {
            return [];
        }

        const commonIds =
            new Set(commonProductIds);

        const merged =
            new Map();

        termResults.forEach(results => {

            results.forEach(candidate => {

                const productId =
                    String(candidate.productId);

                if (!commonIds.has(productId)) {
                    return;
                }

                const key =
                    productId +
                    "|" +
                    candidate.field;

                const existing =
                    merged.get(key);

                if (
                    !existing ||
                    candidate.score > existing.score
                ) {
                    merged.set(
                        key,
                        candidate
                    );
                }

            });

        });

        return Array.from(
            merged.values()
        );
    }

    const singleTerm =
        queryTerms[0];

    const queries = [
        singleTerm
    ];

    if (
        typeof SEARCH_RULES !== "undefined" &&
        Array.isArray(SEARCH_RULES)
    ) {

        SEARCH_RULES.forEach(rule => {

            if (
                !rule ||
                !rule.from ||
                !rule.to
            ) {
                return;
            }

            const ruleFrom =
                normalizeSearchValue(
                    rule.from
                );

            const ruleIndex = [{

                productId: "__rule__",

                product: null,

                field: "rule",

                original: rule.from,

                normalized: ruleFrom,

                compact:
                    compactSearchValue(
                        rule.from
                    ),

                tokens:
                    tokenizeSearchValue(
                        rule.from
                    )

            }];

            const ruleMatch =
                getSearchCandidatesBase(
                    singleTerm,
                    ruleIndex
                );

            if (ruleMatch.length) {
                queries.push(
                    rule.to
                );
            }

        });

    }

    const merged =
        new Map();

    queries.forEach(searchQuery => {

        const candidates =
            getSearchCandidatesBase(
                searchQuery,
                searchIndex
            );

        candidates.forEach(candidate => {

            const key =
                String(candidate.productId) +
                "|" +
                candidate.field;

            const existing =
                merged.get(key);

            if (
                !existing ||
                candidate.score > existing.score
            ) {

                merged.set(
                    key,
                    candidate
                );

            }

        });

    });

    const directCandidates =
        Array.from(
            merged.values()
        );

    const fuzzyCandidates =
        getFuzzySearchCandidates(
            singleTerm,
            searchIndex
        );

    return directCandidates.concat(
        fuzzyCandidates
    );
};

// ============================================================
// COINCIDENCIA FUZZY
// PRODUCTOS + SEARCH_RULES
// ============================================================

function getFuzzySearchCandidates(query, searchIndex) {

    if (!query || !Array.isArray(searchIndex)) {
        return [];
    }

    const normalizedQuery =
        normalizeSearchValue(query);

    if (!normalizedQuery) {
        return [];
    }

    const results = [];


    // --------------------------------------------------------
    // 1. PRODUCTOS
    // --------------------------------------------------------

    searchIndex.forEach(entry => {

        if (!entry || !entry.tokens) {
            return;
        }

        entry.tokens.forEach(token => {

            const normalizedToken =
                normalizeSearchValue(token);

            if (!normalizedToken) {
                return;
            }

            if (normalizedToken === normalizedQuery) {
                return;
            }

            const similarity =
                searchSimilarity(
                    normalizedQuery,
                    normalizedToken
                );

            if (similarity >= 0.75) {

                results.push({

                    product: entry.product,

                    productId: entry.productId,

                    field: entry.field,

                    original: entry.original,

                    score: similarity

                });

            }

        });

    });


    // --------------------------------------------------------
    // 2. SEARCH RULES
    // --------------------------------------------------------

    if (
        typeof SEARCH_RULES !== "undefined" &&
        Array.isArray(SEARCH_RULES)
    ) {

        SEARCH_RULES.forEach(rule => {

            if (
                !rule ||
                !rule.from ||
                !rule.to
            ) {
                return;
            }

            const ruleFrom =
                normalizeSearchValue(rule.from);

            const similarity =
                searchSimilarity(
                    normalizedQuery,
                    ruleFrom
                );

            if (similarity < 0.75) {
                return;
            }


            // Buscar el TO de la regla
            // directamente contra los productos.
            const ruleCandidates =
                getSearchCandidatesBase(
                    rule.to,
                    searchIndex
                );


            ruleCandidates.forEach(candidate => {

                results.push({

                    product: candidate.product,

                    productId: candidate.productId,

                    field: candidate.field,

                    original: candidate.original,

                    score: similarity

                });

            });

        });

    }


    return results;
}


// ------------------------------------------------------------
// AGREGAR FUZZY A LOS CANDIDATOS
// ------------------------------------------------------------

const originalGetSearchCandidates =
    getSearchCandidates;


getSearchCandidates = function(query, searchIndex) {

    const candidates =
        originalGetSearchCandidates(
            query,
            searchIndex
        );

    const fuzzyCandidates =
        getFuzzySearchCandidates(
            query,
            searchIndex
        );

    return candidates.concat(
        fuzzyCandidates
    );
};

// ============================================================
// ETAPA 3 — CONSOLIDACIÓN Y RELEVANCIA POR PRODUCTO
// ============================================================

function rankSearchCandidates(candidates) {

    const productsMap = new Map();


    candidates.forEach(candidate => {

        const productId =
            candidate.productId;

        if (!productId) {
            return;
        }


        // ----------------------------------------------------
        // CREAR REGISTRO DEL PRODUCTO
        // ----------------------------------------------------

        if (!productsMap.has(productId)) {

            productsMap.set(productId, {

                productId: productId,

                product: candidate.product,

                matches: [],

                relevance: 0

            });

        }


        const productResult =
            productsMap.get(productId);


        // ----------------------------------------------------
        // GUARDAR LA COINCIDENCIA
        // ----------------------------------------------------

productResult.matches.push({

    field: candidate.field,

    original: candidate.original,

    matchedTerm: candidate.matchedTerm || "",

    score: candidate.score

});
 });

    // --------------------------------------------------------
    // CALCULAR RELEVANCIA FINAL
    // --------------------------------------------------------

    productsMap.forEach(result => {

        let relevance = 0;


        result.matches.forEach(match => {

            let weight = 1;


            // ------------------------------------------------
            // IMPORTANCIA DEL CAMPO
            // ------------------------------------------------

            switch (match.field) {

                case "brand":
                    weight = 1.10;
                    break;

                case "name":
                    weight = 1.00;
                    break;

                case "keywords":
                    weight = 0.95;
                    break;

                case "category":
                    weight = 0.80;
                    break;

                case "Atributo1":
                    weight = 0.85;
                    break;

                case "Atributo2":
                    weight = 0.85;
                    break;

                case "Atributo3":
                    weight = 0.85;
                    break;

                case "Atributo4":
                    weight = 0.85;
                    break;

            }


            relevance =
                Math.max(
                    relevance,
                    match.score * weight
                );

        });

        // ----------------------------------------------------
        // BONIFICACIÓN POR MÚLTIPLES COINCIDENCIAS
        // ----------------------------------------------------

        if (result.matches.length >= 2) {

            relevance += 0.05;

        }


        if (result.matches.length >= 3) {

            relevance += 0.03;

        }


        // ----------------------------------------------------
        // GUARDAR RELEVANCIA
        // ----------------------------------------------------

        result.relevance =
            relevance;

    });


    // --------------------------------------------------------
    // ORDENAR
    // --------------------------------------------------------

    const results =
        Array.from(
            productsMap.values()
        );


    results.sort(
        (a, b) =>
            b.relevance -
            a.relevance
    );


    return results;
}

function searchVoiceProduct(brand, productText, searchIndex) {

    if (!brand || !productText || !Array.isArray(searchIndex)) {
        return [];
    }

    const normalizedBrand =
        normalizeSearchValue(brand);

    if (!normalizedBrand) {
        return [];
    }


    // --------------------------------------------------------
    // FILTRAR EL ÍNDICE A LA MARCA DETECTADA
    // --------------------------------------------------------

    const brandEntries =
        searchIndex.filter(entry => {

            if (!entry.product) {
                return false;
            }

            return normalizeSearchValue(
                entry.product.brand
            ) === normalizedBrand;

        });


    if (!brandEntries.length) {
        return [];
    }


    // --------------------------------------------------------
    // BUSCAR EL PRODUCTO DENTRO DE ESA MARCA
    // --------------------------------------------------------

    const candidates =
        getSearchCandidates(
            productText,
            brandEntries
        );


    // --------------------------------------------------------
    // ORDENAR Y CONSOLIDAR POR PRODUCTO
    // --------------------------------------------------------

    return rankSearchCandidates(
        candidates
    );
}

// ============================================================
// INCORPORAR BUSQUEDA POR REGLAS
// ============================================================

function applySearchRules(text) {
    if (!text || typeof text !== "string") {
        return text;
    }

    let result = text;

    SEARCH_RULES.forEach(rule => {
        if (!rule || !rule.from || !rule.to) return;

        const from = normalizeSearchValue(rule.from);
        const to = rule.to;

        if (!from) return;

        // Busca la regla como palabra o frase completa,
        // sin modificar palabras que simplemente la contengan.
        const regex = new RegExp(
            `(^|\\s)${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`,
            "gi"
        );

        result = result.replace(regex, `$1${to}`);
    });

    return result;
}

// ============================================================
// ETAPA 4 — BÚSQUEDA POR VOZ
// MARCA + PRODUCTO
// ============================================================

function searchVoiceQuery(text, searchIndex) {

    if (!text || !Array.isArray(searchIndex)) return [];

    text = applySearchRules(text);

    const splitResult = splitVoiceBrandAndProduct(text);


    // --------------------------------------------------------
    // MARCA + PRODUCTO
    // --------------------------------------------------------

    if (
        splitResult &&
        splitResult.brand &&
        splitResult.remainingText
    ) {

        return searchVoiceProduct(
            splitResult.brand,
            splitResult.remainingText,
            searchIndex
        );

    }


    // --------------------------------------------------------
    // SIN MARCA → BÚSQUEDA GENERAL
    // --------------------------------------------------------

    const candidates =
        getSearchCandidates(
            text,
            searchIndex
        );

    return rankSearchCandidates(
        candidates
    );
}

// Solo productos que se pueden comprar (sin posters ni separadores, ver js/datos.js)
window.searchIndex = buildSearchIndex(
    typeof productosVendibles !== "undefined" ? productosVendibles : products
);