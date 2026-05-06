import { Pricing } from "./types";

export const DEFAULT_PRICING: Pricing = {
  "Polo Shirt": { "S": 450, "M": 500, "L": 550 },
  "Trousers": { "28": 800, "30": 850, "32": 900 },
  "Skirt": { "24": 600, "26": 650, "28": 700 },
  "Blazer": { "32": 1500, "34": 1650, "36": 1800 }
};

export const STORAGE_KEYS = {
  PRICING: 'uniform_pricing',
  SALES: 'uniform_sales',
  FORM_CONFIG: 'uniform_form_config'
};

export const CLASSES = [
  'Nursery', 'LKG', 'UKG', 
  '1st', '2nd', '3rd', '4th', '5th', 
  '6th', '7th', '8th', '9th', '10th', 
  '11th', '12th'
];
