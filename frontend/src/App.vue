<template>
  <div class="app-container">
    <div class="login-container">
      <div class="login-header">
        <el-button type="text" @click="goBack" class="back-button">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <h1 class="login-title">个人所得税</h1>
      </div>
      
      <div class="login-form">
        <div class="avatar-container">
          <div class="avatar">
            <el-icon><User /></el-icon>
          </div>
        </div>
        
        <el-form :model="loginForm" class="form-content">
          <el-form-item label="账号">
            <el-input 
              v-model="loginForm.username" 
              placeholder="手机号码/证件号码"
              prefix-icon="Phone"
            >
              <template #append>
                <el-icon class="el-input__icon"><QuestionFilled /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          
          <el-form-item label="密码">
            <el-input 
              v-model="loginForm.password" 
              type="password" 
              placeholder="请输入密码"
              prefix-icon="Lock"
            />
          </el-form-item>
          
          <div class="forgot-password">
            <el-button type="text" @click="forgotPassword">找回密码</el-button>
          </div>
          
          <el-button type="primary" class="login-button" @click="login">登录</el-button>
          
          <el-button type="default" class="register-button" @click="register">注册</el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, User, QuestionFilled } from '@element-plus/icons-vue'

const loginForm = ref({
  username: '',
  password: ''
})

const goBack = () => {
  // 实现返回功能
  console.log('返回')
}

const forgotPassword = () => {
  // 实现找回密码功能
  console.log('找回密码')
}

const login = () => {
  // 实现登录功能
  console.log('登录', loginForm.value)
}

const register = () => {
  // 实现注册功能
  console.log('注册')
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-container {
  width: 400px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.login-header {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e4e7ed;
}

.back-button {
  margin-right: 20px;
}

.login-title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
  margin: 0;
}

.login-form {
  padding: 40px 30px;
}

.avatar-container {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #ecf5ff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 40px;
  color: #409eff;
}

.form-content {
  width: 100%;
}

.el-form-item {
  margin-bottom: 20px;
}

.el-form-item__label {
  font-weight: 500;
  color: #606266;
}

.forgot-password {
  text-align: right;
  margin-bottom: 30px;
}

.login-button {
  width: 100%;
  height: 40px;
  font-size: 16px;
  margin-bottom: 15px;
}

.register-button {
  width: 100%;
  height: 40px;
  font-size: 16px;
}
</style>