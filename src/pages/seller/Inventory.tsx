import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  addInventoryItem,
  getInventory,
  loadInventoryFromBackend,
  subscribeInventory,
  type SellerInventoryItem,
} from "@/lib/sellerInventory";
import { getSellerSession } from "@/utils/sessionManager";

type Category = "Food" | "Snacks" | "Drinks";
type InvType = "Active" | "Inactive";

/**
 * Rich icon library per category with searchable keyword tags.
 * Keywords are matched against the food name to surface relevant icons only.
 */
type IconEntry = { icon: string; keywords: string[] };

/** Tabbed icon picker dataset — emoji + readable label, grouped by cuisine/category. */
type IconTabKey = "all" | "south" | "north" | "snacks" | "drinks" | "fastfood" | "desserts";
type LabeledIcon = {
  emoji: string;
  label: string;
  tab: Exclude<IconTabKey, "all">;
  keywords?: string[];
};

const ICON_TABS: { key: IconTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "south", label: "South Indian" },
  { key: "north", label: "North Indian" },
  { key: "snacks", label: "Snacks" },
  { key: "drinks", label: "Drinks" },
  { key: "fastfood", label: "Fast Food" },
  { key: "desserts", label: "Desserts" },
];

const LABELED_ICONS: LabeledIcon[] = [
  // South Indian
  { emoji: "🫓", label: "Idli", tab: "south" },
  { emoji: "🥞", label: "Dosa", tab: "south" },
  { emoji: "🫔", label: "Uttapam", tab: "south" },
  { emoji: "🍛", label: "Sambar", tab: "south" },
  { emoji: "🥣", label: "Rasam", tab: "south" },
  { emoji: "🍚", label: "Rice", tab: "south" },
  { emoji: "🥘", label: "Curd Rice", tab: "south" },
  { emoji: "🫕", label: "Kootu", tab: "south" },
  { emoji: "🍲", label: "Avial", tab: "south" },
  { emoji: "🍱", label: "Meals", tab: "south" },
  { emoji: "🥟", label: "Vada", tab: "south" },
  { emoji: "🍩", label: "Medu Vada", tab: "south" },
  { emoji: "🧆", label: "Bonda", tab: "south" },
  { emoji: "🌯", label: "Parotta", tab: "south" },
  { emoji: "🫙", label: "Chutney", tab: "south" },
  { emoji: "🍵", label: "Filter Kaapi", tab: "south" },
  { emoji: "☕", label: "Kaapi", tab: "south" },
  { emoji: "🍜", label: "Sevai", tab: "south" },
  { emoji: "🍢", label: "Pongal", tab: "south" },
  { emoji: "🫘", label: "Sundal", tab: "south" },
  // North Indian
  { emoji: "🫓", label: "Roti", tab: "north" },
  { emoji: "🫙", label: "Dal", tab: "north" },
  { emoji: "🧈", label: "Butter", tab: "north" },
  { emoji: "🍛", label: "Curry", tab: "north" },
  { emoji: "🍖", label: "Chicken", tab: "north" },
  { emoji: "🥙", label: "Wrap", tab: "north" },
  { emoji: "🫔", label: "Paratha", tab: "north" },
  { emoji: "🍢", label: "Paneer", tab: "north" },
  { emoji: "🍲", label: "Rajma", tab: "north" },
  { emoji: "🥘", label: "Chole", tab: "north" },
  { emoji: "🌮", label: "Tacos/Roti", tab: "north" },
  { emoji: "🍱", label: "Thali", tab: "north" },
  { emoji: "🍗", label: "Tandoori", tab: "north" },
  { emoji: "🥩", label: "Kebab", tab: "north" },
  { emoji: "🍚", label: "Biryani", tab: "north" },
  { emoji: "🫕", label: "Korma", tab: "north" },
  { emoji: "🧅", label: "Lassi", tab: "north" },
  { emoji: "🥛", label: "Milk", tab: "north" },
  { emoji: "🍵", label: "Chai", tab: "north" },
  { emoji: "🥗", label: "Salad", tab: "north" },
  // Snacks
  { emoji: "🌊", label: "Pani Puri", tab: "snacks" },
  { emoji: "🥙", label: "Pav Bhaji", tab: "snacks" },
  { emoji: "🌯", label: "Bhel Puri", tab: "snacks" },
  { emoji: "🧆", label: "Pakora", tab: "snacks" },
  { emoji: "🍟", label: "Fries", tab: "snacks" },
  { emoji: "🥨", label: "Breadstick", tab: "snacks" },
  { emoji: "🍪", label: "Biscuit", tab: "snacks" },
  { emoji: "🥜", label: "Peanuts", tab: "snacks" },
  { emoji: "🫘", label: "Chana", tab: "snacks" },
  { emoji: "🌽", label: "Corn", tab: "snacks" },
  { emoji: "🥪", label: "Sandwich", tab: "snacks" },
  { emoji: "🍕", label: "Pizza", tab: "snacks" },
  { emoji: "🌭", label: "Hot Dog", tab: "snacks" },
  { emoji: "🧀", label: "Cheese", tab: "snacks" },
  { emoji: "🥚", label: "Egg", tab: "snacks" },
  { emoji: "🍳", label: "Omelette", tab: "snacks" },
  { emoji: "🥐", label: "Croissant", tab: "snacks" },
  { emoji: "🥯", label: "Bagel", tab: "snacks" },
  { emoji: "🫓", label: "Bread", tab: "snacks" },
  { emoji: "🧇", label: "Waffle", tab: "snacks" },
  // Drinks
  { emoji: "🥤", label: "Cold Drink", tab: "drinks" },
  { emoji: "🧃", label: "Juice", tab: "drinks" },
  { emoji: "☕", label: "Coffee", tab: "drinks" },
  { emoji: "🍵", label: "Tea", tab: "drinks" },
  { emoji: "🥛", label: "Milk", tab: "drinks" },
  { emoji: "🍹", label: "Mocktail", tab: "drinks" },
  { emoji: "🧋", label: "Bubble Tea", tab: "drinks" },
  { emoji: "🍶", label: "Lassi", tab: "drinks" },
  { emoji: "🥂", label: "Sherbet", tab: "drinks" },
  { emoji: "🍺", label: "Soda", tab: "drinks" },
  { emoji: "🌊", label: "Water", tab: "drinks" },
  { emoji: "🫖", label: "Herbal Tea", tab: "drinks" },
  // Fast Food
  { emoji: "🍔", label: "Burger", tab: "fastfood" },
  { emoji: "🍕", label: "Pizza", tab: "fastfood" },
  { emoji: "🌮", label: "Tacos", tab: "fastfood" },
  { emoji: "🌯", label: "Wrap", tab: "fastfood" },
  { emoji: "🍟", label: "Fries", tab: "fastfood" },
  { emoji: "🍗", label: "Fried Chicken", tab: "fastfood" },
  { emoji: "🍖", label: "Ribs", tab: "fastfood" },
  { emoji: "🥙", label: "Shawarma", tab: "fastfood" },
  { emoji: "🌭", label: "Hot Dog", tab: "fastfood" },
  { emoji: "🥪", label: "Sub", tab: "fastfood" },
  { emoji: "🍜", label: "Noodles", tab: "fastfood" },
  { emoji: "🍱", label: "Bento", tab: "fastfood" },
  { emoji: "🍛", label: "Rice Bowl", tab: "fastfood" },
  { emoji: "🍤", label: "Shrimp", tab: "fastfood" },
  { emoji: "🥚", label: "Egg", tab: "fastfood" },
  // Desserts
  { emoji: "🍮", label: "Halwa", tab: "desserts" },
  { emoji: "🍯", label: "Honey", tab: "desserts" },
  { emoji: "🍰", label: "Cake", tab: "desserts" },
  { emoji: "🧁", label: "Cupcake", tab: "desserts" },
  { emoji: "🍩", label: "Donut", tab: "desserts" },
  { emoji: "🍪", label: "Cookie", tab: "desserts" },
  { emoji: "🍫", label: "Chocolate", tab: "desserts" },
  { emoji: "🍦", label: "Ice Cream", tab: "desserts" },
  { emoji: "🍧", label: "Kulfi", tab: "desserts" },
  { emoji: "🍨", label: "Ice Cream", tab: "desserts" },
  { emoji: "🎂", label: "Birthday", tab: "desserts" },
  { emoji: "🍬", label: "Candy", tab: "desserts" },
  { emoji: "🍭", label: "Lollipop", tab: "desserts" },
  { emoji: "🍮", label: "Pudding", tab: "desserts" },
  { emoji: "🥧", label: "Pie", tab: "desserts" },
];

/**
 * Keyword index for the smart suggestion feature.
 * Key format: `${emoji}|${label}` to match a unique LabeledIcon entry.
 * Words are lowercase. Only the icons listed in the spec need rich keywords;
 * for the rest we fall back to splitting the label.
 */
const ICON_KEYWORDS: Record<string, string[]> = {
  // South Indian
  "🫓|Idli": ["idli", "idly", "steamed", "soft"],
  "🥞|Dosa": ["dosa", "crispy", "crepe", "plain dosa", "masala dosa", "rava dosa", "set dosa"],
  "🫔|Uttapam": ["uttapam", "uthappam", "thick dosa", "onion uttapam"],
  "🍛|Sambar": ["sambar", "sambhar", "dal", "lentil", "curry", "vegetable curry"],
  "🥣|Rasam": ["rasam", "pepper water", "tomato rasam", "tamarind"],
  "🍚|Rice": ["rice", "steamed rice", "white rice", "boiled rice"],
  "🥘|Curd Rice": ["curd rice", "thayir sadam", "yogurt rice", "curd", "thayir"],
  "🍲|Avial": ["avial", "aviyal", "mixed veg", "coconut curry"],
  "🍱|Meals": ["meals", "thali", "full meals", "lunch", "dinner", "plate"],
  "🥟|Vada": ["vada", "vadai", "wada", "fritter"],
  "🍩|Medu Vada": ["medu vada", "medu", "medhu", "medu vadai", "donut vada"],
  "🧆|Bonda": ["bonda", "aloo bonda", "potato bonda", "bajji", "pakora"],
  "🌯|Parotta": ["parotta", "parota", "porotta", "layered", "kothu parotta", "kothu"],
  "🫙|Chutney": ["chutney", "coconut chutney", "tomato chutney", "green chutney", "dip"],
  "🍵|Filter Kaapi": ["filter kaapi", "filter coffee", "south coffee", "decoction", "kaapi"],
  "🍜|Sevai": ["sevai", "idiyappam", "string hoppers", "lemon sevai"],
  "🍢|Pongal": ["pongal", "ven pongal", "sweet pongal", "khichdi", "rice dish"],
  "🫘|Sundal": ["sundal", "chana sundal", "boiled legumes", "chickpea"],
  // North Indian
  "🫓|Roti": ["roti", "chapati", "chapatti", "phulka", "wheat bread", "flatbread"],
  "🫔|Paratha": ["paratha", "aloo paratha", "gobi paratha", "stuffed paratha"],
  "🫙|Dal": ["dal", "daal", "lentil", "dal makhani", "dal tadka", "dal fry"],
  "🍢|Paneer": ["paneer", "cottage cheese", "paneer butter masala", "shahi paneer", "palak paneer", "paneer tikka"],
  "🍲|Rajma": ["rajma", "kidney beans", "rajma chawal"],
  "🥘|Chole": ["chole", "chana", "chickpea", "pindi chole", "chole bhature"],
  "🍗|Tandoori": ["tandoori", "tandoor", "grilled", "clay oven", "tandoori roti", "tandoori chicken"],
  "🥩|Kebab": ["kebab", "seekh kebab", "shami kebab", "grilled meat", "mutton kebab"],
  "🍚|Biryani": ["biryani", "biriyani", "dum biryani", "chicken biryani", "mutton biryani", "veg biryani"],
  "🥙|Wrap": ["wrap", "roll", "frankie", "kathi roll", "egg roll", "chicken roll"],
  "🍵|Chai": ["chai", "tea", "masala chai", "ginger tea", "cutting chai", "milk tea"],
  // Snacks
  "🌊|Pani Puri": ["pani puri", "panipuri", "golgappa", "puchka", "water puri", "street food"],
  "🥙|Pav Bhaji": ["pav bhaji", "pav", "bhaji", "mumbai street"],
  "🌯|Bhel Puri": ["bhel puri", "bhelpuri", "bhel", "puffed rice"],
  "🧆|Pakora": ["pakora", "pakoda", "fritter", "onion pakora", "chilli pakora", "bajji"],
  "🍟|Fries": ["fries", "french fries", "potato fries", "chips", "masala fries"],
  "🥟|Momos": ["momos", "momo", "dumpling", "steamed momos", "fried momos", "dim sum"],
  "🥪|Sandwich": ["sandwich", "club sandwich", "grilled sandwich", "veg sandwich", "cheese sandwich"],
  "🍕|Pizza": ["pizza", "cheese pizza", "veg pizza", "slice"],
  "🌽|Corn": ["corn", "sweet corn", "maize", "masala corn", "butter corn"],
  "🍳|Omelette": ["omelette", "omelet", "anda omelette", "masala omelette"],
  "🥚|Egg": ["egg", "boiled egg", "egg snack", "anda"],
  // Drinks
  "🥤|Cold Drink": ["cold drink", "soda", "fizzy", "cola", "pepsi", "coke", "soft drink"],
  "🧃|Juice": ["juice", "fresh juice", "orange juice", "fruit juice", "mango juice"],
  "☕|Coffee": ["coffee", "espresso", "latte", "cappuccino", "cold coffee", "iced coffee"],
  "🍵|Tea": ["tea", "hot tea", "green tea", "black tea", "ginger tea", "chai"],
  "🥛|Milk": ["milk", "hot milk", "cold milk", "flavoured milk", "badam milk"],
  "🍹|Mocktail": ["mocktail", "fruit punch", "virgin mojito", "tropical"],
  "🧋|Bubble Tea": ["bubble tea", "boba", "tapioca", "milk tea"],
  "🍶|Lassi": ["lassi", "sweet lassi", "salt lassi", "mango lassi", "buttermilk", "chaas"],
  // Fast Food
  "🍔|Burger": ["burger", "veg burger", "cheese burger", "chicken burger", "patty"],
  "🌮|Tacos": ["tacos", "taco", "mexican"],
  "🍗|Fried Chicken": ["fried chicken", "kfc", "crispy chicken", "chicken wings", "wings"],
  "🍜|Noodles": ["noodles", "hakka noodles", "chowmein", "schezwan", "ramen", "maggi"],
  // Desserts
  "🍮|Halwa": ["halwa", "gajar halwa", "moong halwa", "sooji halwa", "kesari"],
  "🍰|Cake": ["cake", "pastry", "chocolate cake", "vanilla cake", "birthday cake"],
  "🧁|Cupcake": ["cupcake", "muffin", "mini cake"],
  "🍩|Donut": ["donut", "doughnut", "glazed donut"],
  "🍪|Cookie": ["cookie", "biscuit", "choco chip"],
  "🍫|Chocolate": ["chocolate", "choco", "cocoa", "dark chocolate"],
  "🍦|Ice Cream": ["ice cream", "softy", "vanilla ice cream", "chocolate ice cream"],
  "🍧|Kulfi": ["kulfi", "malai kulfi", "pista kulfi", "indian ice cream"],
};

/** Score a single icon against the typed query and return total points (0 = no match). */
function scoreIconForQuery(icon: LabeledIcon, query: string): number {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return 0;
  const key = `${icon.emoji}|${icon.label}`;
  const keywords = ICON_KEYWORDS[key] ?? [icon.label.toLowerCase()];
  const labelLower = icon.label.toLowerCase();
  const queryWords = q.split(/\s+/).filter((w) => w.length > 0);
  let score = 0;
  for (const kwRaw of keywords) {
    const kw = kwRaw.toLowerCase();
    if (kw === q) score += 100;
    else if (kw.startsWith(q)) score += 60;
    else if (kw.includes(q)) score += 40;
    else if (q.length > 3 && q.includes(kw)) score += 30;
    for (const w of queryWords) {
      if (w.length > 2 && kw.includes(w)) score += 20;
    }
  }
  if (labelLower.includes(q)) score += 50;
  return score;
}

const ICON_LIBRARY: Record<Category, IconEntry[]> = {
  Food: [
    { icon: "🍛", keywords: ["curry", "rice", "biryani", "dal", "sambar", "rajma", "chole", "korma", "masala", "gravy", "indian", "thali", "meals"] },
    { icon: "🍚", keywords: ["rice", "biryani", "pulao", "jeera", "steamed", "plain", "curd rice", "lemon rice"] },
    { icon: "🍲", keywords: ["curry", "stew", "soup", "dal", "sambar", "rasam", "kadhi", "hot pot", "gravy"] },
    { icon: "🥘", keywords: ["paella", "biryani", "pulao", "handi", "kadai", "korma", "masala", "gravy", "curry"] },
    { icon: "🍱", keywords: ["meal", "thali", "lunch box", "bento", "combo", "platter"] },
    { icon: "🫓", keywords: ["roti", "chapati", "naan", "kulcha", "paratha", "thepla", "bhakri", "phulka", "tandoori roti", "rumali"] },
    { icon: "🥖", keywords: ["bread", "baguette", "loaf", "pav", "bun"] },
    { icon: "🍞", keywords: ["bread", "toast", "loaf", "sandwich bread", "milk bread"] },
    { icon: "🥞", keywords: ["pancake", "cheela", "pesarattu", "appam", "uttapam", "dosa thin"] },
    { icon: "🧇", keywords: ["waffle", "crispy", "breakfast"] },
    { icon: "🍳", keywords: ["egg", "omelette", "bhurji", "fried egg", "anda", "boiled egg", "poached"] },
    { icon: "🥚", keywords: ["egg", "boiled", "anda", "half boil"] },
    { icon: "🍗", keywords: ["chicken", "tandoori", "drumstick", "leg piece", "fried chicken", "kfc", "wings", "non veg", "nonveg"] },
    { icon: "🍖", keywords: ["meat", "mutton", "lamb", "kebab", "bbq", "barbecue", "grill", "ribs", "non veg"] },
    { icon: "🥩", keywords: ["steak", "meat", "beef", "mutton", "lamb chop", "tikka"] },
    { icon: "🥓", keywords: ["bacon", "pork", "ham"] },
    { icon: "🌭", keywords: ["hot dog", "sausage", "frankfurter"] },
    { icon: "🍔", keywords: ["burger", "veg burger", "cheese burger", "aloo tikki burger", "patty"] },
    { icon: "🍟", keywords: ["fries", "french fries", "finger chips", "potato fries", "wedges"] },
    { icon: "🍕", keywords: ["pizza", "margherita", "pepperoni", "cheese pizza", "tandoori pizza"] },
    { icon: "🌮", keywords: ["taco", "mexican", "wrap"] },
    { icon: "🌯", keywords: ["wrap", "burrito", "kathi roll", "frankie", "shawarma", "roll"] },
    { icon: "🥙", keywords: ["pita", "shawarma", "stuffed", "kebab roll", "pocket"] },
    { icon: "🧆", keywords: ["falafel", "kofta", "vada", "bonda", "manchurian", "ball"] },
    { icon: "🥗", keywords: ["salad", "veg", "healthy", "raita", "kachumber", "sprouts"] },
    { icon: "🥪", keywords: ["sandwich", "club sandwich", "grilled sandwich", "bombay sandwich", "veg sandwich"] },
    { icon: "🍝", keywords: ["pasta", "spaghetti", "noodles", "macaroni", "alfredo", "penne"] },
    { icon: "🍜", keywords: ["noodles", "ramen", "hakka", "chowmein", "schezwan", "soup noodles", "maggi"] },
    { icon: "🍣", keywords: ["sushi", "japanese", "salmon", "raw fish"] },
    { icon: "🍤", keywords: ["prawn", "shrimp", "tempura", "fried prawn", "seafood"] },
    { icon: "🦐", keywords: ["prawn", "shrimp", "seafood"] },
    { icon: "🦞", keywords: ["lobster", "seafood"] },
    { icon: "🦀", keywords: ["crab", "seafood"] },
    { icon: "🐟", keywords: ["fish", "fish curry", "fish fry", "meen", "seafood", "pomfret", "rohu"] },
    { icon: "🍢", keywords: ["skewer", "kebab", "seekh", "satay", "tandoori"] },
    { icon: "🥟", keywords: ["dumpling", "momo", "gyoza", "potsticker", "wonton"] },
    { icon: "🫔", keywords: ["tamale", "wrap", "stuffed"] },
    { icon: "🫕", keywords: ["fondue", "cheese", "melted"] },
    { icon: "🧀", keywords: ["cheese", "paneer", "cheddar", "mozzarella"] },
    { icon: "🧈", keywords: ["butter", "ghee", "makhan"] },
    { icon: "🥣", keywords: ["bowl", "soup", "porridge", "oats", "dalia", "kheer", "payasam"] },
    { icon: "🍿", keywords: ["popcorn"] },
    { icon: "🥧", keywords: ["pie", "quiche"] },
    { icon: "🥯", keywords: ["bagel", "donut bread"] },
    { icon: "🥨", keywords: ["pretzel", "twist"] },
    { icon: "🫘", keywords: ["beans", "rajma", "chole", "lobia", "kidney beans", "chickpea"] },
    { icon: "🌽", keywords: ["corn", "bhutta", "makka", "sweet corn"] },
    { icon: "🍠", keywords: ["sweet potato", "shakarkandi"] },
    { icon: "🥔", keywords: ["potato", "aloo", "bhaji"] },
    { icon: "🥕", keywords: ["carrot", "gajar"] },
    { icon: "🍅", keywords: ["tomato", "tamatar"] },
    { icon: "🥦", keywords: ["broccoli", "veg"] },
    { icon: "🌶️", keywords: ["chilli", "spicy", "mirchi", "hot", "andhra", "schezwan"] },
    { icon: "🥬", keywords: ["leafy", "palak", "spinach", "saag", "methi", "greens"] },
    { icon: "🍄", keywords: ["mushroom", "khumb"] },
    { icon: "🥥", keywords: ["coconut", "nariyal"] },
  ],
  Snacks: [
    { icon: "🍟", keywords: ["fries", "french fries", "finger chips", "wedges"] },
    { icon: "🍿", keywords: ["popcorn", "caramel popcorn", "butter popcorn"] },
    { icon: "🥨", keywords: ["pretzel"] },
    { icon: "🥯", keywords: ["bagel"] },
    { icon: "🥖", keywords: ["bread", "baguette", "pav"] },
    { icon: "🫓", keywords: ["roti", "khakra", "papad", "thepla", "chapati"] },
    { icon: "🥟", keywords: ["momo", "dumpling", "samosa", "kachori", "gujiya"] },
    { icon: "🧆", keywords: ["vada", "bonda", "pakora", "bajji", "fritter", "falafel", "kofta", "manchurian", "medu vada"] },
    { icon: "🥪", keywords: ["sandwich", "grilled sandwich", "bombay sandwich"] },
    { icon: "🌯", keywords: ["roll", "frankie", "kathi roll", "wrap", "shawarma"] },
    { icon: "🥙", keywords: ["shawarma", "kebab roll", "stuffed pita"] },
    { icon: "🌮", keywords: ["taco", "tacos"] },
    { icon: "🍕", keywords: ["pizza", "mini pizza", "pizza slice"] },
    { icon: "🍔", keywords: ["burger", "slider", "mini burger"] },
    { icon: "🌭", keywords: ["hot dog", "sausage"] },
    { icon: "🥚", keywords: ["egg", "boiled egg", "anda"] },
    { icon: "🍳", keywords: ["omelette", "bhurji", "egg"] },
    { icon: "🍢", keywords: ["seekh", "skewer", "kebab", "tandoori"] },
    { icon: "🍡", keywords: ["dango", "skewer", "sweet"] },
    { icon: "🍘", keywords: ["rice cracker", "chivda", "namkeen"] },
    { icon: "🍪", keywords: ["cookie", "biscuit", "khari"] },
    { icon: "🥜", keywords: ["peanut", "moongphali", "nuts", "chana", "groundnut", "masala peanut", "chikki"] },
    { icon: "🌰", keywords: ["chestnut", "nut", "almond", "cashew", "kaju", "badam"] },
    { icon: "🫘", keywords: ["chana", "chickpea", "sundal", "boiled chana", "sprouts"] },
    { icon: "🌽", keywords: ["corn", "bhutta", "makka", "sweet corn", "cheese corn"] },
    { icon: "🍠", keywords: ["sweet potato", "shakarkandi chaat"] },
    { icon: "🥔", keywords: ["potato", "aloo tikki", "aloo chaat", "potato chips", "wafer"] },
    { icon: "🍅", keywords: ["tomato", "salsa"] },
    { icon: "🌶️", keywords: ["chilli", "mirchi bajji", "spicy", "hot", "schezwan"] },
    { icon: "🥒", keywords: ["cucumber", "kakdi", "salad"] },
    { icon: "🥕", keywords: ["carrot stick"] },
    { icon: "🧀", keywords: ["cheese", "paneer", "cheese balls", "cheese stick"] },
    { icon: "🫓", keywords: ["khakra", "papad", "puri", "papdi", "matri"] },
    { icon: "🥧", keywords: ["pie", "puff", "patties"] },
    { icon: "🍤", keywords: ["prawn", "tempura", "fried"] },
    { icon: "🥗", keywords: ["salad", "sprouts", "kachumber", "fruit salad"] },
    { icon: "🍫", keywords: ["chocolate", "bar"] },
    { icon: "🧇", keywords: ["waffle"] },
    { icon: "🥞", keywords: ["pancake", "cheela", "uttapam"] },
    { icon: "🍩", keywords: ["donut", "doughnut", "medu vada"] },
    { icon: "🍦", keywords: ["softy", "ice cream snack"] },
    { icon: "🥥", keywords: ["coconut", "nariyal pani"] },
    { icon: "🍌", keywords: ["banana chips", "kela wafer"] },
    { icon: "🍎", keywords: ["apple", "fruit"] },
    { icon: "🍇", keywords: ["grapes", "fruit"] },
    { icon: "🍓", keywords: ["strawberry", "berry"] },
    { icon: "🍉", keywords: ["watermelon", "fruit"] },
    { icon: "🍊", keywords: ["orange", "fruit"] },
    { icon: "🥭", keywords: ["mango", "aam", "fruit"] },
    { icon: "🍍", keywords: ["pineapple", "ananas", "fruit"] },
    { icon: "🥝", keywords: ["kiwi", "fruit"] },
    { icon: "🍒", keywords: ["cherry", "fruit"] },
    { icon: "🍰", keywords: ["cake slice", "pastry", "tea cake"] },
    { icon: "🧁", keywords: ["cupcake", "muffin"] },
    { icon: "🍮", keywords: ["pudding", "caramel", "custard"] },
    { icon: "🍬", keywords: ["candy", "toffee", "eclairs"] },
    { icon: "🍭", keywords: ["lollipop", "candy stick"] },
    { icon: "🍯", keywords: ["honey", "shahad"] },
  ],
  Drinks: [
    { icon: "☕", keywords: ["coffee", "filter coffee", "cappuccino", "espresso", "latte", "americano", "hot coffee", "mocha"] },
    { icon: "🍵", keywords: ["tea", "chai", "green tea", "matcha", "masala chai", "herbal", "ginger tea", "lemon tea"] },
    { icon: "🥤", keywords: ["soft drink", "cola", "pepsi", "coke", "sprite", "fanta", "soda", "cold drink", "milkshake", "shake"] },
    { icon: "🧋", keywords: ["bubble tea", "boba", "tapioca pearls", "milk tea"] },
    { icon: "🧃", keywords: ["juice box", "tetra pack", "frooti", "maaza", "appy", "real", "tropicana"] },
    { icon: "🍹", keywords: ["cocktail", "mocktail", "tropical", "punch", "fruit drink"] },
    { icon: "🍸", keywords: ["martini", "cocktail"] },
    { icon: "🍷", keywords: ["wine", "red wine", "white wine"] },
    { icon: "🥂", keywords: ["champagne", "celebration", "sparkling"] },
    { icon: "🍾", keywords: ["champagne bottle", "sparkling wine"] },
    { icon: "🍺", keywords: ["beer", "lager", "pint"] },
    { icon: "🍻", keywords: ["beer", "cheers", "mug"] },
    { icon: "🥃", keywords: ["whisky", "rum", "vodka", "scotch", "brandy"] },
    { icon: "🍶", keywords: ["sake", "lassi", "buttermilk", "chaas", "matka"] },
    { icon: "🥛", keywords: ["milk", "doodh", "haldi doodh", "badam milk", "milkshake"] },
    { icon: "🍼", keywords: ["milk bottle", "baby milk"] },
    { icon: "🧉", keywords: ["mate", "herbal drink"] },
    { icon: "🫖", keywords: ["teapot", "tea", "kettle"] },
    { icon: "💧", keywords: ["water", "mineral water", "pani", "still water"] },
    { icon: "🧊", keywords: ["ice", "iced", "cold", "frozen", "iced coffee", "iced tea"] },
    { icon: "🍋", keywords: ["lemon", "lime", "nimbu pani", "shikanji", "lemonade", "lemon soda"] },
    { icon: "🍊", keywords: ["orange juice", "santra", "mosambi"] },
    { icon: "🍎", keywords: ["apple juice"] },
    { icon: "🍇", keywords: ["grape juice"] },
    { icon: "🍓", keywords: ["strawberry shake", "berry smoothie"] },
    { icon: "🍉", keywords: ["watermelon juice"] },
    { icon: "🥭", keywords: ["mango", "aam panna", "mango shake", "mango lassi", "mango juice"] },
    { icon: "🍍", keywords: ["pineapple juice"] },
    { icon: "🥥", keywords: ["coconut water", "nariyal pani", "tender coconut"] },
    { icon: "🍌", keywords: ["banana shake", "kela shake"] },
    { icon: "🫐", keywords: ["blueberry smoothie"] },
    { icon: "🥝", keywords: ["kiwi juice"] },
    { icon: "🍒", keywords: ["cherry drink"] },
    { icon: "🌰", keywords: ["badam milk", "almond milk", "kaju shake"] },
    { icon: "🫗", keywords: ["pour", "drink"] },
    { icon: "🍯", keywords: ["honey drink", "honey lemon"] },
    { icon: "🌶️", keywords: ["spicy drink", "masala soda"] },
    { icon: "🥒", keywords: ["cucumber cooler", "mint cooler"] },
    { icon: "🍪", keywords: ["cookie shake"] },
    { icon: "🍫", keywords: ["chocolate shake", "hot chocolate", "cocoa"] },
    { icon: "🍦", keywords: ["ice cream shake", "thick shake", "cold coffee"] },
    { icon: "🧇", keywords: ["waffle shake"] },
    { icon: "🍰", keywords: ["red velvet shake"] },
    { icon: "🥃", keywords: ["whisky on the rocks"] },
  ],
};

const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
      active
        ? "bg-primary text-primary-foreground shadow-glow"
        : "bg-secondary text-foreground/80 hover:bg-secondary/80"
    }`}
  >
    {children}
  </button>
);

const SellerInventory = () => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Category>("Food");
  const [invType, setInvType] = useState<InvType>("Active");
  const [items, setItems] = useState<SellerInventoryItem[]>(() => getInventory(getSellerSession()?.id));
  const [activeIconTab, setActiveIconTab] = useState<IconTabKey>("all");
  const [selectedIcon, setSelectedIcon] = useState<{ emoji: string; label: string } | null>(null);

  // Keep the recently-added list in sync with localStorage (also across tabs).
  useEffect(() => {
    const sellerId = getSellerSession()?.id;
    const unsub = subscribeInventory(() => setItems(getInventory(sellerId)));
    loadInventoryFromBackend(sellerId).then(setItems).catch((e) => toast.error(e instanceof Error ? e.message : "Could not load inventory"));
    return unsub;
  }, []);

  /**
   * Smart icon list:
   * - When the seller hasn't typed a name, show all icons for the chosen category.
   * - When a name is typed, only show icons whose keywords match any token of the name.
   * - If nothing matches, fall back to all category icons so the picker is never empty.
   */
  // Filter icons by the selected tab. "All" shows the entire library.
  const visibleIcons = useMemo(() => {
    if (activeIconTab === "all") return LABELED_ICONS;
    return LABELED_ICONS.filter((i) => i.tab === activeIconTab);
  }, [activeIconTab]);

  /**
   * Smart suggestions: score every icon against the typed name and return
   * the top 6 matches. Hidden when the query is too short or has 0 matches.
   */
  const suggestions = useMemo(() => {
    const q = name.trim();
    if (q.length < 2) return [];
    // Deduplicate by emoji+label so the same icon doesn't appear twice
    // (e.g. 🍵 appears in multiple tabs).
    const seen = new Set<string>();
    const scored: { icon: LabeledIcon; score: number }[] = [];
    for (const icon of LABELED_ICONS) {
      const key = `${icon.emoji}|${icon.label}`;
      if (seen.has(key)) continue;
      const s = scoreIconForQuery(icon, q);
      if (s > 0) {
        seen.add(key);
        scored.push({ icon, score: s });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 6).map((x) => x.icon);
  }, [name]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const priceNum = Number(price);
    if (!trimmed) {
      toast.error("Please enter a food name");
      return;
    }
    if (!priceNum || priceNum <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (!selectedIcon) {
      toast.error("Please choose an icon");
      return;
    }
    // Prevent duplicate inventory items (case-insensitive name match within this seller).
    const normalized = trimmed.toLowerCase();
    const duplicate = items.find((it) => it.name.trim().toLowerCase() === normalized);
    if (duplicate) {
      toast.error(`"${duplicate.name}" is already in your inventory`);
      return;
    }
    try {
      await addInventoryItem({
        name: trimmed,
        price: priceNum,
        category,
        icon: selectedIcon.emoji,
        iconLabel: selectedIcon.label,
        status: invType,
      });
      toast.success(`${trimmed} added to inventory`);
      setName("");
      setPrice("");
      setSelectedIcon(null);
      setActiveIconTab("all");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save item");
    }
  };

  return (
    <div className="seller-admin-shell">
      <div className="seller-admin-content">
        <header className="flex items-center gap-3">
          <Link
            to="/seller/dashboard"
            aria-label="Back to dashboard"
            className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              arrow_back
            </span>
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight">Add Inventory</h1>
        </header>

        {/* Heading */}
        <section className="mt-7 border-b border-border pb-5">
          <h2 className="text-2xl font-extrabold tracking-[0.08em] text-primary">
            ADD INVENTORY
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add new food items to your menu
          </p>
        </section>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-3xl border border-border bg-gradient-card p-5 shadow-card"
        >
          {/* Food name */}
          <label className="block">
            <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              FOOD NAME
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v.length > 0 ? v.charAt(0).toUpperCase() + v.slice(1) : v);
              }}
              maxLength={80}
              placeholder="Enter food name"
              className="mt-2 w-full rounded-full bg-secondary/70 px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary/60"
            />
          </label>

          {/* Price */}
          <label className="mt-5 block">
            <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              PRICE (₹)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price (₹)"
              className="mt-2 w-full rounded-full bg-secondary/70 px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary/60"
            />
          </label>

          {/* Category */}
          <div className="mt-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              SELECT CATEGORY
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(["Food", "Snacks", "Drinks"] as Category[]).map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          {/* Inventory type */}
          <div className="mt-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              INVENTORY TYPE
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(["Active", "Inactive"] as InvType[]).map((t) => (
                <Chip key={t} active={invType === t} onClick={() => setInvType(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                CHOOSE ICON
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {visibleIcons.length} icons
              </span>
            </div>

            {/* Smart suggestion banner — appears as the seller types the food name */}
            <style>{`
              @keyframes smart-banner-in {
                0% { opacity: 0; transform: translateY(-6px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes smart-chip-pop {
                0% { opacity: 0; transform: scale(0.85); }
                100% { opacity: 1; transform: scale(1); }
              }
              .smart-chip:hover {
                background: rgba(37,99,235,0.18) !important;
                border-color: #2563EB !important;
                transform: scale(1.04);
              }
            `}</style>
            {suggestions.length > 0 && (
              <div
                key={name.trim().toLowerCase()}
                style={{
                  background: "#1A1A2E",
                  border: "1.5px solid #2563EB",
                  borderRadius: 14,
                  padding: "12px 14px",
                  marginTop: 12,
                  marginBottom: 16,
                  animation: "smart-banner-in 250ms ease both",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "#2563EB",
                    letterSpacing: "0.12em",
                    margin: 0,
                  }}
                >
                  ⚡ Suggested Icons for "{name.trim()}"
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {suggestions.map((s, i) => {
                    const isSelected =
                      selectedIcon?.emoji === s.emoji && selectedIcon?.label === s.label;
                    return (
                      <button
                        type="button"
                        key={`sugg-${s.emoji}-${s.label}-${i}`}
                        onClick={() =>
                          setSelectedIcon({ emoji: s.emoji, label: s.label })
                        }
                        className="smart-chip"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          background: isSelected
                            ? "rgba(37,99,235,0.25)"
                            : "#111827",
                          border: `1.5px solid ${isSelected ? "#2563EB" : "#1E3A5F"}`,
                          borderRadius: 10,
                          padding: "8px 12px",
                          boxShadow: isSelected
                            ? "0 0 0 2px rgba(37,99,235,0.3)"
                            : "none",
                          cursor: "pointer",
                          transition:
                            "background 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
                          animation: `smart-chip-pop 300ms cubic-bezier(0.34,1.56,0.64,1) both`,
                          animationDelay: `${i * 45}ms`,
                        }}
                      >
                        <span style={{ fontSize: 22, lineHeight: 1 }}>{s.emoji}</span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#CBD5E1",
                            fontWeight: 600,
                          }}
                        >
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Horizontal scrollable category tabs */}
            <div
              className="mt-3 flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <style>{`.icon-tabs-scroll::-webkit-scrollbar{display:none}`}</style>
              <div className="icon-tabs-scroll flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {ICON_TABS.map((t) => {
                  const active = activeIconTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveIconTab(t.key)}
                      className="whitespace-nowrap rounded-full font-bold uppercase transition"
                      style={{
                        padding: "5px 12px",
                        fontSize: 11,
                        background: active ? "#2563EB" : "#1C1C1E",
                        color: active ? "#FFFFFF" : "#6B7280",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icon grid */}
            <div
              className="mt-3 grid grid-cols-5 overflow-y-auto overflow-x-hidden pr-1"
              style={{ gap: 10, maxHeight: 260 }}
            >
              {visibleIcons.map((it, idx) => {
                const active =
                  selectedIcon?.emoji === it.emoji && selectedIcon?.label === it.label;
                return (
                  <button
                    type="button"
                    key={`${it.tab}-${it.emoji}-${it.label}-${idx}`}
                    onClick={() => setSelectedIcon({ emoji: it.emoji, label: it.label })}
                    aria-label={`Select ${it.label}`}
                    className="group relative flex aspect-square w-full flex-col items-center justify-center rounded-xl transition hover:scale-105"
                    style={{
                      background: active ? "rgba(37,99,235,0.15)" : "#1C1C1E",
                      border: `2px solid ${active ? "#2563EB" : "transparent"}`,
                    }}
                  >
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{it.emoji}</span>
                    <span
                      className="mt-1 truncate px-1 text-center uppercase"
                      style={{ fontSize: 7, color: "#6B7280", letterSpacing: "0.05em", maxWidth: "100%" }}
                    >
                      {it.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected preview */}
            {selectedIcon && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Selected: <span className="text-base align-middle">{selectedIcon.emoji}</span>{" "}
                <span className="font-semibold text-foreground">{selectedIcon.label}</span>
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="mt-7 w-full rounded-full bg-gradient-primary py-3.5 text-base font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 active:scale-[0.99]"
          >
            Save Item
          </button>
        </form>

        {/* Recently added */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-[0.22em] text-muted-foreground">
              RECENTLY ADDED
            </h3>
            <span className="h-[2px] w-10 rounded-full bg-muted" />
          </div>

          <ul className="mt-4 space-y-3">
            {items.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                No items yet. Items you save will appear here.
              </li>
            )}
            {items.slice(0, 2).map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-card p-4 shadow-card"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-2xl">
                  {it.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{it.name}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {it.category} • {it.iconLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-extrabold text-primary">
                    ₹{it.price}
                  </p>
                  <p
                    className={`mt-0.5 text-xs font-semibold ${
                      it.status === "Active"
                        ? "text-success"
                        : it.status === "Inactive"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {it.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default SellerInventory;