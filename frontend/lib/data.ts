import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";

const dataDir = path.join(process.cwd(), "data");

function loadYaml<T>(filename: string): T {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  return yaml.load(raw) as T;
}

export interface Business {
  name: string;
  tagline: string;
  description: string;
  site_url: string;
  contact: {
    phone_primary: string;
    phone_secondary: string;
    email: string;
    instagram_handle: string;
    instagram_url: string;
  };
  address: {
    line1: string;
    line2: string;
    plus_code: string;
    postal_code: string;
    google_maps_url: string;
  };
  hours: {
    monday_to_sunday: string;
  };
  reservations: {
    method: string;
    note: string;
  };
  analytics: {
    gtm_id: string;
  };
}

export interface MenuItem {
  name: string;
  price?: number;
  prices?: Record<string, number>;
  description?: string;
  special?: string;
  note?: string;
  image?: string;
}

export interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export interface MenuData {
  coffee: MenuCategory[];
  food: MenuCategory[];
  images: { src: string; alt: string }[];
}

export interface GalleryData {
  photos: { src: string; alt: string }[];
  food: { src: string; alt: string }[];
}

export function getBusiness(): Business {
  return loadYaml<Business>("business.yaml");
}

export function getMenu(): MenuData {
  return loadYaml<MenuData>("menu.yaml");
}

export function getGallery(): GalleryData {
  return loadYaml<GalleryData>("gallery.yaml");
}
