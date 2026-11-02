import { createProject, id } from './model.js';
import { addVisualSample } from './sample-visual.js';

export function linkModelSample() {
  const p = createProject('https://linkmodel.ai/', '从官网承诺，到开发者的第一次成功调用');
  p.name = 'LinkModel';
  p.mode = 'sample';
  p.company = {
    audience: '需要接入多类 AI 模型的开发者；官网也提供创作者入口。首要客户群仍待团队确认。',
    value: '以统一入口访问多类 AI 模型，连接模型选择、试用与 API 调用。依据公开资料的企业自述。',
    goal: '帮助新开发者完成第一次成功调用（研究假设，待团队确认）。',
    journey: '理解价值 → 选择模型 → 阅读首次调用指南 → 获取密钥 → 创建任务 → 查看状态 → 获取结果',
    ownGoal: '围绕首次使用体验，获得一次小范围设计合作的沟通机会。',
    notes: '2026-10-28 公开文本初读。未执行注册、登录、真实生成、付费或性能测试。官网视觉与公开交互走查待补；不可将采集失败解释成产品缺陷。',
  };
  p.sources = [
    { id: 'E1', title: '官网 · Developers', url: 'https://linkmodel.ai/', locator: 'Developers 段落 · 结果与费用的描述', excerpt: '历史初读记录：官网将结果地址与费用描述为响应的一部分，并写有 “No second round trip.”。需要重新检查完整上下文。', limitation: '2026-10-28 的文本初读，尚未归档截图；该句也可能只指费用查询。不能据此断言功能承诺不实。', capturedAt: '2026-10-28', method: '历史公开文本初读', verified: false },
    { id: 'E2', title: '文档 · First API Call', url: 'https://docs.linkmodel.ai/first-api-call', locator: '3. Create a task → 4. Poll the task', excerpt: '创建任务的示例先返回任务编号与处理中状态；随后查询任务，以取得完成状态和结果地址。', limitation: '2026-10-29 已重新读取公开文档文本；未通过真实 API 请求验证。来源核对仍由使用者完成。', capturedAt: '2026-10-29', method: '公开文档文本读取', verified: false },
    { id: 'E3', title: '文档 · 提交不确定与结果保存', url: 'https://docs.linkmodel.ai/first-api-call', locator: '3. Create a task（超时提示）；4. Poll the task（结果链接）', excerpt: '文档提示：提交超时后直接重试可能创建额外任务与账单；生成的结果地址为动态签名链接，不宜作为永久标识。', limitation: '2026-10-29 已重新读取公开文档文本；控制台是否已有相应提示仍未知。', capturedAt: '2026-10-29', method: '公开文档文本读取', verified: false },
  ];
  const common = {
    alternative: '官网可能只强调费用无需额外查询；目标开发者也可能已熟悉异步任务。若走查没有发现预期落差，应调整或放弃该机会。',
    preserve: '保留现有模型目录、试用入口与入门文档，优先改善它们之间的衔接。',
    dependencies: '确认首要用户与增长目标；提供实际首次使用流程或演示；澄清任务与费用语义。控制台已有能力未知，范围需在走查后调整。',
    validation: '让目标开发者尝试首次任务，观察能否理解当前状态、判断下一步并处理提交不确定的情况；有真实数据后再比较首次成功率与完成耗时。',
    status: 'candidate',
  };
  p.opportunities = [
    { ...common, id: id(), title: '让第一次调用的预期与实际流程衔接起来',
      observation: '官网初读与首次调用文档，对结果返回过程采用了不同粒度的表述。文档明确包含创建任务与轮询两个步骤。',
      inference: '不熟悉异步生成的开发者可能低估等待、轮询与状态处理。当前没有证据证明用户实际产生误解，这只是待验证的机会。',
      scope: '聚焦一个模型、一个首次任务：对齐官网与文档表述，设计选模型、预估成本、提交、等待、成功和失败恢复的交互原型，并交付关键状态文案。',
      sourceIds: ['E1', 'E2'],
      copy: { en: {
        title: 'A clearer path to the first successful API call',
        observation: 'An initial reading of the public site and getting-started guide suggests different levels of detail about result delivery. The guide describes creating a task, then polling for its result.',
        inference: 'Developers unfamiliar with asynchronous generation may need clearer expectations about waiting and state handling. This is a hypothesis; no user confusion has been established.',
        alternative: 'The site may only mean that cost needs no extra query, and the target audience may already understand asynchronous tasks. The opportunity should be revised if a walkthrough finds no expectation gap.',
        scope: 'Focus on one model and one first task: align the site and guide, prototype model selection, cost expectations, submission, waiting, success and recovery, and provide key state copy.',
        dependencies: 'Confirm the primary audience and onboarding priorities, review the actual first-use journey with the team, and clarify task and pricing semantics. Adjust scope to the capabilities already present in the dashboard.',
        validation: 'Observe whether target developers can explain the current state, identify the next step and handle an uncertain submission. Compare success and completion time only if real baseline data is available.',
        opening: 'Hi LinkModel team — I’m Lina, a product designer with experience in AI video workflows. While reviewing your public site and getting-started guide, I noticed a possible opportunity to make the handoff to asynchronous tasks clearer for first-time developers.\n\nI’d explore one focused journey: choosing a model, understanding cost, submitting a task, and knowing what to do while it runs or if submission is uncertain. A small prototype could help test that journey with new users.\n\nWould a short conversation about your current onboarding priorities be useful?',
      } },
    },
    { ...common, id: id(), title: '先验证提交不确定时的恢复体验',
      observation: '首次调用文档明确提示：提交超时后盲目重试可能创建额外任务和账单。',
      inference: '可以进一步研究开发者是否知道如何确认提交结果，再决定要不要重试。尚未观察控制台，不能断言界面缺少恢复能力。',
      alternative: '现有 SDK、控制台或支持文档可能已经解决这个问题；需要先走查真实流程。',
      scope: '先走查一个提交不确定的场景；仅在确认缺口后，设计状态解释、下一步指引与恢复原型。',
      sourceIds: ['E3'],
      copy: { en: {
        title: 'Explore recovery when a submission is uncertain',
        observation: 'The getting-started guide warns that blindly retrying after a submission timeout can create additional tasks and billing orders.',
        inference: 'It may be useful to study how developers confirm a submission before retrying. The dashboard has not been observed, so a missing recovery capability has not been established.',
        alternative: 'The existing SDK, dashboard or support materials may already address this situation. A walkthrough is needed first.',
        scope: 'Walk through one uncertain-submission scenario. Only if a gap is confirmed, prototype the state explanation, next-step guidance and recovery interaction.',
        dependencies: 'Review the real flow with the team and confirm existing recovery capabilities before defining implementation work.',
        validation: 'Observe whether developers can identify the submission state and choose an appropriate next step without creating unintended repeat requests.',
      } },
    },
  ];
  p.selectedId = p.opportunities[0].id;
  p.decision = 'pitch';
  return addVisualSample(p);
}
