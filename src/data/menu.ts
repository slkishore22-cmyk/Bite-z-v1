// Mock data for the customer app. Served via React Query so results are cached
// instantly across navigations — important for low-bandwidth campus networks.
// Images are referenced from a public CDN (Unsplash) so the browser + edge
// caches handle delivery automatically.

export type Offer = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  accent: "primary" | "warning" | "success";
};

export type CampusOffer = {
  id: string;
  canteen: string;
  title: string;
  highlight: string;
  subtitle: string;
  active: boolean;
  accent: "primary" | "warning" | "success";
};

export type Canteen = {
  id: string;
  name: string;
  tagline: string;
  isOpen: boolean;
  emoji: string;
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  rating: number;
  prepMinutes: number;
  isVeg: boolean;
  categoryId: string;
  image: string;
  popular?: boolean;
};

export const offers: Offer[] = [
  {
    id: "o1",
    title: "Flat ₹50 OFF",
    subtitle: "On your first order today",
    code: "BITEZ50",
    accent: "primary",
  },
  {
    id: "o2",
    title: "Combo at ₹149",
    subtitle: "Burger + Fries + Drink",
    code: "COMBO149",
    accent: "warning",
  },
  {
    id: "o3",
    title: "Free delivery",
    subtitle: "On orders above ₹199",
    code: "FREEDEL",
    accent: "success",
  },
];

export const categories: Category[] = [
  { id: "all", name: "All", emoji: "🍽️" },
  { id: "food", name: "Food", emoji: "🍛" },
  { id: "snacks", name: "Snacks", emoji: "🍔" },
  { id: "drinks", name: "Drinks", emoji: "🥤" },
  { id: "desserts", name: "Desserts", emoji: "🍰" },
];

export const menuItems: MenuItem[] = [
  {
    id: "m1",
    name: "Cheese Burst Burger",
    description: "Double patty, molten cheese, smoky sauce",
    price: 180,
    oldPrice: 220,
    rating: 4.6,
    prepMinutes: 12,
    isVeg: false,
    categoryId: "snacks",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=70&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "m2",
    name: "Chole Poori",
    description: "Punjabi chole with fluffy pooris",
    price: 120,
    rating: 4.4,
    prepMinutes: 15,
    isVeg: true,
    categoryId: "food",
    image:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=70&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "m3",
    name: "Truffle Parmesan Fries",
    description: "Crispy fries, truffle oil, parmesan",
    price: 140,
    rating: 4.7,
    prepMinutes: 10,
    isVeg: true,
    categoryId: "snacks",
    image:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=70&auto=format&fit=crop",
  },
  {
    id: "m4",
    name: "Iced Peach Tea",
    description: "Refreshing brew with real peach",
    price: 80,
    rating: 4.3,
    prepMinutes: 5,
    isVeg: true,
    categoryId: "drinks",
    image:
      "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=70&auto=format&fit=crop",
  },
  {
    id: "m5",
    name: "Paneer Tikka Wrap",
    description: "Smoky paneer, mint chutney, soft roti",
    price: 150,
    rating: 4.5,
    prepMinutes: 12,
    isVeg: true,
    categoryId: "food",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=70&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "m6",
    name: "Choco Lava Cake",
    description: "Warm cake with molten chocolate core",
    price: 110,
    rating: 4.8,
    prepMinutes: 8,
    isVeg: true,
    categoryId: "desserts",
    image:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=70&auto=format&fit=crop",
  },
  {
    id: "m7",
    name: "Cold Coffee",
    description: "Frothy cold coffee with vanilla",
    price: 90,
    rating: 4.4,
    prepMinutes: 5,
    isVeg: true,
    categoryId: "drinks",
    image:
      "https://images.unsplash.com/photo-1517959105821-eaf2591984ca?w=600&q=70&auto=format&fit=crop",
  },
  {
    id: "m8",
    name: "Veg Hakka Noodles",
    description: "Wok-tossed noodles with crunchy veggies",
    price: 130,
    rating: 4.2,
    prepMinutes: 12,
    isVeg: true,
    categoryId: "food",
    image:
      "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=70&auto=format&fit=crop",
  },
];

// Simulate a tiny network delay so React Query's cache benefits become obvious.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const campusOffers: CampusOffer[] = [
  {
    id: "co1",
    canteen: "The Main Square",
    title: "Mega Midnight Deal",
    highlight: "-40% OFF",
    subtitle: "On orders above ₹100",
    active: true,
    accent: "primary",
  },
  {
    id: "co2",
    canteen: "North Canteen",
    title: "Burger Bonanza",
    highlight: "FREE SIDES",
    subtitle: "Valid on all combos",
    active: true,
    accent: "warning",
  },
];

export const canteens: Canteen[] = [
  {
    id: "c1",
    name: "The Main Square",
    tagline: "Fastest bites on campus",
    isOpen: true,
    emoji: "🍔",
  },
  {
    id: "c2",
    name: "The Library Cafe",
    tagline: "Brewing ideas & coffee",
    isOpen: true,
    emoji: "☕",
  },
  {
    id: "c3",
    name: "Sunset Diner",
    tagline: "Classic comfort food",
    isOpen: false,
    emoji: "🌅",
  },
];

// Items the user reorders most often (mock).
export const frequentItemIds = ["m1", "m2", "m7"];

export async function fetchCampusOffers(): Promise<CampusOffer[]> {
  await delay(120);
  return campusOffers;
}

export async function fetchCanteens(): Promise<Canteen[]> {
  await delay(120);
  return canteens;
}

export async function fetchFrequentItems(): Promise<MenuItem[]> {
  await delay(150);
  return menuItems.filter((i) => frequentItemIds.includes(i.id));
}

export async function fetchOffers(): Promise<Offer[]> {
  await delay(120);
  return offers;
}

export async function fetchCategories(): Promise<Category[]> {
  await delay(120);
  return categories;
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  await delay(180);
  return menuItems;
}