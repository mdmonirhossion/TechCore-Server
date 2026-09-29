import { slugify } from '../utils/slugify.js';

export const categories = [
  { id: 'cat-cpu', name: 'Processor', slug: 'processor', icon: 'Cpu' },
  { id: 'cat-gpu', name: 'Graphics Card', slug: 'gpu', icon: 'Tv' },
  { id: 'cat-mb', name: 'Motherboard', slug: 'motherboard', icon: 'Grid' },
  { id: 'cat-ram', name: 'RAM (Memory)', slug: 'ram', icon: 'HardDrive' },
  { id: 'cat-psu', name: 'Power Supply', slug: 'power-supply', icon: 'Zap' },
  { id: 'cat-laptop', name: 'Laptops', slug: 'laptop', icon: 'Laptop' },
  { id: 'cat-storage', name: 'SSD / Storage', slug: 'storage', icon: 'Database' },
  { id: 'cat-monitor', name: 'Gaming Monitors', slug: 'monitor', icon: 'Monitor' },
  { id: 'cat-cooler', name: 'CPU Cooler', slug: 'cpu-cooler', icon: 'Wind' },
  { id: 'cat-case', name: 'Casing', slug: 'casing', icon: 'Box' },
  { id: 'cat-peripherals', name: 'Accessories & Peripherals', slug: 'accessories', icon: 'Headphones' },
  { id: 'cat-desktop', name: 'Desktop PC', slug: 'desktop', icon: 'Monitor' },
  { id: 'cat-watch', name: 'Smartwatch', slug: 'smartwatch', icon: 'Watch' },
  { id: 'cat-earbuds', name: 'Earbuds & Audio', slug: 'earbuds', icon: 'Headphones' },
  { id: 'cat-camera', name: 'Security Camera', slug: 'camera', icon: 'Camera' },
  { id: 'cat-software', name: 'Software & OS', slug: 'software', icon: 'Disc' }
];

export const brands = [
  'ASUS', 'MSI', 'Gigabyte', 'AMD', 'Intel', 'Corsair', 'Lenovo', 'Apple', 'HP', 'G.Skill', 'Deepcool', 'Samsung', 'Logitech', 'HyperX', 'Hikvision', 'Microsoft', 'Kaspersky', 'KOORUI'
];

const rawProducts = [
  // 1. Desktop PCs
  {
    id: 'prod-desktop-101',
    name: 'TechCore Ultimate Ryzen 7 7800X3D RTX 4070 Ti Super Custom Rig',
    sku: 'PC-TC-7800X3D-4070TIS',
    brand: 'ASUS',
    category: 'Desktop PC',
    categorySlug: 'desktop',
    builderCategory: 'Desktop',
    price: 245000,
    discountPrice: 229900,
    stock: 5,
    images: ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop'],
    description: 'High-end custom gaming desktop featuring AMD Ryzen 7 7800X3D, RTX 4070 Ti Super 16GB, 32GB DDR5 RAM, 1TB NVMe Gen4 SSD, 850W Gold Modular PSU.',
    specifications: {
      processor: 'AMD Ryzen 7 7800X3D',
      graphics: 'NVIDIA RTX 4070 Ti Super 16GB',
      ram: '32GB DDR5 6000MHz',
      storage: '1TB NVMe M.2 SSD',
      psu: '850W 80+ Gold Fully Modular'
    },
    warranty: '3 Years Warranty',
    rating: 5.0,
    reviewsCount: 12,
    isFlashSale: true,
    flashSalePrice: 225000,
    tags: ['Desktop PC', 'Custom Rig', 'Ryzen 7', 'RTX 4070 Ti Super']
  },

  // 2. Processors
  {
    id: 'prod-101',
    name: 'AMD Ryzen 7 7800X3D Gaming Processor',
    sku: 'CPU-AMD-7800X3D',
    brand: 'AMD',
    category: 'Processor',
    categorySlug: 'processor',
    builderCategory: 'CPU',
    price: 48500,
    discountPrice: 44999,
    stock: 18,
    images: ['https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop'],
    description: 'The ultimate gaming processor featuring 8 Cores, 16 Threads, and 96MB L3 3D V-Cache technology.',
    specifications: {
      socket: 'AM5',
      cores: '8 Cores / 16 Threads',
      baseClock: '4.2 GHz',
      boostClock: '5.0 GHz',
      tdpWatts: 120
    },
    warranty: '3 Years',
    rating: 4.9,
    reviewsCount: 42,
    isFlashSale: true,
    flashSalePrice: 43500,
    tags: ['AM5', 'Ryzen 7', '7800X3D', 'AMD', 'Gaming CPU']
  },
  {
    id: 'prod-102',
    name: 'Intel Core i7-14700K 14th Gen Processor',
    sku: 'CPU-INT-14700K',
    brand: 'Intel',
    category: 'Processor',
    categorySlug: 'processor',
    builderCategory: 'CPU',
    price: 49000,
    discountPrice: 46500,
    stock: 12,
    images: ['https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop'],
    description: '20 Cores (8 P-cores + 12 E-cores) and 28 Threads delivering high speed gaming and heavy content creation performance.',
    specifications: {
      socket: 'LGA1700',
      cores: '20 Cores / 28 Threads',
      baseClock: '3.4 GHz',
      boostClock: '5.6 GHz'
    },
    warranty: '3 Years',
    rating: 4.8,
    reviewsCount: 29,
    isFlashSale: false,
    tags: ['LGA1700', 'Core i7', '14700K', 'Intel']
  },
  {
    id: 'prod-104',
    name: 'Intel Core i9-14900K 14th Gen Flagship Processor',
    sku: 'CPU-INT-14900K',
    brand: 'Intel',
    category: 'Processor',
    categorySlug: 'processor',
    builderCategory: 'CPU',
    price: 72000,
    discountPrice: 68500,
    stock: 8,
    images: ['https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop'],
    description: '24 Cores (8 P-cores + 16 E-cores) and 32 Threads with up to 6.0 GHz Thermal Velocity Boost.',
    specifications: {
      socket: 'LGA1700',
      cores: '24 Cores / 32 Threads',
      boostClock: '6.0 GHz'
    },
    warranty: '3 Years',
    rating: 5.0,
    reviewsCount: 19,
    isFlashSale: false,
    tags: ['Intel', 'Core i9', '14900K', 'LGA1700']
  },

  // 3. Laptops
  {
    id: 'prod-601',
    name: 'ASUS ROG Strix G16 Core i7 13th Gen RTX 4060 Gaming Laptop',
    sku: 'LAP-ASUS-ROG-G16',
    brand: 'ASUS',
    category: 'Laptops',
    categorySlug: 'laptop',
    price: 185000,
    discountPrice: 169900,
    stock: 8,
    images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop'],
    description: 'Intel Core i7-13650HX, 16GB DDR5 RAM, 1TB NVMe Gen4 SSD, RTX 4060 8GB GPU, 16" FHD+ 165Hz Display.',
    specifications: {
      processor: 'Intel Core i7-13650HX',
      ram: '16GB DDR5',
      storage: '1TB M.2 NVMe SSD',
      graphics: 'NVIDIA RTX 4060 8GB'
    },
    warranty: '2 Years International',
    rating: 4.9,
    reviewsCount: 22,
    isFlashSale: true,
    flashSalePrice: 165000,
    tags: ['Gaming Laptop', 'RTX 4060', 'Core i7', 'ASUS ROG']
  },
  {
    id: 'prod-603',
    name: 'Apple MacBook Air 15" M3 Chip 8GB 256GB SSD',
    sku: 'LAP-APL-MBA15-M3',
    brand: 'Apple',
    category: 'Laptops',
    categorySlug: 'laptop',
    price: 175000,
    discountPrice: 162000,
    stock: 10,
    images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop'],
    description: 'Apple M3 Chip with 8-Core CPU & 10-Core GPU, 15.3" Liquid Retina Display, 18-hour battery life.',
    specifications: {
      processor: 'Apple M3 Chip',
      ram: '8GB Unified Memory',
      storage: '256GB SSD',
      display: '15.3" Liquid Retina'
    },
    warranty: '1 Year Apple Official',
    rating: 4.9,
    reviewsCount: 34,
    isFlashSale: false,
    tags: ['MacBook Air 15', 'M3', 'Apple', 'Laptop']
  },
  {
    id: 'prod-604',
    name: 'ASUS TUF Gaming A15 Ryzen 7 7735HS RTX 4050 Laptop',
    sku: 'LAP-ASUS-TUF-A15',
    brand: 'ASUS',
    category: 'Laptops',
    categorySlug: 'laptop',
    price: 128000,
    discountPrice: 119900,
    stock: 14,
    images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop'],
    description: 'AMD Ryzen 7 7735HS Processor, 16GB DDR5 RAM, 512GB SSD, RTX 4050 6GB GPU, 15.6" 144Hz FHD Display.',
    specifications: {
      processor: 'AMD Ryzen 7 7735HS',
      ram: '16GB DDR5',
      storage: '512GB NVMe SSD',
      graphics: 'NVIDIA RTX 4050 6GB'
    },
    warranty: '2 Years Warranty',
    rating: 4.7,
    reviewsCount: 26,
    isFlashSale: true,
    flashSalePrice: 116500,
    tags: ['ASUS TUF', 'Ryzen 7', 'RTX 4050', 'Gaming Laptop']
  },
  {
    id: 'prod-605',
    name: 'Lenovo Legion Slim 5 Ryzen 7 7840HS RTX 4060 Laptop',
    sku: 'LAP-LEN-LEGION-SLIM5',
    brand: 'Lenovo',
    category: 'Laptops',
    categorySlug: 'laptop',
    price: 172000,
    discountPrice: 159000,
    stock: 7,
    images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop'],
    description: 'AMD Ryzen 7 7840HS, 16GB DDR5, 1TB SSD, RTX 4060 8GB, 16" WQXGA 165Hz IPS Display.',
    specifications: {
      processor: 'AMD Ryzen 7 7840HS',
      ram: '16GB DDR5',
      storage: '1TB Gen4 SSD',
      graphics: 'RTX 4060 8GB'
    },
    warranty: '2 Years Warranty',
    rating: 4.8,
    reviewsCount: 19,
    isFlashSale: false,
    tags: ['Legion Slim 5', 'Lenovo', 'RTX 4060', 'Laptop']
  },
  {
    id: 'prod-606',
    name: 'HP Victus 15 Core i5 13th Gen RTX 3050 Gaming Laptop',
    sku: 'LAP-HP-VICTUS-15',
    brand: 'HP',
    category: 'Laptops',
    categorySlug: 'laptop',
    price: 92000,
    discountPrice: 84900,
    stock: 15,
    images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop'],
    description: 'Intel Core i5-13420H, 8GB DDR4, 512GB NVMe SSD, RTX 3050 6GB GPU, 15.6" FHD 144Hz.',
    specifications: {
      processor: 'Intel Core i5-13420H',
      ram: '8GB DDR4',
      storage: '512GB SSD',
      graphics: 'RTX 3050 6GB'
    },
    warranty: '2 Years Warranty',
    rating: 4.6,
    reviewsCount: 31,
    isFlashSale: false,
    tags: ['HP Victus', 'Core i5', 'RTX 3050', 'Laptop']
  },

  // 4. Smartwatches & Wearables
  {
    id: 'prod-watch-101',
    name: 'Apple Watch Series 9 GPS 45mm Midnight Aluminum Case',
    sku: 'WCH-APL-S9-45',
    brand: 'Apple',
    category: 'Smartwatch',
    categorySlug: 'smartwatch',
    price: 54000,
    discountPrice: 48900,
    stock: 12,
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop'],
    description: 'S9 SiP chip, Double Tap gesture, Bright Always-On Retina display, ECG & Blood Oxygen monitoring.',
    specifications: {
      caseSize: '45mm',
      display: 'Always-On Retina OLED',
      chip: 'Apple S9 SiP',
      waterResistance: '50m Water Resistant'
    },
    warranty: '1 Year Apple Official',
    rating: 4.9,
    reviewsCount: 45,
    isFlashSale: true,
    flashSalePrice: 47500,
    tags: ['Apple Watch', 'Series 9', 'Smartwatch', 'Apple']
  },

  // 5. Earbuds & Audio
  {
    id: 'prod-earbuds-101',
    name: 'Apple AirPods Pro (2nd Generation) with USB-C MagSafe Case',
    sku: 'AUD-APL-AIRPODS-PRO2',
    brand: 'Apple',
    category: 'Earbuds & Audio',
    categorySlug: 'earbuds',
    price: 29500,
    discountPrice: 26900,
    stock: 20,
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop'],
    description: 'H2 Chip powered Active Noise Cancellation, Transparency Mode, Personalized Spatial Audio, USB-C MagSafe charging.',
    specifications: {
      chip: 'Apple H2 Chip',
      noiseCancellation: 'Active Noise Cancellation (ANC)',
      batteryLife: 'Up to 6 hours listening time',
      caseCharging: 'USB-C / MagSafe'
    },
    warranty: '1 Year Apple Official',
    rating: 4.9,
    reviewsCount: 62,
    isFlashSale: false,
    tags: ['AirPods Pro', 'Apple', 'Earbuds', 'ANC']
  },

  // 6. Accessories & Peripherals
  {
    id: 'prod-acc-101',
    name: 'HyperX QuadCast S RGB USB Condenser Gaming Microphone',
    sku: 'ACC-HYP-QUADCAST-S',
    brand: 'HyperX',
    category: 'Accessories & Peripherals',
    categorySlug: 'accessories',
    price: 18500,
    discountPrice: 16800,
    stock: 16,
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop'],
    description: 'Dynamic RGB lighting effects, Anti-vibration shock mount, Tap-to-mute sensor with LED indicator, 4 polar patterns.',
    specifications: {
      polarPatterns: 'Stereo, Omnidirectional, Cardioid, Bidirectional',
      sampleRate: '48kHz / 16-bit',
      lighting: 'Customizable RGB via NGENUITY'
    },
    warranty: '2 Years Warranty',
    rating: 4.8,
    reviewsCount: 38,
    isFlashSale: false,
    tags: ['HyperX', 'Microphone', 'Streaming', 'RGB']
  },
  {
    id: 'prod-acc-102',
    name: 'Logitech G PRO X SUPERLIGHT 2 Wireless Gaming Mouse',
    sku: 'ACC-LOG-SUPERLIGHT2',
    brand: 'Logitech',
    category: 'Accessories & Peripherals',
    categorySlug: 'accessories',
    price: 16500,
    discountPrice: 14900,
    stock: 22,
    images: ['https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop'],
    description: 'LIGHTFORCE hybrid switches, HERO 2 sensor up to 32,000 DPI, 60g ultra-lightweight design, 95 hours battery life.',
    specifications: {
      sensor: 'HERO 2 (32,000 DPI)',
      weight: '60 grams',
      batteryLife: '95 Hours',
      connectivity: 'LIGHTSPEED Wireless / USB-C'
    },
    warranty: '2 Years Warranty',
    rating: 5.0,
    reviewsCount: 51,
    isFlashSale: true,
    flashSalePrice: 14200,
    tags: ['Logitech G', 'Gaming Mouse', 'Wireless', 'SUPERLIGHT']
  },

  // 7. Security Cameras
  {
    id: 'prod-cam-101',
    name: 'Hikvision 2MP Outdoor PT Smart Wi-Fi IP Camera',
    sku: 'CAM-HIK-2MP-PT',
    brand: 'Hikvision',
    category: 'Security Camera',
    categorySlug: 'camera',
    price: 4800,
    discountPrice: 4200,
    stock: 25,
    images: ['https://images.unsplash.com/photo-1557862921-37829c790f19?w=600&auto=format&fit=crop'],
    description: '1080P Full HD, 360-degree Pan & Tilt rotation, Night Vision, Two-way Audio, Motion Detection, IP66 Weatherproof.',
    specifications: {
      resolution: '2MP (1920x1080)',
      nightVision: 'Up to 30 meters IR',
      storage: 'MicroSD slot up to 256GB',
      connectivity: 'Wi-Fi & RJ45 Ethernet'
    },
    warranty: '1 Year Warranty',
    rating: 4.7,
    reviewsCount: 29,
    isFlashSale: false,
    tags: ['Hikvision', 'Security Camera', 'WiFi Camera', 'IP Camera']
  },

  // 8. Software & OS
  {
    id: 'prod-soft-101',
    name: 'Microsoft Windows 11 Pro 64-bit Retail License Key',
    sku: 'SOFT-MS-WIN11-PRO',
    brand: 'Microsoft',
    category: 'Software & OS',
    categorySlug: 'software',
    price: 3500,
    discountPrice: 2800,
    stock: 50,
    images: ['https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&auto=format&fit=crop'],
    description: 'Official digital activation key for Windows 11 Pro 64-bit. Lifetime activation, BitLocker encryption, Remote Desktop.',
    specifications: {
      type: 'Retail Digital License Key',
      bitArchitecture: '64-bit',
      validity: 'Lifetime'
    },
    warranty: 'Digital Delivery & Instant Activation Guarantee',
    rating: 5.0,
    reviewsCount: 95,
    isFlashSale: true,
    flashSalePrice: 2490,
    tags: ['Windows 11', 'Microsoft', 'Software', 'OS']
  },
  {
    id: 'prod-soft-102',
    name: 'Kaspersky Total Security 1 User 1 Year License',
    sku: 'SOFT-KAS-TOTAL-1Y',
    brand: 'Kaspersky',
    category: 'Software & OS',
    categorySlug: 'software',
    price: 1200,
    discountPrice: 850,
    stock: 40,
    images: ['https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&auto=format&fit=crop'],
    description: 'Complete protection against viruses, malware, ransomware, identity theft, and online payment fraud.',
    specifications: {
      devices: '1 Device',
      duration: '1 Year Subscription',
      platform: 'Windows / Mac / Android'
    },
    warranty: '1 Year Official Key Guarantee',
    rating: 4.8,
    reviewsCount: 40,
    isFlashSale: false,
    tags: ['Kaspersky', 'Antivirus', 'Security', 'Software']
  },

  // 9. Gaming Monitors
  {
    id: 'prod-mon-101',
    name: 'KOORUI 24E4 24" FHD 165Hz 1ms Gaming Monitor',
    sku: 'MON-KOO-24E4-165',
    brand: 'KOORUI',
    category: 'Gaming Monitors',
    categorySlug: 'monitor',
    builderCategory: 'Monitor',
    price: 16500,
    discountPrice: 14800,
    stock: 18,
    images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop'],
    description: '24-inch Full HD (1920x1080), 165Hz Ultra-Fast Refresh Rate, 1ms MPRT, FreeSync & G-Sync Compatible, Frameless design.',
    specifications: {
      screenSize: '24 Inch',
      resolution: 'FHD (1920x1080)',
      refreshRate: '165Hz',
      panelType: 'VA Panel'
    },
    warranty: '3 Years Warranty',
    rating: 4.8,
    reviewsCount: 37,
    isFlashSale: true,
    flashSalePrice: 13990,
    tags: ['KOORUI', 'Gaming Monitor', '165Hz', 'Monitor']
  },
  {
    id: 'prod-mon-102',
    name: 'MSI MAG 323UPF 32" 4K UHD 160Hz Rapid IPS Gaming Monitor',
    sku: 'MON-MSI-323UPF-4K',
    brand: 'MSI',
    category: 'Gaming Monitors',
    categorySlug: 'monitor',
    builderCategory: 'Monitor',
    price: 98000,
    discountPrice: 91500,
    stock: 4,
    images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop'],
    description: '32-inch 4K UHD (3840x2160), 160Hz Refresh Rate, Rapid IPS 0.5ms GTG, VESA DisplayHDR 600, Type-C 90W PD.',
    specifications: {
      screenSize: '32 Inch',
      resolution: '4K UHD (3840x2160)',
      refreshRate: '160Hz',
      panelType: 'Rapid IPS'
    },
    warranty: '3 Years Warranty',
    rating: 5.0,
    reviewsCount: 14,
    isFlashSale: false,
    tags: ['MSI', '4K Monitor', '160Hz', 'Gaming Monitor']
  },

  // 10. Graphics Cards
  {
    id: 'prod-301',
    name: 'ASUS Dual GeForce RTX 4060 OC 8GB GDDR6',
    sku: 'GPU-ASUS-4060-8G',
    brand: 'ASUS',
    category: 'Graphics Card',
    categorySlug: 'gpu',
    builderCategory: 'GPU',
    price: 43500,
    discountPrice: 39999,
    stock: 15,
    images: ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop'],
    description: 'NVIDIA Ada Lovelace Architecture, DLSS 3, 3rd Gen Ray Tracing Cores, 8GB GDDR6 memory.',
    specifications: {
      gpuModel: 'RTX 4060',
      vram: '8GB GDDR6',
      recommendedPsu: '550W'
    },
    warranty: '3 Years',
    rating: 4.8,
    reviewsCount: 56,
    isFlashSale: true,
    flashSalePrice: 38999,
    tags: ['RTX 4060', 'NVIDIA', 'GPU', 'ASUS', 'DLSS 3']
  },
  {
    id: 'prod-304',
    name: 'Gigabyte GeForce RTX 4080 SUPER GAMING OC 16GB',
    sku: 'GPU-GIG-4080S-16G',
    brand: 'Gigabyte',
    category: 'Graphics Card',
    categorySlug: 'gpu',
    builderCategory: 'GPU',
    price: 145000,
    discountPrice: 138000,
    stock: 5,
    images: ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop'],
    description: '16GB GDDR6X 256-bit memory, WINDFORCE cooling system, RGB Fusion, Dual BIOS.',
    specifications: {
      gpuModel: 'RTX 4080 SUPER',
      vram: '16GB GDDR6X',
      recommendedPsu: '850W'
    },
    warranty: '3 Years Warranty',
    rating: 5.0,
    reviewsCount: 16,
    isFlashSale: false,
    tags: ['RTX 4080 SUPER', 'Gigabyte', 'GPU', '4K Gaming']
  },

  // 11. Motherboards
  {
    id: 'prod-201',
    name: 'ASUS TUF Gaming B650-PLUS WiFi AM5 Motherboard',
    sku: 'MB-ASUS-B650P',
    brand: 'ASUS',
    category: 'Motherboard',
    categorySlug: 'motherboard',
    builderCategory: 'Motherboard',
    price: 26500,
    discountPrice: 24900,
    stock: 14,
    images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop'],
    description: 'ATX motherboard with AM5 Socket, DDR5 support, PCIe 5.0 M.2 slot, WiFi 6, and robust 12+2 power stages.',
    specifications: {
      socket: 'AM5',
      ramType: 'DDR5',
      formFactor: 'ATX'
    },
    warranty: '3 Years',
    rating: 4.8,
    reviewsCount: 19,
    isFlashSale: true,
    flashSalePrice: 23900,
    tags: ['AM5', 'B650', 'DDR5', 'ASUS']
  },

  // 12. RAM
  {
    id: 'prod-401',
    name: 'Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz',
    sku: 'RAM-COR-32G-DDR5',
    brand: 'Corsair',
    category: 'RAM (Memory)',
    categorySlug: 'ram',
    builderCategory: 'RAM',
    price: 16500,
    discountPrice: 14900,
    stock: 22,
    images: ['https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop'],
    description: 'High-speed DDR5 memory module with dynamic ten-zone RGB lighting and Intel XMP 3.0 / AMD EXPO profiles.',
    specifications: {
      ramType: 'DDR5',
      capacity: '32GB (2x16GB)',
      speed: '6000MHz'
    },
    warranty: 'Lifetime Warranty',
    rating: 4.9,
    reviewsCount: 40,
    isFlashSale: true,
    flashSalePrice: 14200,
    tags: ['DDR5', '32GB', '6000MHz', 'Corsair']
  },

  // 13. Power Supply
  {
    id: 'prod-501',
    name: 'Corsair RM850x 850W 80 Plus Gold Fully Modular PSU',
    sku: 'PSU-COR-850W-GOLD',
    brand: 'Corsair',
    category: 'Power Supply',
    categorySlug: 'power-supply',
    builderCategory: 'PSU',
    price: 16500,
    discountPrice: 15200,
    stock: 14,
    images: ['https://images.unsplash.com/photo-1587202372616-b43abea06c2a?w=600&auto=format&fit=crop'],
    description: 'ATX 3.0 & PCIe 5.0 12VHPWR power supply with Low-Noise operation and 105°C Japanese Capacitors.',
    specifications: {
      wattage: 850,
      efficiencyRating: '80 Plus Gold',
      modularity: 'Full Modular'
    },
    warranty: '10 Years Warranty',
    rating: 4.9,
    reviewsCount: 28,
    isFlashSale: false,
    tags: ['850W', '80 Plus Gold', 'Corsair', 'PSU']
  },

  // 14. SSD / Storage
  {
    id: 'prod-701',
    name: 'Samsung 990 PRO 1TB PCIe 4.0 NVMe M.2 SSD',
    sku: 'SSD-SAM-990P-1TB',
    brand: 'Samsung',
    category: 'SSD / Storage',
    categorySlug: 'storage',
    builderCategory: 'SSD',
    price: 15500,
    discountPrice: 13900,
    stock: 28,
    images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop'],
    description: 'Blazing speed up to 7450 MB/s Read and 6900 MB/s Write speed with Samsung V-NAND 3-bit MLC.',
    specifications: {
      capacity: '1TB',
      interface: 'PCIe Gen 4.0 x4, NVMe 2.0',
      readSpeed: '7450 MB/s'
    },
    warranty: '5 Years',
    rating: 4.9,
    reviewsCount: 37,
    isFlashSale: true,
    flashSalePrice: 13200,
    tags: ['Samsung 990 PRO', '1TB SSD', 'NVMe']
  },

  // 15. CPU Cooler
  {
    id: 'prod-801',
    name: 'Deepcool AK620 Digital Performance Dual-Tower CPU Cooler',
    sku: 'CLR-DC-AK620-DIG',
    brand: 'Deepcool',
    category: 'CPU Cooler',
    categorySlug: 'cpu-cooler',
    builderCategory: 'CPU Cooler',
    price: 7800,
    discountPrice: 6900,
    stock: 18,
    images: ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop'],
    description: 'Dual-tower CPU cooler with real-time temperature display screen, 260W TDP cooling capacity.',
    specifications: {
      coolerType: 'Air Cooler',
      tdpCapacityWatts: 260
    },
    warranty: '3 Years',
    rating: 4.8,
    reviewsCount: 25,
    isFlashSale: false,
    tags: ['Deepcool', 'AK620', 'CPU Cooler']
  }
];

export const products = rawProducts.map(p => ({
  ...p,
  slug: p.slug || slugify(p.name),
  stockStatus: p.stockStatus || (p.stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'),
  emiAvailable: p.emiAvailable !== undefined ? p.emiAvailable : true
}));

export const sampleServiceRequests = [
  {
    id: 'SR-9001',
    customerName: 'Rahim Chowdhury',
    phone: '01711223344',
    productName: 'ASUS Dual RTX 4060 8GB',
    serialNumber: 'SN-ASUS4060-88412',
    problem: 'Display flickers under high gaming load.',
    status: 'In Diagnosis',
    technician: 'Rahim (Senior GPU Specialist)',
    createdAt: '2026-09-18'
  }
];

export const sampleSuppliers = [
  {
    id: 'sup-1',
    name: 'Global Tech Distribution Ltd.',
    contactPerson: 'Abul Kalam',
    phone: '01912345678',
    email: 'supply@globaltech.bd',
    totalPurchase: 1450000,
    dueAmount: 120000
  }
];
