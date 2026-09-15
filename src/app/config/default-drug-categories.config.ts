export interface DrugCategorySeedNode {
  name: string;
  children?: DrugCategorySeedNode[];
}

export const DEFAULT_DRUG_ROOT_NAME = 'DRUG';

/** Default consumable item category tree synced on new/partial installations. */
export const DEFAULT_DRUG_CATEGORY_TREE: DrugCategorySeedNode = {
  name: DEFAULT_DRUG_ROOT_NAME,
  children: [
    {
      name: 'Anti-infective Agents',
      children: [
        {
          name: 'Antibiotics',
          children: [
            {
              name: 'Beta-Lactams',
              children: [
                {
                  name: 'Penicillins',
                  children: [
                    {
                      name: 'Natural Penicillins',
                      children: [{ name: 'Penicillin G' }]
                    },
                    {
                      name: 'Aminopenicillins',
                      children: [{ name: 'Amoxicillin' }, { name: 'Ampicillin' }]
                    },
                    {
                      name: 'Anti-staphylococcal Penicillins',
                      children: [{ name: 'Cloxacillin' }]
                    }
                  ]
                },
                {
                  name: 'Cephalosporins',
                  children: [
                    { name: '1st Generation' },
                    { name: '2nd Generation' },
                    { name: '3rd Generation' },
                    { name: '4th Generation' }
                  ]
                },
                { name: 'Carbapenems' },
                { name: 'Monobactams' }
              ]
            },
            {
              name: 'Macrolides',
              children: [{ name: 'Azithromycin' }, { name: 'Erythromycin' }]
            },
            {
              name: 'Tetracyclines',
              children: [{ name: 'Doxycycline' }]
            },
            {
              name: 'Aminoglycosides',
              children: [{ name: 'Gentamicin' }]
            },
            {
              name: 'Fluoroquinolones',
              children: [{ name: 'Ciprofloxacin' }, { name: 'Levofloxacin' }]
            },
            {
              name: 'Sulfonamides',
              children: [{ name: 'Cotrimoxazole' }]
            }
          ]
        },
        {
          name: 'Antifungals',
          children: [{ name: 'Azoles' }, { name: 'Polyenes' }, { name: 'Echinocandins' }]
        },
        {
          name: 'Antivirals',
          children: [{ name: 'Anti-HIV' }, { name: 'Anti-Herpes' }, { name: 'Anti-Hepatitis' }]
        },
        {
          name: 'Antiparasitics',
          children: [
            { name: 'Antimalarials' },
            { name: 'Antihelminthics' },
            { name: 'Antiprotozoals' }
          ]
        }
      ]
    },
    {
      name: 'Cardiovascular Drugs',
      children: [
        {
          name: 'Antihypertensives',
          children: [
            { name: 'ACE Inhibitors' },
            { name: 'ARBs' },
            { name: 'Beta Blockers' },
            { name: 'Calcium Channel Blockers' },
            { name: 'Diuretics' }
          ]
        },
        { name: 'Antianginals' },
        { name: 'Antiarrhythmics' },
        { name: 'Anticoagulants' },
        { name: 'Antiplatelets' },
        {
          name: 'Lipid-Lowering Agents',
          children: [{ name: 'Statins' }]
        }
      ]
    },
    {
      name: 'Endocrine Drugs',
      children: [
        {
          name: 'Antidiabetic Agents',
          children: [
            { name: 'Biguanides' },
            { name: 'Sulfonylureas' },
            { name: 'DPP-4 Inhibitors' },
            { name: 'SGLT2 Inhibitors' },
            { name: 'Insulins' }
          ]
        },
        { name: 'Thyroid Drugs' },
        { name: 'Corticosteroids' },
        { name: 'Hormonal Agents' }
      ]
    },
    {
      name: 'Central Nervous System Drugs',
      children: [
        {
          name: 'Analgesics',
          children: [
            {
              name: 'Non-Opioid Analgesics',
              children: [{ name: 'Paracetamol' }, { name: 'NSAIDs' }]
            },
            {
              name: 'Opioid Analgesics',
              children: [{ name: 'Tramadol' }, { name: 'Morphine' }]
            }
          ]
        },
        { name: 'Antiepileptics' },
        { name: 'Antidepressants' },
        { name: 'Antipsychotics' },
        { name: 'Anxiolytics' },
        { name: 'Sedatives/Hypnotics' }
      ]
    },
    {
      name: 'Respiratory Drugs',
      children: [
        { name: 'Bronchodilators' },
        { name: 'Corticosteroids' },
        { name: 'Antihistamines' },
        { name: 'Cough Suppressants' },
        { name: 'Expectorants' }
      ]
    },
    {
      name: 'Gastrointestinal Drugs',
      children: [
        { name: 'Antacids' },
        { name: 'Proton Pump Inhibitors' },
        { name: 'H2-Receptor Antagonists' },
        { name: 'Antiemetics' },
        { name: 'Laxatives' },
        { name: 'Antidiarrheals' }
      ]
    },
    {
      name: 'Musculoskeletal Drugs',
      children: [
        { name: 'NSAIDs' },
        { name: 'Muscle Relaxants' },
        { name: 'Anti-gout Drugs' },
        { name: 'Osteoporosis Drugs' }
      ]
    },
    {
      name: 'Dermatological Drugs',
      children: [
        { name: 'Topical Antibiotics' },
        { name: 'Topical Antifungals' },
        { name: 'Corticosteroids' },
        { name: 'Acne Treatments' }
      ]
    },
    {
      name: 'Ophthalmic Drugs',
      children: [
        { name: 'Antiglaucoma Agents' },
        { name: 'Antibiotic Eye Preparations' },
        { name: 'Anti-inflammatory Eye Preparations' }
      ]
    },
    {
      name: 'Obstetric & Gynecological Drugs',
      children: [
        { name: 'Contraceptives' },
        { name: 'Oxytocics' },
        { name: 'Tocolytics' },
        { name: 'Fertility Agents' }
      ]
    },
    {
      name: 'Oncology Drugs',
      children: [
        { name: 'Cytotoxic Agents' },
        { name: 'Hormonal Therapy' },
        { name: 'Targeted Therapy' },
        { name: 'Immunotherapy' }
      ]
    },
    {
      name: 'Immunological Agents',
      children: [
        { name: 'Vaccines' },
        { name: 'Immunosuppressants' },
        { name: 'Immunostimulants' }
      ]
    },
    {
      name: 'Vitamins & Minerals',
      children: [
        {
          name: 'Vitamins',
          children: [
            { name: 'Vitamin A' },
            { name: 'Vitamin B Complex' },
            { name: 'Vitamin C' },
            { name: 'Vitamin D' },
            { name: 'Vitamin E' }
          ]
        },
        {
          name: 'Minerals',
          children: [
            { name: 'Iron' },
            { name: 'Calcium' },
            { name: 'Zinc' },
            { name: 'Magnesium' }
          ]
        }
      ]
    }
  ]
};
