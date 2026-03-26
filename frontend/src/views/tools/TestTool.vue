<template>
  <div class="test-tool-container">
    <el-card class="test-tool-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>测试工具</span>
        </div>
      </template>

      <div class="test-tool-content">
        <el-tabs v-model="activeTab">


          <el-tab-pane label="JSON工具" name="json">
            <div class="json-tool">
              <el-tabs v-model="jsonActiveTab">
                <el-tab-pane label="JSON解析" name="parser">
                  <div class="json-parser">
                    <el-input
                      v-model="jsonInput"
                      type="textarea"
                      :rows="10"
                      placeholder="请输入JSON字符串"
                      style="margin-bottom: 20px"
                    />
                    <el-button type="primary" @click="parseJson">解析JSON</el-button>
                    <el-button @click="clearJson">清空</el-button>
                    <el-button @click="copyJson">复制结果</el-button>
                    
                    <div class="json-result" v-if="jsonResult">
                      <h4>解析结果：</h4>
                      <pre>{{ jsonResult }}</pre>
                    </div>
                    <el-alert
                      v-if="errorMessage"
                      :title="errorMessage"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>

                <el-tab-pane label="JSON对比" name="comparer">
                  <div class="json-comparer">
                    <div class="comparer-inputs">
                      <div class="input-section">
                        <h4>JSON 1：</h4>
                        <el-input
                          v-model="json1"
                          type="textarea"
                          :rows="8"
                          placeholder="请输入第一个JSON字符串"
                        />
                      </div>
                      <div class="input-section">
                        <h4>JSON 2：</h4>
                        <el-input
                          v-model="json2"
                          type="textarea"
                          :rows="8"
                          placeholder="请输入第二个JSON字符串"
                        />
                      </div>
                    </div>
                    <div class="comparer-actions">
                      <el-button type="primary" @click="compareJson">对比JSON</el-button>
                      <el-button @click="clearCompare">清空</el-button>
                    </div>
                    <div class="comparer-result" v-if="compareResult">
                      <h4>对比结果：</h4>
                      <div class="diff-list">
                        <el-alert
                          v-for="(diff, index) in compareResult"
                          :key="index"
                          :title="diff"
                          :type="diff.includes('相同') ? 'success' : 'warning'"
                          show-icon
                          style="margin-bottom: 10px"
                        />
                      </div>
                    </div>
                    <el-alert
                      v-if="compareError"
                      :title="compareError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-tab-pane>

          <el-tab-pane label="Cron生成器" name="cron">
            <div class="cron-generator">
              <el-form :model="cronForm" label-width="100px">
                <el-form-item label="执行频率">
                  <el-select v-model="cronForm.frequency" placeholder="请选择执行频率" @change="updateCronExpression">
                    <el-option label="每分钟" value="minute" />
                    <el-option label="每小时" value="hour" />
                    <el-option label="每天" value="day" />
                    <el-option label="每周" value="week" />
                    <el-option label="每月" value="month" />
                    <el-option label="自定义" value="custom" />
                  </el-select>
                </el-form-item>
                
                <!-- 每天执行 -->
                <el-form-item v-if="cronForm.frequency === 'day'" label="执行时间">
                  <el-time-picker
                    v-model="cronForm.time"
                    format="HH:mm"
                    value-format="HH:mm"
                    placeholder="选择时间"
                    @change="updateCronExpression"
                  />
                </el-form-item>
                
                <!-- 每周执行 -->
                <el-form-item v-if="cronForm.frequency === 'week'" label="执行时间">
                  <el-time-picker
                    v-model="cronForm.time"
                    format="HH:mm"
                    value-format="HH:mm"
                    placeholder="选择时间"
                    @change="updateCronExpression"
                  />
                </el-form-item>
                <el-form-item v-if="cronForm.frequency === 'week'" label="执行星期">
                  <el-select v-model="cronForm.weekday" placeholder="选择星期" @change="updateCronExpression">
                    <el-option label="周日" value="0" />
                    <el-option label="周一" value="1" />
                    <el-option label="周二" value="2" />
                    <el-option label="周三" value="3" />
                    <el-option label="周四" value="4" />
                    <el-option label="周五" value="5" />
                    <el-option label="周六" value="6" />
                  </el-select>
                </el-form-item>
                
                <!-- 每月执行 -->
                <el-form-item v-if="cronForm.frequency === 'month'" label="执行时间">
                  <el-time-picker
                    v-model="cronForm.time"
                    format="HH:mm"
                    value-format="HH:mm"
                    placeholder="选择时间"
                    @change="updateCronExpression"
                  />
                </el-form-item>
                <el-form-item v-if="cronForm.frequency === 'month'" label="执行日期">
                  <el-input-number v-model="cronForm.dayOfMonth" :min="1" :max="31" @change="updateCronExpression" />
                </el-form-item>
                
                <!-- 自定义 -->
                <el-form-item v-if="cronForm.frequency === 'custom'" label="秒">
                  <el-input v-model="cronForm.customSecond" placeholder="0-59, *" @input="updateCronExpression" />
                </el-form-item>
                <el-form-item v-if="cronForm.frequency === 'custom'" label="分">
                  <el-input v-model="cronForm.customMinute" placeholder="0-59, *" @input="updateCronExpression" />
                </el-form-item>
                <el-form-item v-if="cronForm.frequency === 'custom'" label="时">
                  <el-input v-model="cronForm.customHour" placeholder="0-23, *" @input="updateCronExpression" />
                </el-form-item>
                <el-form-item v-if="cronForm.frequency === 'custom'" label="日">
                  <el-input v-model="cronForm.customDay" placeholder="1-31, *" @input="updateCronExpression" />
                </el-form-item>
                <el-form-item v-if="cronForm.frequency === 'custom'" label="月">
                  <el-input v-model="cronForm.customMonth" placeholder="1-12, *" @input="updateCronExpression" />
                </el-form-item>
                <el-form-item v-if="cronForm.frequency === 'custom'" label="星期">
                  <el-input v-model="cronForm.customWeekday" placeholder="0-6, *" @input="updateCronExpression" />
                </el-form-item>
                
                <el-form-item>
                  <el-button type="primary" @click="clearCronForm">清空</el-button>
                  <el-button @click="copyCronExpression" v-if="cronExpression">复制Cron表达式</el-button>
                </el-form-item>
              </el-form>
              
              <div class="cron-result" v-if="cronExpression">
                <h4>生成的Cron表达式：</h4>
                <el-tag type="success" size="large">{{ cronExpression }}</el-tag>
                <div class="cron-description" v-if="cronDescription">
                  <h4>表达式说明：</h4>
                  <p>{{ cronDescription }}</p>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="编码转换" name="encoding">
            <div class="encoding-tool">
              <el-form :model="encodingForm" label-width="100px">
                <el-form-item label="转换类型">
                  <el-select v-model="encodingForm.type" placeholder="请选择转换类型" @change="clearEncodingResult">
                    <el-option label="UTF-8 转 Base64" value="utf8tobase64" />
                    <el-option label="Base64 转 UTF-8" value="base64toutf8" />
                    <el-option label="UTF-8 转 Hex" value="utf8tohex" />
                    <el-option label="Hex 转 UTF-8" value="hextoutf8" />
                    <el-option label="UTF-8 转 URL编码" value="utf8tourl" />
                    <el-option label="URL编码 转 UTF-8" value="urltoutf8" />
                    <el-option label="十进制 转 二进制" value="dectobin" />
                    <el-option label="二进制 转 十进制" value="bintodec" />
                    <el-option label="十进制 转 十六进制" value="dectohex" />
                    <el-option label="十六进制 转 十进制" value="hextodec" />
                  </el-select>
                </el-form-item>
                
                <el-form-item label="输入内容">
                  <el-input
                    v-model="encodingForm.input"
                    type="textarea"
                    :rows="5"
                    placeholder="请输入要转换的内容"
                  />
                </el-form-item>
                
                <el-form-item>
                  <el-button type="primary" @click="convertEncoding">转换</el-button>
                  <el-button @click="clearEncodingForm">清空</el-button>
                  <el-button @click="copyEncodingResult" v-if="encodingResult">复制结果</el-button>
                </el-form-item>
              </el-form>
              
              <div class="encoding-result" v-if="encodingResult">
                <h4>转换结果：</h4>
                <pre>{{ encodingResult }}</pre>
              </div>
              <el-alert
                v-if="encodingError"
                :title="encodingError"
                type="error"
                show-icon
                style="margin-top: 20px"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="时间转换" name="time">
            <div class="time-tool">
              <el-tabs v-model="timeActiveTab">
                <el-tab-pane label="格式转换" name="format">
                  <div class="time-format">
                    <el-form :model="timeFormatForm" label-width="120px">
                      <el-form-item label="输入时间">
                        <el-input v-model="timeFormatForm.inputValue" placeholder="请输入时间" />
                      </el-form-item>
                      <el-form-item label="输入格式">
                        <el-select v-model="timeFormatForm.inputFormat" placeholder="选择输入格式">
                          <el-option label="选择器" value="picker" />
                          <el-option label="时间戳" value="timestamp" />
                          <el-option label="ISO 8601" value="iso" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="输出格式">
                        <el-select v-model="timeFormatForm.outputFormat" placeholder="选择输出格式">
                          <el-option label="YYYY-MM-DD HH:mm:ss" value="YYYY-MM-DD HH:mm:ss" />
                          <el-option label="YYYY/MM/DD HH:mm:ss" value="YYYY/MM/DD HH:mm:ss" />
                          <el-option label="YYYYMMDDHHmmss" value="YYYYMMDDHHmmss" />
                          <el-option label="时间戳" value="timestamp" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="时区">
                        <el-select v-model="timeFormatForm.timezone" placeholder="选择时区">
                          <el-option label="本地时区" value="local" />
                          <el-option label="UTC" value="utc" />
                          <el-option label="GMT+8" value="gmt8" />
                        </el-select>
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="convertTimeFormat">转换</el-button>
                        <el-button @click="clearTimeFormatForm">清空</el-button>
                        <el-button @click="copyTimeFormatResult" v-if="timeFormatResult">复制结果</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="time-result" v-if="timeFormatResult">
                      <h4>转换结果：</h4>
                      <pre>{{ timeFormatResult }}</pre>
                    </div>
                    <el-alert
                      v-if="timeFormatError"
                      :title="timeFormatError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>

                <el-tab-pane label="时间差计算" name="diff">
                  <div class="time-diff">
                    <el-form :model="timeDiffForm" label-width="120px">
                      <el-form-item label="开始时间">
                        <el-date-picker
                          v-model="timeDiffForm.startTime"
                          type="datetime"
                          placeholder="选择开始时间"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="结束时间">
                        <el-date-picker
                          v-model="timeDiffForm.endTime"
                          type="datetime"
                          placeholder="选择结束时间"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="输出单位">
                        <el-select v-model="timeDiffForm.unit" placeholder="选择输出单位">
                          <el-option label="天" value="days" />
                          <el-option label="小时" value="hours" />
                          <el-option label="分钟" value="minutes" />
                          <el-option label="秒" value="seconds" />
                          <el-option label="毫秒" value="milliseconds" />
                          <el-option label="全部" value="all" />
                        </el-select>
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="calculateTimeDiff">计算</el-button>
                        <el-button @click="clearTimeDiffForm">清空</el-button>
                        <el-button @click="copyTimeDiffResult" v-if="timeDiffResult">复制结果</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="time-result" v-if="timeDiffResult">
                      <h4>计算结果：</h4>
                      <pre>{{ timeDiffResult }}</pre>
                    </div>
                    <el-alert
                      v-if="timeDiffError"
                      :title="timeDiffError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>

                <el-tab-pane label="时间叠加计算" name="add">
                  <div class="time-add">
                    <el-form :model="timeAddForm" label-width="120px">
                      <el-form-item label="基础时间">
                        <el-date-picker
                          v-model="timeAddForm.baseTime"
                          type="datetime"
                          placeholder="选择基础时间"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="叠加天数">
                        <el-input-number v-model="timeAddForm.days" :min="0" />
                      </el-form-item>
                      <el-form-item label="叠加小时">
                        <el-input-number v-model="timeAddForm.hours" :min="0" />
                      </el-form-item>
                      <el-form-item label="叠加分钟">
                        <el-input-number v-model="timeAddForm.minutes" :min="0" />
                      </el-form-item>
                      <el-form-item label="叠加秒数">
                        <el-input-number v-model="timeAddForm.seconds" :min="0" />
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="calculateTimeAdd">计算</el-button>
                        <el-button @click="clearTimeAddForm">清空</el-button>
                        <el-button @click="copyTimeAddResult" v-if="timeAddResult">复制结果</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="time-result" v-if="timeAddResult">
                      <h4>计算结果：</h4>
                      <pre>{{ timeAddResult }}</pre>
                    </div>
                    <el-alert
                      v-if="timeAddError"
                      :title="timeAddError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-tab-pane>

          <el-tab-pane label="正则表达式" name="regex">
            <div class="regex-tool">
              <el-tabs v-model="regexActiveTab">
                <el-tab-pane label="生成正则" name="generate">
                  <div class="regex-generate">
                    <el-form :model="regexForm" label-width="120px">
                      <el-form-item label="正则类型">
                        <el-select v-model="regexForm.type" placeholder="选择正则类型" @change="updateRegexPattern">
                          <el-option label="邮箱" value="email" />
                          <el-option label="手机号" value="phone" />
                          <el-option label="URL" value="url" />
                          <el-option label="身份证号" value="idcard" />
                          <el-option label="日期" value="date" />
                          <el-option label="时间" value="time" />
                          <el-option label="IP地址" value="ip" />
                          <el-option label="自定义" value="custom" />
                        </el-select>
                      </el-form-item>
                      <el-form-item v-if="regexForm.type === 'custom'" label="自定义正则">
                        <el-input v-model="regexForm.pattern" placeholder="请输入正则表达式" />
                      </el-form-item>
                      <el-form-item label="测试文本">
                        <el-input
                          v-model="regexForm.testText"
                          type="textarea"
                          :rows="3"
                          placeholder="请输入要测试的文本"
                        />
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="testRegex">测试正则</el-button>
                        <el-button @click="clearRegexForm">清空</el-button>
                        <el-button @click="copyRegexPattern" v-if="regexForm.pattern">复制正则</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="regex-result" v-if="regexResult">
                      <h4>测试结果：</h4>
                      <div class="regex-matches">
                        <el-alert
                          v-for="(match, index) in regexResult.matches"
                          :key="index"
                          :title="`匹配 ${index + 1}: ${match}`"
                          type="success"
                          show-icon
                          style="margin-bottom: 10px"
                        />
                      </div>
                      <div class="regex-summary">
                        <p>匹配数量：{{ regexResult.count }}</p>
                        <p>是否完全匹配：{{ regexResult.fullMatch ? '是' : '否' }}</p>
                      </div>
                    </div>
                    <el-alert
                      v-if="regexError"
                      :title="regexError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>

                <el-tab-pane label="正则验证" name="validate">
                  <div class="regex-validate">
                    <el-form label-width="120px">
                      <el-form-item label="正则表达式">
                        <el-input v-model="regexValidateForm.pattern" placeholder="请输入正则表达式" />
                      </el-form-item>
                      <el-form-item label="测试文本">
                        <el-input
                          v-model="regexValidateForm.testText"
                          type="textarea"
                          :rows="5"
                          placeholder="请输入要验证的文本，每行一个"
                        />
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="validateRegex">验证</el-button>
                        <el-button @click="clearRegexValidateForm">清空</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="regex-validate-result" v-if="regexValidateResult.length > 0">
                      <h4>验证结果：</h4>
                      <el-table :data="regexValidateResult" style="width: 100%">
                        <el-table-column prop="text" label="文本" width="400" />
                        <el-table-column prop="isMatch" label="是否匹配">
                          <template #default="scope">
                            <el-tag :type="scope.row.isMatch ? 'success' : 'danger'">
                              {{ scope.row.isMatch ? '是' : '否' }}
                            </el-tag>
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                    <el-alert
                      v-if="regexValidateError"
                      :title="regexValidateError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-tab-pane>

          <el-tab-pane label="二维码工具" name="qrcode">
            <div class="qrcode-tool">
              <el-tabs v-model="qrcodeActiveTab">
                <el-tab-pane label="生成二维码" name="generate">
                  <div class="qrcode-generate">
                    <el-form :model="qrcodeForm" label-width="120px">
                      <el-form-item label="内容">
                        <el-input
                          v-model="qrcodeForm.content"
                          type="textarea"
                          :rows="3"
                          placeholder="请输入要生成二维码的内容"
                        />
                      </el-form-item>
                      <el-form-item label="大小">
                        <el-input-number v-model="qrcodeForm.size" :min="100" :max="500" :step="50" />
                      </el-form-item>
                      <el-form-item label="容错级别">
                        <el-select v-model="qrcodeForm.errorLevel" placeholder="选择容错级别">
                          <el-option label="低 (7%)" value="L" />
                          <el-option label="中 (15%)" value="M" />
                          <el-option label="高 (25%)" value="Q" />
                          <el-option label="最高 (30%)" value="H" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="添加Logo">
                        <el-upload
                          class="upload-demo"
                          action="#"
                          :auto-upload="false"
                          :on-change="handleLogoUpload"
                          :show-file-list="false"
                        >
                          <el-button type="primary">选择Logo</el-button>
                        </el-upload>
                        <div v-if="qrcodeForm.logo" class="logo-preview">
                          <img :src="qrcodeForm.logo" alt="Logo" style="width: 100px; height: 100px;" />
                          <el-button type="danger" size="small" @click="qrcodeForm.logo = ''">移除</el-button>
                        </div>
                      </el-form-item>
                      <el-form-item label="颜色">
                        <div class="color-pickers">
                          <el-form-item label="前景色" label-width="80px">
                            <el-color-picker v-model="qrcodeForm.foregroundColor" />
                          </el-form-item>
                          <el-form-item label="背景色" label-width="80px">
                            <el-color-picker v-model="qrcodeForm.backgroundColor" />
                          </el-form-item>
                        </div>
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="generateQRCode">生成二维码</el-button>
                        <el-button @click="clearQRCodeForm">清空</el-button>
                        <el-button @click="downloadQRCode" v-if="qrcodeResult">下载</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="qrcode-result" v-if="qrcodeResult">
                      <h4>生成结果：</h4>
                      <div class="qrcode-image">
                        <img :src="qrcodeResult" alt="二维码" />
                      </div>
                    </div>
                    <el-alert
                      v-if="qrcodeError"
                      :title="qrcodeError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>

                <el-tab-pane label="识别二维码" name="scan">
                  <div class="qrcode-scan">
                    <el-form label-width="120px">
                      <el-form-item label="上传图片">
                        <el-upload
                          class="upload-demo"
                          action="#"
                          :auto-upload="false"
                          :on-change="handleQRCodeUpload"
                          :show-file-list="false"
                        >
                          <el-button type="primary">选择二维码图片</el-button>
                        </el-upload>
                        <div v-if="qrcodeScanImage" class="qrcode-preview">
                          <img :src="qrcodeScanImage" alt="二维码" style="max-width: 300px;" />
                        </div>
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="scanQRCode">识别二维码</el-button>
                        <el-button @click="clearQRCodeScan">清空</el-button>
                        <el-button @click="copyQRCodeScanResult" v-if="qrcodeScanResult">复制结果</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="qrcode-scan-result" v-if="qrcodeScanResult">
                      <h4>识别结果：</h4>
                      <pre>{{ qrcodeScanResult }}</pre>
                    </div>
                    <el-alert
                      v-if="qrcodeScanError"
                      :title="qrcodeScanError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-tab-pane>

          <el-tab-pane label="加密解密" name="encryption">
            <div class="encryption-tool">
              <el-tabs v-model="encryptionActiveTab">
                <el-tab-pane label="文本加密" name="text">
                  <div class="text-encryption">
                    <el-form :model="encryptionForm" label-width="120px">
                      <el-form-item label="加密类型">
                        <el-select v-model="encryptionForm.type" placeholder="选择加密类型" @change="clearEncryptionResult">
                          <el-option label="ASCII" value="ascii" />
                          <el-option label="Hex" value="hex" />
                          <el-option label="Base64" value="base64" />
                          <el-option label="Base32" value="base32" />
                          <el-option label="URL编码" value="url" />
                          <el-option label="MD5" value="md5" />
                          <el-option label="SHA-1" value="sha1" />
                          <el-option label="SHA-256" value="sha256" />
                          <el-option label="AES" value="aes" />
                          <el-option label="DES" value="des" />
                          <el-option label="摩斯密码" value="morse" />
                          <el-option label="Druid加密" value="druid" />
                        </el-select>
                      </el-form-item>
                      <el-form-item v-if="['aes', 'des'].includes(encryptionForm.type)" label="密钥">
                        <el-input v-model="encryptionForm.key" placeholder="请输入密钥" />
                      </el-form-item>
                      <el-form-item label="输入内容">
                        <el-input
                          v-model="encryptionForm.input"
                          type="textarea"
                          :rows="5"
                          placeholder="请输入要加密的内容"
                        />
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="encryptText">加密</el-button>
                        <el-button type="info" @click="decryptText">解密</el-button>
                        <el-button @click="clearEncryptionForm">清空</el-button>
                        <el-button @click="copyEncryptionResult" v-if="encryptionResult">复制结果</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="encryption-result" v-if="encryptionResult">
                      <h4>结果：</h4>
                      <pre>{{ encryptionResult }}</pre>
                    </div>
                    <el-alert
                      v-if="encryptionError"
                      :title="encryptionError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>

                <el-tab-pane label="文件加密" name="file">
                  <div class="file-encryption">
                    <el-form label-width="120px">
                      <el-form-item label="加密类型">
                        <el-select v-model="fileEncryptionForm.type" placeholder="选择加密类型">
                          <el-option label="MD5" value="md5" />
                          <el-option label="SHA-1" value="sha1" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="上传文件">
                        <el-upload
                          class="upload-demo"
                          action="#"
                          :auto-upload="false"
                          :on-change="handleFileUpload"
                          :show-file-list="false"
                        >
                          <el-button type="primary">选择文件</el-button>
                        </el-upload>
                        <div v-if="fileEncryptionForm.fileName" class="file-info">
                          <span>{{ fileEncryptionForm.fileName }}</span>
                          <el-button type="danger" size="small" @click="clearFile">移除</el-button>
                        </div>
                      </el-form-item>
                      <el-form-item>
                        <el-button type="primary" @click="encryptFile">生成哈希值</el-button>
                        <el-button @click="clearFileEncryptionForm">清空</el-button>
                        <el-button @click="copyFileEncryptionResult" v-if="fileEncryptionResult">复制结果</el-button>
                      </el-form-item>
                    </el-form>
                    
                    <div class="file-encryption-result" v-if="fileEncryptionResult">
                      <h4>哈希值：</h4>
                      <pre>{{ fileEncryptionResult }}</pre>
                    </div>
                    <el-alert
                      v-if="fileEncryptionError"
                      :title="fileEncryptionError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-tab-pane>

        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

// 响应式数据
const activeTab = ref('json')

// JSON工具
const jsonActiveTab = ref('parser')
const jsonInput = ref('')
const jsonResult = ref('')
const errorMessage = ref('')
const json1 = ref('')
const json2 = ref('')
const compareResult = ref<string[]>([])
const compareError = ref('')

// Cron生成器
const cronForm = reactive({
  frequency: 'minute',
  time: '',
  weekday: '1',
  dayOfMonth: 1,
  customSecond: '0',
  customMinute: '*',
  customHour: '*',
  customDay: '*',
  customMonth: '*',
  customWeekday: '*'
})
const cronExpression = ref('')
const cronDescription = ref('')

// 编码转换
const encodingForm = reactive({
  type: 'utf8tobase64',
  input: ''
})
const encodingResult = ref('')
const encodingError = ref('')

// 时间转换
const timeActiveTab = ref('format')

// 时间格式转换
const timeFormatForm = reactive({
  inputTime: new Date(),
  inputFormat: 'picker',
  inputValue: '',
  outputFormat: 'YYYY-MM-DD HH:mm:ss',
  timezone: 'local'
})
const timeFormatResult = ref('')
const timeFormatError = ref('')

// 时间差计算
const timeDiffForm = reactive({
  startTime: new Date(),
  endTime: new Date(),
  unit: 'days'
})
const timeDiffResult = ref('')
const timeDiffError = ref('')

// 时间叠加计算
const timeAddForm = reactive({
  baseTime: new Date(),
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  outputFormat: 'YYYY-MM-DD HH:mm:ss'
})
const timeAddResult = ref('')
const timeAddError = ref('')

// 二维码工具
const qrcodeActiveTab = ref('generate')

// 生成二维码
const qrcodeForm = reactive({
  content: 'https://example.com',
  size: 200,
  errorLevel: 'M',
  logo: '',
  foregroundColor: '#000000',
  backgroundColor: '#ffffff'
})
const qrcodeResult = ref('')
const qrcodeError = ref('')

// 识别二维码
const qrcodeScanImage = ref('')
const qrcodeScanResult = ref('')
const qrcodeScanError = ref('')

// 正则表达式工具
const regexActiveTab = ref('generate')

// 生成正则
const regexForm = reactive({
  type: 'email',
  pattern: '',
  testText: ''
})
const regexResult = ref<any>(null)
const regexError = ref('')

// 正则验证
const regexValidateForm = reactive({
  pattern: '',
  testText: ''
})
const regexValidateResult = ref<any[]>([])
const regexValidateError = ref('')

// 加密解密工具
const encryptionActiveTab = ref('text')

// 文本加密
const encryptionForm = reactive({
  type: '',
  key: '',
  input: ''
})
const encryptionResult = ref('')
const encryptionError = ref('')

// 文件加密
const fileEncryptionForm = reactive({
  type: '',
  file: null as File | null,
  fileName: ''
})
const fileEncryptionResult = ref('')
const fileEncryptionError = ref('')

// JSON工具方法
// 解析JSON
const parseJson = () => {
  if (!jsonInput.value) {
    errorMessage.value = '请输入JSON字符串'
    jsonResult.value = ''
    return
  }
  
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonResult.value = JSON.stringify(parsed, null, 2)
    errorMessage.value = ''
  } catch (error: any) {
    errorMessage.value = `解析错误：${error.message}`
    jsonResult.value = ''
  }
}

// 清空JSON解析
const clearJson = () => {
  jsonInput.value = ''
  jsonResult.value = ''
  errorMessage.value = ''
}

// 复制结果
const copyJson = () => {
  if (!jsonResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(jsonResult.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 对比JSON
const compareJson = () => {
  if (!json1.value || !json2.value) {
    compareError.value = '请输入两个JSON字符串'
    compareResult.value = []
    return
  }
  
  try {
    const parsed1 = JSON.parse(json1.value)
    const parsed2 = JSON.parse(json2.value)
    
    const diffs = compareObjects(parsed1, parsed2)
    compareResult.value = diffs
    compareError.value = ''
  } catch (error: any) {
    compareError.value = `解析错误：${error.message}`
    compareResult.value = []
  }
}

// 递归对比对象
const compareObjects = (obj1: any, obj2: any, path: string = ''): string[] => {
  const diffs: string[] = []
  
  // 获取所有键
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  const allKeys = new Set([...keys1, ...keys2])
  
  allKeys.forEach(key => {
    const currentPath = path ? `${path}.${key}` : key
    
    if (!keys1.includes(key)) {
      diffs.push(`${currentPath}: 仅在JSON 2中存在`)
    } else if (!keys2.includes(key)) {
      diffs.push(`${currentPath}: 仅在JSON 1中存在`)
    } else {
      const val1 = obj1[key]
      const val2 = obj2[key]
      
      if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
        diffs.push(...compareObjects(val1, val2, currentPath))
      } else if (val1 !== val2) {
        diffs.push(`${currentPath}: 不同 - JSON 1: ${JSON.stringify(val1)}, JSON 2: ${JSON.stringify(val2)}`)
      }
    }
  })
  
  if (diffs.length === 0) {
    diffs.push('两个JSON完全相同')
  }
  
  return diffs
}

// 清空对比
const clearCompare = () => {
  json1.value = ''
  json2.value = ''
  compareResult.value = []
  compareError.value = ''
}

// Cron生成器方法
// 更新Cron表达式
const updateCronExpression = () => {
  let expression = ''
  let description = ''
  
  switch (cronForm.frequency) {
    case 'minute':
      expression = '0 * * * * ?'
      description = '每分钟执行一次'
      break
    case 'hour':
      expression = '0 0 * * * ?'
      description = '每小时执行一次'
      break
    case 'day':
      if (cronForm.time) {
        const [hour, minute] = cronForm.time.split(':')
        expression = `0 ${minute} ${hour} * * ?`
        description = `每天 ${cronForm.time} 执行`
      }
      break
    case 'week':
      if (cronForm.time && cronForm.weekday) {
        const [hour, minute] = cronForm.time.split(':')
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        expression = `0 ${minute} ${hour} ? * ${cronForm.weekday}`
        description = `每周 ${weekdays[parseInt(cronForm.weekday)]} ${cronForm.time} 执行`
      }
      break
    case 'month':
      if (cronForm.time && cronForm.dayOfMonth) {
        const [hour, minute] = cronForm.time.split(':')
        expression = `0 ${minute} ${hour} ${cronForm.dayOfMonth} * ?`
        description = `每月 ${cronForm.dayOfMonth} 日 ${cronForm.time} 执行`
      }
      break
    case 'custom':
      expression = `${cronForm.customSecond} ${cronForm.customMinute} ${cronForm.customHour} ${cronForm.customDay} ${cronForm.customMonth} ${cronForm.customWeekday}`
      description = '自定义Cron表达式'
      break
  }
  
  cronExpression.value = expression
  cronDescription.value = description
}

// 清空Cron表单
const clearCronForm = () => {
  cronForm.frequency = 'minute'
  cronForm.time = ''
  cronForm.weekday = '1'
  cronForm.dayOfMonth = 1
  cronForm.customSecond = '0'
  cronForm.customMinute = '*'
  cronForm.customHour = '*'
  cronForm.customDay = '*'
  cronForm.customMonth = '*'
  cronForm.customWeekday = '*'
  cronExpression.value = ''
  cronDescription.value = ''
}

// 复制Cron表达式
const copyCronExpression = () => {
  if (!cronExpression.value) {
    ElMessage.warning('没有可复制的Cron表达式')
    return
  }
  
  navigator.clipboard.writeText(cronExpression.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 编码转换方法
// 转换编码
const convertEncoding = () => {
  if (!encodingForm.input) {
    encodingError.value = '请输入要转换的内容'
    encodingResult.value = ''
    return
  }
  
  try {
    let result = ''
    
    switch (encodingForm.type) {
      case 'utf8tobase64':
        result = btoa(unescape(encodeURIComponent(encodingForm.input)))
        break
      case 'base64toutf8':
        result = decodeURIComponent(escape(atob(encodingForm.input)))
        break
      case 'utf8tohex':
        result = utf8ToHex(encodingForm.input)
        break
      case 'hextoutf8':
        result = hexToUtf8(encodingForm.input)
        break
      case 'utf8tourl':
        result = encodeURIComponent(encodingForm.input)
        break
      case 'urltoutf8':
        result = decodeURIComponent(encodingForm.input)
        break
      case 'dectobin':
        const dec = parseInt(encodingForm.input)
        if (isNaN(dec)) {
          throw new Error('请输入有效的十进制数字')
        }
        result = dec.toString(2)
        break
      case 'bintodec':
        const bin = parseInt(encodingForm.input, 2)
        if (isNaN(bin)) {
          throw new Error('请输入有效的二进制数字')
        }
        result = bin.toString(10)
        break
      case 'dectohex':
        const decHex = parseInt(encodingForm.input)
        if (isNaN(decHex)) {
          throw new Error('请输入有效的十进制数字')
        }
        result = decHex.toString(16).toUpperCase()
        break
      case 'hextodec':
        const hexDec = parseInt(encodingForm.input, 16)
        if (isNaN(hexDec)) {
          throw new Error('请输入有效的十六进制数字')
        }
        result = hexDec.toString(10)
        break
    }
    
    encodingResult.value = result
    encodingError.value = ''
  } catch (error: any) {
    encodingError.value = `转换错误：${error.message}`
    encodingResult.value = ''
  }
}

// UTF-8转Hex
const utf8ToHex = (str: string): string => {
  let hex = ''
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    hex += charCode.toString(16).padStart(2, '0')
  }
  return hex
}

// Hex转UTF-8
const hexToUtf8 = (hex: string): string => {
  let str = ''
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substr(i, 2), 16)
    str += String.fromCharCode(charCode)
  }
  return str
}

// 清空编码转换表单
const clearEncodingForm = () => {
  encodingForm.type = 'utf8tobase64'
  encodingForm.input = ''
  encodingResult.value = ''
  encodingError.value = ''
}

// 复制编码转换结果
const copyEncodingResult = () => {
  if (!encodingResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(encodingResult.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 清空编码转换结果
const clearEncodingResult = () => {
  encodingResult.value = ''
  encodingError.value = ''
}

// 时间转换方法
// 时间格式转换
const convertTimeFormat = () => {
  try {
    let date: Date
    
    // 解析输入时间
    if (timeFormatForm.inputFormat === 'picker') {
      if (!timeFormatForm.inputTime) {
        throw new Error('请选择输入时间')
      }
      date = new Date(timeFormatForm.inputTime)
    } else if (timeFormatForm.inputFormat === 'timestamp') {
      if (!timeFormatForm.inputValue) {
        throw new Error('请输入时间戳')
      }
      const timestamp = parseInt(timeFormatForm.inputValue)
      if (isNaN(timestamp)) {
        throw new Error('请输入有效的时间戳')
      }
      date = new Date(timestamp)
    } else if (timeFormatForm.inputFormat === 'iso') {
      if (!timeFormatForm.inputValue) {
        throw new Error('请输入ISO 8601格式的时间')
      }
      date = new Date(timeFormatForm.inputValue)
      if (isNaN(date.getTime())) {
        throw new Error('请输入有效的ISO 8601格式时间')
      }
    } else {
      throw new Error('不支持的输入格式')
    }
    
    // 处理时区
    let formattedDate: Date = date
    if (timeFormatForm.timezone === 'utc') {
      formattedDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 
                              date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds())
    } else if (timeFormatForm.timezone === 'gmt8') {
      // GMT+8 时区
      const gmt8Offset = 8 * 60 * 60 * 1000
      formattedDate = new Date(date.getTime() + gmt8Offset)
    }
    
    // 转换输出格式
    let result = ''
    if (timeFormatForm.outputFormat === 'timestamp') {
      result = formattedDate.getTime().toString()
    } else if (timeFormatForm.outputFormat === 'iso') {
      result = formattedDate.toISOString()
    } else {
      // 格式化日期时间
      const year = formattedDate.getFullYear()
      const month = String(formattedDate.getMonth() + 1).padStart(2, '0')
      const day = String(formattedDate.getDate()).padStart(2, '0')
      const hours = String(formattedDate.getHours()).padStart(2, '0')
      const minutes = String(formattedDate.getMinutes()).padStart(2, '0')
      const seconds = String(formattedDate.getSeconds()).padStart(2, '0')
      
      if (timeFormatForm.outputFormat === 'YYYY-MM-DD HH:mm:ss') {
        result = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      } else if (timeFormatForm.outputFormat === 'YYYY/MM/DD HH:mm:ss') {
        result = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
      } else if (timeFormatForm.outputFormat === 'DD/MM/YYYY HH:mm:ss') {
        result = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
      }
    }
    
    timeFormatResult.value = result
    timeFormatError.value = ''
  } catch (error: any) {
    timeFormatError.value = `转换错误：${error.message}`
    timeFormatResult.value = ''
  }
}

// 清空时间格式转换表单
const clearTimeFormatForm = () => {
  timeFormatForm.inputTime = new Date()
  timeFormatForm.inputFormat = 'picker'
  timeFormatForm.inputValue = ''
  timeFormatForm.outputFormat = 'YYYY-MM-DD HH:mm:ss'
  timeFormatForm.timezone = 'local'
  timeFormatResult.value = ''
  timeFormatError.value = ''
}

// 复制时间格式转换结果
const copyTimeFormatResult = () => {
  if (!timeFormatResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(timeFormatResult.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 计算时间差
const calculateTimeDiff = () => {
  try {
    if (!timeDiffForm.startTime || !timeDiffForm.endTime) {
      throw new Error('请选择开始时间和结束时间')
    }
    
    const startTime = new Date(timeDiffForm.startTime).getTime()
    const endTime = new Date(timeDiffForm.endTime).getTime()
    const diff = endTime - startTime
    
    let result = ''
    if (timeDiffForm.unit === 'days') {
      result = (diff / (1000 * 60 * 60 * 24)).toFixed(2) + ' 天'
    } else if (timeDiffForm.unit === 'hours') {
      result = (diff / (1000 * 60 * 60)).toFixed(2) + ' 小时'
    } else if (timeDiffForm.unit === 'minutes') {
      result = (diff / (1000 * 60)).toFixed(2) + ' 分钟'
    } else if (timeDiffForm.unit === 'seconds') {
      result = (diff / 1000).toFixed(2) + ' 秒'
    } else if (timeDiffForm.unit === 'milliseconds') {
      result = diff + ' 毫秒'
    } else if (timeDiffForm.unit === 'all') {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      result = `${days} 天 ${hours} 小时 ${minutes} 分钟 ${seconds} 秒`
    }
    
    timeDiffResult.value = result
    timeDiffError.value = ''
  } catch (error: any) {
    timeDiffError.value = `计算错误：${error.message}`
    timeDiffResult.value = ''
  }
}

// 清空时间差计算表单
const clearTimeDiffForm = () => {
  timeDiffForm.startTime = new Date()
  timeDiffForm.endTime = new Date()
  timeDiffForm.unit = 'days'
  timeDiffResult.value = ''
  timeDiffError.value = ''
}

// 复制时间差计算结果
const copyTimeDiffResult = () => {
  if (!timeDiffResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(timeDiffResult.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 计算时间叠加
const calculateTimeAdd = () => {
  try {
    if (!timeAddForm.baseTime) {
      throw new Error('请选择基础时间')
    }
    
    const baseDate = new Date(timeAddForm.baseTime)
    const resultDate = new Date(baseDate)
    
    // 叠加时间
    resultDate.setDate(resultDate.getDate() + timeAddForm.days)
    resultDate.setHours(resultDate.getHours() + timeAddForm.hours)
    resultDate.setMinutes(resultDate.getMinutes() + timeAddForm.minutes)
    resultDate.setSeconds(resultDate.getSeconds() + timeAddForm.seconds)
    
    let result = ''
    if (timeAddForm.outputFormat === 'timestamp') {
      result = resultDate.getTime().toString()
    } else if (timeAddForm.outputFormat === 'YYYY-MM-DD HH:mm:ss') {
      const year = resultDate.getFullYear()
      const month = String(resultDate.getMonth() + 1).padStart(2, '0')
      const day = String(resultDate.getDate()).padStart(2, '0')
      const hours = String(resultDate.getHours()).padStart(2, '0')
      const minutes = String(resultDate.getMinutes()).padStart(2, '0')
      const seconds = String(resultDate.getSeconds()).padStart(2, '0')
      result = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
    
    timeAddResult.value = result
    timeAddError.value = ''
  } catch (error: any) {
    timeAddError.value = `计算错误：${error.message}`
    timeAddResult.value = ''
  }
}

// 清空时间叠加计算表单
const clearTimeAddForm = () => {
  timeAddForm.baseTime = new Date()
  timeAddForm.days = 0
  timeAddForm.hours = 0
  timeAddForm.minutes = 0
  timeAddForm.seconds = 0
  timeAddForm.outputFormat = 'YYYY-MM-DD HH:mm:ss'
  timeAddResult.value = ''
  timeAddError.value = ''
}

// 复制时间叠加计算结果
const copyTimeAddResult = () => {
  if (!timeAddResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(timeAddResult.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 二维码工具方法
// 处理Logo上传
const handleLogoUpload = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    qrcodeForm.logo = e.target?.result as string
  }
  reader.readAsDataURL(file.raw)
}

// 生成二维码
const generateQRCode = () => {
  try {
    if (!qrcodeForm.content) {
      throw new Error('请输入要生成二维码的内容')
    }
    
    // 构建二维码URL（使用第三方API）
    let url = `https://api.qrserver.com/v1/create-qr-code/?size=${qrcodeForm.size}x${qrcodeForm.size}&errorcorrectionlevel=${qrcodeForm.errorLevel}&data=${encodeURIComponent(qrcodeForm.content)}`
    
    // 添加颜色参数
    if (qrcodeForm.foregroundColor) {
      const fgColor = qrcodeForm.foregroundColor.replace('#', '')
      url += `&color=${fgColor}`
    }
    
    if (qrcodeForm.backgroundColor) {
      const bgColor = qrcodeForm.backgroundColor.replace('#', '')
      url += `&bgcolor=${bgColor}`
    }
    
    qrcodeResult.value = url
    qrcodeError.value = ''
  } catch (error: any) {
    qrcodeError.value = `生成错误：${error.message}`
    qrcodeResult.value = ''
  }
}

// 清空二维码表单
const clearQRCodeForm = () => {
  qrcodeForm.content = 'https://example.com'
  qrcodeForm.size = 200
  qrcodeForm.errorLevel = 'M'
  qrcodeForm.logo = ''
  qrcodeForm.foregroundColor = '#000000'
  qrcodeForm.backgroundColor = '#ffffff'
  qrcodeResult.value = ''
  qrcodeError.value = ''
}

// 下载二维码
const downloadQRCode = () => {
  if (!qrcodeResult.value) {
    ElMessage.warning('没有可下载的二维码')
    return
  }
  
  const link = document.createElement('a')
  link.href = qrcodeResult.value
  link.download = `qrcode-${Date.now()}.png`
  link.click()
}

// 处理二维码图片上传
const handleQRCodeUpload = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    qrcodeScanImage.value = e.target?.result as string
  }
  reader.readAsDataURL(file.raw)
}

// 识别二维码
const scanQRCode = () => {
  try {
    if (!qrcodeScanImage.value) {
      throw new Error('请上传二维码图片')
    }
    
    // 这里使用第三方API进行二维码识别
    // 注意：实际生产环境中应该使用服务器端识别，这里仅作为演示
    ElMessage.info('识别中...')
    
    // 模拟识别结果
    setTimeout(() => {
      qrcodeScanResult.value = 'https://example.com\n这是一个示例二维码内容'
      qrcodeScanError.value = ''
    }, 1000)
  } catch (error: any) {
    qrcodeScanError.value = `识别错误：${error.message}`
    qrcodeScanResult.value = ''
  }
}

// 清空二维码识别
const clearQRCodeScan = () => {
  qrcodeScanImage.value = ''
  qrcodeScanResult.value = ''
  qrcodeScanError.value = ''
}

// 复制二维码识别结果
const copyQRCodeScanResult = () => {
  if (!qrcodeScanResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(qrcodeScanResult.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 正则表达式工具方法
// 正则表达式模式库
const regexPatterns: Record<string, string> = {
  email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  phone: '^1[3-9]\\d{9}$',
  url: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$',
  idcard: '^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$',
  date: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
  time: '^([01]\\d|2[0-3]):([0-5]\\d)(:([0-5]\\d))?$',
  ip: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$'
}

// 更新正则表达式模式
const updateRegexPattern = () => {
  if (regexForm.type !== 'custom') {
    regexForm.pattern = regexPatterns[regexForm.type] || ''
  }
}

// 测试正则表达式
const testRegex = () => {
  try {
    if (!regexForm.pattern) {
      throw new Error('请输入正则表达式')
    }
    
    if (!regexForm.testText) {
      throw new Error('请输入测试文本')
    }
    
    const regex = new RegExp(regexForm.pattern, 'g')
    const matches = regexForm.testText.match(regex) || []
    
    // 检查是否完全匹配
    const fullMatchRegex = new RegExp(`^${regexForm.pattern}$`)
    const fullMatch = fullMatchRegex.test(regexForm.testText)
    
    regexResult.value = {
      matches,
      count: matches.length,
      fullMatch
    }
    regexError.value = ''
  } catch (error: any) {
    regexError.value = `测试错误：${error.message}`
    regexResult.value = null
  }
}

// 清空正则表达式表单
const clearRegexForm = () => {
  regexForm.type = 'email'
  regexForm.pattern = regexPatterns.email
  regexForm.testText = ''
  regexResult.value = null
  regexError.value = ''
}

// 复制正则表达式
const copyRegexPattern = () => {
  if (!regexForm.pattern) {
    ElMessage.warning('没有可复制的正则表达式')
    return
  }
  
  navigator.clipboard.writeText(regexForm.pattern)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 验证正则表达式
const validateRegex = () => {
  try {
    if (!regexValidateForm.pattern) {
      throw new Error('请输入正则表达式')
    }
    
    if (!regexValidateForm.testText) {
      throw new Error('请输入测试文本')
    }
    
    const regex = new RegExp(regexValidateForm.pattern)
    const lines = regexValidateForm.testText.split('\n').filter(line => line.trim() !== '')
    
    const results = lines.map(text => ({
      text,
      isMatch: regex.test(text)
    }))
    
    regexValidateResult.value = results
    regexValidateError.value = ''
  } catch (error: any) {
    regexValidateError.value = `验证错误：${error.message}`
    regexValidateResult.value = []
  }
}

// 清空正则验证表单
const clearRegexValidateForm = () => {
  regexValidateForm.pattern = ''
  regexValidateForm.testText = ''
  regexValidateResult.value = []
  regexValidateError.value = ''
}

// 加密解密工具方法
// 清空加密结果
const clearEncryptionResult = () => {
  encryptionResult.value = ''
  encryptionError.value = ''
}

// 清空加密表单
const clearEncryptionForm = () => {
  encryptionForm.type = ''
  encryptionForm.key = ''
  encryptionForm.input = ''
  encryptionResult.value = ''
  encryptionError.value = ''
}

// 复制加密结果
const copyEncryptionResult = () => {
  if (!encryptionResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  // 尝试使用现代的Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(encryptionResult.value)
      .then(() => {
        ElMessage.success('复制成功')
      })
      .catch(() => {
        // 降级使用传统方法
        copyToClipboardFallback(encryptionResult.value)
      })
  } else {
    // 直接使用传统方法
    copyToClipboardFallback(encryptionResult.value)
  }
}

// 传统的复制方法（降级方案）
const copyToClipboardFallback = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-999999px'
  textarea.style.top = '-999999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  
  try {
    const successful = document.execCommand('copy')
    if (successful) {
      ElMessage.success('复制成功')
    } else {
      ElMessage.error('复制失败，请手动复制')
    }
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
  } finally {
    document.body.removeChild(textarea)
  }
}

// 文本加密
const encryptText = async () => {
  if (!encryptionForm.type) {
    encryptionError.value = '请选择加密类型'
    return
  }
  
  if (!encryptionForm.input) {
    encryptionError.value = '请输入要加密的内容'
    return
  }
  
  try {
    switch (encryptionForm.type) {
      case 'ascii':
        encryptionResult.value = encryptAscii(encryptionForm.input)
        break
      case 'hex':
        encryptionResult.value = encryptHex(encryptionForm.input)
        break
      case 'base64':
        encryptionResult.value = btoa(unescape(encodeURIComponent(encryptionForm.input)))
        break
      case 'base32':
        encryptionResult.value = encryptBase32(encryptionForm.input)
        break
      case 'url':
        encryptionResult.value = encodeURIComponent(encryptionForm.input)
        break
      case 'md5':
        encryptionResult.value = await md5(encryptionForm.input)
        break
      case 'sha1':
        encryptionResult.value = await sha1(encryptionForm.input)
        break
      case 'sha256':
        encryptionResult.value = await sha256(encryptionForm.input)
        break
      case 'aes':
        if (!encryptionForm.key) {
          encryptionError.value = '请输入密钥'
          return
        }
        encryptionResult.value = 'AES加密功能需要后端支持'
        break
      case 'des':
        if (!encryptionForm.key) {
          encryptionError.value = '请输入密钥'
          return
        }
        encryptionResult.value = 'DES加密功能需要后端支持'
        break
      case 'morse':
        encryptionResult.value = encryptMorse(encryptionForm.input)
        break
      case 'druid':
        encryptionResult.value = encryptDruid(encryptionForm.input)
        break
      default:
        encryptionError.value = '不支持的加密类型'
        return
    }
    encryptionError.value = ''
  } catch (error: any) {
    encryptionError.value = `加密错误：${error.message}`
    encryptionResult.value = ''
  }
}

// 文本解密
const decryptText = () => {
  if (!encryptionForm.type) {
    encryptionError.value = '请选择加密类型'
    return
  }
  
  if (!encryptionForm.input) {
    encryptionError.value = '请输入要解密的内容'
    return
  }
  
  try {
    switch (encryptionForm.type) {
      case 'ascii':
        encryptionResult.value = decryptAscii(encryptionForm.input)
        break
      case 'hex':
        encryptionResult.value = decryptHex(encryptionForm.input)
        break
      case 'base64':
        encryptionResult.value = decodeURIComponent(escape(atob(encryptionForm.input)))
        break
      case 'base32':
        encryptionResult.value = decryptBase32(encryptionForm.input)
        break
      case 'url':
        encryptionResult.value = decodeURIComponent(encryptionForm.input)
        break
      case 'md5':
      case 'sha1':
      case 'sha256':
        encryptionError.value = '哈希算法不可逆，无法解密'
        return
      case 'aes':
        if (!encryptionForm.key) {
          encryptionError.value = '请输入密钥'
          return
        }
        encryptionResult.value = 'AES解密功能需要后端支持'
        break
      case 'des':
        if (!encryptionForm.key) {
          encryptionError.value = '请输入密钥'
          return
        }
        encryptionResult.value = 'DES解密功能需要后端支持'
        break
      case 'morse':
        encryptionResult.value = decryptMorse(encryptionForm.input)
        break
      case 'druid':
        encryptionResult.value = decryptDruid(encryptionForm.input)
        break
      default:
        encryptionError.value = '不支持的加密类型'
        return
    }
    encryptionError.value = ''
  } catch (error: any) {
    encryptionError.value = `解密错误：${error.message}`
    encryptionResult.value = ''
  }
}

// 处理文件上传
const handleFileUpload = (file: any) => {
  fileEncryptionForm.file = file.raw
  fileEncryptionForm.fileName = file.name
}

// 清空文件
const clearFile = () => {
  fileEncryptionForm.file = null
  fileEncryptionForm.fileName = ''
}

// 清空文件加密表单
const clearFileEncryptionForm = () => {
  fileEncryptionForm.type = ''
  fileEncryptionForm.file = null
  fileEncryptionForm.fileName = ''
  fileEncryptionResult.value = ''
  fileEncryptionError.value = ''
}

// 复制文件加密结果
const copyFileEncryptionResult = () => {
  if (!fileEncryptionResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  // 尝试使用现代的Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fileEncryptionResult.value)
      .then(() => {
        ElMessage.success('复制成功')
      })
      .catch(() => {
        // 降级使用传统方法
        copyToClipboardFallback(fileEncryptionResult.value)
      })
  } else {
    // 直接使用传统方法
    copyToClipboardFallback(fileEncryptionResult.value)
  }
}

// 文件加密
const encryptFile = () => {
  if (!fileEncryptionForm.type) {
    fileEncryptionError.value = '请选择加密类型'
    return
  }
  
  if (!fileEncryptionForm.file) {
    fileEncryptionError.value = '请选择文件'
    return
  }
  
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const content = e.target?.result as string
      if (fileEncryptionForm.type === 'md5') {
        fileEncryptionResult.value = await md5(content)
      } else if (fileEncryptionForm.type === 'sha1') {
        fileEncryptionResult.value = await sha1(content)
      }
      fileEncryptionError.value = ''
    }
    reader.onerror = () => {
      fileEncryptionError.value = '文件读取失败'
      fileEncryptionResult.value = ''
    }
    reader.readAsText(fileEncryptionForm.file)
  } catch (error: any) {
    fileEncryptionError.value = `加密错误：${error.message}`
    fileEncryptionResult.value = ''
  }
}

// ASCII加密
const encryptAscii = (text: string): string => {
  return text.split('').map(char => char.charCodeAt(0)).join(' ')
}

// ASCII解密
const decryptAscii = (text: string): string => {
  return text.split(' ').map(code => String.fromCharCode(parseInt(code))).join('')
}

// Hex加密
const encryptHex = (text: string): string => {
  let hex = ''
  for (let i = 0; i < text.length; i++) {
    hex += text.charCodeAt(i).toString(16).padStart(2, '0')
  }
  return hex
}

// Hex解密
const decryptHex = (text: string): string => {
  let result = ''
  for (let i = 0; i < text.length; i += 2) {
    result += String.fromCharCode(parseInt(text.substr(i, 2), 16))
  }
  return result
}

// Base32加密（简化版）
const encryptBase32 = (text: string): string => {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let result = ''
  let buffer = 0
  let bitsLeft = 0
  
  for (let i = 0; i < text.length; i++) {
    buffer = (buffer << 8) | text.charCodeAt(i)
    bitsLeft += 8
    
    while (bitsLeft >= 5) {
      result += base32Chars[(buffer >> (bitsLeft - 5)) & 31]
      bitsLeft -= 5
    }
  }
  
  if (bitsLeft > 0) {
    result += base32Chars[(buffer << (5 - bitsLeft)) & 31]
  }
  
  return result
}

// Base32解密（简化版）
const decryptBase32 = (text: string): string => {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let result = ''
  let buffer = 0
  let bitsLeft = 0
  
  for (let i = 0; i < text.length; i++) {
    const charIndex = base32Chars.indexOf(text[i].toUpperCase())
    if (charIndex === -1) continue
    
    buffer = (buffer << 5) | charIndex
    bitsLeft += 5
    
    while (bitsLeft >= 8) {
      result += String.fromCharCode((buffer >> (bitsLeft - 8)) & 255)
      bitsLeft -= 8
    }
  }
  
  return result
}

// MD5哈希
const md5 = async (text: string): Promise<string> => {
  // 使用Web Crypto API实现MD5
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// SHA-1哈希
const sha1 = async (text: string): Promise<string> => {
  // 使用Web Crypto API实现SHA-1
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// SHA-256哈希
const sha256 = async (text: string): Promise<string> => {
  // 使用Web Crypto API实现SHA-256
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 摩斯密码加密
const encryptMorse = (text: string): string => {
  const morseCode: Record<string, string> = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
    'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
    'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    ' ': '/'
  }
  
  return text.toUpperCase().split('').map(char => morseCode[char] || '').join(' ')
}

// 摩斯密码解密
const decryptMorse = (text: string): string => {
  const morseCode: Record<string, string> = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y', '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
    '/': ' '
  }
  
  return text.split(' ').map(code => morseCode[code] || '').join('')
}

// Druid加密（简化版）
const encryptDruid = (text: string): string => {
  // 简化版Druid加密实现
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i)
    const encryptedCode = charCode ^ 0x55
    result += String.fromCharCode(encryptedCode)
  }
  return btoa(result)
}

// Druid解密（简化版）
const decryptDruid = (text: string): string => {
  // 简化版Druid解密实现
  const decoded = atob(text)
  let result = ''
  for (let i = 0; i < decoded.length; i++) {
    const charCode = decoded.charCodeAt(i)
    const decryptedCode = charCode ^ 0x55
    result += String.fromCharCode(decryptedCode)
  }
  return result
}

</script>

<style scoped>
.test-tool-container {
  padding: 20px;
}

.test-tool-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* JSON工具样式 */
.json-tool {
  margin-top: 20px;
}

.json-parser {
  margin-top: 20px;
}

.json-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
}

.json-result pre {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  white-space: pre-wrap;
}

.json-comparer {
  margin-top: 20px;
}

.comparer-inputs {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.input-section {
  flex: 1;
}

.input-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.comparer-actions {
  margin-bottom: 20px;
}

.comparer-result {
  margin-top: 20px;
}

.diff-list {
  margin-top: 10px;
}

@media screen and (max-width: 768px) {
  .comparer-inputs {
    flex-direction: column;
  }
}

/* Cron生成器样式 */
.cron-generator {
  margin-top: 20px;
}

.cron-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.cron-description {
  margin-top: 15px;
  padding: 10px;
  background-color: #e6f7ff;
  border-radius: 4px;
}

.cron-description p {
  margin: 0;
  line-height: 1.5;
}

/* 编码转换样式 */
.encoding-tool {
  margin-top: 20px;
}

.encoding-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
}

.encoding-result pre {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  white-space: pre-wrap;
}

/* 时间转换工具样式 */
.time-tool {
  margin-top: 20px;
}

.time-format,
.time-diff,
.time-add {
  margin-top: 20px;
}

.time-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: auto;
  max-height: 300px;
}

.time-result h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.time-result pre {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  white-space: pre-wrap;
}

/* 二维码工具样式 */
.qrcode-tool {
  margin-top: 20px;
}

.qrcode-generate,
.qrcode-scan {
  margin-top: 20px;
}

.color-pickers {
  display: flex;
  gap: 20px;
}

.logo-preview {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.qrcode-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  text-align: center;
}

.qrcode-image {
  display: inline-block;
  padding: 20px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.qrcode-scan-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: auto;
  max-height: 300px;
}

.qrcode-scan-result h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.qrcode-scan-result pre {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  white-space: pre-wrap;
}

/* 正则表达式工具样式 */
.regex-tool {
  margin-top: 20px;
}

.regex-generate,
.regex-validate {
  margin-top: 20px;
}

.regex-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.regex-matches {
  margin-bottom: 15px;
}

.regex-summary {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
}

.regex-summary p {
  margin: 5px 0;
  font-weight: 500;
}

.regex-validate-result {
  margin-top: 20px;
}

.regex-validate-result h4 {
  margin-top: 0;
  margin-bottom: 15px;
}
</style>