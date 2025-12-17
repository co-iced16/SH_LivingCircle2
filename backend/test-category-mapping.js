const { validateAndMapCategoryCode } = require('./utils/categoryMapping');

async function testCategoryMapping() {
  console.log('🧪 测试分类代码映射功能...\n');
  
  const testCases = [
    // 测试用例: [原始分类代码, 预期结果描述]
    ['050100', '直接匹配 - 中餐厅'],
    ['050101', '三级映射 - 综合酒楼 -> 中餐厅'],
    ['050102', '三级映射 - 四川菜 -> 中餐厅'],
    ['050199', '三级映射 - 其他中餐 -> 中餐厅'],
    ['051000', '二级映射 - 未定义的餐饮小类 -> 餐饮服务'],
    ['110000', '直接匹配 - 风景名胜'],
    ['110101', '三级映射 - 风景区细分 -> 风景名胜'],
    ['990000', '无效分类 - 应该返回无效'],
    ['141201', '直接匹配 - 高等院校'],
    ['141299', '二级映射 - 其他学校 -> 科教文化服务']
  ];
  
  for (const [code, description] of testCases) {
    try {
      const result = await validateAndMapCategoryCode(code);
      
      if (result.isValid) {
        console.log(`✅ ${code} -> ${result.mappedCode} (${description})`);
        if (result.mappedCode !== result.originalCode) {
          console.log(`   📍 映射: ${result.originalCode} -> ${result.mappedCode}`);
        }
      } else {
        console.log(`❌ ${code} -> 无效 (${description})`);
      }
    } catch (error) {
      console.error(`💥 ${code} -> 错误: ${error.message}`);
    }
  }
  
  console.log('\n🎯 映射逻辑说明:');
  console.log('   - 6位代码: 先尝试匹配前4位+00，再尝试前2位+0000');
  console.log('   - 4位代码: 尝试匹配前2位+0000');
  console.log('   - 直接匹配: 如果代码在我们系统中存在则直接使用');
  
  process.exit(0);
}

testCategoryMapping().catch(console.error);
