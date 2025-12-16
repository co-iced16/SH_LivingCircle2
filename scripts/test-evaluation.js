const { pool } = require('../backend/config/database');

async function checkData() {
  try {
    console.log('=== 检查设施数据分布 ===');
    
    // 检查设施数据的地理分布
    const [facilities] = await pool.execute(`
      SELECT f.category_code, COUNT(*) as count, 
             MIN(l.longitude) as min_lng, MAX(l.longitude) as max_lng, 
             MIN(l.latitude) as min_lat, MAX(l.latitude) as max_lat 
      FROM facilities f 
      JOIN locations l ON f.location_id = l.location_id 
      WHERE f.category_code IN ('050100', '110000') 
      GROUP BY f.category_code
    `);
    
    console.log('设施地理分布:', facilities);
    
    // 查看具体设施位置
    const [samples] = await pool.execute(`
      SELECT f.name, f.category_code, l.longitude, l.latitude, l.formatted_address 
      FROM facilities f 
      JOIN locations l ON f.location_id = l.location_id 
      WHERE f.category_code IN ('050100', '110000') 
      LIMIT 5
    `);
    
    console.log('设施样本:', samples);
    
    // 测试中心点
    const center_lng = 121.506269;
    const center_lat = 31.281904;
    console.log('中心点:', { lng: center_lng, lat: center_lat });
    
    // 手动计算距离看看
    const [test] = await pool.execute(`
      SELECT f.name, l.longitude, l.latitude, l.formatted_address, 
             (111.32 * sqrt(
               pow(? - l.latitude, 2) + 
               pow((? - l.longitude) * cos(radians(?)), 2)
             )) * 1000 as distance 
      FROM facilities f 
      JOIN locations l ON f.location_id = l.location_id 
      WHERE f.category_code = '050100' 
      ORDER BY distance 
      LIMIT 3
    `, [center_lat, center_lng, center_lat]);
    
    console.log('最近的050100设施:', test);
    
    // 测试其他类别
    const [test2] = await pool.execute(`
      SELECT f.name, l.longitude, l.latitude, l.formatted_address, 
             (111.32 * sqrt(
               pow(? - l.latitude, 2) + 
               pow((? - l.longitude) * cos(radians(?)), 2)
             )) * 1000 as distance 
      FROM facilities f 
      JOIN locations l ON f.location_id = l.location_id 
      WHERE f.category_code = '110000' 
      ORDER BY distance 
      LIMIT 3
    `, [center_lat, center_lng, center_lat]);
    
    console.log('最近的110000设施:', test2);
    
  } catch (error) {
    console.error('检查失败:', error);
  }
}

// 执行评估计算（测试版本）
async function performEvaluation(task_id, center_location_id, longitude, latitude, radius, target_categories, transport_modes) {
  try {
    console.log(`开始执行评估计算 - 任务ID: ${task_id}`);
    
    let total_score = 0;
    let category_count = 0;
    let total_facilities = 0;

    // 对每个关注的设施类别进行评估
    for (const category_code of target_categories) {
      console.log(`评估设施类别: ${category_code}`);
      
      // 查找范围内的设施 - 简化距离计算
      const [facilities] = await pool.execute(`
        SELECT 
          f.facility_id,
          f.name,
          l.formatted_address,
          l.longitude,
          l.latitude,
          (111.32 * sqrt(
            pow(? - l.latitude, 2) + 
            pow((? - l.longitude) * cos(radians(?)), 2)
          )) * 1000 as distance
        FROM facilities f
        JOIN locations l ON f.location_id = l.location_id
        WHERE f.category_code = ? 
        HAVING distance <= ?
        ORDER BY distance
        LIMIT 50
      `, [latitude, longitude, latitude, category_code, radius]);

      console.log(`类别 ${category_code} 找到 ${facilities.length} 个设施`);
      total_facilities += facilities.length;

      // 对每个设施计算可达性得分
      for (const facility of facilities) {
        for (const transport_mode of transport_modes) {
          try {
            const distance = Math.round(facility.distance);

            // 估算时间（简化计算）
            let travel_time;
            switch (transport_mode) {
              case 'walk':
                travel_time = Math.round(distance / 80); // 步行速度约80m/min
                break;
              case 'bus':
                travel_time = Math.round(distance / 250); // 公交平均速度约250m/min
                break;
              case 'car':
                travel_time = Math.round(distance / 400); // 汽车平均速度约400m/min
                break;
              case 'ride':
                travel_time = Math.round(distance / 300); // 骑行平均速度约300m/min
                break;
              default:
                travel_time = Math.round(distance / 80);
            }

            // 记录评估结果详情
            await pool.execute(`
              INSERT INTO evaluation_result_details 
              (task_id, facility_id, category_code, transport_mode, travel_time, distance)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [task_id, facility.facility_id, category_code, transport_mode, travel_time, distance]);

          } catch (error) {
            console.error('计算设施可达性错误:', error);
          }
        }
      }

      // 计算该类别的得分（基于设施数量和平均距离）
      if (facilities.length > 0) {
        // 简化的评分算法：设施数量越多，距离越近得分越高
        const density_score = Math.min(facilities.length * 8, 40); // 密度得分（最高40分）
        const avg_distance = facilities.reduce((sum, f) => sum + f.distance, 0) / facilities.length;
        const distance_score = Math.max(60 - (avg_distance / 20), 10); // 距离得分（最高60分）
        
        const category_score = density_score + distance_score;
        total_score += category_score;
        console.log(`类别 ${category_code} 得分: ${category_score.toFixed(2)} (密度: ${density_score}, 距离: ${distance_score.toFixed(2)})`);
      } else {
        console.log(`类别 ${category_code} 没有找到设施`);
      }

      category_count++;
    }

    // 计算最终得分
    const final_score = category_count > 0 ? Math.min(total_score / category_count, 100) : 0;

    // 更新任务的总得分
    await pool.execute(`
      UPDATE evaluation_tasks SET total_score = ? WHERE task_id = ?
    `, [final_score, task_id]);

    console.log(`评估任务 ${task_id} 计算完成，总得分: ${final_score.toFixed(2)}, 设施总数: ${total_facilities}`);

  } catch (error) {
    console.error(`评估任务 ${task_id} 计算失败:`, error);
  }
}

async function testEvaluation() {
  try {
    // 首先检查数据
    await checkData();
    
    console.log('\n=== 开始评估计算测试 ===');
    const task_id = 2;
    const longitude = 121.506269;
    const latitude = 31.281904;
    const radius = 5000; // 扩大到5公里
    const target_categories = ['050100', '110000'];
    const transport_modes = ['bus', 'walk'];
    
    await performEvaluation(task_id, 226, longitude, latitude, radius, target_categories, transport_modes);
    
    // 检查结果
    const [details] = await pool.execute('SELECT COUNT(*) as count FROM evaluation_result_details WHERE task_id = ?', [task_id]);
    const [task] = await pool.execute('SELECT total_score FROM evaluation_tasks WHERE task_id = ?', [task_id]);
    
    console.log('评估结果详情记录数:', details[0].count);
    console.log('最终总分:', task[0].total_score);
    
  } catch (error) {
    console.error('测试评估失败:', error);
  } finally {
    process.exit();
  }
}

testEvaluation();
