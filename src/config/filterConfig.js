/**
 * Category-specific specifications filter whitelist and labels
 */
export const FILTER_CONFIG = {
  monitor: [
    { key: 'screenSize', label: 'Screen Size' },
    { key: 'resolution', label: 'Resolution' },
    { key: 'panelType', label: 'Panel Type' },
    { key: 'refreshRate', label: 'Refresh Rate' },
    { key: 'responseTime', label: 'Response Time' },
    { key: 'inputType', label: 'Input Type' },
    { key: 'features', label: 'Features' }
  ],
  processor: [
    { key: 'socket', label: 'Socket' },
    { key: 'series', label: 'Series' },
    { key: 'cores', label: 'Cores' }
  ],
  gpu: [
    { key: 'chipset', label: 'Chipset' },
    { key: 'memory', label: 'Memory' }
  ],
  ram: [
    { key: 'type', label: 'Memory Type' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'speed', label: 'Speed' }
  ],
  laptop: [
    { key: 'processor', label: 'Processor' },
    { key: 'ram', label: 'RAM' },
    { key: 'storage', label: 'Storage' },
    { key: 'displaySize', label: 'Display Size' }
  ],
  desktop: [
    { key: 'processor', label: 'Processor' },
    { key: 'ram', label: 'RAM' },
    { key: 'storage', label: 'Storage' },
    { key: 'graphics', label: 'Graphics Card' }
  ],
  storage: [
    { key: 'type', label: 'Storage Type' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'formFactor', label: 'Form Factor' },
    { key: 'interface', label: 'Interface' }
  ],
  'power-supply': [
    { key: 'wattage', label: 'Wattage' },
    { key: 'efficiencyRating', label: 'Efficiency Rating' },
    { key: 'modular', label: 'Modular Type' }
  ],
  casing: [
    { key: 'formFactor', label: 'Form Factor' },
    { key: 'sidePanel', label: 'Side Panel' },
    { key: 'color', label: 'Color' }
  ],
  'cpu-cooler': [
    { key: 'coolerType', label: 'Cooler Type' },
    { key: 'fanSpeed', label: 'Fan Speed' },
    { key: 'socketSupport', label: 'Socket Support' }
  ]
};

// Aliases to map various slug representations to the config keys
const CATEGORY_CONFIG_ALIASES = {
  monitors: 'monitor',
  'gaming-monitor': 'monitor',
  '4k-monitor': 'monitor',
  processors: 'processor',
  cpu: 'processor',
  'intel-processor': 'processor',
  'amd-processor': 'processor',
  'graphics-card': 'gpu',
  'graphics-cards': 'gpu',
  gpus: 'gpu',
  memory: 'ram',
  laptops: 'laptop',
  'gaming-laptop': 'laptop',
  ultrabook: 'laptop',
  desktops: 'desktop',
  'desktop-pc': 'desktop',
  'gaming-pc': 'desktop',
  'brand-pc': 'desktop',
  psu: 'power-supply',
  ssd: 'storage',
  hdd: 'storage',
  case: 'casing',
  cooler: 'cpu-cooler'
};

/**
 * Returns the spec filter configuration list for a given category slug or path.
 * Checks exact match, aliases, and segments of a hierarchical path.
 *
 * @param {string} categoryKey - Slug, path, or key
 * @returns {Array<{key: string, label: string}>}
 */
export function getCategoryFilterConfig(categoryKey) {
  if (!categoryKey || typeof categoryKey !== 'string') return [];

  const normalized = categoryKey.toLowerCase().trim();

  // 1. Direct match
  if (FILTER_CONFIG[normalized]) {
    return FILTER_CONFIG[normalized];
  }

  // 2. Direct alias match
  const alias = CATEGORY_CONFIG_ALIASES[normalized];
  if (alias && FILTER_CONFIG[alias]) {
    return FILTER_CONFIG[alias];
  }

  // 3. Segment match in path (e.g. "components/processor/intel-processor" -> "processor")
  const segments = normalized.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (FILTER_CONFIG[seg]) {
      return FILTER_CONFIG[seg];
    }
    const segAlias = CATEGORY_CONFIG_ALIASES[seg];
    if (segAlias && FILTER_CONFIG[segAlias]) {
      return FILTER_CONFIG[segAlias];
    }
  }

  return [];
}
