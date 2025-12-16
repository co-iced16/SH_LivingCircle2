#!/bin/bash
# Git配置脚本 - 处理换行符和基本设置

echo "🔧 配置Git换行符处理..."

# 配置换行符处理
git config core.autocrlf input  # 在Windows上推荐使用input
git config core.safecrlf false  # 关闭安全检查避免警告

echo "✅ Git换行符配置完成"

# 显示当前配置
echo "📋 当前Git配置："
echo "core.autocrlf = $(git config core.autocrlf)"
echo "core.safecrlf = $(git config core.safecrlf)"

# 可选：重新规范化仓库中的文件
read -p "是否要重新规范化仓库中的换行符？(y/N): " normalize
if [[ $normalize =~ ^[Yy]$ ]]; then
    echo "🔄 重新规范化换行符..."
    git add --renormalize .
    echo "✅ 换行符规范化完成"
fi

echo "🎉 Git配置完成！现在可以安全地提交代码了。"
