/**
 * @author : Claude
 * @date : 2024-03-21
 * @module : company-select
 * @description : 公司选择组件模拟数据
 */

// 模拟公司数据
const mockCompanies = [
  { nsrsbh: '91110000123456789X', nsrmc: '北京科技有限公司' },
  { nsrsbh: '91110000234567890X', nsrmc: '上海信息技术有限公司' },
  { nsrsbh: '91110000345678901X', nsrmc: '广州电子科技有限公司' },
  { nsrsbh: '91110000456789012X', nsrmc: '深圳网络科技有限公司' },
  { nsrsbh: '91110000567890123X', nsrmc: '杭州软件科技有限公司' },
  { nsrsbh: '91110000678901234X', nsrmc: '南京智能科技有限公司' },
  { nsrsbh: '91110000789012345X', nsrmc: '武汉数据科技有限公司' },
  { nsrsbh: '91110000890123456X', nsrmc: '成都互联网科技有限公司' },
  { nsrsbh: '91110000901234567X', nsrmc: '重庆云计算科技有限公司' },
  { nsrsbh: '91110000012345678X', nsrmc: '西安人工智能科技有限公司' }
];

// 模拟接口延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 模拟搜索接口
export const mockSearchCompanies = async ({ nsrmc, page, size }) => {
  // 模拟网络延迟
  await delay(500);
  
  // 过滤数据
  const filteredData = mockCompanies.filter(company => 
    company.nsrmc.toLowerCase().includes(nsrmc.toLowerCase())
  );
  
  // 分页
  const start = (page - 1) * size;
  const end = start + size;
  const paginatedData = filteredData.slice(start, end);
  
  return {
    list: paginatedData,
    total: filteredData.length,
    hasMore: end < filteredData.length
  };
}; 