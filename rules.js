/* Règles de classement par défaut : enseignes courantes (mots-clés sans accents, en majuscules).
   Le DERNIER mot-clé présent dans le libellé l'emporte. Tes règles perso passent après. */
(function (root) {
  const R = [];
  const add = (cat, list) => list.forEach(k => R.push([k, cat]));
  add('Shopping / loisirs', ['AMAZON', 'CDISCOUNT', 'FNAC', 'DARTY', 'BOULANGER', 'IKEA', 'LEROY MERLIN', 'CASTORAMA', 'BRICO', 'DECATHLON', 'ZARA', 'H&M', 'KIABI', 'CULTURA', ' ACTION ', 'GIFI', 'JOUECLUB', 'CINEMA', 'PATHE', 'UGC', 'GAUMONT', 'AQUARIUM', 'ZOO', 'PARC ']);
  add('Courses alimentaires', ['CARREFOUR', 'LECLERC', 'INTERMARCHE', 'MAGASIN U', 'SUPER U', 'HYPER U', 'LIDL', 'AUCHAN', 'MONOPRIX', 'FRANPRIX', 'ALDI', 'CASINO', 'PICARD', 'BIOCOOP', 'GRAND FRAIS', 'BOULANGERIE', 'BOUCHERIE', 'SUPERETTE', 'PRIMEUR', 'DRIVE']);
  add('Restaurants', ['DONALD', 'BURGER KING', 'KFC', 'QUICK', 'SUBWAY', 'DOMINO', 'PIZZA', 'UBER EATS', 'UBER *EATS', 'DELIVEROO', 'RESTAURANT', 'RESTO', 'BRASSERIE', 'STARBUCKS', 'SUSHI', 'KEBAB', 'CREPERIE']);
  add('Recharge / carburant', ['TOTALENERGIES', 'TOTAL ACCESS', 'SHELL', ' ESSO ', 'AVIA', 'ELECTRA', 'IONITY', 'FASTNED', 'IZIVIA', 'ALLEGO', 'POWERDOT', 'FRESHMILE', 'SUPERCHARGER', 'STATION', 'CARBURANT']);
  add('Péages / parkings', ['SANEF', 'COFIROUTE', 'VINCI AUTOROUTES', 'APRR', 'ULYS', 'SAPN', 'PEAGE', 'PARKING', 'INDIGO', 'Q-PARK', 'EFFIA']);
  add('Entretien voiture', ['NORAUTO', 'SPEEDY', 'MIDAS', 'FEU VERT', 'EUROMASTER', 'POINT S', 'CARGLASS', 'GARAGE', 'CONTROLE TECHNIQUE']);
  add('Jeux vidéo (Steam)', ['STEAM', 'EPIC GAMES', 'PLAYSTATION', 'NINTENDO', 'XBOX', 'INSTANT GAMING', 'UBISOFT', 'BLIZZARD']);
  add('Abonnements', ['NETFLIX', 'SPOTIFY', 'DISNEY', 'CANAL+', 'DEEZER', 'YOUTUBE', 'APPLE.COM/BILL', 'ICLOUD', 'ADOBE', 'MICROSOFT', 'GOOGLE ONE', 'AMAZON PRIME', 'PRIME VIDEO', 'DISCORD', 'OPENAI', 'ANTHROPIC', 'OVH', 'DROPBOX']);
  add('Santé / coiffure', ['PHARMA', 'MEDECIN', 'DOCTOLIB', 'OPTIQUE', 'DENTISTE', 'LABORATOIRE', 'MUTUELLE', 'COIFF', 'BARBIER']);
  add('Imprévus / divers', ['AMENDE', 'WERO', 'RETRAIT DAB', 'RETRAIT ', 'FONDATION', 'DON ']);
  add('Loyer', ['LOYER']);
  add('Électricité (EDF)', ['EDF', 'ENGIE']);
  add('Internet / mobile', ['ORANGE', 'SFR', 'BOUYGUES', 'FREE MOBILE', 'FREE SAS', 'SOSH', 'B&YOU']);
  add('Assurances', ['ASSURANCE', 'MAIF', 'MACIF', 'MATMUT', 'GROUPAMA', 'ALLIANZ', 'GMF', 'LEOCARE']);
  add('Impôts', ['IMPOT', 'DGFIP', 'TRESOR PUBLIC']);
  add('Frais bancaires', ['COMMISSION D', 'FORFAIT INTERETS', 'FRAIS CONVENTION', 'COTISATION CARTE', 'AGIOS', 'FRAIS TENUE']);
  add('Épargne', ['TRADE REPUBLIC', 'DEGIRO', 'BOURSORAMA']);
  add('Virement interne', ['VIR PERM. LIV', 'VIR LIVRET']);
  root.DEFAULT_RULES = R;
  if (typeof module !== 'undefined') module.exports = R;
})(typeof self !== 'undefined' ? self : globalThis);
