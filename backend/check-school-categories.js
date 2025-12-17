const { pool } = require('./config/database');

async function checkSchoolCategories() {
  try {
    const [cats] = await pool.execute(
      'SELECT category_code, category_name FROM facility_categories WHERE category_code LIKE ? ORDER BY category_code',
      ['141%']
    );
    
    console.log('学校相关分类:');
    cats.forEach(cat => {
      console.log(`${cat.category_code} - ${cat.category_name}`);
    });
    
    console.log(`\n总共找到 ${cats.length} 个学校相关分类`);
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchoolCategories();
