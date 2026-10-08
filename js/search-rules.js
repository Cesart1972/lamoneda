// ============================================================
// REGLAS PERSONALIZADAS DE BÚSQUEDA
// ============================================================
//
// "from" = lo que puede escribir o decir el cliente
// "to"   = término correcto que debe buscar el motor
//
// Las reglas sirven tanto para búsqueda escrita como por voz.
//

const SEARCH_RULES = [
  {from: "clay", to: "clight"},
  {from: "clite", to: "clight"},
  {from: "clai", to: "clight"},
  {from: "gel mas", to: "Hellman's"},
  {from: "zamora", to: "savora"},
  {from: "lia", to: "lima"},
  {from: "cbc", to: "CBSe"},
  {from: "lives", to: "Levex"},
  {from: "6m", to: "Seiseme"},
  {from: "6 m", to: "Seiseme"},
  {from: "acanaladas", to: "americanas"},
  {from: "labandina", to: "lavandina"},
  {from: "multi", to: "molto"},
  {from: "moto", to: "molto"},
  {from: "cvc", to: "cbse"},
  {from: "ruso", to: "rollo"},
];