import { SystemConfig } from '@/api/entities';

const CONFIG_KEY = 'platform_config';

// Default platforms with their custom fields
export const DEFAULT_PLATFORMS = [
  {
    id: 'vercel',
    name: 'Vercel',
    icon: 'server',
    color: 'bg-black text-white',
    enabled: true,
    fields: [
      { key: 'platform_url', label: 'Vercel URL', placeholder: 'https://project.vercel.app', type: 'url' },
      { key: 'platform_project_id', label: 'Vercel Project ID', placeholder: 'prj_xxxxxxxx', type: 'text' },
      { key: 'platform_public_code', label: 'קוד ציבורי (Public)', placeholder: 'https://vercel.com/...', type: 'url' },
    ],
  },
  {
    id: 'streamlit',
    name: 'Streamlit',
    icon: 'bar-chart',
    color: 'bg-red-500 text-white',
    enabled: true,
    fields: [
      { key: 'platform_url', label: 'Streamlit URL', placeholder: 'https://app-name.streamlit.app', type: 'url' },
      { key: 'platform_app_id', label: 'Streamlit App ID', placeholder: 'app_xxxxxxxx', type: 'text' },
    ],
  },
  {
    id: 'netlify',
    name: 'Netlify',
    icon: 'globe',
    color: 'bg-teal-500 text-white',
    enabled: false,
    fields: [
      { key: 'platform_url', label: 'Netlify URL', placeholder: 'https://project.netlify.app', type: 'url' },
      { key: 'platform_site_id', label: 'Netlify Site ID', placeholder: 'xxxxxxxx-xxxx-xxxx', type: 'text' },
    ],
  },
  {
    id: 'railway',
    name: 'Railway',
    icon: 'train-front',
    color: 'bg-purple-600 text-white',
    enabled: false,
    fields: [
      { key: 'platform_url', label: 'Railway URL', placeholder: 'https://project.up.railway.app', type: 'url' },
    ],
  },
  {
    id: 'custom',
    name: 'שרת עצמאי',
    icon: 'hard-drive',
    color: 'bg-gray-600 text-white',
    enabled: true,
    fields: [
      { key: 'platform_url', label: 'Server URL', placeholder: 'https://...', type: 'url' },
      { key: 'platform_ssh', label: 'SSH Access', placeholder: 'user@server.com', type: 'text' },
    ],
  },
];

export async function loadPlatformConfig() {
  try {
    const configs = await SystemConfig.list(null, 50);
    const config = configs.find(c => c.config_key === CONFIG_KEY);
    if (config && config.data?.platforms) {
      return { platforms: config.data.platforms, configId: config.id };
    }
    const newConfig = await SystemConfig.create({
      config_key: CONFIG_KEY,
      data: { platforms: DEFAULT_PLATFORMS },
    });
    return { platforms: DEFAULT_PLATFORMS, configId: newConfig.id };
  } catch (err) {
    console.error('Error loading platform config:', err);
    return { platforms: DEFAULT_PLATFORMS, configId: null };
  }
}

export async function savePlatformConfig(configId, platforms) {
  try {
    if (configId) {
      await SystemConfig.update(configId, { data: { platforms } });
    } else {
      const newConfig = await SystemConfig.create({
        config_key: CONFIG_KEY,
        data: { platforms },
      });
      return newConfig.id;
    }
    return configId;
  } catch (err) {
    console.error('Error saving platform config:', err);
    throw err;
  }
}
