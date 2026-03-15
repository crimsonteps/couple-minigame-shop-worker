# Charades 词库 v1

生成时间：2026-03-11T08:03:27.922Z

## 总量
- 总词数：1000
- 日常词：400
- 流行词：400
- 挑战词：200

## 难度分布
```json
{
  "hard": 420,
  "medium": 400,
  "easy": 180
}
```

## 分类分布
```json
{
  "科技词": 223,
  "成语": 200,
  "食物": 183,
  "流行语境": 157,
  "日常": 150,
  "动物": 67,
  "网络热词": 20
}
```

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
