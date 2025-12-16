const Joi = require('joi');

// 用户注册验证
const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': '用户名只能包含字母和数字',
      'string.min': '用户名至少需要3个字符',
      'string.max': '用户名不能超过30个字符',
      'any.required': '用户名为必填项'
    }),
  password: Joi.string()
    .min(6)
    .max(100)
    .required()
    .messages({
      'string.min': '密码至少需要6个字符',
      'string.max': '密码不能超过100个字符',
      'any.required': '密码为必填项'
    }),
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': '请输入有效的邮箱地址'
    }),
  phone: Joi.string()
    .pattern(/^1[3-9]\d{9}$/)
    .optional()
    .messages({
      'string.pattern.base': '请输入有效的手机号码'
    })
});

// 用户登录验证
const loginSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      'any.required': '用户名为必填项'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': '密码为必填项'
    })
});

// 社区反馈验证
const communityFeedbackSchema = Joi.object({
  longitude: Joi.number()
    .required()
    .messages({
      'any.required': '经度为必填项'
    }),
  latitude: Joi.number()
    .required()
    .messages({
      'any.required': '纬度为必填项'
    }),
  formatted_address: Joi.string()
    .min(5)
    .max(255)
    .required()
    .messages({
      'string.min': '地址至少需要5个字符',
      'string.max': '地址不能超过255个字符',
      'any.required': '地址为必填项'
    }),
  district_code: Joi.string()
    .max(20)
    .optional()
    .messages({
      'string.max': '区域代码不能超过20个字符'
    }),
  score: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .required()
    .messages({
      'number.min': '评分不能小于1',
      'number.max': '评分不能大于5',
      'any.required': '评分为必填项'
    }),
  content: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': '评价内容不能超过1000个字符'
    }),
  resident_type: Joi.string()
    .valid('owner', 'tenant', 'visitor')
    .optional()
    .messages({
      'any.only': '居民类型必须是: owner、tenant、visitor'
    })
});

// 设施反馈验证
const facilityFeedbackSchema = Joi.object({
  facility_id: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.positive': '设施ID必须是正整数'
    }),
  // 创建新设施时需要的字段
  facility_name: Joi.string()
    .max(255)
    .when('facility_id', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'string.max': '设施名称不能超过255个字符',
      'any.required': '未提供设施ID时，设施名称为必填项'
    }),
  category_code: Joi.string()
    .length(6)
    .when('facility_id', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'string.length': '设施分类代码必须是6位字符',
      'any.required': '未提供设施ID时，设施分类为必填项'
    }),
  formatted_address: Joi.string()
    .max(255)
    .when('facility_id', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'string.max': '设施地址不能超过255个字符',
      'any.required': '未提供设施ID时，设施地址为必填项'
    }),
  longitude: Joi.number()
    .when('facility_id', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'any.required': '未提供设施ID时，经度为必填项'
    }),
  latitude: Joi.number()
    .when('facility_id', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'any.required': '未提供设施ID时，纬度为必填项'
    }),
  district_code: Joi.string()
    .max(20)
    .optional()
    .messages({
      'string.max': '区域代码不能超过20个字符'
    }),
  score: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .required()
    .messages({
      'number.min': '评分必须在1到5之间',
      'number.max': '评分必须在1到5之间',
      'number.integer': '评分必须是整数',
      'any.required': '评分为必填项'
    }),
  content: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': '评价内容不能超过1000个字符'
    })
});

// 便利度评估验证
const evaluationSchema = Joi.object({
  formatted_address: Joi.string()
    .min(5)
    .max(255)
    .required()
    .messages({
      'string.min': '评估中心地址至少需要5个字符',
      'string.max': '评估中心地址不能超过255个字符',
      'any.required': '评估中心地址为必填项'
    }),
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
      'number.min': '经度必须在-180到180之间',
      'number.max': '经度必须在-180到180之间',
      'any.required': '经度为必填项'
    }),
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
      'number.min': '纬度必须在-90到90之间',
      'number.max': '纬度必须在-90到90之间',
      'any.required': '纬度为必填项'
    }),
  district_code: Joi.string()
    .max(20)
    .optional()
    .messages({
      'string.max': '区域代码不能超过20个字符'
    }),
  radius: Joi.number()
    .integer()
    .min(100)
    .max(5000)
    .required()
    .messages({
      'number.min': '评估半径至少100米',
      'number.max': '评估半径最大5000米',
      'any.required': '评估半径为必填项'
    }),
  target_categories: Joi.array()
    .items(Joi.string().length(6))
    .min(1)
    .required()
    .messages({
      'array.min': '至少选择一个设施类别',
      'any.required': '设施类别为必填项',
      'string.length': '设施类别代码必须是6位字符'
    }),
  transport_modes: Joi.array()
    .items(Joi.string().valid('walk', 'bus', 'car', 'ride'))
    .min(1)
    .required()
    .messages({
      'array.min': '至少选择一种交通方式',
      'any.required': '交通方式为必填项',
      'any.only': '交通方式只能是 walk、bus、car 或 ride'
    })
});

// 设施管理验证
const facilitySchema = Joi.object({
  name: Joi.string()
    .max(255)
    .required()
    .messages({
      'string.max': '设施名称不能超过255个字符',
      'any.required': '设施名称为必填项'
    }),
  category_code: Joi.string()
    .length(6)
    .required()
    .messages({
      'string.length': '设施分类代码必须是6位字符',
      'any.required': '设施分类为必填项'
    }),
  formatted_address: Joi.string()
    .max(255)
    .required()
    .messages({
      'string.max': '设施地址不能超过255个字符',
      'any.required': '设施地址为必填项'
    }),
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
      'number.min': '经度必须在-180到180之间',
      'number.max': '经度必须在-180到180之间',
      'any.required': '经度为必填项'
    }),
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
      'number.min': '纬度必须在-90到90之间',
      'number.max': '纬度必须在-90到90之间',
      'any.required': '纬度为必填项'
    }),
  district_code: Joi.string()
    .max(20)
    .optional()
    .messages({
      'string.max': '区域代码不能超过20个字符'
    })
});

// 通用验证中间件
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '输入数据验证失败',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

module.exports = {
  registerSchema,
  loginSchema,
  communityFeedbackSchema,
  facilityFeedbackSchema,
  evaluationSchema,
  facilitySchema,
  validate
};
