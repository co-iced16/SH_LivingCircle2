const { pool } = require('../config/database');
const { calculateDistance, searchNearbyPOI, getRouteInfo } = require('../utils/map');

// 获取分类下的所有子分类（包括自身）
async function getIncludedCategories(categoryCode) {
  // 获取分类信息
  const [category] = await pool.execute(
    'SELECT category_code, parent_code FROM facility_categories WHERE category_code = ?',
    [categoryCode]
  );
  
  if (category.length === 0) {
    return []; // 分类不存在
  }
  
  const categoryInfo = category[0];
  const includedCategories = [categoryCode]; // 包含自身
  
  // 如果是父级分类，获取所有子分类
  if (!categoryInfo.parent_code || categoryInfo.parent_code === null) {
    // 这是一级分类，获取所有子分类
    const [subCategories] = await pool.execute(
      'SELECT category_code FROM facility_categories WHERE parent_code = ?',
      [categoryCode]
    );
    
    for (const sub of subCategories) {
      includedCategories.push(sub.category_code);
      
      // 如果子分类还有子分类，也要包含
      const [subSubCategories] = await pool.execute(
        'SELECT category_code FROM facility_categories WHERE parent_code = ?',
        [sub.category_code]
      );
      
      for (const subsub of subSubCategories) {
        includedCategories.push(subsub.category_code);
      }
    }
  } else {
    // 这是二级分类，获取其三级子分类
    const [subCategories] = await pool.execute(
      'SELECT category_code FROM facility_categories WHERE parent_code = ?',
      [categoryCode]
    );
    
    for (const sub of subCategories) {
      includedCategories.push(sub.category_code);
    }
  }
  
  return [...new Set(includedCategories)]; // 去重
}

// 获取目标范围内的居民反馈数据
async function getCommunityFeedback(longitude, latitude, radius) {
  try {
    // 获取社区生活圈评价
    const [communityFeedbacks] = await pool.execute(`
      SELECT 
        cf.feedback_id,
        fb.score,
        fb.content,
        cf.resident_type,
        fb.submitted_at,
        l.formatted_address,
        l.longitude,
        l.latitude,
        (111.32 * sqrt(
          pow(? - l.latitude, 2) + 
          pow((? - l.longitude) * cos(radians(?)), 2)
        )) * 1000 as distance
      FROM community_feedback cf
      JOIN feedback_base fb ON cf.feedback_id = fb.feedback_id
      JOIN locations l ON cf.location_id = l.location_id
      WHERE fb.feedback_type = 'community'
      HAVING distance <= ?
      ORDER BY fb.submitted_at DESC
      LIMIT 50
    `, [latitude, longitude, latitude, radius]);

    return communityFeedbacks;
  } catch (error) {
    console.error('获取社区反馈失败:', error.message);
    return [];
  }
}

// 获取特定设施的居民反馈数据
async function getFacilityFeedback(facilityIds) {
  if (!facilityIds || facilityIds.length === 0) {
    return [];
  }

  try {
    const placeholders = facilityIds.map(() => '?').join(',');
    
    const [facilityFeedbacks] = await pool.execute(`
      SELECT 
        ff.feedback_id,
        ff.facility_id,
        fb.score,
        fb.content,
        fb.submitted_at,
        f.name as facility_name
      FROM facility_feedback ff
      JOIN feedback_base fb ON ff.feedback_id = fb.feedback_id
      JOIN facilities f ON ff.facility_id = f.facility_id
      WHERE fb.feedback_type = 'facility' 
        AND ff.facility_id IN (${placeholders})
      ORDER BY fb.submitted_at DESC
    `, facilityIds);

    return facilityFeedbacks;
  } catch (error) {
    console.error('获取设施反馈失败:', error.message);
    return [];
  }
}

// 辅助函数：从地址中提取区域代码
function extractDistrictCode(address) {
  const districtMappings = {
    '黄浦区': '310101',
    '徐汇区': '310104', 
    '长宁区': '310105',
    '静安区': '310106',
    '普陀区': '310107',
    '虹口区': '310109',
    '杨浦区': '310110',
    '浦东新区': '310115',
    '闵行区': '310112',
    '宝山区': '310113',
    '嘉定区': '310114',
    '松江区': '310117',
    '青浦区': '310118',
    '奉贤区': '310120',
    '金山区': '310116',
    '崇明区': '310151'
  };

  for (const [district, code] of Object.entries(districtMappings)) {
    if (address.includes(district)) {
      return code;
    }
  }

  return null; // 无法识别区域
}

// 创建评估任务
const createEvaluationTask = async (req, res) => {
  try {
    const {
      formatted_address,
      longitude,
      latitude,
      radius,
      target_categories,
      transport_modes,
      district_code
    } = req.body;

    // 如果没有提供区域代码，尝试从地址提取
    const finalDistrictCode = district_code || extractDistrictCode(formatted_address);

    // 验证输入
    if (!formatted_address || !longitude || !latitude || !radius) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的位置信息'
      });
    }

    if (!target_categories || target_categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少选择一个设施类别'
      });
    }

    if (!transport_modes || transport_modes.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少选择一种交通方式'
      });
    }

    // 检查或创建位置记录
    let locationId;
    const [existingLocation] = await pool.execute(
      'SELECT location_id FROM locations WHERE longitude = ? AND latitude = ?',
      [longitude, latitude]
    );

    if (existingLocation.length > 0) {
      locationId = existingLocation[0].location_id;
    } else {
      const [locationResult] = await pool.execute(
        'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
        [formatted_address, longitude, latitude, finalDistrictCode]
      );
      locationId = locationResult.insertId;
    }

    // 创建评估任务
    const [taskResult] = await pool.execute(`
      INSERT INTO evaluation_tasks (user_id, center_location_id, radius)
      VALUES (?, ?, ?)
    `, [req.user.user_id, locationId, radius]);

    const task_id = taskResult.insertId;

    // 插入关注的设施类别
    for (const category_code of target_categories) {
      await pool.execute(`
        INSERT INTO evaluation_target_categories (task_id, category_code)
        VALUES (?, ?)
      `, [task_id, category_code]);
    }

    // 插入关注的交通方式
    for (const transport_mode of transport_modes) {
      await pool.execute(`
        INSERT INTO evaluation_target_modes (task_id, transport_mode)
        VALUES (?, ?)
      `, [task_id, transport_mode]);
    }

    // 执行评估计算（异步执行，不阻塞响应）
    performEvaluation(task_id, locationId, longitude, latitude, radius, target_categories, transport_modes)
      .catch(error => console.error('评估计算错误:', error));

    res.status(201).json({
      success: true,
      message: '评估任务创建成功，正在计算中...',
      data: { task_id }
    });

  } catch (error) {
    console.error('创建评估任务错误:', error);
    res.status(500).json({
      success: false,
      message: '创建评估任务失败'
    });
  }
};

// 执行评估计算（后台处理）
async function performEvaluation(task_id, center_location_id, longitude, latitude, radius, target_categories, transport_modes) {
  try {
    console.log(`\n🚀 开始执行评估计算 - 任务ID: ${task_id}`);
    console.log(`📍 中心点: (${longitude}, ${latitude}), 半径: ${radius}m`);
    console.log(`📋 目标分类: [${target_categories.join(', ')}]`);
    console.log(`🚗 交通方式: [${transport_modes.join(', ')}]`);
    
    // 获取社区反馈数据
    console.log(`\n📋 获取社区反馈数据...`);
    const communityFeedbacks = await getCommunityFeedback(longitude, latitude, radius);
    console.log(`📊 找到 ${communityFeedbacks.length} 条社区反馈`);
    
    let total_score = 0;
    let category_count = 0;
    let total_facilities = 0;
    let all_facility_ids = []; // 收集所有设施ID用于获取反馈

    // 对每个关注的设施类别进行评估
    for (const category_code of target_categories) {
      console.log(`\n🏢 ===== 评估设施类别: ${category_code} =====`);
      
      // 获取包含的所有分类代码（支持分层搜索）
      const includedCategories = await getIncludedCategories(category_code);
      console.log(`📂 类别 ${category_code} 包含子分类: [${includedCategories.join(', ')}]`);
      
      if (includedCategories.length === 0) {
        console.log(`❌ 类别 ${category_code} 不存在，跳过`);
        continue;
      }
      
      // 构建 SQL 查询的 IN 子句
      const placeholders = includedCategories.map(() => '?').join(',');
      
      console.log(`🔍 开始搜索系统数据库...`);
      // 查找范围内的设施 - 使用分层搜索
      const [facilities] = await pool.execute(`
        SELECT 
          f.facility_id,
          f.name,
          f.category_code as actual_category,
          l.formatted_address,
          l.longitude,
          l.latitude,
          (111.32 * sqrt(
            pow(? - l.latitude, 2) + 
            pow((? - l.longitude) * cos(radians(?)), 2)
          )) * 1000 as distance
        FROM facilities f
        JOIN locations l ON f.location_id = l.location_id
        WHERE f.category_code IN (${placeholders})
        HAVING distance <= ?
        ORDER BY distance
        LIMIT 50
      `, [latitude, longitude, latitude, ...includedCategories, radius]);

      console.log(`📊 类别 ${category_code} 在系统数据库中找到 ${facilities.length} 个设施`);
      
      // 显示找到的设施详情（前5个）
      if (facilities.length > 0) {
        console.log(`📝 设施详情 (前5个):`);
        facilities.slice(0, 5).forEach((facility, index) => {
          console.log(`   ${index + 1}. ${facility.name} (${facility.actual_category}) - 距离: ${Math.round(facility.distance)}m`);
        });
        if (facilities.length > 5) {
          console.log(`   ... 还有 ${facilities.length - 5} 个设施`);
        }
      }
      
      // 如果设施数量不足10个，使用高德地图API补充搜索
      if (facilities.length < 10) {
        console.log(`⚠️ 类别 ${category_code} 设施不足10个，启动高德地图补充搜索`);
        
        try {
          // 根据分类生成搜索关键词
          const [categoryInfo] = await pool.execute(
            'SELECT category_name FROM facility_categories WHERE category_code = ?',
            [category_code]
          );
          
          if (categoryInfo.length > 0) {
            // 清理分类名称作为搜索关键词
            let keyword = categoryInfo[0].category_name
              .replace(/^.*?-/, '')          // 移除前缀
              .replace(/服务$/, '')          // 移除 "服务" 后缀
              .replace(/场所$/, '')          // 移除 "场所" 后缀
              .trim();
            
            console.log(`🔍 使用关键词 "${keyword}" 在高德地图搜索补充设施`);
            
            // 调用高德地图搜索API
            const additionalPois = await searchNearbyPOI(longitude, latitude, keyword, Math.min(radius, 3000));
            
            console.log(`🌐 高德地图API返回 ${additionalPois?.length || 0} 个补充设施`);
            
            if (additionalPois && additionalPois.length > 0) {
              console.log(`📝 高德POI详情 (前5个):`);
              additionalPois.slice(0, 5).forEach((poi, index) => {
                console.log(`   ${index + 1}. ${poi.name} - 距离: ${Math.round(poi.distance)}m - 地址: ${poi.address}`);
              });
              
              // 将新设施添加到数据库
              let addedCount = 0;
              for (const poi of additionalPois) {
                if (addedCount >= (50 - facilities.length)) break; // 总数不超过50
                
                try {
                  console.log(`➕ 尝试添加设施: ${poi.name}`);
                  
                  // 检查设施是否已存在
                  const [existing] = await pool.execute(
                    'SELECT f.facility_id FROM facilities f JOIN locations l ON f.location_id = l.location_id WHERE f.name = ? AND l.formatted_address = ?',
                    [poi.name, poi.address]
                  );
                  
                  if (existing.length === 0) {
                    // 创建位置记录
                    const districtCode = extractDistrictCode(poi.address);
                    const [locationResult] = await pool.execute(
                      'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
                      [poi.address, poi.longitude, poi.latitude, districtCode]
                    );
                    
                    const location_id = locationResult.insertId;
                    
                    // 创建设施记录，使用原始分类代码
                    const [facilityResult] = await pool.execute(
                      'INSERT INTO facilities (name, location_id, category_code) VALUES (?, ?, ?)',
                      [poi.name, location_id, category_code]
                    );
                    
                    // 添加到当前搜索结果中
                    const distance = calculateDistance(latitude, longitude, poi.latitude, poi.longitude);
                    facilities.push({
                      facility_id: facilityResult.insertId,
                      name: poi.name,
                      actual_category: category_code,
                      formatted_address: poi.address,
                      longitude: poi.longitude,
                      latitude: poi.latitude,
                      distance: distance // calculateDistance 已返回米，无需再乘以1000
                    });
                    
                    addedCount++;
                    console.log(`   ✅ 成功添加设施: ${poi.name} (ID: ${facilityResult.insertId})`);
                  } else {
                    console.log(`   ⏭️ 设施已存在，跳过: ${poi.name}`);
                  }
                } catch (error) {
                  console.error(`   ❌ 添加补充设施失败: ${poi.name}`, error.message);
                }
              }
              
              console.log(`✅ 成功补充 ${addedCount} 个设施，当前总数: ${facilities.length}`);
            } else {
              console.log(`❌ 高德地图未找到补充设施`);
            }
          } else {
            console.log(`❌ 无法获取分类信息，跳过补充搜索`);
          }
        } catch (error) {
          console.error(`❌ 高德地图补充搜索失败:`, error.message);
        }
      } else {
        console.log(`✅ 设施数量充足，无需补充搜索`);
      }
      
      console.log(`📊 类别 ${category_code} 最终设施数量: ${facilities.length}`);
      total_facilities += facilities.length;
      
      // 收集设施ID用于后续获取反馈
      const facilityIds = facilities.map(f => f.facility_id);
      all_facility_ids.push(...facilityIds);

      // 对每个设施计算可达性得分
      console.log(`🚗 开始计算 ${facilities.length} 个设施的可达性...`);
      let processedFacilities = 0;
      
      for (const facility of facilities) {
        processedFacilities++;
        console.log(`📍 处理设施 ${processedFacilities}/${facilities.length}: ${facility.name} (${facility.actual_category})`);
        
        for (const transport_mode of transport_modes) {
          try {
            const distance = Math.round(facility.distance);

            // 优化API调用：对于较近距离(<500m)，直接使用估算避免API配额问题
            let travel_time;
            if (distance < 500) {
              // 近距离直接估算，减少API调用
              switch (transport_mode) {
                case 'walk':
                  travel_time = Math.round(distance / 80);
                  break;
                case 'bus':
                  travel_time = Math.round(distance / 250);
                  break;
                case 'car':
                  travel_time = Math.round(distance / 400);
                  break;
                case 'ride':
                  travel_time = Math.round(distance / 300);
                  break;
                default:
                  travel_time = Math.round(distance / 80);
              }
              console.log(`   🚗 ${transport_mode}: ${distance}m, ${travel_time}min (近距离估算)`);
            } else {
              // 较远距离尝试API调用
              try {
                const routeInfo = await getRouteInfo(longitude, latitude, facility.longitude, facility.latitude, transport_mode);
                travel_time = routeInfo.duration; // 已经是分钟
                
                if (routeInfo.estimated) {
                  console.log(`   🚗 ${transport_mode}: ${distance}m, ${travel_time}min (估算)`);
                } else {
                  console.log(`   🚗 ${transport_mode}: ${distance}m, ${travel_time}min (API)`);
                }
              } catch (apiError) {
                // API失败降级到估算
                switch (transport_mode) {
                  case 'walk':
                    travel_time = Math.round(distance / 80);
                    break;
                  case 'bus':
                    travel_time = Math.round(distance / 250);
                    break;
                  case 'car':
                    travel_time = Math.round(distance / 400);
                    break;
                  case 'ride':
                    travel_time = Math.round(distance / 300);
                    break;
                  default:
                    travel_time = Math.round(distance / 80);
                }
                console.log(`   🚗 ${transport_mode}: ${distance}m, ${travel_time}min (降级估算)`);
              }
            }

            // 记录评估结果详情
            const [insertResult] = await pool.execute(`
              INSERT INTO evaluation_result_details 
              (task_id, facility_id, category_code, transport_mode, travel_time, distance)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [task_id, facility.facility_id, category_code, transport_mode, travel_time, distance]);

            console.log(`   💾 数据已保存到 evaluation_result_details (ID: ${insertResult.insertId})`);

          } catch (error) {
            console.error(`   ❌ 计算设施可达性错误:`, error.message);
          }
        }
      }
      
      console.log(`✅ 完成处理 ${processedFacilities} 个设施的可达性数据`);

      // 获取该类别设施的反馈数据
      const categoryFacilityIds = facilities.map(f => f.facility_id);
      const facilityFeedbacks = await getFacilityFeedback(categoryFacilityIds);
      
      console.log(`📋 类别 ${category_code} 找到 ${facilityFeedbacks.length} 条设施反馈`);
      
      // 为每个设施关联其反馈信息
      const facilityFeedbackMap = new Map();
      for (const fb of facilityFeedbacks) {
        if (!facilityFeedbackMap.has(fb.facility_id)) {
          facilityFeedbackMap.set(fb.facility_id, []);
        }
        facilityFeedbackMap.get(fb.facility_id).push(fb);
      }
      
      // 为设施添加反馈信息
      for (const facility of facilities) {
        facility.feedbacks = facilityFeedbackMap.get(facility.facility_id) || [];
        if (facility.feedbacks.length > 0) {
          facility.avg_score = facility.feedbacks.reduce((sum, fb) => sum + fb.score, 0) / facility.feedbacks.length;
        }
      }

      // 计算该类别的便利度得分
      let category_score = 0;
      let category_has_feedback = facilityFeedbacks.length > 0;
      
      if (facilities.length > 0) {
        // === 1. 设施密度得分 (权重40%) ===
        // 设施数量达到10个就是满分
        const facility_density_score = Math.min((facilities.length / 10) * 100, 100);
        
        // === 2. 交通可达性得分 (权重35%) ===
        // 根据用户选择的交通方式计算最优时间
        const avg_distance = facilities.reduce((sum, f) => sum + f.distance, 0) / facilities.length;
        
        // 获取每个设施在所有交通方式下的最短时间
        let best_times = facilities.map(f => f.travel_time || 999);
        const nearest_time = Math.min(...best_times); // 最近设施的时间（秒）
        
        // 根据交通方式调整时间标准
        // 步行：5分钟内满分；公交/骑行：10分钟内满分；驾车：15分钟内满分
        const mode = transport_modes[0] || 'walk';
        let excellent_time, good_time; // 秒
        if (mode === 'walk') {
          excellent_time = 300;  // 5分钟
          good_time = 900;       // 15分钟
        } else if (mode === 'bus' || mode === 'ride') {
          excellent_time = 600;  // 10分钟
          good_time = 1200;      // 20分钟
        } else { // car
          excellent_time = 900;  // 15分钟
          good_time = 1800;      // 30分钟
        }
        
        let time_score;
        if (nearest_time <= excellent_time) {
          time_score = 100;
        } else if (nearest_time <= good_time) {
          time_score = 100 - ((nearest_time - excellent_time) / (good_time - excellent_time)) * 30;
        } else {
          time_score = Math.max(70 - ((nearest_time - good_time) / good_time) * 20, 50);
        }
        
        // 距离评分作为补充
        const distance_ratio = avg_distance / radius;
        const distance_score = Math.max(100 - distance_ratio * 50, 50);
        
        // 可达性综合：时间占70%，距离占30%
        const accessibility_score = time_score * 0.7 + distance_score * 0.3;
        
        // === 3. 居民反馈得分（仅在有反馈时计入）===
        let feedback_score = 0;
        
        if (category_has_feedback) {
          const avg_feedback_score = facilityFeedbacks.reduce((sum, fb) => sum + fb.score, 0) / facilityFeedbacks.length;
          feedback_score = (avg_feedback_score / 5) * 100;
          console.log(`   - 设施反馈: ${facilityFeedbacks.length}条, 平均评分: ${avg_feedback_score.toFixed(1)}/5`);
        }
        
        // === 综合得分计算 ===
        // 无反馈时：设施密度55% + 可达性45%
        // 有反馈时：设施密度40% + 可达性35% + 反馈25%
        if (category_has_feedback) {
          category_score = (facility_density_score * 0.40) + (accessibility_score * 0.35) + (feedback_score * 0.25);
        } else {
          category_score = (facility_density_score * 0.55) + (accessibility_score * 0.45);
        }
        
        console.log(`类别 ${category_code} 得分详情:`);
        console.log(`   - 设施数量: ${facilities.length}/10 (密度得分: ${facility_density_score.toFixed(1)})`);
        console.log(`   - 最近设施: ${Math.round(nearest_time/60)}分钟[${mode}], 平均距离: ${Math.round(avg_distance)}m (可达性得分: ${accessibility_score.toFixed(1)})`);
        if (category_has_feedback) {
          console.log(`   - 反馈得分: ${feedback_score.toFixed(1)}`);
        } else {
          console.log(`   - 无设施反馈，不计入反馈得分`);
        }
        console.log(`   - 综合得分: ${category_score.toFixed(1)}`);
      } else {
        console.log(`类别 ${category_code} 没有找到设施，得分: 0`);
      }

      
      total_score += category_score;
      category_count++;
    }

    // 计算最终得分（融合社区整体反馈）
    let base_score = category_count > 0 ? total_score / category_count : 0;
    
    // 社区整体反馈调整（更科学的融合方式）
    let final_score = base_score;
    if (communityFeedbacks.length > 0) {
      const avg_community_score = communityFeedbacks.reduce((sum, fb) => sum + fb.score, 0) / communityFeedbacks.length;
      const community_score_normalized = (avg_community_score / 5) * 100;
      
      // 社区反馈可信度：反馈数量越多权重越高，最多10条达到满权重
      const community_confidence = Math.min(communityFeedbacks.length / 10, 1);
      // 社区反馈最大影响权重15%
      const community_weight = 0.15 * community_confidence;
      
      // 加权融合：基础分 * (1-社区权重) + 社区分 * 社区权重
      final_score = base_score * (1 - community_weight) + community_score_normalized * community_weight;
      
      console.log(`\n📋 社区整体反馈分析:`);
      console.log(`   - 反馈数量: ${communityFeedbacks.length}条`);
      console.log(`   - 平均评分: ${avg_community_score.toFixed(1)}/5 (标准化: ${community_score_normalized.toFixed(1)})`);
      console.log(`   - 融合权重: ${(community_weight*100).toFixed(1)}%`);
      console.log(`   - 基础分: ${base_score.toFixed(1)} -> 最终分: ${final_score.toFixed(1)}`);
    }
    
    final_score = Math.max(0, Math.min(final_score, 100));

    // 更新任务的总得分
    await pool.execute(`
      UPDATE evaluation_tasks SET total_score = ? WHERE task_id = ?
    `, [final_score, task_id]);

    // 最终统计验证
    const [finalStats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT category_code) as categories_processed,
        COUNT(DISTINCT facility_id) as total_facilities_recorded,
        COUNT(*) as total_records
      FROM evaluation_result_details 
      WHERE task_id = ?
    `, [task_id]);

    console.log(`\n🎉 评估任务 ${task_id} 计算完成！`);
    console.log(`📊 最终统计:`);
    console.log(`   - 总得分: ${final_score.toFixed(2)}`);
    console.log(`   - 处理分类数: ${category_count}`);
    console.log(`   - 设施总数: ${total_facilities}`);
    console.log(`   - 数据库记录分类数: ${finalStats[0].categories_processed}`);
    console.log(`   - 数据库记录设施数: ${finalStats[0].total_facilities_recorded}`);
    console.log(`   - 数据库记录总条数: ${finalStats[0].total_records}`);

  } catch (error) {
    console.error(`❌ 评估任务 ${task_id} 计算失败:`, error.message);
    console.error(`错误堆栈:`, error.stack);
    
    // 即使出错也要设置一个默认得分，避免任务卡在计算中状态
    try {
      await pool.execute(`
        UPDATE evaluation_tasks SET total_score = 0 WHERE task_id = ?
      `, [task_id]);
      console.log(`已为失败任务 ${task_id} 设置默认得分 0`);
    } catch (updateError) {
      console.error(`更新失败任务得分出错:`, updateError.message);
    }
  }
}

// 获取用户的评估任务列表
const getEvaluationTasks = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const [tasks] = await pool.query(`
      SELECT 
        et.task_id,
        l.formatted_address as center_address,
        et.radius,
        et.created_at,
        et.total_score,
        l.longitude,
        l.latitude,
        l.district_code
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.user_id = ?
      ORDER BY et.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `, [req.user.user_id]);

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM evaluation_tasks WHERE user_id = ?
    `, [req.user.user_id]);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('获取评估任务列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取评估任务列表失败'
    });
  }
};

// 获取评估结果（专门的结果接口）
const getEvaluationResult = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`\n🔍 getEvaluationResult 被调用 - 任务ID: ${id}, 用户ID: ${req.user.user_id}`);

    // 先查询任务是否存在（不限制用户）
    const [allTasks] = await pool.execute(`
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
    `, [id]);

    console.log(`🔍 任务${id}的所有信息:`, allTasks.length > 0 ? allTasks[0] : '未找到');

    // 获取任务基本信息（带用户权限检查）
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
      WHERE et.task_id = ? AND et.user_id = ?
    `, [id, req.user.user_id]);

    console.log(`📊 查询到的任务数量: ${tasks.length}`);
    if (tasks.length > 0) {
      console.log(`📋 任务详情: task_id=${tasks[0].task_id}, total_score=${tasks[0].total_score}, user_id=${tasks[0].user_id}`);
    }

    if (tasks.length === 0) {
      console.log(`❌ 任务不存在或权限不足 - 查询条件: task_id=${id}, user_id=${req.user.user_id}`);
      return res.status(404).json({
        success: false,
        message: '评估任务不存在'
      });
    }

    const task = tasks[0];

    // 获取关注的设施类别
    const [categories] = await pool.execute(`
      SELECT 
        etc.category_code,
        fc.category_name
      FROM evaluation_target_categories etc
      JOIN facility_categories fc ON etc.category_code = fc.category_code
      WHERE etc.task_id = ?
    `, [id]);

    // 获取关注的交通方式
    const [modes] = await pool.execute(`
      SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?
    `, [id]);

    // 获取评估结果详情
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
    `, [id]);

    console.log(`📋 查询到的评估详情记录数: ${details.length}`);
    console.log(`📊 前5条详情记录:`, details.slice(0, 5).map(d => ({
      facility: d.facility_name,
      category: d.category_name,
      distance: d.distance
    })));

    // 获取所有设施的反馈信息
    const facilityIds = [...new Set(details.map(d => d.facility_id))];
    const facilityFeedbacks = await getFacilityFeedback(facilityIds);
    
    // 按设施ID分组反馈
    const facilityFeedbackMap = new Map();
    for (const fb of facilityFeedbacks) {
      if (!facilityFeedbackMap.has(fb.facility_id)) {
        facilityFeedbackMap.set(fb.facility_id, []);
      }
      facilityFeedbackMap.get(fb.facility_id).push({
        score: fb.score,
        content: fb.content,
        submitted_at: fb.submitted_at
      });
    }
    
    // 为每个设施详情添加反馈信息
    for (const detail of details) {
      const feedbacks = facilityFeedbackMap.get(detail.facility_id) || [];
      detail.feedbacks = feedbacks;
      detail.feedback_count = feedbacks.length;
      if (feedbacks.length > 0) {
        detail.avg_score = feedbacks.reduce((sum, fb) => sum + fb.score, 0) / feedbacks.length;
      } else {
        detail.avg_score = null;
      }
    }
    
    console.log(`📋 设施反馈统计: 共${facilityFeedbacks.length}条反馈, 涉及${facilityFeedbackMap.size}个设施`);

    // 按类别统计
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
          min_distance: Infinity,
          avg_travel_time: 0,
          transport_modes: new Set(),
          feedback_count: 0,
          total_feedback_score: 0
        });
      }
      
      const cat = categoryMap.get(key);
      if (!cat.facilities.has(detail.facility_id)) {
        cat.facilities.add(detail.facility_id);
        // 统计该设施的反馈
        if (detail.feedback_count > 0) {
          cat.feedback_count += detail.feedback_count;
          cat.total_feedback_score += detail.avg_score * detail.feedback_count;
        }
      }
      cat.total_distance += detail.distance;
      cat.min_distance = Math.min(cat.min_distance, detail.distance);
      cat.transport_modes.add(detail.transport_mode);
    }

    for (const [key, cat] of categoryMap) {
      const facilityCount = cat.facilities.size;
      const stats = {
        category_code: key,
        category_name: cat.category_name,
        facility_count: facilityCount,
        avg_distance: facilityCount > 0 ? Math.round(cat.total_distance / facilityCount) : 0,
        min_distance: cat.min_distance === Infinity ? 0 : Math.round(cat.min_distance),
        transport_modes: Array.from(cat.transport_modes),
        feedback_count: cat.feedback_count,
        avg_feedback_score: cat.feedback_count > 0 ? (cat.total_feedback_score / cat.feedback_count).toFixed(1) : null
      };
      categoryStats.push(stats);
    }

    // 按交通方式统计
    const transportStats = [];
    const transportMap = new Map();

    for (const detail of details) {
      const key = detail.transport_mode;
      if (!transportMap.has(key)) {
        transportMap.set(key, {
          transport_mode: key,
          facility_count: 0,
          total_time: 0,
          avg_time: 0,
          total_distance: 0,
          avg_distance: 0
        });
      }
      
      const trans = transportMap.get(key);
      trans.facility_count++;
      trans.total_time += detail.travel_time;
      trans.total_distance += detail.distance;
    }

    for (const [key, trans] of transportMap) {
      trans.avg_time = trans.facility_count > 0 ? Math.round(trans.total_time / trans.facility_count) : 0;
      trans.avg_distance = trans.facility_count > 0 ? Math.round(trans.total_distance / trans.facility_count) : 0;
      transportStats.push(trans);
    }

    // 组装完整的评估结果
    const result = {
      task_info: {
        task_id: task.task_id,
        center_address: task.center_address,
        longitude: task.longitude,
        latitude: task.latitude,
        radius: task.radius,
        created_at: task.created_at,
        total_score: Math.round(parseFloat(task.total_score || 0))
      },
      target_categories: categories,
      transport_modes: modes.map(m => m.transport_mode),
      category_stats: categoryStats,
      transport_stats: transportStats,
      facility_details: details,
      summary: {
        total_facilities: new Set(details.map(d => d.facility_id)).size,
        total_categories: categories.length,
        total_transport_modes: modes.length,
        avg_distance: details.length > 0 ? Math.round(details.reduce((sum, d) => sum + d.distance, 0) / details.length) : 0,
        total_feedbacks: facilityFeedbacks.length,
        facilities_with_feedback: facilityFeedbackMap.size
      }
    };

    console.log(`🎯 准备返回的结果:`)
    console.log(`   - task_info.total_score: ${result.task_info.total_score} (原始: ${task.total_score})`)
    console.log(`   - summary.total_facilities: ${result.summary.total_facilities}`)
    console.log(`   - category_stats数量: ${result.category_stats.length}`)
    console.log(`   - facility_details数量: ${result.facility_details.length}`)

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取评估结果错误:', error);
    res.status(500).json({
      success: false,
      message: '获取评估结果失败'
    });
  }
};

// 获取评估任务详情
const getEvaluationTaskDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // 获取任务基本信息
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
      WHERE et.task_id = ? AND et.user_id = ?
    `, [id, req.user.user_id]);

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '评估任务不存在'
      });
    }

    const task = tasks[0];

    // 获取关注的设施类别
    const [categories] = await pool.execute(`
      SELECT 
        etc.category_code,
        fc.category_name
      FROM evaluation_target_categories etc
      JOIN facility_categories fc ON etc.category_code = fc.category_code
      WHERE etc.task_id = ?
    `, [id]);

    // 获取关注的交通方式
    const [modes] = await pool.execute(`
      SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?
    `, [id]);

    // 获取评估结果详情
    const [details] = await pool.execute(`
      SELECT 
        erd.facility_id,
        erd.category_code,
        erd.transport_mode,
        erd.travel_time,
        erd.distance,
        f.name as facility_name,
        l.formatted_address as facility_address,
        fc.category_name
      FROM evaluation_result_details erd
      JOIN facilities f ON erd.facility_id = f.facility_id
      JOIN locations l ON f.location_id = l.location_id
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      WHERE erd.task_id = ?
      ORDER BY erd.category_code, erd.distance
    `, [id]);

    res.json({
      success: true,
      data: {
        task,
        target_categories: categories,
        transport_modes: modes.map(m => m.transport_mode),
        evaluation_details: details
      }
    });

  } catch (error) {
    console.error('获取评估任务详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取评估任务详情失败'
    });
  }
};

// 删除评估任务
const deleteEvaluationTask = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查任务是否存在且属于当前用户
    const [tasks] = await pool.execute(`
      SELECT task_id FROM evaluation_tasks WHERE task_id = ? AND user_id = ?
    `, [id, req.user.user_id]);

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '评估任务不存在'
      });
    }

    // 删除评估任务（级联删除会自动删除相关记录）
    await pool.execute(`
      DELETE FROM evaluation_tasks WHERE task_id = ?
    `, [id]);

    res.json({
      success: true,
      message: '评估任务删除成功'
    });

  } catch (error) {
    console.error('删除评估任务错误:', error);
    res.status(500).json({
      success: false,
      message: '删除评估任务失败'
    });
  }
};

// 获取评估统计
const getEvaluationStats = async (req, res) => {
  try {
    // 用户的评估任务统计
    const [userStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_tasks,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score
      FROM evaluation_tasks 
      WHERE user_id = ? AND total_score IS NOT NULL
    `, [req.user.user_id]);

    // 按设施类别统计
    const [categoryStats] = await pool.execute(`
      SELECT 
        fc.category_name,
        COUNT(DISTINCT erd.task_id) as task_count,
        COUNT(erd.facility_id) as facility_count,
        AVG(erd.distance) as avg_distance
      FROM evaluation_result_details erd
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      JOIN evaluation_tasks et ON erd.task_id = et.task_id
      WHERE et.user_id = ?
      GROUP BY erd.category_code, fc.category_name
      ORDER BY task_count DESC
    `, [req.user.user_id]);

    res.json({
      success: true,
      data: {
        user_stats: userStats[0],
        category_stats: categoryStats
      }
    });

  } catch (error) {
    console.error('获取评估统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
};

module.exports = {
  createEvaluationTask,
  getEvaluationTasks,
  getEvaluationTaskDetails,
  getEvaluationResult,
  deleteEvaluationTask,
  getEvaluationStats
};
