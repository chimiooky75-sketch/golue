import { MapZone, ZoneSubmission, SubmissionStatus } from '../types';

// Initial Hardcoded Data for Multiple Cities
const INITIAL_ZONES: MapZone[] = [
  // 厦门
  { id: 'xm1', city: '厦门', name: '第八菜市场 (八市)', type: 'GREEN', description: '老厦门人的海鲜市场，价格相对公道，但也需注意称重。', coordinates: { x: 30, y: 55 } },
  { id: 'xm2', city: '厦门', name: '曾厝垵海鲜街', type: 'RED', description: '高风险区域。多为网红店，价格虚高，主要针对游客。', coordinates: { x: 60, y: 70 } },
  { id: 'xm3', city: '厦门', name: '鼓浪屿餐厅', type: 'RED', description: '岛上餐饮普遍较贵且口味一般，建议只吃小吃，正餐回岛内吃。', coordinates: { x: 20, y: 65 } },
  { id: 'xm4', city: '厦门', name: '沙坡尾', type: 'GREEN', description: '文艺聚集地，明码标价的店较多，但单价稍高。', coordinates: { x: 35, y: 75 } },
  { id: 'xm5', city: '厦门', name: '出租车推荐店', type: 'RED', description: '千万别去！司机通常有回扣，价格极高且海鲜往往被调包。', coordinates: { x: 50, y: 40 } },
  
  // 三亚
  { id: 'sy1', city: '三亚', name: '第一市场', type: 'GREEN', description: '自己买海鲜找加工店，相对靠谱，但要在市场内多比价。', coordinates: { x: 45, y: 50 } },
  { id: 'sy2', city: '三亚', name: '某某湾拉客大排档', type: 'RED', description: '路边拉客的热情小妹带去的店，通常阴阳菜单，慎入。', coordinates: { x: 70, y: 30 } },
  
  // 丽江
  { id: 'lj1', city: '丽江', name: '忠义市场', type: 'GREEN', description: '本地人买菜的地方，水果和菌子价格真实。', coordinates: { x: 30, y: 40 } },
  { id: 'lj2', city: '丽江', name: '茶马古道骑马', type: 'RED', description: '低价团费陷阱，上马后中途加价，不给钱不让走。', coordinates: { x: 60, y: 20 } },
  
  // 青岛
  { id: 'qd1', city: '青岛', name: '登州路啤酒街', type: 'RED', description: '部分店铺存在隐形消费，点菜前务必确认是“按只”还是“按盘”。', coordinates: { x: 55, y: 45 } },
  { id: 'qd2', city: '青岛', name: '营口路市场', type: 'GREEN', description: '啤酒屋加工模式发源地，氛围好，价格透明。', coordinates: { x: 40, y: 60 } },

  // 长沙
  { id: 'cs1', city: '长沙', name: '黄兴步行街切糕', type: 'RED', description: '传统避雷点，虽然整治过，但仍需警惕流动摊贩的模糊报价。', coordinates: { x: 50, y: 50 } },
  { id: 'cs2', city: '长沙', name: '冬瓜山', type: 'GREEN', description: '夜宵聚集地，香肠和炸炸炸很地道。', coordinates: { x: 45, y: 65 } },

  // 成都
  { id: 'cd1', city: '成都', name: '宽窄巷子采耳', type: 'RED', description: '景区内价格虚高，技术参差不齐，建议去老社区体验。', coordinates: { x: 40, y: 40 } },
  { id: 'cd2', city: '成都', name: '建设路小吃', type: 'GREEN', description: '虽然排队久，但价格亲民，味道正宗。', coordinates: { x: 60, y: 55 } },
];

const STORAGE_KEY_SUBMISSIONS = 'travel_minesweeper_submissions_v2';

// Helper to get local storage data
const getStoredSubmissions = (): ZoneSubmission[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveSubmissions = (submissions: ZoneSubmission[]) => {
  localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
};

export const zoneService = {
  // Get all active zones (Hardcoded + Approved User Submissions)
  getActiveZones: (): MapZone[] => {
    const submissions = getStoredSubmissions();
    const approvedZones: MapZone[] = submissions
      .filter(s => s.status === 'APPROVED' && s.coordinates)
      .map(s => ({
        id: s.id,
        name: s.name,
        city: s.city || '厦门', // Fallback for old data
        type: s.type,
        description: s.description,
        coordinates: s.coordinates!,
        isUserGenerated: true
      }));
    
    return [...INITIAL_ZONES, ...approvedZones];
  },

  // Get pending submissions for moderation
  getPendingSubmissions: (): ZoneSubmission[] => {
    return getStoredSubmissions().filter(s => s.status === 'PENDING').sort((a, b) => b.submittedAt - a.submittedAt);
  },

  // Submit a new zone
  submitZone: (zone: Omit<ZoneSubmission, 'id' | 'status' | 'submittedAt'>): void => {
    const submissions = getStoredSubmissions();
    const newSubmission: ZoneSubmission = {
      ...zone,
      id: `sub_${Date.now()}`,
      status: 'PENDING',
      submittedAt: Date.now()
    };
    submissions.push(newSubmission);
    saveSubmissions(submissions);
  },

  // Moderate a submission
  moderateSubmission: (id: string, action: 'APPROVE' | 'REJECT'): void => {
    const submissions = getStoredSubmissions();
    const index = submissions.findIndex(s => s.id === id);
    if (index !== -1) {
      submissions[index].status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      saveSubmissions(submissions);
    }
  },
  
  // Clear all data (debug utility)
  resetData: () => {
    localStorage.removeItem(STORAGE_KEY_SUBMISSIONS);
  }
};