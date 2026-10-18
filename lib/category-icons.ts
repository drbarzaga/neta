import {
  RiPriceTagLine,
  RiBankCardLine,
  RiWalletLine,
  RiSafeLine,
  RiBankLine,
  RiHomeLine,
  RiReceiptLine,
  RiShoppingCartLine,
  RiShoppingBagLine,
  RiCarLine,
  RiPlaneLine,
  RiRestaurantLine,
  RiHeartPulseLine,
  RiGraduationCapLine,
  RiGiftLine,
  RiGamepadLine,
  RiBoxingLine,
  RiPlugLine,
  RiWifiLine,
  RiPhoneLine,
  RiSmartphoneLine,
  RiDropLine,
  RiFlashlightLine,
  RiGasStationLine,
  RiBusLine,
  RiParentLine,
  RiBearSmileLine,
  RiShirtLine,
  RiHammerLine,
  RiBriefcaseLine,
  RiBillLine,
  RiCoinsLine,
  RiArrowRightUpLine,
  RiCalendarLine,
  RiTargetLine,
  RiTrophyLine,
  RiRocketLine,
  RiStarLine,
  RiHeartLine,
  RiDiamondLine,
  RiBikeLine,
  RiUmbrellaLine,
  RiBuilding2Line,
  RiSeedlingLine,
  RiCupLine,
  type RemixiconComponentType,
} from '@remixicon/react';

export const CATEGORY_ICONS: Record<string, RemixiconComponentType> = {
  tag: RiPriceTagLine,
  'credit-card': RiBankCardLine,
  wallet: RiWalletLine,
  'piggy-bank': RiSafeLine,
  landmark: RiBankLine,
  home: RiHomeLine,
  receipt: RiReceiptLine,
  'shopping-cart': RiShoppingCartLine,
  'shopping-bag': RiShoppingBagLine,
  car: RiCarLine,
  plane: RiPlaneLine,
  utensils: RiRestaurantLine,
  'heart-pulse': RiHeartPulseLine,
  'graduation-cap': RiGraduationCapLine,
  gift: RiGiftLine,
  gamepad: RiGamepadLine,
  dumbbell: RiBoxingLine,
  plug: RiPlugLine,
  wifi: RiWifiLine,
  phone: RiPhoneLine,
  smartphone: RiSmartphoneLine,
  droplets: RiDropLine,
  zap: RiFlashlightLine,
  fuel: RiGasStationLine,
  bus: RiBusLine,
  baby: RiParentLine,
  dog: RiBearSmileLine,
  shirt: RiShirtLine,
  hammer: RiHammerLine,
  briefcase: RiBriefcaseLine,
  banknote: RiBillLine,
  coins: RiCoinsLine,
  'trending-up': RiArrowRightUpLine,
  calendar: RiCalendarLine,
  target: RiTargetLine,
  trophy: RiTrophyLine,
  rocket: RiRocketLine,
  star: RiStarLine,
  heart: RiHeartLine,
  gem: RiDiamondLine,
  bike: RiBikeLine,
  umbrella: RiUmbrellaLine,
  building: RiBuilding2Line,
  sprout: RiSeedlingLine,
  'party-popper': RiCupLine,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(key: string | null | undefined): RemixiconComponentType {
  return (key && CATEGORY_ICONS[key]) || RiPriceTagLine;
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
