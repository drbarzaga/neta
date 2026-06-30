import {
  Tag,
  CreditCard,
  Wallet,
  PiggyBank,
  Landmark,
  Home,
  Receipt,
  ShoppingCart,
  ShoppingBag,
  Car,
  Plane,
  Utensils,
  HeartPulse,
  GraduationCap,
  Gift,
  Gamepad2,
  Dumbbell,
  Plug,
  Wifi,
  Phone,
  Smartphone,
  Droplets,
  Zap,
  Fuel,
  Bus,
  Baby,
  Dog,
  Shirt,
  Hammer,
  Briefcase,
  Banknote,
  Coins,
  TrendingUp,
  CalendarDays,
  Target,
  Trophy,
  Rocket,
  Star,
  Heart,
  Gem,
  Bike,
  Umbrella,
  Building2,
  Sprout,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  tag: Tag,
  'credit-card': CreditCard,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
  landmark: Landmark,
  home: Home,
  receipt: Receipt,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  car: Car,
  plane: Plane,
  utensils: Utensils,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  gift: Gift,
  gamepad: Gamepad2,
  dumbbell: Dumbbell,
  plug: Plug,
  wifi: Wifi,
  phone: Phone,
  smartphone: Smartphone,
  droplets: Droplets,
  zap: Zap,
  fuel: Fuel,
  bus: Bus,
  baby: Baby,
  dog: Dog,
  shirt: Shirt,
  hammer: Hammer,
  briefcase: Briefcase,
  banknote: Banknote,
  coins: Coins,
  'trending-up': TrendingUp,
  calendar: CalendarDays,
  target: Target,
  trophy: Trophy,
  rocket: Rocket,
  star: Star,
  heart: Heart,
  gem: Gem,
  bike: Bike,
  umbrella: Umbrella,
  building: Building2,
  sprout: Sprout,
  'party-popper': PartyPopper,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(key: string | null | undefined): LucideIcon {
  return (key && CATEGORY_ICONS[key]) || Tag;
}

/** Icono por defecto según el nombre (para seed/heurística). */
export function defaultIconForName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('tarjeta')) return 'credit-card';
  if (n.includes('pagarte') || n.includes('ahorro') || n.includes('fondo'))
    return 'piggy-bank';
  if (n.includes('fijo') || n.includes('alquiler') || n.includes('casa') || n.includes('hogar'))
    return 'home';
  if (n.includes('variable') || n.includes('compra')) return 'shopping-cart';
  if (n.includes('comida') || n.includes('super')) return 'utensils';
  if (n.includes('auto') || n.includes('nafta') || n.includes('combustible')) return 'car';
  if (n.includes('salud') || n.includes('médic')) return 'heart-pulse';
  return 'tag';
}
