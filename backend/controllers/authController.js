const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// 用户注册
const register = async (req, res) => {
  try {
    const { username, password, email, phone } = req.body;

    // 检查用户是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE username = ? OR email = ?',
      [username, email || '']
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: '用户名或邮箱已存在'
      });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 插入新用户
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      [username, passwordHash, email || null]
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        id: result.insertId,
        username: username
      }
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试'
    });
  }
};

// 用户登录
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const [users] = await pool.execute(
      'SELECT user_id, username, password_hash, email, role FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
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
      message: '登录失败，请稍后重试'
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

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};
