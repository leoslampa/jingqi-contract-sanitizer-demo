"use strict";

const state = {
  fileName: "",
  sourceText: "",
  matches: [],
  warnings: [],
  contractType: "generic",
  contractTypeName: "通用文书",
  contractTypeMode: "auto",
  outputText: "",
  downloadUrls: [],
  sourceFormat: "",
};
let importGeneration = 0;
let exportGeneration = 0;
let activeImport = null;

const $ = (id) => document.getElementById(id);
const els = {
  fileInput: $("fileInput"),
  chooseFileButton: $("chooseFileButton"),
  dropZone: $("dropZone"),
  fileNotice: $("fileNotice"),
  contractType: $("contractType"),
  manualContractType: $("manualContractType"),
  manualContractTypeField: $("manualContractTypeField"),
  customTerms: $("customTerms"),
  importPanel: $("importPanel"),
  reviewPanel: $("reviewPanel"),
  exportPanel: $("exportPanel"),
  sourceDocument: $("sourceDocument"),
  previewDocument: $("previewDocument"),
  sourceFileName: $("sourceFileName"),
  findingsList: $("findingsList"),
  matchCount: $("matchCount"),
  warningStrip: $("warningStrip"),
  quickTerm: $("quickTerm"),
  reviewPrompt: $("reviewPrompt"),
  riskCallout: $("riskCallout"),
  exportSummaryText: $("exportSummaryText"),
  downloadMdButton: $("downloadMdButton"),
  downloadReportButton: $("downloadReportButton"),
  openMdButton: $("openMdButton"),
  copyMdButton: $("copyMdButton"),
};

const categoryConfig = {
  entityA: { label: "主体A", placeholder: "【主体A】", risk: "high" },
  entityB: { label: "主体B", placeholder: "【主体B】", risk: "high" },
  entityC: { label: "主体C", placeholder: "【主体C】", risk: "high" },
  entityD: { label: "主体D", placeholder: "【主体D】", risk: "high" },
  entityE: { label: "主体E", placeholder: "【主体E】", risk: "high" },
  entityF: { label: "主体F", placeholder: "【主体F】", risk: "high" },
  entityG: { label: "主体G", placeholder: "【主体G】", risk: "high" },
  entityH: { label: "主体H", placeholder: "【主体H】", risk: "high" },
  entityI: { label: "主体I", placeholder: "【主体I】", risk: "high" },
  entityJ: { label: "主体J", placeholder: "【主体J】", risk: "high" },
  entityOther: { label: "相关主体", placeholder: "【相关主体】", risk: "high" },
  person: { label: "人员姓名", placeholder: "【联系人】", risk: "high" },
  address: { label: "地址", placeholder: "【地址】", risk: "high" },
  project: { label: "项目或采购标的", placeholder: "【项目A】", risk: "medium" },
  email: { label: "邮箱", placeholder: "【邮箱已删除】", risk: "high" },
  phone: { label: "联系方式", placeholder: "【联系方式已删除】", risk: "high" },
  idCard: { label: "身份证号", placeholder: "【身份证号已删除】", risk: "high" },
  creditCode: { label: "统一社会信用代码", placeholder: "【统一社会信用代码已删除】", risk: "high" },
  bankAccount: { label: "银行账号", placeholder: "【银行账号已删除】", risk: "high" },
  bankName: { label: "开户行", placeholder: "【开户行已删除】", risk: "high" },
  amount: { label: "金额", placeholder: "【金额】", risk: "medium" },
  percentage: { label: "百分比", placeholder: "X%", risk: "medium" },
  ratio: { label: "比例", placeholder: "【比例】", risk: "medium" },
  installment: { label: "分期安排", placeholder: "X期", risk: "medium" },
  numericSpec: { label: "技术数值", placeholder: "X", risk: "medium" },
  contractNumber: { label: "文档编号", placeholder: "【文档编号】", risk: "high" },
  date: { label: "日期", placeholder: "20XX年XX月XX日", risk: "medium" },
  duration: { label: "期限", placeholder: "Y日", risk: "medium" },
  custom: { label: "自定义敏感词", placeholder: "【敏感信息】", risk: "medium" },
};

const summaryHistory = createSummaryHistory(categoryConfig);

const batchGroups = {
  amount: { label: "金额", categories: new Set(["amount"]) },
  spec: { label: "数量与参数", categories: new Set(["numericSpec", "percentage", "ratio", "installment"]) },
  time: { label: "日期与期限", categories: new Set(["date", "duration"]) },
};

const specUnitPattern = "(?:min|ms|GU|μm|um|nm|mm|cm|km|m²|㎡|平方米|平方|平米|米|kg|mg|g|ml|mL|L|kW|W|V|A|MPa|kPa|Pa|℃|°C|°|H|h|m|s|d|y|户|名|轮|件|级|次|套|个|台|组|批|栋|层|楼|号楼|年|个月|月|周|天|日|小时|分钟|秒|毫秒)";
const chineseNumberPattern = "[零〇一二两三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖拾佰仟萬億]+";
const companySuffixPattern = "(?:公司|集团|中心|企业|事务所|研究院|研究所|委员会|银行|学校|大学|学院|医院|协会|基金会|机关|单位)";
const companyNameSource = String.raw`[\u4e00-\u9fa5A-Za-z0-9（）()·&＆.\-—_、 \t　\r\n]{2,90}${companySuffixPattern}`;
const partyLabelSource = "甲方|乙方|丙方|丁方|戊方|己方|庚方|辛方|壬方|癸方";
const currencyNamePattern = "(?:人民币|港币|港元|美元|美金|欧元|英镑|日元|日币|澳元|加元|新加坡元|新币|CNY|RMB|HKD|USD|EUR|GBP|JPY|AUD|CAD|SGD)";
const currencySymbolPattern = "(?:HK\\$|US\\$|CNY|RMB|USD|EUR|GBP|JPY|HKD|¥|￥|\\$|€|£)";
const chineseUpperMoneyPattern = "[零〇壹贰叁肆伍陆柒捌玖拾佰仟萬万億亿兆]{1,50}";
const chineseUpperMoneyUnitPattern = `(?:(?:元|圆|万元|萬元|亿元|億元)(?:${currencyNamePattern})?|美元|美金|港元|港币|欧元|英镑|日元|澳元|加元|新加坡元|新币)`;

const patterns = [
  { category: "email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { category: "idCard", regex: /(?<![0-9A-Z])\d{17}[0-9Xx](?![0-9A-Z])/g },
  { category: "creditCode", regex: /(?<![0-9A-Z])[0-9A-HJ-NPQRTUWXY]{18}(?![0-9A-Z])/g },
  { category: "phone", regex: /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)|(?<!\d)(?:0\d{2,3}[-\s]?)?\d{7,8}(?!\d)/g },
  { category: "phone", regex: /(?<!\d)(?:[（(]\s*0\d{2,3}\s*[）)]|0\d{2,3})[\s　-]*\d{3,4}[\s　-]*\d{4}(?!\d)(?:\s*[（(]\s*(?:总机|转\s*\d+)\s*[）)])?/g },
  { category: "bankAccount", regex: /(?<!\d)(?:\d[ -]?){16,24}(?!\d)/g },
  { category: "date", regex: /[【\[]\s*(?:20\d{2}|19\d{2})\s*[】\]]\s*年\s*[【\[]\s*(?:0?[1-9]|1[0-2])\s*[】\]]\s*月(?:\s*[【\[]\s*(?:0?[1-9]|[12]\d|3[01])\s*[】\]]\s*日)?/g, placeholder: (match) => match[0].includes("日") ? "20XX年XX月XX日" : "20XX年XX月" },
  { category: "amount", regex: new RegExp(`${currencyNamePattern}\\s*(?:金额|价款|费用)?大写\\s*[：:]\\s*[【\\[（(]?\\s*${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}?[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?\\s*[】\\]\\）)]?`, "gi"), placeholder: "【金额】" },
  { category: "amount", regex: new RegExp(`(?:${currencyNamePattern}\\s*)?(?:¥|￥|\\$|€|£)?\\s*\\d{1,3}(?:[,，]\\d{3})+(?:\\.\\d{1,2})?\\s*[（(]\\s*(?:大写\\s*[：:]?\\s*)?(?:${currencyNamePattern}\\s*)?${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}?[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?\\s*[）)]`, "gi"), placeholder: "【金额】" },
  { category: "amount", regex: new RegExp(`(?:${currencyNamePattern}\\s*)?(?:¥|￥|\\$|€|£)?\\s*(?:\\d{1,3}(?:[,，]\\d{3})+|\\d+)(?:\\.\\d{1,2})?\\s*(?:亿元|万元|万(?!\\s*(?:平方米|平方|平米|㎡|m²))|元|美元|美金|港元|港币|欧元|英镑|日元|澳元|加元|新加坡元|新币)(?:\\s*[（(]\\s*(?:大写\\s*[：:]?\\s*)?(?:${currencyNamePattern}\\s*)?${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}?[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?\\s*[）)])?`, "gi"), placeholder: (match) => {
    const context = match.input.slice(Math.max(0, match.index - 16), match.index);
    if (/(?:合同总额|合同总金额|合同金额|费用总额)\s*(?:为|是|：|:)?\s*$/.test(context)) return "【金额】";
    if (new RegExp(`${currencyNamePattern}|${currencySymbolPattern}`, "i").test(match[0])) return "【金额】";
    return `X${(match[0].match(/(?:亿元|万元|万|元|美元|美金|港元|港币|欧元|英镑|日元|澳元|加元|新加坡元|新币)(?=\s*(?:[（(]|$))/) || ["元"])[0]}`;
  } },
  { category: "amount", regex: /(?:>=|<=|=>|=<|≥|≤|≈|≃|≅|≒|>|<|=|~)\s*\d+(?:\.\d+)?\s*(?:亿元|万元|万(?!\s*(?:平方米|平方|平米|㎡|m²))|元)/g, placeholder: (match) => `${(match[0].match(/^(?:>=|<=|=>|=<|≥|≤|≈|≃|≅|≒|>|<|=|~)/) || [""])[0]}X${(match[0].match(/(?:亿元|万元|万|元)$/) || ["元"])[0]}` },
  { category: "amount", regex: new RegExp(`${currencySymbolPattern}\\s*[【\\[（(]?\\s*(?:\\d{1,3}(?:[,，]\\d{3})+|\\d+)(?:\\.\\d{1,2})?\\s*[】\\]\\）)]?\\s*(?:元|万元|亿元|美元|美金|港元|港币|欧元|英镑|日元|澳元|加元|新加坡元|新币)?`, "gi") },
  { category: "amount", regex: /(?:人民币\s*)?[【\[]\s*\d+(?:\.\d{1,2})?\s*(?:万|亿)?\s*[】\]]\s*元/g },
  { category: "amount", regex: /(?:人民币\s*)?[【\[]\s*\d+\.\d{1,2}\s*[】\]]/g },
  { category: "amount", regex: new RegExp(`(?:${currencyNamePattern}\\s*)?[【\\[]\\s*${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}?[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?\\s*[】\\]]`, "gi") },
  { category: "amount", regex: new RegExp(`(?:大写\\s*[：:]?\\s*)?(?:${currencyNamePattern}\\s*)?[【\\[（(]?\\s*(?:${currencyNamePattern}\\s*)?${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?\\s*[】\\]\\）)]?`, "gi"), placeholder: "【金额】" },
  { category: "amount", regex: /(?<!\d)\d+(?:\.\d{1,2})?(?=\s*元\s*\/\s*[^/\s，,；;。]{1,12}\s*\/\s*(?:月|日|年))/g, placeholder: "X" },
  { category: "amount", regex: /(?<!\d)\d+(?:\.\d{1,2})?(?=\s*[】\]\）)]?\s*元(?![\d]))/g, placeholder: "X" },
  { category: "amount", regex: new RegExp(`(?:${currencyNamePattern}\\s*)?${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?`, "gi") },
  { category: "amount", regex: /(?:\d+(?:\.\d{1,2})?)\s*[-—–~至]\s*(?:\d+(?:\.\d{1,2})?)\s*(元|万元|亿元|美元|美金|港元|港币|欧元|英镑|日元|澳元|加元|新加坡元|新币)/g, placeholder: (match) => `X-Y${match[1]}` },
  { category: "percentage", regex: /\d+(?:\.\d+)?\s*[％%]\s*[-—–~至]\s*\d+(?:\.\d+)?\s*[％%]/g, placeholder: "X%-Y%" },
  { category: "percentage", regex: /\d+(?:\.\d+)?\s*[％%]/g, placeholder: "X%" },
  { category: "percentage", regex: /百分之\s*(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+)/g, placeholder: "百分之X" },
  { category: "percentage", regex: /\d+(?:\.\d+)?\s*‰\s*[-—–~至]\s*\d+(?:\.\d+)?\s*‰/g, placeholder: "X‰-Y‰" },
  { category: "percentage", regex: /\d+(?:\.\d+)?\s*‰/g, placeholder: "X‰" },
  { category: "percentage", regex: /千分之\s*(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+)/g, placeholder: "千分之X" },
  { category: "ratio", regex: /(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+)分之(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+)/g, placeholder: "X分之Y" },
  { category: "ratio", regex: /一半|半数|过半/g, placeholder: "【比例】" },
  { category: "ratio", regex: /\d+(?:\.\d+)?(?=\s*[×xX*]\s*(?:余款|价款|金额|费用|总额))/g, placeholder: "X" },
  { category: "ratio", regex: /(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十]+)(?:成|折)/g, placeholder: (match) => `X${match[0].endsWith("折") ? "折" : "成"}` },
  { category: "installment", regex: /分\s*[【\[（(]?\s*(?:\d+|[零〇一二两三四五六七八九十百]+)\s*期\s*[】\]\）)]?/g, placeholder: "分X期" },
  { category: "installment", regex: /(?:第\s*)?(?:\d+|[零〇一二两三四五六七八九十百]+)(?=\s*期)/g, placeholder: (match) => match[0].trim().startsWith("第") ? "第X" : "X" },
  { category: "numericSpec", regex: /(?:>=|<=|=>|=<|≥|≤|≈|≃|≅|≒|>|<|=|~)\s*\d+(?:\.\d+)?/g, placeholder: (match) => `${(match[0].match(/^(?:>=|<=|=>|=<|≥|≤|≈|≃|≅|≒|>|<|=|~)/) || [""])[0]}X` },
  { category: "numericSpec", regex: new RegExp(`(?:>=|<=|=>|=<|≥|≤|≈|≃|≅|≒|>|<|=|~)\\s*\\d+(?:\\.\\d+)?\\s*${specUnitPattern}`, "gi"), placeholder: (match) => `${(match[0].match(/^(?:>=|<=|=>|=<|≥|≤|≈|≃|≅|≒|>|<|=|~)/) || [""])[0]}X${(match[0].match(new RegExp(`${specUnitPattern}$`, "i")) || [""])[0]}` },
  { category: "numericSpec", regex: new RegExp(`\\d+(?:\\.\\d+)?\\s*(?:-|—|–|~|到|至|to)\\s*\\d+(?:\\.\\d+)?\\s*${specUnitPattern}`, "gi"), placeholder: (match) => `X-Y${(match[0].match(new RegExp(`${specUnitPattern}$`, "i")) || [""])[0]}` },
  { category: "numericSpec", regex: new RegExp(`(?:至少|至多|不少于|不低于|不高于|不超过|低于|高于|大于|小于|约|共|全部)?\\s*\\d+(?:\\.\\d+)?\\s*${specUnitPattern}`, "gi"), placeholder: (match) => {
    const prefix = (match[0].match(/^(?:至少|至多|不少于|不低于|不高于|不超过|低于|高于|大于|小于|约|共|全部)?/) || [""])[0];
    const unit = (match[0].match(new RegExp(`${specUnitPattern}$`, "i")) || [""])[0];
    return `${prefix}X${unit}`;
  } },
  { category: "numericSpec", regex: /\d+(?:\.\d+)?\s*(?:万|千|百)?\s*(?:平方米|平方|平米|㎡|m²|米)/g, placeholder: (match) => `X${(match[0].match(/(?:万|千|百)?\s*(?:平方米|平方|平米|㎡|m²|米)$/) || [""])[0].replace(/\s+/g, "")}` },
  { category: "numericSpec", regex: new RegExp(`(?<![\\dA-Za-z])\\d+(?:\\.\\d+)?\\s*${specUnitPattern}(?![A-Za-z])`, "gi"), placeholder: (match) => `X${(match[0].match(new RegExp(`${specUnitPattern}$`, "i")) || [""])[0]}` },
  { category: "date", regex: /(?<!\d)(?:20\d{2}|19\d{2})年\s?(?:0?[1-9]|1[0-2])月\s?(?:0?[1-9]|[12]\d|3[01])日(?!\d)/g },
  { category: "date", regex: /(?<!\d)(?:20\d{2}|19\d{2})[.\-/](?:0?[1-9]|1[0-2])[.\-/](?:0?[1-9]|[12]\d|3[01])(?!\d)/g, placeholder: "20XX年XX月XX日" },
  { category: "date", regex: /(?<!\d)(?:20\d{2}|19\d{2})年\s?(?:0?[1-9]|1[0-2])月(?!\s?(?:0?[1-9]|[12]\d|3[01])日)(?!\d)/g },
  { category: "date", regex: /(?<![\d年])(?:0?[1-9]|1[0-2])月\s?(?:0?[1-9]|[12]\d|3[01])日(?!\d)/g },
  { category: "duration", regex: /(第)?\s*[【\[（(]?\s*\d+\s*[】\]\）)]?\s*[-—–~至]\s*[【\[（(]?\s*\d+\s*[】\]\）)]?\s*(个?月|周|天|日|小时|年)/g, placeholder: (match) => `${match[1] ? "第" : ""}Y-Z${match[2]}` },
  { category: "duration", regex: new RegExp(`(?<![\\d年月])(?:[【\\[（(]\\s*)?(?:\\d+|${chineseNumberPattern})(?:\\s*[】\\]\\）)])?\\s*(个?(?:自然日|工作日|月)|天|日|周|小时|年)(?:\\s*[（(]\\s*(?:大写\\s*[：:]?\\s*)?${chineseNumberPattern}\\s*(?:个?(?:自然日|工作日|月)|天|日|周|小时|年)?\\s*[）)])?`, "g"), placeholder: (match) => `Y${(match[0].match(/个?(?:自然日|工作日|月)|天|日|周|小时|年/) || ["日"])[0]}` },
  { category: "amount", regex: /(?:人民币\s*)?(?:¥|￥)?\s*\d{1,3}(?:[,，]\d{3})+(?:\.\d{1,2})?\s*(?:元|万元|亿元)?|(?:人民币\s*)?(?:¥|￥)\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*(?:万元|亿元)/g },
];

const demoContract = `# 技术合作开发合同

甲方（委托方）　:【上海青岚科技有限公司】（以下简称“青岚”）
合同编号：HT-2025-001
统一社会信用代码：91310115MA1K4AB12C
住所地　.【上海市浦东新区示例路88号】
联系人　.（陈明）
联系电话：13812345678
邮箱：chenming@example.com

乙方，　[杭州砺川信息技术有限公司]（后称“砺川”）
统一社会信用代码：91330106MA2B0XY45D
地址、电话：【杭州市西湖区样例大道16号】
联系人：周岚
联系电话：0571-87654321

丙方：深圳星丙科技有限公司（以下简称“星丙”）
丁方：北京云丁研究中心（简称“云丁”）

## 第一条 项目内容

各方就“星河协同平台”开展合作开发，青岚负责需求确认，砺川负责核心模块设计与交付，星丙提供测试支持，云丁负责成果评估。

## 第二条 项目费用

合同总金额为人民币1,280,000元。甲方在合同签署后支付30%，阶段验收后支付40%，最终验收后支付30%。
合同金额大写为人民币【壹佰贰拾捌万元整】，首期款为人民币[300000.00]元，违约金为人民币[10万]元。
税率为6%，阶段付款比例为30%-40%，报价为$12,000，预算区间为100-200万元。
其中一半费用分（三期）支付，首期支付总额的三分之一。

收款账号：6222 8888 1234 5678 901
开户行及账号：【中国建设银行上海浦东支行 6222888812345678901】

场地服务费按22元/㎡/月计算。

## 第三条 项目周期

合同签署日期为2026年3月1日，有效期自[2026.01.01]至[2026.12.31]，共12个月。第一阶段周期为第1-2周，计划交付日期为8月31日。乙方应在收到故障通知后24小时内响应，甲方应在验收后5日内提出异议。

## 第四条 知识产权

合作开发形成的知识产权归属由双方另行书面确认。

## 第五条 技术指标

2. 完成3 - 5轮试制；光泽度要求50 – 120GU；粗糙度要求0.1 ~ 0.5μm；硬度要求>=3H；附着力要求0级；耐磨要求≥3000次；响应时间5 to 8ms；保密期0.5年。

## 第六条 争议解决

协商不成的，向甲方（上海青岚科技有限公司）所在地有管辖权的人民法院提起诉讼。

## 第七条 规则回归样例

2.2组织刑事或行政打击的责任由违约方承担。
服务期限为2个月（贰个月），乙方应在通知后【20】个工作日内补足资料。
违约金增加1万元（大写：壹万元），余款≥100万时按0.55×余款计算。
逾期付款按合同总费用的0.3‰向乙方支付违约金。
法定代表人或授权代表已获得法定资格；授权代表：项目经理。
授权代表：；【李示例，CLO】；法定代表人（或授权代表）：；【周示例，法定代表人】。
所有通讯应发往相关接受方的下述地址、电邮地址、传真号码，或书面通知的其他地址、电邮地址。
合同有效期为【2026】年【5】月【1】日至【2027】年【4】月【30】日。
1.7 工作日：指合同约定的正常办公日期。
开票地址：东莞市长安镇示例社区东门中路168号。
合同价款为1，000,000（壹佰万元整）。
收件人[刘示例]；电话13100000000；邮箱example@example.com。
乙方：地址[广东省东莞市长安镇示例路168号]；收件人[廖示例]。
| 甲方： | 广东星河示例科技有限公司（以下简称“甲方”） |
费用大写：人民币[捌拾叁万肆仟肆佰叁拾壹玖角]。
甲方不配合、主管机关要求额外说明而导致延误的，乙方不承担责任。
甲方签署与履行本协议不违反其公司章程。`;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setStep(step) {
  if (step !== 3) {
    ++exportGeneration;
    revokeDownloadUrls();
    els.reviewPrompt.value = "";
    els.exportSummaryText.textContent = "";
    els.riskCallout.textContent = "";
    els.riskCallout.hidden = true;
    for (const id of ["copyMdButton", "copyPromptButton"]) {
      $(id).disabled = false;
      $(`${id}Status`).textContent = "";
    }
  }
  document.querySelectorAll(".step").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.step) === step));
  els.importPanel.hidden = step !== 1;
  els.reviewPanel.hidden = step !== 2;
  els.exportPanel.hidden = step !== 3;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showNotice(message, isError = false) {
  els.fileNotice.hidden = !message;
  els.fileNotice.textContent = message;
  els.fileNotice.classList.toggle("is-error", isError);
}

async function handleFile(file) {
  if (!file) return;
  activeImport?.abort();
  const controller = new AbortController();
  activeImport = controller;
  const generation = ++importGeneration;
  const extension = file.name.split(".").pop().toLowerCase();
  showNotice("正在本地读取文件……");

  try {
    const { IMPORT_LIMITS } = await import('./docx-reader.mjs');
    if (generation !== importGeneration) return;
    let text = "";
    const warnings = [];
    if (["md", "markdown"].includes(extension)) {
      if (file.size > IMPORT_LIMITS.inputBytes) throw new Error('Markdown 暂限 10 MB，请分段处理。');
      text = await file.text();
    } else if (extension === "docx") {
      if (file.size > IMPORT_LIMITS.inputBytes) throw new Error('DOCX 暂限 10 MB，请分段处理。');
      const result = await parseDocx(await file.arrayBuffer(), controller.signal);
      text = result.markdown;
      warnings.push(...result.warnings);
    } else if (extension === "pdf") {
      if (file.size > 30 * 1024 * 1024) throw new Error("PDF 实验导入暂限 30 MB，请缩小文件后重试。");
      const { parsePdf } = await import("./pdf-import.mjs");
      const result = await parsePdf(await file.arrayBuffer(), (page, total) => {
        if (generation === importGeneration) showNotice(`正在本地提取 PDF 文字：第 ${page} / ${total} 页……`);
      }, controller.signal);
      text = result.markdown;
      warnings.push(...result.warnings);
    } else if (extension === "doc") {
      throw new Error("这是旧版 Word（.doc）文件。旧格式存储结构较复杂，当前工具直接读取可能遗漏正文、表格等内容。请用 Word / WPS 打开，选择“另存为 → Word 文档（.docx）”后再导入；仅修改文件后缀无效。");
    } else {
      throw new Error("支持 Markdown、DOCX 和 PDF 文字导入（实验）；旧版 DOC 请先另存为 DOCX。");
    }

    if (generation !== importGeneration) return;
    if (text.length > IMPORT_LIMITS.textCharacters) throw new Error('提取文字超过 20 万字符，请分段处理。');
    if (!text.trim()) throw new Error("没有读取到可处理的文字。请检查文件内容。");
    state.warnings = warnings;
    state.sourceFormat = extension;
    state.fileName = file.name;
    state.sourceText = normalizeText(text);
    state.contractTypeMode = els.contractType.value;
    const manualType = els.manualContractType.value.trim();
    if (state.contractTypeMode === "manual" && !manualType) {
      els.manualContractType.setCustomValidity("请输入文书类型。");
      els.manualContractType.reportValidity();
      throw new Error("选择手动输入后，请填写文书类型。");
    }
    els.manualContractType.setCustomValidity("");
    state.contractType = resolveContractType(state.contractTypeMode, state.sourceText, manualType);
    state.contractTypeName = state.contractTypeMode === "manual" ? manualType : detectContractTypeName(state.sourceText, state.contractType);
    buildMatches();
    renderReview();
    showNotice("");
    setStep(2);
  } catch (error) {
    if (generation !== importGeneration) return;
    showNotice(error.message || "文件解析失败，请换一个文件再试。", true);
  }
}

function loadDemo() {
  activeImport?.abort();
  activeImport = null;
  ++importGeneration;
  state.sourceFormat = "md";
  state.fileName = "虚构技术合作合同.md";
  state.sourceText = demoContract;
  state.contractTypeMode = "auto";
  state.contractType = resolveContractType("auto", state.sourceText);
  state.contractTypeName = detectContractTypeName(state.sourceText, state.contractType);
  els.contractType.value = "auto";
  syncContractTypeInput();
  state.warnings = ["当前使用的是虚构样例，不包含真实合同信息。"];
  buildMatches();
  renderReview();
  setStep(2);
}

function normalizeText(text) {
  return text.replace(/\r\n?/g, "\n").replace(/[\t ]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

function resolveContractType(mode, text, manualType = "") {
  // Classify explicit document headings before contract keywords in their body.
  const headings = mode === "manual" ? [manualType] : text.split("\n").slice(0, 8);
  for (const heading of headings) {
    const clean = heading.replace(/^\s*#{1,6}\s*/, "").trim();
    if (!/^[\u4e00-\u9fa5A-Za-z0-9 ·（）()《》_-]{2,80}$/.test(clean)) continue;
    if (/(?:授权委托书|委托书)[》）)]?$/.test(clean)) return "mandate";
    if (/授权书[》）)]?$/.test(clean)) return "authorization";
    if (/(?:声明函|声明书|承诺函|承诺书)[》）)]?$/.test(clean)) return "statement";
    if (/(?:函|通知书)[》）)]?$/.test(clean)) return "letter";
  }
  const source = mode === "manual" ? `${manualType}\n${text}` : text;
  if (!/(?:合同|协议|契约)/.test(source)) return "generic";
  const techTerms = ["技术开发", "合作开发", "研发", "技术成果", "技术指标", "知识产权", "源代码", "技术秘密"];
  const purchaseTerms = ["采购合同", "采购方", "供应方", "供应商", "采购标的", "货物", "供货", "订单", "质量保证"];
  const techScore = techTerms.reduce((score, term) => score + (source.includes(term) ? 1 : 0), 0);
  const purchaseScore = purchaseTerms.reduce((score, term) => score + (source.includes(term) ? 1 : 0), 0);
  if (techScore === 0 && purchaseScore === 0) return "contract";
  return techScore > purchaseScore ? "tech" : "purchase";
}

function detectContractTypeName(text, type) {
  if (["authorization", "mandate", "statement", "letter", "generic"].includes(type)) return defaultContractTypeLabel(type);
  const lines = text.split("\n").slice(0, 30);
  for (const line of lines) {
    const clean = line.replace(/^\s*(?:#{1,6}|\|)\s*/, "").replace(/\|.*$/, "").trim();
    const match = clean.match(/[\u4e00-\u9fa5A-Za-z0-9·（）()《》]{2,36}(?:合同|协议|契约)/);
    if (match && !/(?:本合同|本协议|签订合同|订立合同)$/.test(match[0])) return match[0];
  }
  return defaultContractTypeLabel(type);
}

function defaultContractTypeLabel(type = state.contractType) {
  if (type === "authorization") return "授权书";
  if (type === "mandate") return "委托书";
  if (type === "statement") return "声明或承诺文书";
  if (type === "letter") return "业务函件";
  if (type === "contract") return "通用合同";
  if (type === "tech") return "技术合作开发合同";
  if (type === "purchase") return "业务采购合同";
  return "通用文书";
}

function contractTypeLabel() {
  // Output metadata must never reuse a title or manual label from the source.
  return defaultContractTypeLabel();
}

function syncContractTypeInput() {
  const manual = els.contractType.value === "manual";
  els.manualContractTypeField.hidden = !manual;
  els.manualContractType.disabled = !manual;
  els.manualContractType.required = manual;
  if (!manual) els.manualContractType.setCustomValidity("");
}

function safeFilenamePart(value) {
  return value.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim() || "文档";
}

function buildMatches() {
  const found = [];
  const amountMode = document.querySelector('input[name="amountMode"]:checked').value;

  for (const pattern of patterns) {
    if (pattern.category === "amount" && amountMode === "keep") continue;
    pattern.regex.lastIndex = 0;
    for (const match of state.sourceText.matchAll(pattern.regex)) {
      let placeholder;
      if (pattern.category === "date") {
        if (match[0].includes("年")) placeholder = match[0].includes("日") ? "20XX年XX月XX日" : "20XX年XX月";
        else placeholder = "XX月XX日";
      }
      if (pattern.category === "duration" && !pattern.placeholder) placeholder = `Y${match[1]}`;
      if (typeof pattern.placeholder === "function") placeholder = pattern.placeholder(match);
      else if (pattern.placeholder) placeholder = pattern.placeholder;
      addCandidate(found, match.index, match[0], pattern.category, placeholder);
    }
  }

  const parties = extractParties(state.sourceText);
  parties.forEach((party) => {
    const regex = flexibleEntityRegex(party.value);
    for (const match of state.sourceText.matchAll(regex)) {
      const expanded = expandSquareWrapper(state.sourceText, match.index, match.index + match[0].length);
      addCandidate(found, expanded.start, state.sourceText.slice(expanded.start, expanded.end), party.category, party.placeholder);
    }
  });

  extractRelatedEntities(state.sourceText, parties).forEach((entity) => {
    const regex = flexibleEntityRegex(entity.value);
    for (const match of state.sourceText.matchAll(regex)) {
      const expanded = expandSquareWrapper(state.sourceText, match.index, match.index + match[0].length);
      addCandidate(found, expanded.start, state.sourceText.slice(expanded.start, expanded.end), entity.category, entity.placeholder);
    }
  });

  extractPartyAliases(state.sourceText, parties).forEach((alias) => {
    const regex = flexibleEntityRegex(alias.value);
    for (const match of state.sourceText.matchAll(regex)) {
      const expanded = expandSquareWrapper(state.sourceText, match.index, match.index + match[0].length);
      addCandidate(found, expanded.start, state.sourceText.slice(expanded.start, expanded.end), alias.category, alias.placeholder);
    }
  });

  extractLabeledFields(state.sourceText).forEach((field) => addCandidate(found, field.start, field.value, field.category, field.placeholder));
  extractContextualPersons(state.sourceText).forEach((field) => addCandidate(found, field.start, field.value, field.category, field.placeholder));

  const customTerms = els.customTerms.value.split(/\n|、|;/).map((item) => item.trim()).filter(Boolean);
  customTerms.forEach((term, index) => addTermMatches(found, term, `【敏感信息${index + 1}】`));

  state.matches = mergeCandidates(found);
}

function extractParties(text) {
  const definitions = [
    { stem: "甲", category: "entityA", labels: ["甲方", "采购方", "买方"] },
    { stem: "乙", category: "entityB", labels: ["乙方", "供应方", "卖方"] },
    { stem: "丙", category: "entityC", labels: ["丙方"] },
    { stem: "丁", category: "entityD", labels: ["丁方"] },
    { stem: "戊", category: "entityE", labels: ["戊方"] },
    { stem: "己", category: "entityF", labels: ["己方"] },
    { stem: "庚", category: "entityG", labels: ["庚方"] },
    { stem: "辛", category: "entityH", labels: ["辛方"] },
    { stem: "壬", category: "entityI", labels: ["壬方"] },
    { stem: "癸", category: "entityJ", labels: ["癸方"] },
  ];
  const companySource = companyNameSource;
  const separatorSource = String.raw`(?:[ \t　]*[：:，,.。][ \t　]*(?:(?:\|[ \t　]*)|(?:\n[ \t　]*))?|[ \t]*　+[ \t　]*|[ \t]{2,}|[ \t　]*\|[ \t　]*|[ \t　]*\n[ \t　]*|[ \t　]*(?=[【\[]))`;
  const preamble = contractPreamble(text);

  function scan(scope) {
    const found = [];
    for (const item of definitions) {
      const labelSource = item.labels.join("|");
      const fieldRegex = new RegExp(`(?:${labelSource})[ \\t　]*(?:[（(][^）)\\n]{1,20}[）)])?${separatorSource}[【\\[（(]?[ \\t　]*(${companySource})`, "g");
      const associationRegex = new RegExp(`${item.stem}方\\s*[（(]\\s*(${companySource})\\s*[）)]`, "g");
      for (const regex of [fieldRegex, associationRegex]) {
        for (const match of scope.matchAll(regex)) {
          const value = cleanEntityValue(match[1]);
          if (value.length >= 2 && value.length <= 50 && isLikelyPartyName(value)) found.push({ value, category: item.category });
        }
      }
    }
    return found;
  }

  const parties = scan(preamble);
  if (!parties.length && preamble.length < text.length) parties.push(...scan(text));
  // Role declarations require a field boundary and a colon/wrapper. In particular,
  // never match 授权人 inside 被授权人 or interpret prose about authority as a name.
  const roles = "被授权人|被授权方|授权人|授权方|委托人|受托人|委托方|受托方|声明人|声明方|承诺人|承诺方|出具方";
  const name = String.raw`(?:[^\n：:；;，,|【\]】]{2,80}${companySuffixPattern}|[\u4e00-\u9fa5·]{2,4}|[A-Za-z][A-Za-z .'-]{1,48})`;
  const declaration = new RegExp(String.raw`(?:^|[\n|；;])[ \t　]*(?:${roles})[ \t　]*(?:[（(][^）)\n]{1,20}[）)])?(?:名称|姓名)?[ \t　]*(?:[：:][ \t　]*[|]?[ \t　]*[【\[（(]?[ \t　]*|[【\[])(` + name + String.raw`)(?=[ \t　]*(?:[【\[（(】\]）)；;，,|]|\n|$))`, "g");
  for (const match of text.matchAll(declaration)) {
    const value = match[1].trim();
    if (!isLikelyPartyName(value) && !isLikelyPersonOrRoleValue(value)) continue;
    if (/^(?:姓名|名称|待填写|未填写|授权范围|委托事项)$/.test(value)) continue;
    if (parties.some(party => party.value === value)) continue;
    const used = new Set(parties.map(party => party.category));
    const category = Object.keys(categoryConfig).find(key => /^entity[A-J]$/.test(key) && !used.has(key));
    parties.push({value, category: category || "entityOther", ...(category ? {} : {placeholder: `【主体${parties.length + 1}】`})});
  }
  const unique = parties.filter((party, index, list) => list.findIndex(item => item.value === party.value) === index);
  const reserved = new Set(unique.map(party => party.category));
  const assigned = new Set();
  return unique.map(party => {
    if (assigned.has(party.category)) {
      const free = Object.keys(categoryConfig).find(key => /^entity[A-J]$/.test(key) && !reserved.has(key));
      if (free) { party = {...party, category: free}; reserved.add(free); }
      else if (!party.placeholder) party = {...party, category: "entityOther", placeholder: `【主体${unique.indexOf(party) + 1}】`};
    }
    assigned.add(party.category);
    return party;
  });
}

function contractPreamble(text) {
  const boundary = text.search(/\n[ \t　]*(?:#{1,6}[ \t　]*)?(?:第[一二三四五六七八九十百千0-9]+(?:条|章)|第一部分)[ \t　]/);
  if (boundary > 0) return text.slice(0, boundary);
  return text.slice(0, Math.min(text.length, 20000));
}

function cleanEntityValue(value) {
  return value
    .replace(/(?:统一社会信用代码|纳税人识别号|地址|电话|联系人|法定代表人).*$/, "")
    .replace(/[（(【\[]\s*(?:以下简称|以下称|后称|简称|略称).*$/, "")
    .replace(/[ \t　\r\n]+/g, "")
    .replace(/^[ \t　【\[（(：:，,.。]+|[ \t　】\]）)：:，,.。]+$/g, "")
    .trim();
}

function isLikelyPartyName(value) {
  return new RegExp(`${companySuffixPattern}$`).test(value);
}

function flexibleEntityRegex(value) {
  return new RegExp(flexibleEntitySource(value), "g");
}

function flexibleEntitySource(value) {
  return [...value].map((char) => escapeRegex(char)).join("[\\s　]*");
}

function extractPartyAliases(text, parties) {
  const aliases = [];
  const blocked = new Set(["甲方", "乙方", "丙方", "丁方", "戊方", "己方", "庚方", "辛方", "壬方", "癸方", "双方", "各方", "本公司", "该公司", "一方", "对方", "授权人", "被授权人", "授权方", "被授权方", "委托人", "受托人", "委托方", "受托方", "声明人", "承诺人"]);
  parties.forEach((party) => {
    const source = flexibleEntitySource(party.value);
    const regex = new RegExp(`${source}[ \\t　]*[】\\]]?[ \\t　]*[（(【\\[][^\\n]{0,30}?(?:以下简称|以下称|后称|简称|略称)[：:，, \\t　]*(?:为[：:，, \\t　]*)?[“\"‘']?([^”\"’'\\n，,；;）)\\]】]{1,20})`, "g");
    for (const match of text.matchAll(regex)) {
      const alias = match[1].replace(/[ \\t　：:，,.。]+$/g, "").trim();
      if (alias.length < 2 || alias.length > 20 || blocked.has(alias)) continue;
      if (!party.value.includes(alias)) continue;
      aliases.push({
        value: alias,
        category: party.category,
        placeholder: party.placeholder ? party.placeholder.replace("】", "简称】") : `【主体${party.category.replace("entity", "")}简称】`,
      });
    }
  });
  return aliases.filter((alias, index, list) => list.findIndex((item) => item.value === alias.value && item.category === alias.category) === index);
}

function extractRelatedEntities(text, parties = []) {
  const fields = [];
  const known = new Set(parties.map((party) => party.value));
  const label = String.raw`(?:公司名称|单位名称|企业名称|主体名称|名\s*称|监理人|设计人|发包人|承包人|代理人|采购人|供应商|服务商|收款方|付款方|第三方|相关方|户\s*名|账户名|收款户名)`;
  const labelRegex = new RegExp(`${label}[ \\t　]*[：:，,.。;；]?\\s*[【\\[（(]?[ \\t　]*(${companyNameSource})`, "g");
  const partyRegex = new RegExp(`(?:${partyLabelSource})[ \\t　]*(?:公司)?名称[ \\t　]*[：:，,.。;；]?\\s*[【\\[（(]?[ \\t　]*(${companyNameSource})`, "g");
  for (const regex of [labelRegex, partyRegex]) {
    for (const match of text.matchAll(regex)) {
      const value = cleanEntityValue(match[1]);
      if (!value || known.has(value) || !isLikelyPartyName(value)) continue;
      fields.push({ value, category: "entityOther", placeholder: "【相关主体】" });
    }
  }
  return fields.filter((entity, index, list) => list.findIndex((item) => item.value === entity.value) === index);
}

function expandSquareWrapper(text, start, end) {
  const pairs = { "【": "】", "[": "]" };
  const open = text[start - 1];
  const close = text[end];
  if (pairs[open] && pairs[open] === close) return { start: start - 1, end: end + 1 };
  return { start, end };
}

function extractLabeledFields(text) {
  const fields = [];
  const labeledPatterns = [
    { category: "contractNumber", regex: /(?:授权书编号|委托书编号|声明函编号|文书编号|文档编号|函件编号|合同编号|合同号|协议编号|协议号|订单编号|项目编号)[：:，,.。\s　]*([【\[（(]?[A-Za-z0-9\u4e00-\u9fa5._/—–\-]{3,80}[】\]\）)]?)/g, placeholder: "【文档编号】" },
    { category: "address", regex: /(?:地址(?:、|及)电话)[：:，,.。\s　]*([^\n|；;]{4,120})/g, placeholder: "【地址及联系方式】" },
    { category: "address", regex: new RegExp(`(?:${partyLabelSource})[：:，,.。\\s　]*(?:公司名称[：:，,.。\\s　]*[^\\n|；;]{2,80})?[：:，,.。\\s　]*地址[：:，,.。\\s　]*([【\\[]?[^\\n|；;】\\]]{4,120}[】\\]]?)`, "g"), placeholder: "【地址】" },
    { category: "address", regex: /(?:注册地址|办公地址|通讯地址|通信地址|送达地址|联系地址|开票地址|发票地址|账单地址|住所地|住所|经营场所|项目地址|服务地址|交付地址|收货地址|履约地点|(?:^|[\n|])[ \t　]*地址)[：:，,.。\s　]*([【\[]?[^\n|；;】\]]{4,120}[】\]]?)/gm, placeholder: "【地址】" },
    { category: "address", regex: /(?:位于|坐落于|所在地为|项目地点为|工程地点为|工程地址为)[：:，,.。\s　]*([^\n，,；;。|]{4,120})/g, placeholder: "【地址】" },
    { category: "person", regex: /(?:收件人|收货人|接收人)[ \t　]*[：:；;，,.。]?[ \t　]*([【\[][^】\]\n|；;]{2,40}[】\]])/g, placeholder: "【收件人】" },
    { category: "person", regex: /(?:联系人及联系方式|联系人和联系方式|联系人\/联系方式|联系人、联系方式)[ \t　]*[：:；;，,.。]?[ \t　]*([\u4e00-\u9fa5·A-Za-z][\u4e00-\u9fa5·A-Za-z \t　]{1,20})(?=[ \t　]*(?:电话|手机|邮箱|电邮|传真|$))/g, placeholder: "【联系人】" },
    { category: "person", regex: /(?:法定代表人\s*[（(]\s*或\s*授权代表\s*[）)]|授权人|授权代表|签字人|签字代表|签署人|委托代理人|发包人代表|承包人代表|项目经理|项目负责人|总监理工程师)(?:[（(][^）)\n]{1,12}[）)])?(?:姓名|名称|岗位|职务)?(?:[ \t　]*[：:；;，,.。][ \t　]*|[ \t　]+)([【\[][^】\]\n|]{2,60}[】\]]|[（(][^）)\n|]{2,60}[）)]|[\u4e00-\u9fa5·A-Za-z][\u4e00-\u9fa5·A-Za-z \t　]{1,28}?)(?=[ \t　]*(?:电话|手机|邮箱|电邮|传真|联系人|联系人及联系方式|授权代表|地址|姓名|职务|岗位|[；;，,.。|]|\n|$))/g, placeholder: "【授权代表信息】" },
    { category: "person", regex: /(?:联系人|收件人|收货人|接收人|经办人|法定代表人|负责人|授权代表|委托代理人|发包人代表|承包人代表|项目经理|项目负责人)(?:[（(][^）)\n]{1,12}[）)])?(?:姓名|岗位|职务)?(?:[ \t　]*[：:，,.。][ \t　]*|[ \t　]+)((?:[【\[（(][\s　]*)?[\u4e00-\u9fa5·A-Za-z][\u4e00-\u9fa5·A-Za-z \t　]{1,28}?)(?=[ \t　]*(?:电话|手机|邮箱|电邮|传真|联系人|联系人及联系方式|授权代表|地址|姓名|职务|岗位|[；;，,.。|]|\n|$))/g, placeholder: "【联系人】" },
    { category: "person", regex: /(?:姓名|姓\s*名|职务|岗位)[ \t　]*[：:，,.。][ \t　]*([【\[（(]?[ \t　]*[\u4e00-\u9fa5·A-Za-z][\u4e00-\u9fa5·A-Za-z \t　]{1,28}[】\]\）)]?)/g, placeholder: "【人员信息】" },
    { category: "bankName", regex: /(?:开户行|开户银行)(?:及|、)(?:账号|帐号)[：:，,.。\s　]*([^\n；;]{4,120})/g, placeholder: "【开户行及账号已删除】" },
    { category: "bankName", regex: /(?:开户银行|账户开户行|开户行)[：:，,.。\s　]*([^\n；;]{2,80})/g, placeholder: "【开户行已删除】" },
    { category: "amount", regex: new RegExp(`(?:金额大写|价款大写|费用大写|大写)[：:，,.。\\s　]*((?:${currencyNamePattern})?[\\s　]*[【\\[（(]?\\s*(?:${currencyNamePattern}\\s*)?${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}?[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?\\s*[】\\]\\）)]?)`, "gi"), placeholder: "【金额】" },
    { category: "amount", regex: new RegExp(`(?:合同总额|合同金额|费用总额|服务费用|服务费|含税金额|不含税金额|价款|租金|违约金|保证金|押金|单价|金额)[：:，,.。\\s　]*((?:${currencyNamePattern}|${currencySymbolPattern})?[\\s　]*[【\\[（(]?[\\s　]*(?:\\d{1,3}(?:[,，]\\d{3})+|\\d+)(?:\\.\\d{1,2})?[\\s　]*(?:万|亿)?[\\s　]*[】\\]\\）)]?[\\s　]*(?:元|美元|美金|港元|港币|欧元|英镑|日元|澳元|加元|新加坡元|新币)?)`, "gi"), placeholder: "【金额】" },
    { category: "amount", regex: new RegExp(`(?:合同总额|合同金额|费用总额|服务费用|服务费|含税金额|不含税金额|价款|租金|违约金|保证金|押金|金额)[：:，,.。\\s　]*((?:${currencyNamePattern})?[\\s　]*[【\\[（(]?[\\s　]*(?:${currencyNamePattern}\\s*)?${chineseUpperMoneyPattern}${chineseUpperMoneyUnitPattern}?[零〇壹贰叁肆伍陆柒捌玖拾佰仟角分]*(?:整|正)?[\\s　]*[】\\]\\）)]?)`, "gi"), placeholder: "【金额】" },
    { category: "numericSpec", regex: /(?:范围|区间|标准要求|参数|结果(?:为)?)[：:，,.。\s　]*(\d+(?:\.\d+)?\s*(?:-|—|–|~|到|至|to)\s*\d+(?:\.\d+)?)/gi, placeholder: "X-Y" },
    {
      category: "project",
      regex: /(?:项目名称|项目代号|采购标的|产品名称|双方就)[：:\s“\"]+([^\n，”\"；;]{2,50})/g,
      placeholder: state.contractType === "tech" ? "【技术项目A】" : state.contractType === "purchase" ? "【采购标的A】" : "【项目或标的A】",
    },
  ];
  for (const item of labeledPatterns) {
    for (const match of text.matchAll(item.regex)) {
      const value = match[1].trim();
      if (item.category === "person" && !isLikelyPersonOrRoleValue(value)) continue;
      if (item.category === "address" && !isLikelyAddressValue(value)) continue;
      const relativeIndex = match[0].indexOf(value);
      fields.push({ start: match.index + relativeIndex, value, category: item.category, placeholder: item.placeholder });
    }
  }
  return fields;
}

function extractContextualPersons(text) {
  const fields = [];
  const nameSource = "[\\u4e00-\\u9fa5·]{2,4}";

  function addName(start, value, placeholder = "【人员姓名】") {
    const clean = value.trim();
    if (!isLikelyPersonOrRoleValue(clean)) return;
    fields.push({ start, value: clean, category: "person", placeholder });
  }

  const lecturerRegex = /(?:讲师|培训讲师|授课老师|授课教师|主讲人)[ \t　]*(?:为|是)?[：:，,.。\s　]*([^，,。\n；;]{2,60})/g;
  for (const match of text.matchAll(lecturerRegex)) {
    const segment = match[1];
    const segmentStart = match.index + match[0].indexOf(segment);
    let cursor = 0;
    for (const token of segment.split(/[、,，和及与\s　]+/)) {
      if (!token) continue;
      const localIndex = segment.indexOf(token, cursor);
      cursor = localIndex + token.length;
      if (!new RegExp(`^${nameSource}$`).test(token)) continue;
      addName(segmentStart + localIndex, token);
    }
  }

  const lawyerRegex = new RegExp(`(?:^|[、,，\\s　])(${nameSource})(?=律师)`, "g");
  for (const match of text.matchAll(lawyerRegex)) {
    const value = match[1];
    const relativeIndex = match[0].indexOf(value);
    addName(match.index + relativeIndex, value);
  }

  const lawyerSegmentRegex = /(?:指派|委托|聘请|保证|由)[^。\n；;]{0,100}律师[^。\n；;]{0,80}/g;
  for (const segmentMatch of text.matchAll(lawyerSegmentRegex)) {
    const segment = segmentMatch[0];
    const nameBeforeLawyerRegex = new RegExp(`(?:本所)?(${nameSource})(?=律师)`, "g");
    for (const nameMatch of segment.matchAll(nameBeforeLawyerRegex)) {
      const value = nameMatch[1];
      if (/(主办|代理|承办|团队|人员|合伙|本案|出庭)/.test(value)) continue;
      const relativeIndex = nameMatch[0].lastIndexOf(value);
      addName(segmentMatch.index + nameMatch.index + relativeIndex, value);
    }
  }

  return fields;
}

function isLikelyPersonOrRoleValue(value) {
  const clean = value.replace(/^[【\[（(\s　]+|[】\]\）)\s　]+$/g, "");
  if (clean.length < 2 || clean.length > 60) return false;
  if (/(?:已获得|获得法定|法定资格|应当|应为|有权|无权|可以|不得|签署本|签订本|或授权|以及|并且)/.test(clean)) return false;
  if (/^(?:待填写|未填写|待补充|未提供|授权范围|委托事项|姓名|姓\s*名|名称|名\s*称|职务|岗位|地址|通讯地址|通信地址|联系电话|电子信箱|电子邮箱)$/.test(clean)) return false;
  if (isLikelyPartyName(clean) || isLikelyAddressValue(clean)) return false;
  const parts = clean.split(/[，,、]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length > 2 || parts.length === 0) return false;
  const nameOrRole = /^[\u4e00-\u9fa5·A-Za-z][\u4e00-\u9fa5·A-Za-z \t　]{1,29}$/;
  return parts.every((part) => nameOrRole.test(part));
}

function isLikelyAddressValue(value) {
  const clean = value.replace(/^[【\[（(\s　]+|[】\]\）)\s　]+$/g, "");
  if (/(?:下述|上述|相关方|书面通知|电邮地址|传真号码|其他地址)/.test(clean)) return false;
  if (clean.length < 4 || clean.length > 140) return false;
  return /(?:省|市|区|县|镇|乡|村|路|街|道|巷|号|楼|室|座|层|大厦|广场|园区|开发区|自治区|特别行政区)/.test(clean) && /\d|号|室|楼|座|层|园|区|路|街|道|村|镇/.test(clean);
}

function addTermMatches(target, term, placeholder = "【敏感信息】") {
  if (!term) return;
  const regex = new RegExp(escapeRegex(term), "g");
  for (const match of state.sourceText.matchAll(regex)) addCandidate(target, match.index, match[0], "custom", placeholder);
}

function addCandidate(target, start, value, category, placeholder) {
  const cleanValue = value.trim();
  const offset = value.indexOf(cleanValue);
  target.push({
    id: `${category}-${start + offset}-${cleanValue.length}`,
    start: start + offset,
    end: start + offset + cleanValue.length,
    value: cleanValue,
    category,
    placeholder: placeholder || categoryConfig[category].placeholder,
    selected: true,
  });
}

function mergeCandidates(candidates) {
  const priority = { contractNumber: 18, idCard: 17, creditCode: 16, bankAccount: 15, bankName: 14, email: 13, phone: 12, entityA: 11, entityB: 11, entityC: 11, entityD: 11, entityE: 11, entityF: 11, entityG: 11, entityH: 11, entityI: 11, entityJ: 11, entityOther: 11, address: 10, person: 9, project: 8, custom: 7, date: 6, duration: 5, installment: 4, ratio: 3, percentage: 2, numericSpec: 1, amount: 0 };
  const sorted = candidates
    .filter((item) => item.value && !isClauseNumberCandidate(item))
    .sort((a, b) => a.start - b.start || b.end - a.end || priority[b.category] - priority[a.category]);
  const result = [];
  for (const candidate of sorted) {
    if (result.some((existing) => candidate.start < existing.end && candidate.end > existing.start)) continue;
    result.push(candidate);
  }
  return result.sort((a, b) => a.start - b.start);
}

function isClauseNumberCandidate(candidate) {
  const lineStart = state.sourceText.lastIndexOf("\n", candidate.start - 1) + 1;
  const lineEnd = state.sourceText.indexOf("\n", lineStart);
  const line = state.sourceText.slice(lineStart, lineEnd === -1 ? state.sourceText.length : lineEnd);
  const leading = line.match(/^[ \t　]*(?:#{1,6}[ \t　]+)?/)[0].length;
  const content = line.slice(leading);
  const ordinal = content.match(new RegExp(`^第(?:\\d+|${chineseNumberPattern})(?:条|款|章|节|项)`));
  const wrapped = content.match(new RegExp(`^[（(【\\[]\\s*(?:\\d+(?:\\.\\d+)*|${chineseNumberPattern})\\s*[）)】\\]]`));
  const plain = content.match(new RegExp(`^(?:\\d+(?:\\s*[.．]\\s*\\d+)*|${chineseNumberPattern})`));
  const token = ordinal || wrapped || plain;
  if (!token) return false;

  const rest = content.slice(token[0].length);
  const hierarchicalClause = /^\d+(?:\s*[.．]\s*\d+)+$/.test(token[0]);
  const semanticUnit = /^\s*(?:个?(?:自然日|工作日|月)|天|日|周|小时|分钟|秒|毫秒|年|亿元|万元|万|元|%|％|轮|件|级|次|套|台|批)(?![\u4e00-\u9fa5])/.test(rest);
  if (semanticUnit && !hierarchicalClause) return false;

  const explicitClause = Boolean(ordinal || wrapped || hierarchicalClause || /^\s*[.．、:：]/.test(rest) || /^\s*[\u4e00-\u9fa5]/.test(rest));
  if (!explicitClause) return false;
  const clauseStart = lineStart + leading;
  const clauseEnd = clauseStart + token[0].length + (/^\s*[.．、:：]/.exec(rest)?.[0].length || 0);
  return candidate.start < clauseEnd && candidate.end > clauseStart;
}

function renderReview() {
  $("pdfReviewNotice").hidden = state.sourceFormat !== "pdf";
  els.sourceFileName.textContent = state.fileName;
  els.matchCount.textContent = state.matches.length;
  const typeNotice = state.contractTypeMode === "auto"
    ? [`文书参考分类：${contractTypeLabel()}（自动判断，请复核）。`]
    : [`已参考手动输入，导出使用通用类别“${contractTypeLabel()}”。`];
  const notices = [...typeNotice, ...state.warnings];
  els.warningStrip.hidden = notices.length === 0;
  els.warningStrip.textContent = notices.join(" ");
  els.sourceDocument.innerHTML = highlightText(state.sourceText, state.matches, false);
  renderFindings();
  renderPreview();
  updateBatchControls();
}

function highlightText(text, matches, preview) {
  let cursor = 0;
  let html = "";
  for (const match of matches) {
    if (!match.selected) continue;
    html += escapeHtml(text.slice(cursor, match.start));
    const shown = preview ? match.placeholder : match.value;
    html += `<mark class="${preview ? "is-removed" : ""}" title="${escapeHtml(categoryConfig[match.category].label)}">${escapeHtml(shown)}</mark>`;
    cursor = match.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

function renderFindings() {
  els.findingsList.replaceChildren();
  if (!state.matches.length) {
    const empty = document.createElement("div");
    empty.className = "finding";
    empty.textContent = "暂未发现候选项。请补充敏感词并人工检查原文。";
    els.findingsList.appendChild(empty);
    return;
  }

  state.matches.forEach((match, index) => {
    const row = document.createElement("label");
    row.className = "finding";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = match.selected;
    checkbox.addEventListener("change", () => {
      match.selected = checkbox.checked;
      els.sourceDocument.innerHTML = highlightText(state.sourceText, state.matches, false);
      renderPreview();
      updateBatchControls();
    });

    const body = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "finding-meta";
    meta.innerHTML = `<span class="category-chip">${escapeHtml(categoryConfig[match.category].label)}</span><span>第 ${index + 1} 项</span>`;
    const value = document.createElement("div");
    value.className = "finding-value";
    value.textContent = match.value;
    value.title = match.value;
    const replacement = document.createElement("input");
    replacement.type = "text";
    replacement.value = match.placeholder;
    replacement.setAttribute("aria-label", `${match.value} 的替换内容`);
    replacement.addEventListener("input", () => {
      match.placeholder = replacement.value || "【已删除】";
      renderPreview();
    });

    body.append(meta, value, replacement);
    row.append(checkbox, body);
    els.findingsList.appendChild(row);
  });
}

function batchMatches(groupKey) {
  const group = batchGroups[groupKey];
  return group ? state.matches.filter((match) => group.categories.has(match.category)) : [];
}

function updateBatchControls() {
  document.querySelectorAll("[data-batch-group]").forEach((button) => {
    const groupKey = button.dataset.batchGroup;
    const group = batchGroups[groupKey];
    const matches = batchMatches(groupKey);
    const keptCount = matches.filter((match) => !match.selected).length;
    const allKept = matches.length > 0 && keptCount === matches.length;
    const label = button.querySelector("[data-batch-label]");
    const count = button.querySelector("[data-batch-count]");

    button.disabled = matches.length === 0;
    button.classList.toggle("is-kept", allKept);
    button.setAttribute("aria-pressed", String(allKept));
    button.setAttribute("aria-label", allKept ? `${group.label}已保留，点击恢复脱敏` : `保留全部${group.label}`);
    label.textContent = allKept ? `${group.label}已保留` : `保留${group.label}`;
    count.textContent = keptCount && !allKept ? `${keptCount}/${matches.length} 已保留` : `${matches.length} 项`;
    button.title = allKept ? `点击后重新脱敏全部${group.label}` : `点击后保留全部${group.label}原文`;
  });
}

function toggleBatchGroup(groupKey) {
  const matches = batchMatches(groupKey);
  if (!matches.length) return;
  const shouldRestoreMasking = matches.every((match) => !match.selected);
  matches.forEach((match) => { match.selected = shouldRestoreMasking; });
  renderReview();
}

function renderPreview() {
  const selected = state.matches.filter((item) => item.selected).sort((a, b) => a.start - b.start);
  els.previewDocument.innerHTML = highlightText(state.sourceText, selected, true);
  state.outputText = applyMatches(state.sourceText, selected);
  if (state.sourceFormat === "pdf") {
    state.outputText = `> ${state.warnings.join("\n> ")}\n\n${state.outputText}`;
  }
}

function applyMatches(text, matches) {
  let result = "";
  let cursor = 0;
  for (const match of matches) {
    result += text.slice(cursor, match.start) + (match.placeholder || "【已删除】");
    cursor = match.end;
  }
  return result + text.slice(cursor);
}

function addQuickTerm() {
  const term = els.quickTerm.value.trim();
  if (!term) return;
  const additions = [];
  addTermMatches(additions, term, `【敏感信息】`);
  if (!additions.length) {
    els.quickTerm.setCustomValidity("原文中没有找到这个词。");
    els.quickTerm.reportValidity();
    return;
  }
  els.quickTerm.setCustomValidity("");
  state.matches = mergeCandidates([...state.matches, ...additions]);
  els.quickTerm.value = "";
  renderReview();
}

function prepareExport() {
  revokeDownloadUrls();
  renderPreview();
  const summary = summaryHistory.record(state.matches);
  prepareDownloadLink(els.downloadMdButton, `${safeFilenamePart(contractTypeLabel())}_${state.sourceFormat === "pdf" ? "PDF文字提取_" : ""}脱敏版.md`, state.outputText);
  prepareDownloadLink(els.downloadReportButton, "文档_脱敏报告.md", buildReport(summary));
  els.openMdButton.href = markdownDataUrl(state.outputText);
  const selected = state.matches.filter((item) => item.selected);
  const unselectedHighRisk = state.matches.filter((item) => !item.selected && categoryConfig[item.category].risk === "high");
  els.exportSummaryText.textContent = state.sourceFormat === "pdf"
    ? `已处理 ${selected.length} 处候选信息。导出仅包含 PDF 提取文字的脱敏稿，不代表原 PDF 已脱敏或内容完整。`
    : `已处理 ${selected.length} 处候选信息，输出文件只包含脱敏后的文本内容。`;
  els.riskCallout.hidden = unselectedHighRisk.length === 0;
  els.riskCallout.textContent = unselectedHighRisk.length
    ? `你保留了 ${unselectedHighRisk.length} 处高风险信息。仍可导出，但请确认这些内容可以提交给大模型。`
    : "";
  els.reviewPrompt.value = buildReviewPrompt();
  setStep(3);
}

function buildReviewPrompt() {
  const type = contractTypeLabel();
  const focuses = {
    tech: "重点检查研发分工、技术成果、知识产权归属、验收、付款、保密、违约与退出机制。",
    purchase: "重点检查采购标的、价格与税费、交付、验收、付款账期、质量责任、违约与争议解决。",
    contract: "重点检查各方角色、权利义务、金额与付款、履行期限、验收、保密、违约、解除与争议解决。",
    authorization: "重点检查授权人与被授权人的对应关系、授权事项、权限范围、地域、有效期、转授权条件、撤销与终止条件。",
    mandate: "重点检查委托人与受托人的对应关系、委托事项、代理权限、期限、转委托条件、撤销与终止条件。",
    statement: "重点检查出具主体、声明或承诺事项、适用对象、条件、例外、期限及责任边界。",
    letter: "重点检查发出方与接收方、函件目的、事实陈述、要求或回应、期限及责任边界。",
    generic: "先判断文本用途，再检查涉及的人物或组织、核心事项、条件、例外、期限及前后是否一致。",
  };
  return `请分析随附的脱敏版${type}。\n\n${focuses[state.contractType] || focuses.generic}\n\n请按以下结构输出：\n1. 核心内容摘要及相关各方角色；\n2. 不明确、矛盾或需核实的内容；\n3. 结合文书用途提出修改或补充建议，不机械套用合同条款清单；\n4. 如涉及风险，说明影响及判断依据；\n5. 每项判断引用对应段落或条款。\n\n请区分“原文明确载明”“原文未载明”“原值已隐藏”和“提取缺失”。不要猜测占位符对应的真实主体、金额、日期或项目，也不要把隐藏值当成原文漏填。因脱敏或提取缺失而无法判断的事项，请明确列出并要求本地回查原件。\n\n提示：AI 分析仅供参考，不能替代专业判断；涉及法律事项时应由律师或企业法务复核。`;
}

function buildReport(summary) {
  const grouped = new Map();
  state.matches.forEach((match) => {
    const key = categoryConfig[match.category].label;
    if (!grouped.has(key)) grouped.set(key, { selected: 0, kept: 0 });
    grouped.get(key)[match.selected ? "selected" : "kept"] += 1;
  });
  const lines = [
    "# 脱敏报告",
    "",
    `- 摘要任务编号：${summary.id}`,
    `- 工具版本：${summary.version}`,
    `- 文书类型：${contractTypeLabel()}${state.contractTypeMode === "auto" ? "（自动识别）" : "（手动输入）"}`,
    `- 处理时间：${new Date(summary.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（UTC+8）`,
    `- 输出格式：Markdown`,
    "- 说明：本报告不记录任何原始敏感值。",
    "",
    "## 处理统计",
    "",
  ];
  if (!grouped.size) lines.push("- 未发现自动识别项，仍需人工检查。");
  grouped.forEach((counts, label) => lines.push(`- ${label}：已处理 ${counts.selected} 处，用户保留 ${counts.kept} 处`));
  if (state.warnings.length) lines.push("", "## 文件提示", "", ...state.warnings.map((item) => `- ${item}`));
  lines.push("", "## 责任提示", "", "本工具仅辅助识别敏感信息，导出前应由用户完成人工复核。AI 分析仅供参考，不能替代律师或企业法务的专业判断。", "");
  return lines.join("\n");
}

function prepareDownloadLink(link, filename, content) {
  link.href = markdownDataUrl(content);
  link.download = filename;
}

function markdownDataUrl(content) {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`;
}

function revokeDownloadUrls() {
  state.downloadUrls.forEach((url) => URL.revokeObjectURL(url));
  state.downloadUrls = [];
  [els.downloadMdButton, els.downloadReportButton, els.openMdButton].forEach((link) => {
    link.removeAttribute("href");
    if (link !== els.openMdButton) link.removeAttribute("download");
  });
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  const copied = document.execCommand("copy");
  helper.remove();
  if (!copied) throw new Error("当前浏览器不允许复制，请长按预览内容手动复制。");
}

function resetApp() {
  activeImport?.abort();
  activeImport = null;
  ++importGeneration;
  state.sourceFormat = "";
  revokeDownloadUrls();
  state.fileName = "";
  state.sourceText = "";
  state.matches = [];
  state.warnings = [];
  state.outputText = "";
  state.contractType = "generic";
  state.contractTypeName = "通用文书";
  state.contractTypeMode = "auto";
  els.fileInput.value = "";
  els.contractType.value = "auto";
  els.manualContractType.value = "";
  els.manualContractType.setCustomValidity('');
  syncContractTypeInput();
  els.customTerms.value = "";
  els.quickTerm.value = "";
  els.quickTerm.setCustomValidity('');
  els.sourceFileName.textContent = '';
  els.reviewPrompt.value = '';
  els.exportSummaryText.textContent = '';
  els.riskCallout.textContent = '';
  els.riskCallout.hidden = true;
  els.warningStrip.textContent = '';
  els.warningStrip.hidden = true;
  $('pdfReviewNotice').hidden = true;
  els.matchCount.textContent = '0';
  els.sourceDocument.textContent = "";
  els.previewDocument.textContent = "";
  els.findingsList.replaceChildren();
  updateBatchControls();
  showNotice("");
  setStep(1);
}

async function parseDocx(arrayBuffer, signal) {
  const entries = await unzipEntries(arrayBuffer, signal);
  const documentXml = entries.get("word/document.xml");
  if (!documentXml) throw new Error("DOCX 中没有找到正文，文件可能已经损坏。");

  const warnings = [];
  if ([...entries.keys()].some((name) => name.startsWith("word/media/"))) warnings.push("文档包含图片；MVP 不读取图片内容，请人工检查图片中的敏感信息。");
  if (entries.has("word/comments.xml")) warnings.push("文档包含批注；批注不会写入输出，请确认其中没有必须保留的文档内容。");
  if ([...entries.keys()].some((name) => name.startsWith("word/embeddings/"))) warnings.push("文档包含嵌入附件；附件未处理，请单独检查。");

  const parts = [documentXml];
  [...entries.entries()]
    .filter(([name]) => /^word\/(header|footer)\d+\.xml$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([, xml]) => parts.push(xml));

  const markdownParts = parts.map((xml, index) => {
    const converted = wordXmlToMarkdown(xml);
    if (index === 0) return converted;
    return converted ? `\n\n---\n\n> 页眉或页脚内容\n\n${converted}` : "";
  });
  return { markdown: markdownParts.join("").trim(), warnings };
}

async function unzipEntries(arrayBuffer, signal) {
  const { readDocxEntries } = await import('./docx-reader.mjs');
  return readDocxEntries(arrayBuffer, signal);
}

function wordXmlToMarkdown(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("DOCX 正文结构无法解析。");
  const body = doc.getElementsByTagNameNS("*", "body")[0] || doc.documentElement;
  const blocks = [];

  for (const node of body.children) {
    if (node.localName === "p") {
      const text = paragraphText(node).trim();
      if (!text) continue;
      const style = firstDescendantAttribute(node, "pStyle", "val") || "";
      const headingMatch = style.match(/(?:Heading|标题)\s*([1-6])/i);
      blocks.push(headingMatch ? `${"#".repeat(Number(headingMatch[1]))} ${text}` : text);
    } else if (node.localName === "tbl") {
      const table = tableToMarkdown(node);
      if (table) blocks.push(table);
    }
  }
  return blocks.join("\n\n");
}

function paragraphText(node) {
  let text = "";
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
  let current = walker.currentNode;
  while (current) {
    if (current.localName === "t") text += current.textContent;
    else if (current.localName === "tab") text += "\t";
    else if (current.localName === "br" || current.localName === "cr") text += "\n";
    current = walker.nextNode();
  }
  return text;
}

function firstDescendantAttribute(node, localName, attributeLocalName) {
  const element = [...node.getElementsByTagNameNS("*", localName)][0];
  if (!element) return null;
  const attribute = [...element.attributes].find((item) => item.localName === attributeLocalName);
  return attribute ? attribute.value : null;
}

function tableToMarkdown(tableNode) {
  const rows = [...tableNode.children]
    .filter((child) => child.localName === "tr")
    .map((row) => [...row.children]
      .filter((child) => child.localName === "tc")
      .map((cell) => [...cell.children]
        .filter((child) => child.localName === "p")
        .map((paragraph) => paragraphText(paragraph).trim())
        .filter(Boolean)
        .join("；")
        .replace(/\|/g, "\\|")));
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
  const header = normalized[0];
  const separator = Array(width).fill("---");
  return [header, separator, ...normalized.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

els.chooseFileButton.addEventListener("click", (event) => { event.stopPropagation(); els.fileInput.click(); });
$("demoButton").addEventListener("click", (event) => { event.stopPropagation(); loadDemo(); });
els.dropZone.addEventListener("click", (event) => { if (event.target !== els.chooseFileButton) els.fileInput.click(); });
els.fileInput.addEventListener("change", () => handleFile(els.fileInput.files[0]));
els.contractType.addEventListener("change", syncContractTypeInput);
["dragenter", "dragover"].forEach((name) => els.dropZone.addEventListener(name, (event) => { event.preventDefault(); els.dropZone.classList.add("is-dragging"); }));
["dragleave", "drop"].forEach((name) => els.dropZone.addEventListener(name, (event) => { event.preventDefault(); els.dropZone.classList.remove("is-dragging"); }));
els.dropZone.addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));
$("clearButton").addEventListener("click", resetApp);
$("backButton").addEventListener("click", () => setStep(1));
$("returnReviewButton").addEventListener("click", () => setStep(2));
$("exportStepButton").addEventListener("click", prepareExport);
$("addTermButton").addEventListener("click", addQuickTerm);
els.quickTerm.addEventListener("keydown", (event) => { if (event.key === "Enter") addQuickTerm(); });
$("selectAllButton").addEventListener("click", () => { state.matches.forEach((item) => { item.selected = true; }); renderReview(); });
document.querySelectorAll("[data-batch-group]").forEach((button) => {
  button.addEventListener("click", () => toggleBatchGroup(button.dataset.batchGroup));
});
async function copyWithFeedback(button, text) {
  const generation = exportGeneration;
  const status = $(`${button.id}Status`);
  button.disabled = true;
  status.textContent = "正在复制……";
  try {
    await copyText(text);
    if (generation === exportGeneration) status.textContent = "已复制。";
  } catch {
    if (generation === exportGeneration) {
      status.textContent = button.id === "copyPromptButton"
        ? "复制未成功，请选中上方提示词后手动复制，或检查浏览器剪贴板权限后重试。"
        : "复制未成功，请下载脱敏 Markdown，或检查浏览器剪贴板权限后重试。";
    }
  } finally {
    if (generation === exportGeneration) button.disabled = false;
  }
}
els.copyMdButton.addEventListener("click", () => copyWithFeedback(els.copyMdButton, state.outputText));
$("copyPromptButton").addEventListener("click", () => copyWithFeedback($("copyPromptButton"), els.reviewPrompt.value));

window.addEventListener("beforeunload", () => {
  activeImport?.abort();
  revokeDownloadUrls();
  state.sourceText = "";
  state.matches = [];
  state.outputText = "";
});

// 本地自动化测试入口；正常打开页面时不会执行。
if (new URLSearchParams(window.location.search).get("fixture") === "docx") {
  fetch("tests/fixture.docx")
    .then((response) => response.arrayBuffer())
    .then(parseDocx)
    .then((result) => {
      state.fileName = "fixture.docx";
      state.sourceText = normalizeText(result.markdown);
      state.contractTypeMode = "auto";
      state.contractType = resolveContractType("auto", state.sourceText);
      state.contractTypeName = detectContractTypeName(state.sourceText, state.contractType);
      els.contractType.value = "auto";
      syncContractTypeInput();
      state.warnings = result.warnings;
      buildMatches();
      renderReview();
      setStep(2);
    })
    .catch((error) => showNotice(`DOCX 测试失败：${error.message}`, true));
}

syncContractTypeInput();
