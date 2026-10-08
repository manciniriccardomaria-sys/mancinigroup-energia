import type { OfferCatalogItem } from "./offers";

// CTE MET 24/09/2026 e 02/10/2026; prezzi netti originali quando disponibili.
// Provvigioni: listino ricevuto il 07/10/2026, importi già spettanti all’agenzia.
export const metOfferCatalog: OfferCatalogItem[] = [
  {
    "code": "026846ENFML46XX289FAMFIXEEXMONX4",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET FAMILY POWER FIX",
    "customerType": "RES",
    "pcv": 3.5,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Family Power Fix 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "gross",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 20,
      "commissionPerUnit": 0,
      "renewalSpread": 0.0175,
      "nonHourlySurcharge": 0.003
    },
    "fixedPrice": 0.1871
  },
  {
    "code": "026846ENFML46XX289HOMEFIXEEXMON2",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET HOME POWER FIX",
    "customerType": "RES",
    "pcv": 8,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Home Power FIX 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "gross",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 35,
      "commissionPerUnit": 0,
      "renewalSpread": 0.0281,
      "nonHourlySurcharge": 0.003
    },
    "fixedPrice": 0.1991
  },
  {
    "code": "026846ENFML46XX2894HOMEFIXEEMON2",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET 4 HOME POWER FIX",
    "customerType": "RES",
    "pcv": 11,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4 Home Power FIX 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "gross",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 55,
      "commissionPerUnit": 0,
      "renewalSpread": 0.0281,
      "nonHourlySurcharge": 0.003
    },
    "fixedPrice": 0.1991
  },
  {
    "code": "026846ENFML46XX2894HOMEFIXEEMN24",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET 4 HOME POWER FIX 24",
    "customerType": "RES",
    "pcv": 11,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4 Home Power Fix 24 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 24,
      "priceBasis": "gross",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 55,
      "commissionPerUnit": 0,
      "renewalSpread": 0.0281,
      "nonHourlySurcharge": 0.003
    },
    "fixedPrice": 0.1782
  },
  {
    "code": "026846ENFML46XX2894HOMEFIXEEMN36",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET 4 HOME POWER FIX 36",
    "customerType": "RES",
    "pcv": 11,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4 Home Power Fix 36 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 36,
      "priceBasis": "gross",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 55,
      "commissionPerUnit": 0,
      "renewalSpread": 0.0281,
      "nonHourlySurcharge": 0.003
    },
    "fixedPrice": 0.1642
  },
  {
    "code": "026846ENFFL46XX289ONEXMULTIXXEEX",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET ONE POWER",
    "customerType": "BUS",
    "pcv": 15,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE ONE POWER 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 0,
      "commissionFixed": 30,
      "commissionPerUnit": 0.00025,
      "financialRate": 0.02,
      "referenceIndex": 0.156,
      "maxAnnualConsumption": 2000000,
      "notes": [
        "La stima esclude gli ulteriori costi delle CGF non disponibili.",
        "Esclusa la maggiorazione 0,002 €/kWh per decorrenza differita oltre tre mesi."
      ]
    },
    "fixedPrices": {
      "f1": 0.1703,
      "f2": 0.1807,
      "f3": 0.1591
    },
    "requiresBands": true
  },
  {
    "code": "026846ENFFL46XX2892YOUXMULTIXEEX",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET 2YOU POWER",
    "customerType": "BUS",
    "pcv": 15,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 2YOU POWER 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0.002,
      "monthlyServiceFee": 0,
      "commissionFixed": 30,
      "commissionPerUnit": 0.001,
      "financialRate": 0.02,
      "referenceIndex": 0.156,
      "maxAnnualConsumption": 2000000,
      "notes": [
        "La stima esclude gli ulteriori costi delle CGF non disponibili.",
        "Esclusa la maggiorazione 0,002 €/kWh per decorrenza differita oltre tre mesi."
      ]
    },
    "fixedPrices": {
      "f1": 0.1703,
      "f2": 0.1807,
      "f3": 0.1591
    },
    "requiresBands": true
  },
  {
    "code": "026846ENFFL46XX2894YOUXMULTIXEEX",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET 4YOU POWER",
    "customerType": "BUS",
    "pcv": 15,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4YOU POWER 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0.006,
      "monthlyServiceFee": 0,
      "commissionFixed": 30,
      "commissionPerUnit": 0.0015,
      "financialRate": 0.02,
      "referenceIndex": 0.156,
      "maxAnnualConsumption": 2000000,
      "notes": [
        "La stima esclude gli ulteriori costi delle CGF non disponibili.",
        "Esclusa la maggiorazione 0,002 €/kWh per decorrenza differita oltre tre mesi."
      ]
    },
    "fixedPrices": {
      "f1": 0.1703,
      "f2": 0.1807,
      "f3": 0.1591
    },
    "requiresBands": true
  },
  {
    "code": "026846ENFFL46XX289BUSINESSEEFIXX",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET BUSINESS POWER FIX",
    "customerType": "BUS",
    "pcv": 18,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Business Power Fix 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0.002,
      "monthlyServiceFee": 0,
      "commissionFixed": 40,
      "commissionPerUnit": 0.002,
      "financialRate": 0.02,
      "referenceIndex": 0.156,
      "maxAnnualConsumption": 50000
    },
    "fixedPrices": {
      "f1": 0.1828,
      "f2": 0.1932,
      "f3": 0.1716
    },
    "requiresBands": true
  },
  {
    "code": "026846ENFFL46XX289BUSINESSEFIX24",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET BUSINESS POWER FIX 24 MESI",
    "customerType": "BUS",
    "pcv": 18,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Business Power Fix 24 mesi 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 24,
      "priceBasis": "net",
      "commercialPerUnit": 0.002,
      "monthlyServiceFee": 0,
      "commissionFixed": 40,
      "commissionPerUnit": 0.002,
      "financialRate": 0.02,
      "referenceIndex": 0.137,
      "maxAnnualConsumption": 50000
    },
    "fixedPrices": {
      "f1": 0.1651,
      "f2": 0.1713,
      "f3": 0.1519
    },
    "requiresBands": true
  },
  {
    "code": "026846ENFFL46XX289CALENDFIXEEE24",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET CALENDAR FIX POWER 24 MESI",
    "customerType": "BUS",
    "pcv": 0,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE CALENDAR FIX POWER 24 mesi 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 24,
      "priceBasis": "net",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 0,
      "commissionFixed": 0,
      "commissionPerUnit": 0.005,
      "financialRate": 0.02,
      "referenceIndex": 0.144,
      "maxAnnualConsumption": 5000000,
      "notes": [
        "La stima esclude gli ulteriori costi delle CGF non disponibili."
      ],
      "minAnnualConsumption": 200000,
      "financialFrom": "2028-01-01"
    },
    "fixedPrices": {
      "f1": 0.1526,
      "f2": 0.1588,
      "f3": 0.1394
    },
    "requiresBands": true
  },
  {
    "code": "026846ESVOL46XX289CERMAKENERTOG2",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET CER MAKE ENERGY TOGETHER",
    "customerType": "RES",
    "pcv": 9,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE CER Make Energy Together 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 120,
      "priceBasis": "gross",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 50,
      "commissionPerUnit": 0,
      "energyModel": "cer",
      "renewalSpread": 0.0088,
      "nonHourlySurcharge": 0.003
    },
    "fixedPrice": 0.1045,
    "requiresBands": true
  },
  {
    "code": "026846ENFML46XX2974HMFXE24PROMET",
    "supplier": "MET",
    "commodity": "luce",
    "offerEasy": "MET 4 HOME POWER FIX 24 ProMETto",
    "customerType": "RES",
    "pcv": 11,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4 Home Power Fix 24 ProMETto -30% 02.10.2026.pdf",
      "conditionDate": "2026-10-02",
      "fixedMonths": 24,
      "priceBasis": "gross",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "fixedStartDate": "2027-01-01",
      "renewalSpread": 0.028,
      "notes": [
        "Provvigione da confermare.",
        "Prezzo 0,1247 dalla CTE; la scheda sintetica riporta 0,12474.",
        "Fase iniziale indicizzata per consumi prima del 01/01/2027."
      ],
      "nonHourlySurcharge": 0.003
    },
    "fixedPrice": 0.1247
  },
  {
    "code": "026846GNFML46XX289FAMILYXFIXGAS4",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET FAMILY GAS FIX",
    "customerType": "RES",
    "pcv": 4.5,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Family Gas Fix 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 20,
      "commissionPerUnit": 0,
      "gasPcsReference": 0.03852,
      "renewalSpread": 0.08
    },
    "fixedPrice": 0.744
  },
  {
    "code": "026846GNFML46XX289HOMEXFIXXGASX4",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET HOME GAS FIX",
    "customerType": "RES",
    "pcv": 8,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Home Gas Fix 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 35,
      "commissionPerUnit": 0,
      "gasPcsReference": 0.03852,
      "renewalSpread": 0.15
    },
    "fixedPrice": 0.833
  },
  {
    "code": "026846GNFML46XX2894HOMEXFIXGAS24",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET 4 HOME GAS FIX 24",
    "customerType": "RES",
    "pcv": 11,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4 Home Gas Fix 24 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 24,
      "priceBasis": "net",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 55,
      "commissionPerUnit": 0,
      "gasPcsReference": 0.03852,
      "notes": [
        "Spread dopo il periodo fisso non quantificato nella CTE: da confermare."
      ]
    },
    "fixedPrice": 0.695
  },
  {
    "code": "026846GNFML46XX2894HOMEXFIXGAS36",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET 4 HOME GAS FIX 36",
    "customerType": "RES",
    "pcv": 11,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4 Home Gas Fix 36 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 36,
      "priceBasis": "net",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "commissionFixed": 55,
      "commissionPerUnit": 0,
      "gasPcsReference": 0.03852,
      "notes": [
        "Spread dopo il periodo fisso non quantificato nella CTE: da confermare."
      ]
    },
    "fixedPrice": 0.632
  },
  {
    "code": "026846GNFML46XX2974HMFXE24PROMET",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET 4 HOME GAS FIX 24 ProMETto",
    "customerType": "RES",
    "pcv": 11,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE 4 Home Gas Fix 24 ProMETto -30% 02.10.2026.pdf",
      "conditionDate": "2026-10-02",
      "fixedMonths": 24,
      "priceBasis": "net",
      "commercialPerUnit": 0,
      "monthlyServiceFee": 1,
      "fixedStartDate": "2027-01-01",
      "renewalSpread": 0.15,
      "gasPcsReference": 0.03852,
      "notes": [
        "Provvigione da confermare.",
        "Fase iniziale M-GAS + spread per consumi prima del 01/01/2027."
      ]
    },
    "fixedPrice": 0.487
  },
  {
    "code": "026846GNFML46XX289BUSINESSGASFIX",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET BUSINESS GAS FIX",
    "customerType": "BUS",
    "pcv": 18,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Business Gas Fix 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0.02,
      "monthlyServiceFee": 0,
      "commissionFixed": 50,
      "commissionPerUnit": 0.015,
      "financialRate": 0.02,
      "gasCsc": 0.0356,
      "gasPcsReference": 0.03852,
      "referenceIndex": 0.68,
      "maxAnnualConsumption": 50000
    },
    "fixedPrice": 0.803
  },
  {
    "code": "026846GNFML46XX289BUSINESSGFIX24",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET BUSINESS GAS FIX 24 MESI",
    "customerType": "BUS",
    "pcv": 18,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE Business Gas Fix 24 mesi 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 24,
      "priceBasis": "net",
      "commercialPerUnit": 0.02,
      "monthlyServiceFee": 0,
      "commissionFixed": 50,
      "commissionPerUnit": 0.015,
      "financialRate": 0.02,
      "gasCsc": 0.0356,
      "gasPcsReference": 0.03852,
      "referenceIndex": 0.54,
      "maxAnnualConsumption": 50000
    },
    "fixedPrice": 0.664
  },
  {
    "code": "026846GNFML46XX289SICUROXGXFIXX3",
    "supplier": "MET",
    "commodity": "gas",
    "offerEasy": "MET SICURO GAS FIX",
    "customerType": "BUS",
    "pcv": 15,
    "spread": 0,
    "pricingType": "fixed",
    "active": true,
    "met": {
      "sourceFile": "CTE SICURO Gas FIX 24.09.2026.pdf",
      "conditionDate": "2026-09-24",
      "fixedMonths": 12,
      "priceBasis": "net",
      "commercialPerUnit": 0.02,
      "monthlyServiceFee": 0,
      "commissionFixed": 30,
      "commissionPerUnit": 0,
      "financialRate": 0.02,
      "gasCsc": 0.0356,
      "gasPcsReference": 0.03852,
      "referenceIndex": 0.68,
      "maxAnnualConsumption": 50000
    },
    "fixedPrice": 0.823
  }
];
