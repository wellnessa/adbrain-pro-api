import { cors, handleOptions, requireToken } from '../../_lib/middleware.js';
import metaApi from '../../_lib/meta-api.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const accessToken = requireToken(req, res);
  if (!accessToken) return;

  const { adAccountId, date_preset = 'last_30d' } = req.query;
  const cleanId = adAccountId.replace('act_', '');

  try {
    // Buscar todos os breakdowns em paralelo
    const [ageGenderData, deviceData, placementData] = await Promise.all([
      metaApi.getAgeGenderBreakdown(accessToken, cleanId, date_preset),
      metaApi.getDeviceBreakdown(accessToken, cleanId, date_preset),
      metaApi.getPlacementBreakdown(accessToken, cleanId, date_preset)
    ]);

    // Processar idade e gênero
    const ageGender = processAgeGenderBreakdown(ageGenderData);
    
    // Processar dispositivos
    const devices = processDeviceBreakdown(deviceData);
    
    // Processar posicionamentos
    const placements = processPlacementBreakdown(placementData);

    return res.status(200).json({
      success: true,
      breakdown: {
        ageGender,
        devices,
        placements
      },
      datePreset: date_preset
    });
  } catch (error) {
    console.error('Erro ao buscar breakdown:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

function processAgeGenderBreakdown(data) {
  if (data.error || !data.data) {
    return { byAge: [], byGender: [], combined: [] };
  }

  const byAge = {};
  const byGender = { male: { spend: 0, conversions: 0 }, female: { spend: 0, conversions: 0 }, unknown: { spend: 0, conversions: 0 } };
  const combined = [];

  data.data.forEach(item => {
    const age = item.age;
    const gender = item.gender;
    const spend = parseFloat(item.spend || 0);
    const conversions = extractConversions(item.actions);
    const cpa = conversions > 0 ? spend / conversions : 0;

    // Agregar por idade
    if (!byAge[age]) {
      byAge[age] = { age, spend: 0, conversions: 0 };
    }
    byAge[age].spend += spend;
    byAge[age].conversions += conversions;

    // Agregar por gênero
    if (gender === 'male') {
      byGender.male.spend += spend;
      byGender.male.conversions += conversions;
    } else if (gender === 'female') {
      byGender.female.spend += spend;
      byGender.female.conversions += conversions;
    } else {
      byGender.unknown.spend += spend;
      byGender.unknown.conversions += conversions;
    }

    // Combinado
    combined.push({
      age,
      gender,
      genderLabel: gender === 'male' ? 'Masculino' : gender === 'female' ? 'Feminino' : 'Outro',
      spend: parseFloat(spend.toFixed(2)),
      conversions,
      cpa: parseFloat(cpa.toFixed(2))
    });
  });

  // Calcular CPA por idade
  const ageArray = Object.values(byAge).map(item => ({
    ...item,
    spend: parseFloat(item.spend.toFixed(2)),
    cpa: item.conversions > 0 ? parseFloat((item.spend / item.conversions).toFixed(2)) : 0
  })).sort((a, b) => a.age.localeCompare(b.age));

  // Calcular CPA por gênero
  const genderArray = [
    {
      gender: 'male',
      label: 'Masculino',
      spend: parseFloat(byGender.male.spend.toFixed(2)),
      conversions: byGender.male.conversions,
      cpa: byGender.male.conversions > 0 ? parseFloat((byGender.male.spend / byGender.male.conversions).toFixed(2)) : 0
    },
    {
      gender: 'female',
      label: 'Feminino',
      spend: parseFloat(byGender.female.spend.toFixed(2)),
      conversions: byGender.female.conversions,
      cpa: byGender.female.conversions > 0 ? parseFloat((byGender.female.spend / byGender.female.conversions).toFixed(2)) : 0
    }
  ];

  return {
    byAge: ageArray,
    byGender: genderArray,
    combined: combined.sort((a, b) => a.cpa - b.cpa).slice(0, 20) // Top 20 combinações
  };
}

function processDeviceBreakdown(data) {
  if (data.error || !data.data) {
    return [];
  }

  return data.data.map(item => {
    const spend = parseFloat(item.spend || 0);
    const conversions = extractConversions(item.actions);
    const cpa = conversions > 0 ? spend / conversions : 0;

    return {
      device: item.device_platform,
      deviceLabel: getDeviceLabel(item.device_platform),
      spend: parseFloat(spend.toFixed(2)),
      conversions,
      cpa: parseFloat(cpa.toFixed(2)),
      impressions: parseInt(item.impressions || 0),
      clicks: parseInt(item.clicks || 0)
    };
  }).sort((a, b) => b.conversions - a.conversions);
}

function processPlacementBreakdown(data) {
  if (data.error || !data.data) {
    return [];
  }

  return data.data.map(item => {
    const spend = parseFloat(item.spend || 0);
    const conversions = extractConversions(item.actions);
    const cpa = conversions > 0 ? spend / conversions : 0;

    return {
      platform: item.publisher_platform,
      position: item.platform_position,
      label: `${getPlacementLabel(item.publisher_platform)} - ${getPositionLabel(item.platform_position)}`,
      spend: parseFloat(spend.toFixed(2)),
      conversions,
      cpa: parseFloat(cpa.toFixed(2)),
      impressions: parseInt(item.impressions || 0),
      clicks: parseInt(item.clicks || 0)
    };
  }).sort((a, b) => b.conversions - a.conversions);
}

function extractConversions(actions) {
  if (!actions) return 0;
  const conversionTypes = ['purchase', 'omni_purchase', 'lead', 'onsite_conversion.lead_grouped'];
  for (const type of conversionTypes) {
    const action = actions.find(a => a.action_type === type);
    if (action) return parseInt(action.value || 0);
  }
  return 0;
}

function getDeviceLabel(device) {
  const labels = {
    'mobile_app': 'App Mobile',
    'mobile_web': 'Mobile Web',
    'desktop': 'Desktop',
    'mobile': 'Mobile',
    'tablet': 'Tablet'
  };
  return labels[device] || device;
}

function getPlacementLabel(platform) {
  const labels = {
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'messenger': 'Messenger',
    'audience_network': 'Audience Network'
  };
  return labels[platform] || platform;
}

function getPositionLabel(position) {
  const labels = {
    'feed': 'Feed',
    'story': 'Stories',
    'reels': 'Reels',
    'explore': 'Explorar',
    'search': 'Busca',
    'marketplace': 'Marketplace',
    'video_feeds': 'Vídeos',
    'right_hand_column': 'Coluna Direita',
    'instant_article': 'Artigos',
    'instream_video': 'In-Stream',
    'an_classic': 'Audience Network'
  };
  return labels[position] || position;
}
