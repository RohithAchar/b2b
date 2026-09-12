import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PASSWORD = "SeedPass123!";
const IMAGE_BASE = "https://picsum.photos/seed/";
const CONCURRENCY = 6;

const envPath = resolve(process.cwd(), ".env.local");
const envTxt = readFileSync(envPath, "utf8");
function envGet(key) {
  return (envTxt.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1] ?? "").trim();
}
const url = envGet("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = envGet("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

function fetchServiceKey() {
  const ref = new URL(url).hostname.split(".")[0];
  const out = execSync(`supabase projects api-keys --project-ref ${ref}`, { encoding: "utf8" })
    .replace(/\x1b\[[0-9;]*m/g, "");
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\S+)\s+\|\s+(\S+)/);
    if (m && m[1] === "service_role") return m[2];
  }
  throw new Error("Could not find service_role key in supabase CLI output");
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fetchServiceKey();
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const userClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

function log(step, msg) {
  console.log(`[${String(step).padEnd(28)}] ${msg}`);
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length).fill(undefined);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function ensureCategory({ name, slug, parentId, sortOrder, imagePath }) {
  let qb = admin
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .eq("sort_order", sortOrder);
  if (parentId === null) {
    qb = qb.is("parent_id", null);
  } else {
    qb = qb.eq("parent_id", parentId);
  }
  const { data: existing } = await qb.maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("categories")
    .insert({ name, slug, parent_id: parentId, sort_order: sortOrder, image_path: imagePath })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureUser(spec) {
  const { data: existing } = await admin.from("profiles").select("id").eq("email", spec.email).maybeSingle();
  if (existing) return { id: existing.id, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: spec.contact_person },
  });
  if (error) throw error;
  return { id: data.user.id, created: true };
}

async function setSupplierRole(email) {
  const { error: signInError } = await userClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  const { error } = await userClient
    .from("profiles")
    .update({ user_type: "supplier" })
    .eq("id", (await userClient.auth.getUser()).data.user.id);
  if (error) throw error;
  await userClient.auth.signOut();
}

async function ensureCompany(ownerId, spec) {
  const { data: existing } = await admin.from("companies").select("id").eq("owner_id", ownerId).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("companies")
    .insert({
      owner_id: ownerId,
      business_name: spec.business_name,
      contact_person: spec.contact_person,
      phone: spec.phone,
      address: spec.address,
      city: spec.city,
      state: spec.state,
      pincode: spec.pincode,
      gstin: spec.gstin,
      pan: spec.pan,
      bank_account: spec.bank_account,
      bank_ifsc: spec.bank_ifsc,
      kyb_status: "verified",
      verified_at: "2026-08-01T00:00:00Z",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function uploadImage(bucket, path, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { error } = await admin.storage.from(bucket).upload(path, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
}

async function ensureProduct(companyId, categoryId, product) {
  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("supplier_id", companyId)
    .eq("seller_sku", product.seller_sku)
    .maybeSingle();
  if (existing) return { id: existing.id, created: false };
  const { data, error } = await admin
    .from("products")
    .insert({
      supplier_id: companyId,
      category_id: categoryId,
      title: product.title,
      description: product.description,
      brand: product.brand ?? null,
      seller_sku: product.seller_sku,
      hsn_code: product.hsn_code,
      unit: product.unit,
      price_per_unit: product.price,
      moq: product.moq,
      stock_qty: product.stock,
      price_slabs: product.price_slabs ?? [],
      negotiable: product.negotiable ?? true,
      sample_available: product.sample ?? false,
      sample_price: product.samplePrice ?? null,
      lead_time_days: product.lead,
      gst_rate: product.gst,
      attributes: product.attributes ?? {},
      certifications: product.certifications ?? [],
      status: product.status ?? "approved",
      submitted_at: product.status === "approved" || product.status === "pending" ? "2026-08-15T00:00:00Z" : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, created: true };
}

const CATEGORIES = [
  { name: "Textiles & Apparel", slug: "textiles-apparel", subs: [
    { name: "Cotton Fabric", slug: "cotton-fabric" },
    { name: "Synthetic Fabric", slug: "synthetic-fabric" },
    { name: "Readymade Garments", slug: "readymade-garments" },
  ] },
  { name: "Electronics & Electricals", slug: "electronics-electricals", subs: [
    { name: "LED Lighting", slug: "led-lighting" },
    { name: "Switches & Sockets", slug: "switches-sockets" },
    { name: "Wires & Cables", slug: "wires-cables" },
  ] },
  { name: "Chemicals & Dyes", slug: "chemicals-dyes", subs: [
    { name: "Industrial Chemicals", slug: "industrial-chemicals" },
    { name: "Dyes & Pigments", slug: "dyes-pigments" },
  ] },
  { name: "Packaging Materials", slug: "packaging-materials", subs: [
    { name: "Corrugated Boxes", slug: "corrugated-boxes" },
    { name: "Plastic Packaging", slug: "plastic-packaging" },
  ] },
  { name: "Industrial Machinery", slug: "industrial-machinery", subs: [
    { name: "Textile Machines", slug: "textile-machines" },
    { name: "Food Processing", slug: "food-processing" },
  ] },
  { name: "Automotive Parts", slug: "automotive-parts", subs: [
    { name: "Brake Pads", slug: "brake-pads" },
    { name: "Engine Components", slug: "engine-components" },
  ] },
  { name: "Agriculture & Farming", slug: "agriculture-farming", subs: [
    { name: "Seeds & Fertilizers", slug: "seeds-fertilizers" },
    { name: "Irrigation Equipment", slug: "irrigation-equipment" },
  ] },
  { name: "Furniture & Fixtures", slug: "furniture-fixtures", subs: [
    { name: "Office Furniture", slug: "office-furniture" },
    { name: "Industrial Racks", slug: "industrial-racks" },
  ] },
];

const SUPPLIERS = [
  { email: "rajesh.textiles@seed.b2b", business_name: "Rajesh Textiles Pvt Ltd", contact_person: "Rajesh Kumar", phone: "+91 98250 00001", address: "Plot 12, New Textile Market", city: "Surat", state: "Gujarat", pincode: "395002", gstin: "24AABCR1234A1Z5", pan: "AABCR1234A", bank_account: "1234567891", bank_ifsc: "SBIN0000111" },
  { email: "brightled@seed.b2b", business_name: "BrightLED Industries", contact_person: "Priya Shah", phone: "+91 98250 00002", address: "GIDC Phase 2, Naroda", city: "Ahmedabad", state: "Gujarat", pincode: "382445", gstin: "24AAACB4567B1Z2", pan: "AABCB5678B", bank_account: "1234567892", bank_ifsc: "SBIN0000222" },
  { email: "chemsolutions@seed.b2b", business_name: "Chem Solutions", contact_person: "Amit Desai", phone: "+91 98250 00003", address: "MIDC Dombivli East", city: "Mumbai", state: "Maharashtra", pincode: "421203", gstin: "27AAACC7890C1Z3", pan: "AABCC7890C", bank_account: "1234567893", bank_ifsc: "SBIN0000333" },
  { email: "packright@seed.b2b", business_name: "PackRight Industries", contact_person: "Sneha Patil", phone: "+91 98250 00004", address: "Chinchwad MIDC", city: "Pune", state: "Maharashtra", pincode: "411019", gstin: "27AAACD9876D1Z4", pan: "AABCD9876D", bank_account: "1234567894", bank_ifsc: "SBIN0000444" },
  { email: "khalsa.engineering@seed.b2b", business_name: "Khalsa Engineering Works", contact_person: "Gurpreet Singh", phone: "+91 98250 00005", address: "Gill Road, Industrial Area B", city: "Ludhiana", state: "Punjab", pincode: "141003", gstin: "03AABCE2345E1Z5", pan: "AABCE2345E", bank_account: "1234567895", bank_ifsc: "SBIN0000555" },
  { email: "agritech.equipment@seed.b2b", business_name: "AgriTech Equipments", contact_person: "Ravi Kumar", phone: "+91 98250 00006", address: "Aziz Nagar, Ranga Reddy", city: "Hyderabad", state: "Telangana", pincode: "500075", gstin: "36AABCF3456F1Z6", pan: "AABCF3456F", bank_account: "1234567896", bank_ifsc: "SBIN0000666" },
  { email: "autoparts.hub@seed.b2b", business_name: "AutoParts Hub", contact_person: "Karthik Iyer", phone: "+91 98250 00007", address: "Ambattur Industrial Estate", city: "Chennai", state: "Tamil Nadu", pincode: "600058", gstin: "33AABCG4567G1Z7", pan: "AABCG4567G", bank_account: "1234567897", bank_ifsc: "SBIN0000777" },
  { email: "urbanfit@seed.b2b", business_name: "UrbanFit Office Solutions", contact_person: "Meera Nair", phone: "+91 98250 00008", address: "Whitefield Main Road", city: "Bengaluru", state: "Karnataka", pincode: "560066", gstin: "29AABCH5678H1Z8", pan: "AABCH5678H", bank_account: "1234567898", bank_ifsc: "SBIN0000888" },
];

const PRODUCTS = [
  {
    status: "approved", supplier: "rajesh.textiles@seed.b2b", category: "cotton-fabric",
    title: "40s Combed Cotton Knit Fabric 160 GSM",
    description: "Single-jersey combed cotton fabric spun at 40s count with a 160 GSM weight. Pre-shrunk, bio-washed and azo-free. Ideal for t-shirts, innerwear and kids wear.",
    brand: "Texport", seller_sku: "TXT-COT-160", hsn_code: "5208", unit: "mtr",
    price: 185, moq: 500, stock: 12000, lead: 10, gst: 5, images: 3,
    price_slabs: [
      { min_qty: 500, price: 185 },
      { min_qty: 2000, price: 178 },
      { min_qty: 5000, price: 172 },
    ],
    sample: true, samplePrice: 60,
    attributes: { "GSM": "160", "Count": "40s", "Width": "72 inch", "Finish": "Bio-wash, pre-shrunk" },
    certifications: ["OEKO-TEX 100", "GOTS"],
    variants: [
      { label: "Natural White", attrs: { colour: "Natural White" }, seller_sku: "TXT-COT-160-NW", price: 185, moq: 500, stock_qty: 6000, sort: 0 },
      { label: "Black", attrs: { colour: "Black" }, seller_sku: "TXT-COT-160-BK", price: 195, moq: 500, stock_qty: 6000, sort: 1 },
    ],
  },
  {
    status: "approved", supplier: "rajesh.textiles@seed.b2b", category: "cotton-fabric",
    title: "Organic Cotton Woven Fabric 60s",
    description: "GOTS-certified organic cotton woven fabric at 60s count, 120 GSM. Soft finish with high tensile strength. Suitable for dress shirts, skirts and home textiles.",
    brand: "Texport", seller_sku: "TXT-ORG-60", hsn_code: "5208", unit: "mtr",
    price: 290, moq: 300, stock: 8000, lead: 15, gst: 5, images: 2,
    certifications: ["GOTS"],
    attributes: { "GSM": "120", "Count": "60s", "Width": "58 inch", "Weave": "Plain" },
  },
  {
    status: "approved", supplier: "rajesh.textiles@seed.b2b", category: "synthetic-fabric",
    title: "Polyester Dope-Dyed Fabric 220 GSM",
    description: "Dope-dyed polyester fabric with colourfast properties, 220 GSM. Colour stays uniform even after repeated washes. Great for sportswear, bags and upholstery.",
    brand: "Texport", seller_sku: "SYN-POLY-220", hsn_code: "5407", unit: "mtr",
    price: 125, moq: 500, stock: 15000, lead: 12, gst: 5, images: 2,
    attributes: { "GSM": "220", "Fibre": "100% Polyester", "Width": "60 inch", "Dye": "Dope-dyed" },
  },
  {
    status: "draft", supplier: "rajesh.textiles@seed.b2b", category: "cotton-fabric",
    title: "Cotton Terry Towel Fabric 480 GSM",
    description: "Ring-spun cotton terry fabric at 480 GSM with low-lint, high absorbency loops. Configurable with stripe or jacquard weaves for towels and bath robes.",
    brand: "Texport", seller_sku: "TXT-TRW-480", hsn_code: "5802", unit: "mtr",
    price: 210, moq: 300, stock: 9000, lead: 14, gst: 5, images: 0,
  },
  {
    status: "approved", supplier: "brightled@seed.b2b", category: "led-lighting",
    title: "Smart LED Bulb 9W B22/E27",
    description: "9W smart LED bulb with dimming and schedule control, 806 lumens, 100-240V AC. Energy rating A+. Compatible with Alexa and Google Home.",
    brand: "BrightLED", seller_sku: "ELX-LED-9W", hsn_code: "8539", unit: "pcs",
    price: 49, moq: 100, stock: 50000, lead: 7, gst: 18, images: 3,
    sample: true, samplePrice: 49,
    attributes: { "Power": "9W", "Lumens": "806 lm", "Dimmable": "Yes", "Voltage": "100-240V AC", "Base": "B22 / E27" },
    certifications: ["BIS", "CE"],
    variants: [
      { label: "Warm White 3000K", attrs: { "Colour temp": "3000K" }, seller_sku: "ELX-LED-9W-WW", price: 49, moq: 100, stock_qty: 20000, sort: 0 },
      { label: "Cool White 6000K", attrs: { "Colour temp": "6000K" }, seller_sku: "ELX-LED-9W-CW", price: 49, moq: 100, stock_qty: 20000, sort: 1 },
      { label: "Daylight 4000K", attrs: { "Colour temp": "4000K" }, seller_sku: "ELX-LED-9W-DL", price: 51, moq: 100, stock_qty: 10000, sort: 2 },
    ],
  },
  {
    status: "approved", supplier: "brightled@seed.b2b", category: "led-lighting",
    title: "LED High Bay Light 100W",
    description: "IP65 LED high bay with 12000 lumens for warehouses and factories. Aluminium die-cast body with 50,000 hr lifespan and 5-year warranty.",
    brand: "BrightLED", seller_sku: "ELX-HB-100", hsn_code: "9405", unit: "pcs",
    price: 1250, moq: 10, stock: 3000, lead: 20, gst: 18, images: 2,
    attributes: { "Power": "100W", "Lumens": "12000 lm", "IP Rating": "IP65", "Warranty": "5 years" },
  },
  {
    status: "approved", supplier: "brightled@seed.b2b", category: "switches-sockets",
    title: "Modular Switch 6A One Way",
    description: "6A one-way modular switch with fire-retardant polycarbonate body from the Crystal series. Wall-mounting included, pack of 10.",
    brand: "BrightLED", seller_sku: "ELX-SW-6A", hsn_code: "8536", unit: "pcs",
    price: 28, moq: 200, stock: 100000, lead: 10, gst: 18, images: 2,
    attributes: { "Current": "6A", "Type": "One way", "Material": "Polycarbonate", "Series": "Crystal" },
    certifications: ["BIS"],
  },
  {
    status: "approved", supplier: "brightled@seed.b2b", category: "wires-cables",
    title: "BIS-Certified Copper Wire 2.5 sq mm (90m)",
    description: "FR-LSH insulated 2.5 sq mm copper wire coil of 90 metres. One of a kind for household and commercial wiring with 0.0025 mm tolerance.",
    brand: "BrightLED", seller_sku: "ELX-WIRE-25", hsn_code: "8544", unit: "pcs",
    price: 1850, moq: 20, stock: 2000, lead: 14, gst: 18, images: 2,
    attributes: { "Size": "2.5 sq mm", "Length": "90 m", "Insulation": "FR-LSH", "Standards": "IS 694" },
    certifications: ["BIS"],
  },
  {
    status: "approved", supplier: "chemsolutions@seed.b2b", category: "industrial-chemicals",
    title: "Caustic Soda Flakes 99%",
    description: "Textile-grade caustic soda flakes at 99% purity in 50 kg HDPE bags. Used for mercerisation, effluent treatment and soap manufacturing. ISI certified.",
    brand: "ChemLab", seller_sku: "CHM-CAUSTIC-99", hsn_code: "2815", unit: "kg",
    price: 42, moq: 1000, stock: 40000, lead: 8, gst: 18, images: 2,
    attributes: { "Purity": "99%", "Form": "Flakes", "Packaging": "50 kg HDPE bag" },
  },
  {
    status: "approved", supplier: "chemsolutions@seed.b2b", category: "industrial-chemicals",
    title: "Citric Acid Anhydrous Food Grade",
    description: "Food-grade citric acid anhydrous in 25 kg bags with high solubility. Widely used in beverages, confectionery and cleaning products. FSSAI approved.",
    brand: "ChemLab", seller_sku: "CHM-CITRIC-AN", hsn_code: "2918", unit: "kg",
    price: 68, moq: 500, stock: 25000, lead: 10, gst: 18, images: 2,
    attributes: { "Grade": "Food grade", "Form": "Anhydrous", "Packaging": "25 kg bag" },
    certifications: ["FSSAI", "ISO 9001"],
  },
  {
    status: "approved", supplier: "chemsolutions@seed.b2b", category: "dyes-pigments",
    title: "Reactive Red Dye 150%",
    description: "High-uptake reactive red dye at 150% strength for cotton and viscose. Excellent wash, light and perspiration fastness. Supplied in 10 kg bales.",
    brand: "ChemLab", seller_sku: "CHM-DYE-RE", hsn_code: "3204", unit: "kg",
    price: 320, moq: 100, stock: 8000, lead: 12, gst: 18, images: 2,
    attributes: { "Strength": "150%", "Class": "Reactive", "Fastness": "Excellent", "Packaging": "10 kg bale" },
  },
  {
    status: "approved", supplier: "packright@seed.b2b", category: "corrugated-boxes",
    title: "3-Ply Corrugated Box 18x12x12",
    description: "Eco-friendly 3-ply corrugated shipping box with brown kraft finish, bursting strength 12 kg/cm2. Custom printing with 48-hour dispatch available.",
    brand: "PackRight", seller_sku: "PKG-3PLY-1812", hsn_code: "4819", unit: "pcs",
    price: 22, moq: 500, stock: 200000, lead: 5, gst: 12, images: 3,
    price_slabs: [
      { min_qty: 500, price: 22 },
      { min_qty: 2000, price: 19 },
      { min_qty: 10000, price: 16 },
    ],
    attributes: { "Ply": "3", "Size": "18x12x12 inch", "Burst strength": "12 kg/cm2" },
    variants: [
      { label: "18x12x12 inch", attrs: { "Size": "18x12x12 inch" }, seller_sku: "PKG-3PLY-1812", price: 22, moq: 500, stock_qty: 100000, sort: 0 },
      { label: "24x18x18 inch", attrs: { "Size": "24x18x18 inch" }, seller_sku: "PKG-3PLY-2418", price: 34, moq: 300, stock_qty: 100000, sort: 1 },
    ],
  },
  {
    status: "approved", supplier: "packright@seed.b2b", category: "corrugated-boxes",
    title: "5-Ply Heavy Duty Carton 30x20x20",
    description: "5-ply export-quality carton with 18 kg/cm2 bursting strength, reinforced corners, and lamination option for high-value and export shipments.",
    brand: "PackRight", seller_sku: "PKG-5PLY-3020", hsn_code: "4819", unit: "pcs",
    price: 48, moq: 300, stock: 150000, lead: 6, gst: 12, images: 2,
    attributes: { "Ply": "5", "Size": "30x20x20 inch", "Burst strength": "18 kg/cm2", "Use": "Export / heavy duty" },
  },
  {
    status: "approved", supplier: "packright@seed.b2b", category: "plastic-packaging",
    title: "LDPE Film Roll 50 Micron",
    description: "Low-density polyethylene film roll at 50 micron, 100% virgin material. Uniform gauge for high-speed packaging machines. Custom width and core sizes available.",
    brand: "PackRight", seller_sku: "PKG-LDPE-50", hsn_code: "3920", unit: "kg",
    price: 165, moq: 100, stock: 30000, lead: 9, gst: 18, images: 2,
    attributes: { "Material": "LDPE", "Micron": "50", "Resin": "100% virgin", "Printing": "Available" },
  },
  {
    status: "approved", supplier: "khalsa.engineering@seed.b2b", category: "textile-machines",
    title: "Automatic Power Loom (6 Shuttle)",
    description: "Cast-iron automatic power loom with 6 shuttles, 200 rpm, cam shedding. Suitable for grey cotton and synthetic weaving with low power consumption.",
    brand: "Khalsa", seller_sku: "MCH-PL-6SH", hsn_code: "8446", unit: "pcs",
    price: 185000, moq: 1, stock: 25, lead: 45, gst: 18, images: 3,
    attributes: { "Shuttles": "6", "Speed": "200 rpm", "Shedding": "Cam", "Power": "1.5 HP" },
  },
  {
    status: "approved", supplier: "khalsa.engineering@seed.b2b", category: "food-processing",
    title: "Automatic Chapati Making Machine",
    description: "Fully automatic chapati machine producing 90 chapatis per hour with dough sheeting and baking. Stainless steel body with thermo-stat control.",
    brand: "Khalsa", seller_sku: "MCH-CHPT-90", hsn_code: "8438", unit: "pcs",
    price: 85000, moq: 1, stock: 40, lead: 30, gst: 18, images: 2,
    attributes: { "Capacity": "90 pcs/hr", "Material": "SS 304", "Dough": "Atta / maida", "Voltage": "220V" },
  },
  {
    status: "approved", supplier: "autoparts.hub@seed.b2b", category: "brake-pads",
    title: "Ceramic Disc Brake Pad Set",
    description: "Low-dust ceramic brake pad set for compact sedans. Disc and drum wear minimised with a stable friction coefficient across temperatures.",
    brand: "Apada", seller_sku: "AUTO-BRK-CER", hsn_code: "8708", unit: "pcs",
    price: 145, moq: 50, stock: 20000, lead: 15, gst: 18, images: 2,
    attributes: { "Material": "Ceramic", "Type": "Disc set", "Friction": "EE grade", "Warranty": "12 months" },
  },
  {
    status: "approved", supplier: "autoparts.hub@seed.b2b", category: "engine-components",
    title: "Engine Piston Ring Set (Standard)",
    description: "Chrome-faced piston ring set, standard bore size, matching OEM dimensions. High wear resistance for petrol and diesel engines.",
    brand: "Apada", seller_sku: "AUTO-PST-STD", hsn_code: "8409", unit: "pcs",
    price: 320, moq: 100, stock: 50000, lead: 18, gst: 18, images: 2,
    attributes: { "Type": "Chrome face", "Bore": "Standard", "Fitment": "Petrol / Diesel" },
  },
  {
    status: "approved", supplier: "agritech.equipment@seed.b2b", category: "seeds-fertilizers",
    title: "Hybrid Cotton Seeds (5 kg)",
    description: "High-yield Bt cotton hybrid seeds in vacuum-packed 5 kg bags. Tolerant to cotton leaf curl, need 35-40% less irrigation than local varieties.",
    brand: "AgriOne", seller_sku: "AGR-SEED-COT", hsn_code: "1207", unit: "box",
    price: 850, moq: 10, stock: 5000, lead: 7, gst: 0, images: 2,
    attributes: { "Pack": "5 kg", "Type": "Bt cotton hybrid", "Germination": "92%+", "Boll maturity": "150-160 days" },
  },
  {
    status: "approved", supplier: "agritech.equipment@seed.b2b", category: "irrigation-equipment",
    title: "Drip Irrigation Kit (1 Acre)",
    description: "Complete drip irrigation kit for 1 acre covering inline laterals, micro-tubes, drippers and screen filter. Reduces water usage by up to 60%.",
    brand: "AgriOne", seller_sku: "AGR-DRIP-1A", hsn_code: "8424", unit: "box",
    price: 4500, moq: 2, stock: 800, lead: 20, gst: 12, images: 3,
    price_slabs: [
      { min_qty: 2, price: 4500 },
      { min_qty: 10, price: 4250 },
      { min_qty: 25, price: 3990 },
    ],
    attributes: { "Coverage": "1 acre", "Emitter spacing": "30 cm", "Discharge": "4 LPH", "Filter": "Screen" },
  },
  {
    status: "pending", supplier: "agritech.equipment@seed.b2b", category: "irrigation-equipment",
    title: "Sprinkler Irrigation Set (1 Acre)",
    description: "Popup sprinkler irrigation kit for 1 acre with GI risers, brass nozzles and PU couplings. Uniform coverage with low operating pressure.",
    brand: "AgriOne", seller_sku: "AGR-SPR-1A", hsn_code: "8424", unit: "box",
    price: 5800, moq: 2, stock: 400, lead: 22, gst: 12, images: 0,
    attributes: { "Coverage": "1 acre", "Riser": "GI 1 m", "Nozzle": "Brass", "Pressure": "2-3 bar" },
  },
  {
    status: "approved", supplier: "urbanfit@seed.b2b", category: "office-furniture",
    title: "Ergonomic Mesh Office Chair",
    description: "Breathable mesh back ergonomic office chair with adjustable lumbar support, 360-degree swivel and recline lock. Tested for 120 kg load capacity.",
    brand: "UrbanFit", seller_sku: "FUR-CHR-MESH", hsn_code: "9401", unit: "pcs",
    price: 3499, moq: 10, stock: 1200, lead: 12, gst: 18, images: 2,
    attributes: { "Seat": "Mesh", "Recline": "Yes", "Load": "120 kg", "Warranty": "2 years" },
  },
  {
    status: "approved", supplier: "urbanfit@seed.b2b", category: "office-furniture",
    title: "Laminated Workstation Desk 120 cm",
    description: "Laminated MDF office workstation desk with cable management ports, steel legs and scratch-resistant surface. Assembly within 30 minutes.",
    brand: "UrbanFit", seller_sku: "FUR-DSK-120", hsn_code: "9403", unit: "pcs",
    price: 6299, moq: 5, stock: 600, lead: 15, gst: 18, images: 2,
    attributes: { "Size": "120x60x75 cm", "Material": "MDF laminated", "Legs": "Steel", "Finish": "Walnut / Grey" },
  },
  {
    status: "approved", supplier: "urbanfit@seed.b2b", category: "industrial-racks",
    title: "Heavy Duty Storage Rack 500 kg/shelf",
    description: "Cold-rolled steel industrial storage rack rated at 500 kg per shelf with adjustable levels. Hot-dip galvanised for corrosion resistance in warehouses.",
    brand: "UrbanFit", seller_sku: "FUR-RACK-IND", hsn_code: "9403", unit: "pcs",
    price: 15999, moq: 2, stock: 150, lead: 20, gst: 18, images: 2,
    attributes: { "Capacity": "500 kg/shelf", "Material": "Cold-rolled steel", "Finish": "Galvanised", "Levels": "4 adjustable" },
  },
  {
    status: "approved", supplier: "rajesh.textiles@seed.b2b", category: "readymade-garments",
    title: "100% Cotton Casual Full Sleeve Shirts",
    description: "Regular-fit casual shirts in 140 GSM combed cotton with full sleeves and button-down collar. Colourfast and ironable; sizes M to XXL.",
    brand: "Texport", seller_sku: "TXT-RTG-FSC", hsn_code: "6205", unit: "pcs",
    price: 599, moq: 50, stock: 20000, lead: 12, gst: 5, images: 2,
    attributes: { "Fit": "Regular", "GSM": "140", "Sleeve": "Full", "Sizes": "M / L / XL / XXL" },
    certifications: ["OEKO-TEX 100"],
  },
];

const BANNERS = [
  {
    slot: "hero",
    title: "Monsoon office refresh",
    subtitle: "Ergonomic chairs and desks at wholesale prices",
    link: "/category/furniture-fixtures",
    sortOrder: 0,
    imagePath: "seed/banner-hero-1.jpg",
    imageSeed: "banner-hero-1",
    imageSize: "1200/480",
  },
  {
    slot: "hero",
    title: "Bulk packaging deals",
    subtitle: "Cartons, boxes and wrapping for every order",
    link: "/category/packaging-materials",
    sortOrder: 1,
    imagePath: "seed/banner-hero-2.jpg",
    imageSeed: "banner-hero-2",
    imageSize: "1200/480",
  },
  {
    slot: "promo",
    title: "Readymade garments sale",
    subtitle: "Regular-fit cotton shirts from ₹599",
    link: "/products?q=cotton",
    sortOrder: 0,
    imagePath: "seed/banner-promo-1.jpg",
    imageSeed: "banner-promo-1",
    imageSize: "1200/256",
  },
];

async function ensureBanner(spec) {
  const { data: existing } = await admin
    .from("home_banners")
    .select("id")
    .eq("slot", spec.slot)
    .eq("sort_order", spec.sortOrder)
    .maybeSingle();
  if (existing) return { id: existing.id, created: false };
  const { data, error } = await admin
    .from("home_banners")
    .insert({
      slot: spec.slot,
      title: spec.title,
      subtitle: spec.subtitle,
      link_url: spec.link,
      is_active: true,
      sort_order: spec.sortOrder,
      image_path: spec.imagePath,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, created: true };
}

async function main() {
  log("project", new URL(url).hostname);

  const idBySlug = {};
  for (const [pi, parent] of CATEGORIES.entries()) {
    const parentId = await ensureCategory({
      name: parent.name,
      slug: parent.slug,
      parentId: null,
      sortOrder: pi,
      imagePath: `seed/${parent.slug}.jpg`,
    });
    idBySlug[parent.slug] = parentId;
    for (const [si, sub] of parent.subs.entries()) {
      const subId = await ensureCategory({
        name: sub.name,
        slug: sub.slug,
        parentId,
        sortOrder: si,
        imagePath: `seed/${sub.slug}.jpg`,
      });
      idBySlug[sub.slug] = subId;
    }
  }
  log("categories", Object.keys(idBySlug).length + " ensured");

  const companyIdByEmail = {};
  for (const spec of SUPPLIERS) {
    const user = await ensureUser(spec);
    if (user.created) {
      await setSupplierRole(spec.email);
      log("user+supplier", spec.email);
    } else {
      log("user exists", spec.email);
    }
    const companyId = await ensureCompany(user.id, spec);
    companyIdByEmail[spec.email] = companyId;
  }

  const allCategories = [];
  for (const parent of CATEGORIES) {
    allCategories.push({ slug: parent.slug, path: `seed/${parent.slug}.jpg` });
    for (const sub of parent.subs) {
      allCategories.push({ slug: sub.slug, path: `seed/${sub.slug}.jpg` });
    }
  }
  await mapLimit(allCategories, CONCURRENCY, async (c) => {
    await uploadImage("category_images", c.path, `${IMAGE_BASE}cat-${c.slug}/600/600`);
  });
  log("category images", allCategories.length + " uploaded");

  const productIds = [];
  for (const product of PRODUCTS) {
    const companyId = companyIdByEmail[product.supplier];
    const categoryId = idBySlug[product.category];
    const result = await ensureProduct(companyId, categoryId, product);
    productIds.push({ ...result, product, companyId });
    log("product", `${product.status.padEnd(8)} ${product.seller_sku}${result.created ? " (new)" : ""}`);
  }

  const missingMedia = [];
  for (const { id, product } of productIds) {
    const { count } = await admin
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);
    if ((count ?? 0) === 0 && (product.images ?? 0) > 0) {
      missingMedia.push({ id, product });
    }
  }

  await mapLimit(missingMedia, CONCURRENCY, async ({ id, product }) => {
    const images = [];
    for (let i = 0; i < (product.images ?? 0); i++) {
      const path = `seed/${product.seller_sku.toLowerCase()}-${i}.jpg`;
      await uploadImage("product_images", path, `${IMAGE_BASE}${product.seller_sku.toLowerCase()}-${i}/600/600`);
      images.push({ product_id: id, path, sort: i, alt: product.title });
    }
    const { error } = await admin.from("product_images").insert(images);
    if (error) throw error;
  });
  log("product images", missingMedia.length + " products reconciled");

  for (const { id, product } of productIds) {
    if (!product.variants || product.variants.length === 0) continue;
    const { count } = await admin
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);
    if ((count ?? 0) === 0) {
      const { error } = await admin
        .from("product_variants")
        .insert(product.variants.map((v) => ({ ...v, product_id: id })));
      if (error) throw error;
    }
  }
  log("media rows", "reconciled");

  let bannerUploads = 0;
  const bannerResults = [];
  for (const spec of BANNERS) {
    const result = await ensureBanner(spec);
    bannerResults.push({ spec, ...result });
    if (result.created) bannerUploads += 1;
  }
  await mapLimit(bannerResults, CONCURRENCY, async ({ spec }) => {
    await uploadImage("banners", spec.imagePath, `${IMAGE_BASE}${spec.imageSeed}/${spec.imageSize}`);
  });
  log("banners", `${bannerUploads} created, ${BANNERS.length - bannerUploads} existing`);

  log("done", `${productIds.length} products, ${allCategories.length} categories, ${SUPPLIERS.length} suppliers`);
  console.log("demo logins: " + SUPPLIERS.map((s) => s.email).join(", ") + " / " + PASSWORD);
}

main().catch((err) => {
  console.error("seed failed:", err.message ?? err);
  process.exit(1);
});