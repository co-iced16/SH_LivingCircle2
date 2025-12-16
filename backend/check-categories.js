const { pool } = require('./config/database');

async function checkAllCategories() {
  try {
    const [categories] = await pool.execute('SELECT category_code, category_name FROM facility_categories ORDER BY category_code');
    
    console.log('所有有效的分类代码:');
    categories.forEach(cat => {
      console.log(`${cat.category_code} - ${cat.category_name}`);
    });
    
    console.log(`\n总分类数: ${categories.length}`);
    
    // 检查是否有常见的分类
    const commonCategories = ['医院', '学校', '银行', '超市', '餐厅'];
    console.log('\n检查常见分类是否存在:');
    for (const keyword of commonCategories) {
      const found = categories.filter(cat => cat.category_name.includes(keyword));
      if (found.length > 0) {
        found.forEach(cat => console.log(`✅ ${keyword}: ${cat.category_code} - ${cat.category_name}`));
      } else {
        console.log(`❌ ${keyword}: 未找到`);
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error('查询错误:', error);
  }
}

checkAllCategories();
