@echo off
echo 🔧 配置Git换行符处理...

rem 配置换行符处理
git config core.autocrlf input
git config core.safecrlf false

echo ✅ Git换行符配置完成

rem 显示当前配置
echo 📋 当前Git配置：
echo core.autocrlf = 
git config core.autocrlf
echo core.safecrlf = 
git config core.safecrlf

echo 🎉 Git配置完成！现在可以安全地提交代码了。
pause
