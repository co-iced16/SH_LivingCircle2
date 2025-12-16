-- 创建用户位置信息表
USE sh_living_circle1;

-- 删除已存在的表（如果需要重新创建）
-- DROP TABLE IF EXISTS user_locations;

-- 创建用户位置信息表
CREATE TABLE IF NOT EXISTS user_locations (
    location_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '位置ID',
    longitude DECIMAL(10, 6) NOT NULL COMMENT '经度',
    latitude DECIMAL(9, 6) NOT NULL COMMENT '纬度', 
    formatted_address TEXT COMMENT '格式化地址',
    accuracy INT COMMENT '定位精度（米）',
    type VARCHAR(50) DEFAULT 'user_location' COMMENT '位置类型',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 添加索引优化查询性能
    INDEX idx_coordinates (longitude, latitude),
    INDEX idx_created_at (created_at),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户位置信息表';

-- 验证表结构
DESCRIBE user_locations;

-- 显示表信息
SHOW TABLE STATUS LIKE 'user_locations';
