import { Pricing } from "./types";

export const DEFAULT_PRICING: Pricing = {
  "Polo Shirt": { 
    "S": { price: 450, stock: 50, minStock: 10 }, 
    "M": { price: 500, stock: 45, minStock: 10 }, 
    "L": { price: 550, stock: 35, minStock: 10 } 
  },
  "Trousers": { 
    "28": { price: 800, stock: 30, minStock: 5 }, 
    "30": { price: 850, stock: 25, minStock: 5 }, 
    "32": { price: 900, stock: 20, minStock: 5 } 
  },
  "Skirt": { 
    "24": { price: 600, stock: 15, minStock: 5 }, 
    "26": { price: 650, stock: 12, minStock: 5 }, 
    "28": { price: 700, stock: 10, minStock: 5 } 
  },
  "Blazer": { 
    "32": { price: 1500, stock: 8, minStock: 2 }, 
    "34": { price: 1650, stock: 5, minStock: 2 }, 
    "36": { price: 1800, stock: 3, minStock: 2 } 
  }
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
