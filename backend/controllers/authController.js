const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// 用户注册
const register = async (req, res) => {
  try {
    const { username, password, email, phone } = req.body;

    // 输入验证
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空',
        error_code: 'INVALID_USERNAME'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码至少需要6个字符',
        error_code: 'INVALID_PASSWORD'
      });
    }

    // 检查用户是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)',
      [username.trim(), email ? email.trim() : null]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: '用户名或邮箱已存在',
        error_code: 'USER_EXISTS'
      });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 插入新用户
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      [username.trim(), passwordHash, email ? email.trim() : null]
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        id: result.insertId,
        username: username.trim()
      }
    });

  } catch (error) {
    console.error('注册错误:', error);
    
    // 处理数据库错误
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: '用户名或邮箱已存在',
        error_code: 'DUPLICATE_ENTRY'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试',
      error_code: 'INTERNAL_ERROR'
    });
  }
};

// 用户登录
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 输入验证
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空',
        error_code: 'INVALID_USERNAME'
      });
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: '密码不能为空',
        error_code: 'INVALID_PASSWORD'
      });
    }

    // 查找用户
    const [users] = await pool.execute(
      'SELECT user_id, username, password_hash, email, role FROM users WHERE username = ?',
      [username.trim()]
    );

    if (users.length === 0) {
      // 统一错误消息，防止用户名枚举攻击
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
        error_code: 'INVALID_CREDENTIALS'
      });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
        error_code: 'INVALID_CREDENTIALS'
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'default-secret-key-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token: token,
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试',
      error_code: 'INTERNAL_ERROR'
    });
  }
};

// 获取当前用户信息
const getProfile = async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT user_id, username, email, role FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
};

// 更新用户信息
const updateProfile = async (req, res) => {
  try {
    const { email } = req.body;
    
    await pool.execute(
      'UPDATE users SET email = ? WHERE user_id = ?',
      [email || null, req.user.user_id]
    );

    res.json({
      success: true,
      message: '用户信息更新成功'
    });

  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
};

// 修改密码
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // 验证旧密码
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    const isValidOldPassword = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!isValidOldPassword) {
      return res.status(400).json({
        success: false,
        message: '原密码错误'
      });
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [newPasswordHash, req.user.user_id]
    );

    res.json({
      success: true,
      message: '密码修改成功'
    });

  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      message: '密码修改失败'
    });
  }
};

// 获取所有用户列表（管理员专用）
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    let params = [];

    if (keyword) {
      whereClause = 'WHERE username LIKE ? OR email LIKE ?';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const [users] = await pool.execute(`
      SELECT user_id, username, email, role, 
             (SELECT COUNT(*) FROM feedback_base WHERE user_id = users.user_id) as feedback_count,
             (SELECT COUNT(*) FROM evaluation_tasks WHERE user_id = users.user_id) as evaluation_count
      FROM users
      ${whereClause}
      ORDER BY user_id DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `, params);

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
};

// 更新用户角色（管理员专用）
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的角色'
      });
    }

    // 不能修改自己的角色
    if (parseInt(id) === req.user.user_id) {
      return res.status(400).json({
        success: false,
        message: '不能修改自己的角色'
      });
    }

    await pool.execute(
      'UPDATE users SET role = ? WHERE user_id = ?',
      [role, id]
    );

    res.json({
      success: true,
      message: '用户角色更新成功'
    });

  } catch (error) {
    console.error('更新用户角色错误:', error);
    res.status(500).json({
      success: false,
      message: '更新用户角色失败'
    });
  }
};

// 删除用户（管理员专用）
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // 不能删除自己
    if (parseInt(id) === req.user.user_id) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己'
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM users WHERE user_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '用户删除成功'
    });

  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({
      success: false,
      message: '删除用户失败'
    });
  }
};

// 获取用户统计（管理员专用）
const getUserStats = async (req, res) => {
  try {
    const [totalUsers] = await pool.execute('SELECT COUNT(*) as total FROM users');
    const [adminCount] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const [recentUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE user_id > (SELECT MAX(user_id) - 10 FROM users)'
    );
    const [activeFeedback] = await pool.execute(
      'SELECT COUNT(DISTINCT user_id) as count FROM feedback_base'
    );

    res.json({
      success: true,
      data: {
        total: totalUsers[0].total,
        admins: adminCount[0].count,
        users: totalUsers[0].total - adminCount[0].count,
        activeUsers: activeFeedback[0].count
      }
    });

  } catch (error) {
    console.error('获取用户统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getUsers,
  updateUserRole,
  deleteUser,
  getUserStats
};
