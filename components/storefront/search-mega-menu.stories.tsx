import type { Meta, StoryObj } from "@storybook/nextjs";

import {
  SearchMegaMenu,
  type MegaMenuCategory,
} from "./search-mega-menu";

const categories: MegaMenuCategory[] = [
  {
    id: "1",
    name: "Textiles & Apparel",
    slug: "textiles-apparel",
    image_path: null,
    product_count: 124,
    subcategories: [
      {
        id: "1a",
        name: "Cotton Fabric",
        slug: "cotton-fabric",
        imageUrl: "https://picsum.photos/seed/cotton-fabric/100",
      },
      {
        id: "1b",
        name: "Synthetic Fabric",
        slug: "synthetic-fabric",
        imageUrl: "https://picsum.photos/seed/synthetic-fabric/100",
      },
      {
        id: "1c",
        name: "Readymade Garments",
        slug: "readymade-garments",
        imageUrl: "https://picsum.photos/seed/garments/100",
      },
    ],
  },
  {
    id: "2",
    name: "Electronics & Electricals",
    slug: "electronics-electricals",
    image_path: null,
    product_count: 86,
    subcategories: [
      {
        id: "2a",
        name: "LED Lighting",
        slug: "led-lighting",
        imageUrl: "https://picsum.photos/seed/led-lighting/100",
      },
      { id: "2b", name: "Switches & Sockets", slug: "switches-sockets" },
      { id: "2c", name: "Wires & Cables", slug: "wires-cables" },
    ],
  },
  {
    id: "3",
    name: "Industrial Machinery",
    slug: "industrial-machinery",
    image_path: null,
    product_count: 42,
    subcategories: [
      { id: "3a", name: "Packaging Machines", slug: "packaging-machines" },
      { id: "3b", name: "Textile Machinery", slug: "textile-machinery" },
    ],
  },
  {
    id: "4",
    name: "Packaging Materials",
    slug: "packaging-materials",
    image_path: null,
    product_count: 0,
    subcategories: [],
  },
  {
    id: "5",
    name: "Home & Furniture",
    slug: "home-furniture",
    image_path: null,
    product_count: 63,
    subcategories: [
      { id: "5a", name: "Wooden Furniture", slug: "wooden-furniture" },
      { id: "5b", name: "Home Decor", slug: "home-decor" },
    ],
  },
  {
    id: "6",
    name: "Agriculture & Food",
    slug: "agriculture-food",
    image_path: null,
    product_count: 91,
    subcategories: [
      { id: "6a", name: "Spices", slug: "spices" },
      { id: "6b", name: "Grains & Pulses", slug: "grains-pulses" },
    ],
  },
  {
    id: "7",
    name: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    image_path: null,
    product_count: 38,
    subcategories: [
      { id: "7a", name: "Ayurvedic Products", slug: "ayurvedic-products" },
    ],
  },
  {
    id: "8",
    name: "Automotive Parts",
    slug: "automotive-parts",
    image_path: null,
    product_count: 27,
    subcategories: [
      { id: "8a", name: "Two-Wheeler Spares", slug: "two-wheeler-spares" },
    ],
  },
];

const meta = {
  title: "Storefront/SearchMegaMenu",
  component: SearchMegaMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    categories,
  },
} satisfies Meta<typeof SearchMegaMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondCategory: Story = {
  args: {
    activeSlug: "electronics-electricals",
  },
};

export const Trending: Story = {
  args: {
    trending: ["cotton fabric", "led lights", "jute bags", "steel bottles"],
  },
};

export const EmptyCategory: Story = {
  args: {
    activeSlug: "packaging-materials",
  },
};

export const NoCategories: Story = {
  args: {
    categories: [],
  },
};

export const WithSuggestions: Story = {
  args: {
    query: "cotton",
    suggestions: [
      { id: "s1", label: "cotton fabric", hint: "12k products" },
      { id: "s2", label: "cotton yarn", hint: "8k products" },
      { id: "s3", label: "cotton sarees", hint: "5k products" },
      { id: "s4", label: "cotton t-shirts", hint: "3k products" },
      { id: "s5", label: "organic cotton", hint: "1k products" },
    ],
  },
};
