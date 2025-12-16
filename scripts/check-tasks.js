const { pool } = require('../backend/config/database');

async function checkRealTasks() {
  try {
    console.log('=== 检查前端创建的评估任务 ===');
    
    // 检查任务 4, 5, 6, 7
    const taskIds = [4, 5, 6, 7];
    
    for (const taskId of taskIds) {
      const [tasks] = await pool.execute('SELECT * FROM evaluation_tasks WHERE task_id = ?', [taskId]);
      if (tasks.length > 0) {
        console.log(`任务 ${taskId} 状态:`, tasks[0]);
        
        // 检查评估结果详情
        const [details] = await pool.execute('SELECT COUNT(*) as count FROM evaluation_result_details WHERE task_id = ?', [taskId]);
        console.log(`任务 ${taskId} 评估结果详情数量:`, details[0].count);
        
        // 检查目标类别和交通方式
        const [categories] = await pool.execute('SELECT category_code FROM evaluation_target_categories WHERE task_id = ?', [taskId]);
        const [modes] = await pool.execute('SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?', [taskId]);
        
        console.log(`任务 ${taskId} 目标类别:`, categories.map(c => c.category_code));
        console.log(`任务 ${taskId} 交通方式:`, modes.map(m => m.transport_mode));
        console.log('---');
      } else {
        console.log(`任务 ${taskId} 不存在`);
      }
    }
    
    // 也检查一下所有存在的任务
    const [allTasks] = await pool.execute('SELECT task_id, total_score, created_at FROM evaluation_tasks ORDER BY task_id DESC');
    console.log('所有评估任务:');
    allTasks.forEach(task => {
      console.log(`- 任务 ${task.task_id}: 得分 ${task.total_score}, 创建时间 ${task.created_at}`);
    });
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit();
  }
}

checkRealTasks();
