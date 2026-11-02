import { id } from './model.js';

export function addVisualSample(p) {
  p.sampleVersion = 3;
  p.focus = '从产品、交互与视觉三个角度，形成专家主导的设计建议';
  p.company.notes = '2026-10-29 补充公开桌面页面走查，1440 × 1000 视口。保留历史文本研究；未执行注册、登录、付费、真实生成或控制台测试。图文建议为 Mira 协助准备的样例，待 Lina 审阅；方案图为概念示意。';
  p.sources.push(
    {id:'E4',title:'官网 · 首屏与行动入口',url:'https://www.linkmodel.ai/',locator:'桌面首屏，活动轮播的 GPT Image 2.5 页面状态',excerpt:'顶部活动条、导航中的 API Key 按钮、带背景图的模型活动标题与首屏试用按钮同时可见。导航与首屏按钮都使用荧光绿强调。',limitation:'公开未登录页面，1440 × 1000 视口，2026-10-29 截图；轮播内容会变化。未进行移动端、可访问性量化或用户测试。',capturedAt:'2026-10-29',method:'真实浏览器截图 · 桌面视口',verified:false,image:'./assets/linkmodel-home-before.webp'},
    {id:'E5',title:'官网 · Popular Models 卡片',url:'https://www.linkmodel.ai/',locator:'Popular Models 区域截图，1429 × 1147，含当时的固定导航叠层',excerpt:'模型以大幅背景图卡片呈现，标题位于左下，类型标签与价格单位使用较小文字；左右边缘有被截断的卡片。',limitation:'只观察首页卡片区域，不代表完整模型目录。截图保留固定导航叠层与当时可见卡片。未验证模型能力、价格正确性或用户选型效率。',capturedAt:'2026-10-29',method:'真实浏览器截图 · 页面区域',verified:false,image:'./assets/linkmodel-models-before.webp'},
  );
  p.sources.find(s=>s.id==='E4').copy={en:{title:'Homepage · hero and actions',locator:'Desktop hero, GPT Image 2.5 carousel state',limitation:'Public, signed-out page captured on 2026-10-29 at a 1440 × 1000 viewport. Carousel content changes. Mobile, measured accessibility and user testing were not covered.'}};
  p.sources.find(s=>s.id==='E5').copy={en:{title:'Homepage · Popular Models',locator:'Popular Models section, 1429 × 1147, including the fixed navigation overlay',limitation:'Homepage showcase only, not the full model catalog. The capture retains the fixed navigation overlay and visible cards. Model capabilities, price accuracy and selection efficiency were not tested.'}};
  p.opportunities.forEach(o=>{o.discipline='interaction';});
  const o = {
    id:id(),discipline:'visual',status:'candidate',sourceIds:['E4','E5'],
    title:'让品牌表达与开发者的信息阅读更有层次',
    observation:'首页保留了鲜明的黑色、荧光绿与模型图像，但首屏多处高强调元素并存；模型卡片的大图比类型与计费信息更显眼。',
    inference:'我的设计判断是：可以拉开品牌展示、主要行动和选型信息的视觉层级。是否影响理解与选型效率，需要结合目标用户验证。',
    alternative:'如果首页主要服务回访用户或活动转化，突出新品与优惠可能是有意的设计取舍。需要先确认页面的首要任务。',
    preserve:'保留黑色与荧光绿的品牌识别、模型丰富度、试用入口和模型更新内容；调整它们的优先级与呈现方式。',
    scope:'先聚焦首屏与模型展示两个区域：交付视觉诊断、两张方向方案、桌面与移动端关键布局，以及字体、色彩、间距和按钮层级规范。',
    dependencies:'确认首页主要服务新访客还是回访开发者、首要转化动作与品牌约束；确认实际模型能力和计费单位。示意文案与模型信息须经团队核对。',
    validation:'让目标开发者描述产品价值、指出主要入口，并找到适合一个具体任务的模型。比较两版的理解与查找过程；视觉可读性另做对比度与响应式检查。',
    copy:{en:{
      title:'A clearer visual hierarchy for the developer journey',
      observation:'The homepage has a distinctive dark palette and lime accents. In the captured hero, campaign messaging and multiple highlighted actions compete for emphasis. In the model section, large images dominate smaller capability and billing labels.',
      inference:'My design assessment is that brand expression, the primary action and model-selection details would benefit from a clearer visual hierarchy. The effect on comprehension and selection still needs user validation.',
      alternative:'If the homepage primarily serves returning users or campaign traffic, the emphasis on launches and offers may be intentional. We should first confirm its main job.',
      scope:'Start with the hero and model showcase: a visual diagnosis, two design directions, key desktop and mobile layouts, and specifications for typography, color, spacing and button hierarchy.',
      dependencies:'Confirm the primary audience, main conversion action and brand constraints. Verify model capabilities and billing units with the team. Concept copy and model information require review.',
      validation:'Ask target developers to describe the value, identify the primary action and find a model for a concrete task. Compare how they understand and navigate both directions; check contrast and responsive behavior separately.',
      opening:'Hi LinkModel team — I’m Lina, a product designer with experience shipping AI products. I reviewed your public homepage and put together two visual directions: a clearer first-screen hierarchy and model information that is easier to compare.\n\nI would preserve the dark palette and lime accents while giving the main action and model details more distinct roles. The attached concepts explain the design reasoning; they are a starting point for discussion.\n\nWould reviewing these directions against your current homepage priorities be useful?',
    }},
    boards:[
      {id:id(),sourceId:'E4',dimension:'hierarchy',proposalImage:'./assets/linkmodel-home-proposal.webp',copy:{
        zh:{title:'01 / 让首屏有一个清晰的视觉主次',finding:'顶部活动条、API Key 按钮和模型试用按钮同时争夺注意力。大标题将模型名称、上线信息与折扣放在同一层级，正文叠在复杂图像上。',rationale:'鲜明的品牌色值得保留。我建议用字号、留白和色彩强度区分“产品是什么”“下一步做什么”“最近有什么活动”，让首屏的阅读顺序更明确。',recommendation:'将稳定的产品价值放在首位；保留一个主要荧光绿行动按钮；API Key 与文档作为次级入口；将模型活动收纳为独立更新区域。下一步根据流量来源确认主按钮。',caption:'结构与视觉层级概念；新文案和入口优先级待确认。保留黑色与荧光绿识别，未使用原站背景图。'},
        en:{title:'01 / Give the first screen a clear reading order',finding:'The announcement, API-key button and model trial action compete for attention. A large headline combines the model name, launch and discount; supporting copy sits over detailed imagery.',rationale:'The distinctive palette is worth keeping. I would use type scale, spacing and color emphasis to separate the product value, the next action and the latest promotion.',recommendation:'Lead with a stable value proposition, use one primary lime action, treat the API key and docs as secondary entries, and place model updates in a separate area. Confirm the primary CTA against traffic sources.',caption:'Hierarchy concept. New copy and entry priorities require review. Dark and lime brand cues are retained; original hero imagery is not reused.'},
      }},
      {id:id(),sourceId:'E5',dimension:'typography',proposalImage:'./assets/linkmodel-models-proposal.webp',copy:{
        zh:{title:'02 / 让选型信息更容易扫读与对照',finding:'模型卡片的大图占据主要空间，类型标签和计费单位较小；不同卡片需要反复读取，才能比较文字信息。截图只反映首页展示区。',rationale:'图像适合传达品牌与生成能力；选型还需要稳定的信息位置。我建议将“任务类型、模型名称、能力入口、计费方式、试用”放到一致的阅读路径上。',recommendation:'增加任务分组，采用对齐的信息行与更清晰的文字层级；保留统一试用入口。方案暂以“查看实时价格”代替未核实价格，正式设计需同时清楚展示单位。',caption:'选型区域的排版方向。模型名称取自截图，未独立验证可用性；分组、字段与能力信息需团队确认。'},
        en:{title:'02 / Make model information easier to scan and compare',finding:'Large images dominate the model cards, while capability tags and billing units are small. Comparing text details requires repeated reading across cards. This observation is limited to the homepage showcase.',rationale:'Imagery can express the brand and creative potential; model selection also benefits from stable information positions. I would align task, model, capability details, pricing and trial actions.',recommendation:'Introduce task grouping and aligned rows with a clearer type scale. Keep trial actions consistent. The concept links to live pricing rather than asserting unverified prices; the final design should make units explicit.',caption:'Typography and comparison concept. Model names come from the capture; availability is not independently verified. Grouping, fields and capabilities require team review.'},
      }},
    ],
  };
  p.opportunities.unshift(o);
  p.selectedId=o.id;
  return p;
}
