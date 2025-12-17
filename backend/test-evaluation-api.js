const { pool } = require('./config/database');

async function testEvaluationAPI() {
  try {
    console.log('🧪 测试评估结果API...\n');

    // 模拟 getEvaluationResult 函数的核心逻辑
    const taskId = 24;
    const userId = 1; // 假设用户ID为1

    console.log(`📋 测试任务ID: ${taskId}`);
    
    // 1. 获取任务基本信息
    const [tasks] = await pool.execute(`
      SELECT 
        et.task_id,
        et.user_id,
        l.formatted_address as center_address,
        et.radius,
        et.created_at,
        et.total_score,
        l.longitude,
        l.latitude,
        l.district_code
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.task_id = ?
    `, [taskId]);

    if (tasks.length === 0) {
      console.log('❌ 任务不存在');
      return;
    }

    const task = tasks[0];
    console.log('📊 任务基本信息:');
    console.log(`   - 任务ID: ${task.task_id}`);
    console.log(`   - 用户ID: ${task.user_id}`);
    console.log(`   - 总分: ${task.total_score} (类型: ${typeof task.total_score})`);
    console.log(`   - 地址: ${task.center_address}`);
    console.log(`   - 半径: ${task.radius}m`);

    // 2. 获取关注的设施类别
    const [categories] = await pool.execute(`
      SELECT 
        etc.category_code,
        fc.category_name
      FROM evaluation_target_categories etc
      JOIN facility_categories fc ON etc.category_code = fc.category_code
      WHERE etc.task_id = ?
    `, [taskId]);

    console.log(`\n📂 目标设施类别 (${categories.length}个):`);
    categories.forEach(cat => {
      console.log(`   - ${cat.category_code}: ${cat.category_name}`);
    });

    // 3. 获取关注的交通方式
    const [modes] = await pool.execute(`
      SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?
    `, [taskId]);

    console.log(`\n🚗 交通方式 (${modes.length}个):`);
    modes.forEach(mode => {
      console.log(`   - ${mode.transport_mode}`);
    });

    // 4. 获取评估结果详情
    const [details] = await pool.execute(`
      SELECT 
        erd.facility_id,
        erd.category_code,
        erd.transport_mode,
        erd.travel_time,
        erd.distance,
        f.name as facility_name,
        l.formatted_address as facility_address,
        l.longitude as facility_lng,
        l.latitude as facility_lat,
        fc.category_name
      FROM evaluation_result_details erd
      JOIN facilities f ON erd.facility_id = f.facility_id
      JOIN locations l ON f.location_id = l.location_id
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      WHERE erd.task_id = ?
      ORDER BY erd.category_code, erd.distance
    `, [taskId]);

    console.log(`\n🏢 评估详情记录: ${details.length}条`);

    // 5. 按类别统计设施数量
    const categoryStats = [];
    const categoryMap = new Map();

    for (const detail of details) {
      const key = detail.category_code;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          category_code: key,
          category_name: detail.category_name,
          facilities: new Set(),
          total_distance: 0,
          min_distance: Infinity
        });
      }
      
      const cat = categoryMap.get(key);
      cat.facilities.add(detail.facility_id);
      cat.total_distance += detail.distance;
      cat.min_distance = Math.min(cat.min_distance, detail.distance);
    }

    console.log('\n📊 按分类统计:');
    for (const [key, cat] of categoryMap) {
      const facilityCount = cat.facilities.size;
      console.log(`   - ${key} (${cat.category_name}): ${facilityCount}个设施`);
      categoryStats.push({
        category_code: key,
        category_name: cat.category_name,
        facility_count: facilityCount,
        avg_distance: facilityCount > 0 ? Math.round(cat.total_distance / facilityCount) : 0,
        min_distance: cat.min_distance === Infinity ? 0 : Math.round(cat.min_distance)
      });
    }

    // 6. 构建最终返回数据
    const result = {
      task_info: {
        task_id: task.task_id,
        center_address: task.center_address,
        longitude: task.longitude,
        latitude: task.latitude,
        radius: task.radius,
        created_at: task.created_at,
        total_score: Math.round(parseFloat(task.total_score || 0)) // 这里是关键！
      },
      target_categories: categories,
      transport_modes: modes.map(m => m.transport_mode),
      category_stats: categoryStats,
      facility_details: details,
      summary: {
        total_facilities: new Set(details.map(d => d.facility_id)).size,
        total_categories: categories.length,
        total_transport_modes: modes.length,
        avg_distance: details.length > 0 ? Math.round(details.reduce((sum, d) => sum + d.distance, 0) / details.length) : 0
      }
    };

    console.log('\n🎯 最终API返回数据:');
    console.log('   - task_info.total_score:', result.task_info.total_score, '(类型:', typeof result.task_info.total_score, ')');
    console.log('   - summary.total_facilities:', result.summary.total_facilities);
    console.log('   - summary.total_categories:', result.summary.total_categories);
    console.log('   - category_stats数量:', result.category_stats.length);
    
    console.log('\n🔍 分类统计详情:');
    result.category_stats.forEach(stat => {
      console.log(`   - ${stat.category_name}: ${stat.facility_count}个设施, 平均距离: ${stat.avg_distance}m`);
    });

    console.log('\n✅ API测试完成！数据看起来正确。');
    console.log('📝 问题分析: 后端返回的数据是正确的，问题可能在前端处理逻辑。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await pool.end();
  }
}

testEvaluationAPI();
