const { pool } = require('../backend/config/database');

async function checkAndProcessRealTasks() {
  try {
    console.log('=== 检查所有前端创建的评估任务 ===');
    
    // 获取所有评估任务
    const [allTasks] = await pool.execute(`
      SELECT et.*, l.longitude, l.latitude, l.formatted_address
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.task_id >= 4
      ORDER BY et.task_id
    `);
    
    console.log('找到的任务:', allTasks.length);
    
    for (const task of allTasks) {
      console.log(`\n=== 任务 ${task.task_id} ===`);
      console.log('任务信息:', {
        task_id: task.task_id,
        radius: task.radius,
        longitude: parseFloat(task.longitude),
        latitude: parseFloat(task.latitude),
        address: task.formatted_address,
        total_score: task.total_score
      });
      
      // 检查目标类别
      const [categories] = await pool.execute('SELECT category_code FROM evaluation_target_categories WHERE task_id = ?', [task.task_id]);
      console.log('目标类别:', categories.map(c => c.category_code));
      
      // 检查交通方式
      const [modes] = await pool.execute('SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?', [task.task_id]);
      console.log('交通方式:', modes.map(m => m.transport_mode));
      
      // 检查评估结果详情
      const [detailsCount] = await pool.execute('SELECT COUNT(*) as count FROM evaluation_result_details WHERE task_id = ?', [task.task_id]);
      console.log('评估结果详情数量:', detailsCount[0].count);
      
      // 如果没有评估结果且总分为0，执行评估
      if (parseFloat(task.total_score) === 0 && detailsCount[0].count === 0) {
        console.log('需要执行评估计算...');
        
        // 将半径扩大到5000米以确保能找到设施
        const adjustedRadius = Math.max(task.radius, 5000);
        
        await performEvaluation(
          task.task_id,
          task.center_location_id,
          parseFloat(task.longitude),
          parseFloat(task.latitude),
          adjustedRadius,
          categories.map(c => c.category_code),
          modes.map(m => m.transport_mode)
        );
        
        // 更新任务半径
        await pool.execute('UPDATE evaluation_tasks SET radius = ? WHERE task_id = ?', [adjustedRadius, task.task_id]);
        
        console.log(`任务 ${task.task_id} 评估完成，半径已更新为 ${adjustedRadius}米`);
      } else {
        console.log('任务已有评估结果，跳过');
      }
    }
    
  } catch (error) {
    console.error('处理失败:', error);
  } finally {
    process.exit();
  }
}

// 执行评估计算
async function performEvaluation(task_id, center_location_id, longitude, latitude, radius, target_categories, transport_modes) {
  try {
    console.log(`开始执行评估计算 - 任务ID: ${task_id}, 半径: ${radius}米`);
    
    let total_score = 0;
    let category_count = 0;
    let total_facilities = 0;

    for (const category_code of target_categories) {
      console.log(`评估设施类别: ${category_code}`);
      
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

      for (const facility of facilities) {
        for (const transport_mode of transport_modes) {
          try {
            const distance = Math.round(facility.distance);
            let travel_time;
            
            switch (transport_mode) {
              case 'walk': travel_time = Math.round(distance / 80); break;
              case 'bus': travel_time = Math.round(distance / 250); break;
              case 'car': travel_time = Math.round(distance / 400); break;
              case 'ride': travel_time = Math.round(distance / 300); break;
              default: travel_time = Math.round(distance / 80);
            }

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

      if (facilities.length > 0) {
        const density_score = Math.min(facilities.length * 8, 40);
        const avg_distance = facilities.reduce((sum, f) => sum + f.distance, 0) / facilities.length;
        const distance_score = Math.max(60 - (avg_distance / 20), 10);
        const category_score = density_score + distance_score;
        total_score += category_score;
        console.log(`类别 ${category_code} 得分: ${category_score.toFixed(2)} (密度: ${density_score}, 距离: ${distance_score.toFixed(2)})`);
      } else {
        console.log(`类别 ${category_code} 没有找到设施`);
      }

      category_count++;
    }

    const final_score = category_count > 0 ? Math.min(total_score / category_count, 100) : 0;
    await pool.execute('UPDATE evaluation_tasks SET total_score = ? WHERE task_id = ?', [final_score, task_id]);

    console.log(`评估任务 ${task_id} 计算完成，总得分: ${final_score.toFixed(2)}, 设施总数: ${total_facilities}`);

  } catch (error) {
    console.error(`评估任务 ${task_id} 计算失败:`, error);
  }
}

checkAndProcessRealTasks();
