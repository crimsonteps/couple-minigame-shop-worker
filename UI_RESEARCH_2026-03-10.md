# UI 调研与落地记录（2026-03-10）

## 目标
为 `couple-minigame-shop-worker` 提升视觉品质与交互一致性，在不改业务逻辑的前提下完成可上线的样式升级。

## 参考来源（精选）
- Awwwards 网站库与近期 SOTD（用于观察当前主流视觉走向与信息层次）：https://www.awwwards.com/websites/
- Awwwards Mobile Excellence Report（用于移动端首屏、导航与 CTA 可见性建议）：https://assets.awwwards.com/awards/downloads/Awwwards_Mobile_Excellence_Report.pdf
- Atlassian Design System Foundations（用于 token、层级和一致性原则）：https://atlassian.design/foundations
- GitHub Primer Foundations / Color（用于语义化颜色与状态表达）：https://primer.style/design/foundations/color
- Google Material 3 Expressive（用于“更高情绪表达 + 可读性”的新版设计趋势）：https://blog.google/products/android/material-3-expressive-android-wear-os-launch/
- W3C WCAG 2.2 Quick Reference（用于焦点可见性与交互可达性基线）：https://www.w3.org/WAI/WCAG22/quickref/

## 设计提炼
- 视觉方向：从“纯温和卡片风”升级为“高可读排版 + 玻璃层叠 + 暖色主强调 + 低饱和青色辅助”。
- 信息层级：强化顶部导航和 Hero 首屏，确保关键状态（连接、积分、时间）在首屏可见。
- 交互反馈：按钮/导航 hover 与 active 有明确层级变化，但控制幅度避免浮夸。
- 可访问性：增加 `focus-visible` 统一焦点环；补充 `prefers-reduced-motion` 适配。

## 本次已落地到项目
- 更新全局设计 token（亮色/暗色两套）与阴影、圆角、主次色语义。
- 引入更现代的中英文排版组合（`Outfit` + `Noto Sans SC`）并保留系统字体回退。
- 增强背景氛围层、卡片材质层与导航玻璃态，提升整体完成度。
- 调整主按钮与导航 active 视觉，提升 CTA 识别度。
- 增加键盘焦点样式和减少动画偏好支持，满足基础可达性要求。
- 为首页、游戏页、商城页、记录页、个人页、管理页补充 Hero 解释文案，提升首屏信息密度。

## 风险与后续建议
- 当前字体依赖 Google Fonts；若目标网络环境受限，建议改为本地托管字体文件。
- 后续可补充 Lighthouse/Axe 自动化检查，把可访问性做成 CI 门禁。
