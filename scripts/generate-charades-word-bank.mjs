import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const OUTPUT_FILE = path.join(ROOT_DIR, "src/room/games/charades-word-bank.ts");
const REPORT_FILE = path.join(ROOT_DIR, "CHARADES_WORD_BANK_V1.md");

const TARGET = {
  challenge: 200,
  daily: 400,
  popular: 400,
};

const SOURCE = {
  thuoclAnimal:
    "https://raw.githubusercontent.com/thunlp/THUOCL/a30ce79d895d01ab5132a5c74c29703ff7efb4cc/data/THUOCL_animal.txt",
  thuoclCar: "https://raw.githubusercontent.com/thunlp/THUOCL/a30ce79d895d01ab5132a5c74c29703ff7efb4cc/data/THUOCL_car.txt",
  thuoclChengyu:
    "https://raw.githubusercontent.com/thunlp/THUOCL/a30ce79d895d01ab5132a5c74c29703ff7efb4cc/data/THUOCL_chengyu.txt",
  thuoclFood: "https://raw.githubusercontent.com/thunlp/THUOCL/a30ce79d895d01ab5132a5c74c29703ff7efb4cc/data/THUOCL_food.txt",
  thuoclIt: "https://raw.githubusercontent.com/thunlp/THUOCL/a30ce79d895d01ab5132a5c74c29703ff7efb4cc/data/THUOCL_IT.txt",
  wikiCn:
    "https://zh.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&titles=%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86%E7%BD%91%E7%BB%9C%E7%94%A8%E8%AF%AD%E5%88%97%E8%A1%A8&explaintext=1&exsectionformat=plain",
  xinhuaIdiom:
    "https://raw.githubusercontent.com/pwxcoo/chinese-xinhua/fe6d6c2e8baa82187f4c96bbe042e43f96c05666/data/idiom.json",
};

const MANUAL_DAILY_WORDS = [
  "牙刷",
  "牙膏",
  "毛巾",
  "脸盆",
  "香皂",
  "洗发水",
  "沐浴露",
  "拖鞋",
  "雨伞",
  "水杯",
  "保温杯",
  "饭碗",
  "筷子",
  "勺子",
  "叉子",
  "盘子",
  "锅盖",
  "平底锅",
  "电饭煲",
  "微波炉",
  "冰箱",
  "空调",
  "风扇",
  "台灯",
  "手电筒",
  "充电器",
  "插线板",
  "电脑",
  "键盘",
  "鼠标",
  "耳机",
  "音箱",
  "手机",
  "平板",
  "相机",
  "书包",
  "背包",
  "行李箱",
  "钱包",
  "钥匙",
  "门锁",
  "窗帘",
  "床单",
  "枕头",
  "被子",
  "沙发",
  "桌子",
  "椅子",
  "衣架",
  "洗衣机",
  "烘干机",
  "吹风机",
  "剃须刀",
  "镜子",
  "梳子",
  "剪刀",
  "胶水",
  "橡皮",
  "铅笔",
  "圆珠笔",
  "钢笔",
  "尺子",
  "本子",
  "便签",
  "书签",
  "日历",
  "闹钟",
  "手表",
  "眼镜",
  "太阳镜",
  "口罩",
  "帽子",
  "围巾",
  "手套",
  "袜子",
  "外套",
  "衬衫",
  "短袖",
  "牛仔裤",
  "运动鞋",
  "拖把",
  "扫把",
  "簸箕",
  "垃圾桶",
  "纸巾",
  "湿巾",
  "洗洁精",
  "抹布",
  "海绵",
  "花瓶",
  "绿萝",
  "仙人掌",
  "盆栽",
  "地毯",
  "门铃",
  "遥控器",
  "投影仪",
  "路由器",
  "电池",
  "灯泡",
  "茶壶",
  "茶杯",
  "咖啡杯",
  "奶茶",
  "果汁",
  "矿泉水",
  "饼干",
  "薯片",
  "蛋挞",
  "面条",
  "米饭",
  "鸡蛋",
  "番茄",
  "黄瓜",
  "土豆",
  "白菜",
  "胡萝卜",
  "苹果",
  "香蕉",
  "西瓜",
  "草莓",
  "葡萄",
  "橙子",
  "芒果",
  "菠萝",
  "火锅",
  "炒饭",
  "包子",
  "馒头",
  "饺子",
  "馄饨",
  "披萨",
  "汉堡",
  "寿司",
  "烤鸭",
  "牛排",
  "煎饼",
  "麻辣烫",
  "烤串",
  "奶酪",
  "酸奶",
  "冰淇淋",
  "巧克力",
  "蛋糕",
  "月饼",
  "粽子",
  "年糕",
  "汤圆",
  "芝麻糊",
  "豆浆",
  "油条",
  "豆腐",
  "花生",
  "核桃",
  "瓜子",
  "开心果",
  "榴莲",
  "荔枝",
  "樱桃",
  "柚子",
  "柠檬",
  "火龙果",
  "牛油果",
];

const MANUAL_POPULAR_WORDS = [
  "内卷",
  "躺平",
  "破防",
  "上头",
  "下头",
  "拿捏",
  "整活",
  "摆烂",
  "冲浪",
  "吃瓜",
  "热搜",
  "塌房",
  "翻车",
  "爆改",
  "神仙",
  "高能",
  "卡点",
  "打卡",
  "种草",
  "拔草",
  "安利",
  "同款",
  "盲盒",
  "开箱",
  "测评",
  "带货",
  "秒杀",
  "拼单",
  "预售",
  "尾款",
  "下单",
  "补货",
  "断货",
  "真香",
  "离谱",
  "逆天",
  "无语",
  "泪目",
  "感动",
  "治愈",
  "氛围感",
  "松弛感",
  "仪式感",
  "情绪价值",
  "社恐",
  "社牛",
  "显眼包",
  "电子榨菜",
  "云旅游",
  "云健身",
  "云办公",
  "打工人",
  "工具人",
  "尾款人",
  "搬砖",
  "摸鱼",
  "卷王",
  "躺赢",
  "天花板",
  "地板价",
  "人设",
  "路人缘",
  "反差感",
  "拉满",
  "回旋镖",
  "嘴替",
  "发疯",
  "续命",
  "回血",
  "满血",
  "空耳",
  "梦幻联动",
  "二创",
  "改编",
  "混剪",
  "转场",
  "高清",
  "超清",
  "弹幕",
  "关注",
  "点赞",
  "收藏",
  "转发",
  "私信",
  "同频",
  "共鸣",
  "代入感",
  "沉浸式",
  "碎片化",
  "信息差",
  "新手村",
  "赛道",
  "风口",
  "闭环",
  "增量",
  "存量",
  "复盘",
  "对齐",
  "拆解",
  "方案",
  "需求",
  "排期",
  "上线",
  "回滚",
  "降级",
  "并发",
  "延迟",
  "卡顿",
  "闪退",
  "兼容",
  "修复",
  "优化",
  "迭代",
  "版本",
  "热更新",
  "缓存",
  "日志",
  "告警",
  "容灾",
  "备份",
  "恢复",
  "网络波动",
  "负载均衡",
  "自动化",
  "可视化",
  "数据看板",
  "推荐算法",
  "模型训练",
  "算力",
  "深度学习",
  "机器学习",
  "人工智能",
  "大模型",
  "提示词",
  "数据标注",
  "多模态",
  "语音识别",
  "图像识别",
  "文本生成",
  "智能助手",
  "在线协作",
  "知识库",
  "搜索引擎",
  "云存储",
  "云服务",
  "开源社区",
  "开发者",
  "产品经理",
  "设计师",
  "程序员",
  "测试工程师",
  "运维工程师",
  "前端开发",
  "后端开发",
  "全栈开发",
  "用户体验",
  "交互设计",
  "视觉设计",
  "信息架构",
];

const SAFE_WIKI_TERMS = new Set([
  "不明觉厉",
  "然并卵",
  "画美不看",
  "人艰不拆",
  "累觉不爱",
  "爷青结",
  "十动然拒",
  "蓝瘦香菇",
  "网红",
  "剁手党",
  "脑洞大开",
  "油腻",
  "高富帅",
  "粉丝",
  "飞友",
  "内卷",
  "躺平",
  "精神小伙",
  "主理人",
  "搭子",
  "工具人",
  "打工人",
  "秒杀",
  "尾款",
  "拼单",
  "补货",
  "断货",
  "带货",
  "种草",
  "拔草",
  "真香",
  "治愈",
  "自律",
  "打卡",
  "沉浸式",
  "碎片化",
  "云办公",
  "云旅游",
  "氛围感",
  "情绪价值",
]);

const BLOCKED_SUBSTRINGS = [
  "你妈",
  "妈死",
  "傻逼",
  "鸡巴",
  "屌",
  "妓",
  "色情",
  "淫",
  "自杀",
  "恐袭",
  "纳粹",
  "法轮",
  "台独",
  "港独",
  "疆独",
  "总书记",
  "共产党",
  "国民党",
  "主席",
  "总理",
  "总统",
  "政府",
  "公安",
  "法院",
  "监狱",
  "政法",
  "武警",
  "解放军",
  "香港",
  "台湾",
  "中国北方",
  "大陆北方",
];

const BLOCKED_SUFFIXES = [
  "公司",
  "集团",
  "大学",
  "学院",
  "政府",
  "法院",
  "公安局",
  "委员会",
  "办公室",
  "派出所",
];

const TEMPLATE_PATTERNS = [
  /^(温柔|热闹|未来|冰冰凉|随意|古老)/,
  /^[\u4e00-\u9fff]{1,4}和[\u4e00-\u9fff]{1,4}$/,
  /^[\u4e00-\u9fff]{1,4}用的[\u4e00-\u9fff]{1,4}$/,
  /^[\u4e00-\u9fff]{1,4}时[\u4e00-\u9fff]{1,4}$/,
];

function runCurl(url) {
  return execFileSync(
    "curl",
    [
      "-L",
      "-sS",
      "--retry",
      "3",
      "--retry-delay",
      "1",
      "--retry-all-errors",
      "--max-time",
      "60",
      url,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 80,
    },
  );
}

async function fetchText(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return runCurl(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`拉取失败: ${url}\n${String(lastError)}`);
}

function cleanWord(raw) {
  return String(raw).replace(/^\uFEFF/, "").replace(/[·•．.]/g, "").replace(/\s+/g, "").trim();
}

function hasBlockedSuffix(word) {
  return BLOCKED_SUFFIXES.some((suffix) => word.endsWith(suffix));
}

function isSafeWord(word) {
  if (!/^[\u4e00-\u9fff]{2,8}$/.test(word)) {
    return false;
  }

  if (TEMPLATE_PATTERNS.some((pattern) => pattern.test(word))) {
    return false;
  }

  if (BLOCKED_SUBSTRINGS.some((part) => word.includes(part))) {
    return false;
  }

  if (hasBlockedSuffix(word)) {
    return false;
  }

  return true;
}

function parseThuocl(text) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawWord, rawFreq] = line.split(/\s+/g);
      const word = cleanWord(rawWord);
      const frequency = Number(rawFreq ?? 0);
      return {
        frequency: Number.isFinite(frequency) ? frequency : 0,
        word,
      };
    });
}

function parseWikiTerms(text) {
  const data = JSON.parse(text);
  const page = data.query.pages[Object.keys(data.query.pages)[0]];
  const extract = page.extract ?? "";
  const terms = [];

  for (const line of extract.split(/\n+/g)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const index = Math.max(trimmed.indexOf("："), trimmed.indexOf(":"));

    if (index <= 0) {
      continue;
    }

    const head = trimmed.slice(0, index).replace(/[「」“”'"\s（）()【】\[\]]/g, "");
    const pieces = head.split(/[、，,;；/]/g);

    for (const piece of pieces) {
      const word = cleanWord(piece);

      if (!word) {
        continue;
      }

      terms.push(word);
    }
  }

  return terms;
}

function parseXinhuaIdioms(text) {
  const raw = JSON.parse(text);

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => cleanWord(item.word ?? ""));
}

function toPoolWords(pool, options = {}) {
  const {
    minLength = 2,
    safeOnly = true,
  } = options;

  return pool
    .map((item) => cleanWord(item.word))
    .filter(Boolean)
    .filter((word) => word.length >= minLength)
    .filter((word) => (safeOnly ? isSafeWord(word) : true));
}

function toSimplePoolWords(words, options = {}) {
  const {
    minLength = 2,
    safeOnly = true,
  } = options;

  return words
    .map((word) => cleanWord(word))
    .filter(Boolean)
    .filter((word) => word.length >= minLength)
    .filter((word) => (safeOnly ? isSafeWord(word) : true));
}

function pushEntries(target, used, words, options) {
  const {
    category,
    difficultyFn,
    limit,
    maxLength = 8,
    minLength = 2,
  } = options;

  for (const word of words) {
    if (target.length >= limit) {
      break;
    }

    if (used.has(word)) {
      continue;
    }

    if (word.length < minLength || word.length > maxLength) {
      continue;
    }

    target.push({
      category,
      difficulty: difficultyFn(target.length),
      word,
    });
    used.add(word);
  }
}

function ensureCount(name, words, expected) {
  if (words.length !== expected) {
    throw new Error(`${name} 数量不正确: ${words.length}/${expected}`);
  }
}

function buildWordBank({
  animalPool,
  carPool,
  chengyuPool,
  foodPool,
  idiomPool,
  itPool,
  wikiPool,
}) {
  const used = new Set();
  const daily = [];
  const popular = [];
  const challenge = [];

  const filteredWikiPool = wikiPool.filter((word) => SAFE_WIKI_TERMS.has(word));

  pushEntries(daily, used, toSimplePoolWords(MANUAL_DAILY_WORDS), {
    category: "日常",
    difficultyFn: (index) => (index < 110 ? "easy" : "medium"),
    limit: 150,
    maxLength: 6,
  });
  pushEntries(
    daily,
    used,
    toPoolWords(animalPool.filter((item) => item.frequency >= 3000), {
      minLength: 2,
    }),
    {
      category: "动物",
      difficultyFn: (index) => (index < 90 ? "easy" : "medium"),
      limit: 280,
      maxLength: 6,
    },
  );
  pushEntries(
    daily,
    used,
    toPoolWords(foodPool.filter((item) => item.frequency >= 6000), {
      minLength: 2,
    }),
    {
      category: "食物",
      difficultyFn: (index) => (index < 70 ? "easy" : "medium"),
      limit: 400,
      maxLength: 6,
    },
  );
  pushEntries(
    daily,
    used,
    toPoolWords(carPool.filter((item) => item.frequency >= 1500), {
      minLength: 2,
    }),
    {
      category: "日常",
      difficultyFn: () => "medium",
      limit: 400,
      maxLength: 6,
    },
  );

  pushEntries(popular, used, filteredWikiPool, {
    category: "网络热词",
    difficultyFn: (index) => (index < 20 ? "easy" : "medium"),
    limit: 40,
    maxLength: 8,
  });
  pushEntries(popular, used, toSimplePoolWords(MANUAL_POPULAR_WORDS), {
    category: "流行语境",
    difficultyFn: (index) => (index < 70 ? "easy" : "medium"),
    limit: 180,
    maxLength: 8,
  });
  pushEntries(
    popular,
    used,
    toPoolWords(itPool.filter((item) => item.frequency >= 4500), {
      minLength: 2,
    }),
    {
      category: "科技词",
      difficultyFn: (index) => (index < 180 ? "medium" : "hard"),
      limit: 400,
      maxLength: 8,
    },
  );

  pushEntries(
    challenge,
    used,
    toPoolWords(chengyuPool.filter((item) => item.frequency >= 3500), {
      minLength: 4,
    }),
    {
      category: "成语",
      difficultyFn: () => "hard",
      limit: 160,
      maxLength: 8,
      minLength: 4,
    },
  );
  pushEntries(challenge, used, toSimplePoolWords(idiomPool, { minLength: 4 }), {
    category: "成语",
    difficultyFn: () => "hard",
    limit: 200,
    maxLength: 8,
    minLength: 4,
  });

  ensureCount("日常词", daily, TARGET.daily);
  ensureCount("流行词", popular, TARGET.popular);
  ensureCount("挑战词", challenge, TARGET.challenge);

  const all = [...daily, ...popular, ...challenge];

  if (new Set(all.map((item) => item.word)).size !== all.length) {
    throw new Error("词库存在重复词");
  }

  return {
    all,
    challenge,
    daily,
    popular,
  };
}

function summarizeWords(words) {
  const categoryCount = new Map();
  const difficultyCount = new Map();

  for (const item of words) {
    categoryCount.set(item.category, (categoryCount.get(item.category) ?? 0) + 1);
    difficultyCount.set(item.difficulty, (difficultyCount.get(item.difficulty) ?? 0) + 1);
  }

  return {
    categoryCount: Object.fromEntries([...categoryCount.entries()].sort((a, b) => b[1] - a[1])),
    difficultyCount: Object.fromEntries([...difficultyCount.entries()].sort((a, b) => b[1] - a[1])),
  };
}

async function writeOutputs(result) {
  const generatedAt = new Date().toISOString();
  const sourceHeader = `import type { CharadesWordEntry } from "../../shared/types";

// This file is generated by scripts/generate-charades-word-bank.mjs
// Generated at: ${generatedAt}
export const CHARADES_WORD_BANK: CharadesWordEntry[] = ${JSON.stringify(result.all, null, 2)};
`;

  await fs.writeFile(OUTPUT_FILE, sourceHeader, "utf8");

  const summary = summarizeWords(result.all);
  const report = `# Charades 词库 v1

生成时间：${generatedAt}

## 总量
- 总词数：${result.all.length}
- 日常词：${result.daily.length}
- 流行词：${result.popular.length}
- 挑战词：${result.challenge.length}

## 难度分布
\`\`\`json
${JSON.stringify(summary.difficultyCount, null, 2)}
\`\`\`

## 分类分布
\`\`\`json
${JSON.stringify(summary.categoryCount, null, 2)}
\`\`\`

## 固定数据来源
- THUOCL（固定提交）  
  - https://github.com/thunlp/THUOCL/tree/a30ce79d895d01ab5132a5c74c29703ff7efb4cc/data
- chinese-xinhua（固定提交）  
  - https://github.com/pwxcoo/chinese-xinhua/tree/fe6d6c2e8baa82187f4c96bbe042e43f96c05666/data
- 中国大陆网络用语列表（维基 API）  
  - https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86%E7%BD%91%E7%BB%9C%E7%94%A8%E8%AF%AD%E5%88%97%E8%A1%A8

## 清洗与过滤规则
- 仅保留纯中文词（2-8 字，挑战词至少 4 字）
- 剔除模板拼接词（如“X和Y”“X用的Y”“X时Y”“温柔X/未来X”）
- 剔除敏感、低俗、侮辱、强政治倾向词
- 严格去重，固定配比输出 1000 条（40/40/20）
`;

  await fs.writeFile(REPORT_FILE, report, "utf8");
}

async function main() {
  console.log("拉取词源...");
  const [animalRaw, carRaw, chengyuRaw, foodRaw, itRaw, wikiRaw, xinhuaIdiomRaw] = await Promise.all([
    fetchText(SOURCE.thuoclAnimal),
    fetchText(SOURCE.thuoclCar),
    fetchText(SOURCE.thuoclChengyu),
    fetchText(SOURCE.thuoclFood),
    fetchText(SOURCE.thuoclIt),
    fetchText(SOURCE.wikiCn),
    fetchText(SOURCE.xinhuaIdiom),
  ]);

  console.log("解析词源...");
  const animalPool = parseThuocl(animalRaw);
  const carPool = parseThuocl(carRaw);
  const chengyuPool = parseThuocl(chengyuRaw);
  const foodPool = parseThuocl(foodRaw);
  const itPool = parseThuocl(itRaw);
  const wikiPool = parseWikiTerms(wikiRaw);
  const idiomPool = parseXinhuaIdioms(xinhuaIdiomRaw);

  console.log("生成词库...");
  const result = buildWordBank({
    animalPool,
    carPool,
    chengyuPool,
    foodPool,
    idiomPool,
    itPool,
    wikiPool,
  });

  await writeOutputs(result);
  console.log(`完成：${result.all.length} 词`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
