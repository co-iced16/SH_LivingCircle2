require('dotenv').config({ path: '../backend/.env' });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

console.log('脚本启动...');

// 使用与测试脚本相同的 performEvaluation 函数
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

async function processRealTask() {
  try {
    console.log('=== 处理前端创建的评估任务 ===');
    
    // 处理任务 6 (半径 3000米)
    const task_id = 6;
    const [tasks] = await pool.execute('SELECT * FROM evaluation_tasks WHERE task_id = ?', [task_id]);
    const [locations] = await pool.execute('SELECT * FROM locations WHERE location_id = ?', [tasks[0].center_location_id]);
    const [categories] = await pool.execute('SELECT category_code FROM evaluation_target_categories WHERE task_id = ?', [task_id]);
    const [modes] = await pool.execute('SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?', [task_id]);
    
    const task = tasks[0];
    const location = locations[0];
    
    console.log('任务信息:', {
      task_id: task.task_id,
      radius: task.radius,
      longitude: parseFloat(location.longitude),
      latitude: parseFloat(location.latitude),
      address: location.formatted_address
    });
    
    await performEvaluation(
      task_id,
      task.center_location_id,
      parseFloat(location.longitude),
      parseFloat(location.latitude),
      task.radius,
      categories.map(c => c.category_code),
      modes.map(m => m.transport_mode)
    );
    
    // 检查结果
    const [details] = await pool.execute('SELECT COUNT(*) as count FROM evaluation_result_details WHERE task_id = ?', [task_id]);
    const [updatedTask] = await pool.execute('SELECT total_score FROM evaluation_tasks WHERE task_id = ?', [task_id]);
    
    console.log('评估结果详情记录数:', details[0].count);
    console.log('最终总分:', updatedTask[0].total_score);
    
  } catch (error) {
    console.error('处理失败:', error);
  } finally {
    process.exit();
  }
}

processRealTask();
