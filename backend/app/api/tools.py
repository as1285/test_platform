from flask import Blueprint, request, jsonify, send_file
from flask_cors import cross_origin
import pandas as pd
import io
import re

excel_bp = Blueprint('excel', __name__, url_prefix='/tools/excel')

@excel_bp.route('/process', methods=['POST'])
@cross_origin()
def process_excel():
    """处理 Excel 文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'code': 400, 'message': '未找到上传文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'code': 400, 'message': '文件名为空'}), 400
        
        # 获取处理选项
        process_options = request.form.get('processOptions', '["remove_br"]')
        import json
        options = json.loads(process_options)
        
        # 读取 Excel 文件
        try:
            df = pd.read_excel(file)
        except Exception as e:
            return jsonify({'code': 400, 'message': f'读取 Excel 文件失败：{str(e)}'}), 400
        
        # 替换 NaN 值为空字符串
        df = df.fillna('')
        
        # 转换为字符串类型
        df = df.astype(str)
        
        total_rows = len(df)
        modified_rows = 0
        
        # 处理数据
        for index, row in df.iterrows():
            original_row = row.copy()
            
            for col in df.columns:
                cell_value = str(row[col])
                
                # 移除 <br> 标签
                if 'remove_br' in options:
                    # 移除各种形式的 <br> 标签
                    cell_value = re.sub(r'<br\s*/?>', '\n', cell_value, flags=re.IGNORECASE)
                    cell_value = re.sub(r'<br>', '\n', cell_value, flags=re.IGNORECASE)
                
                # 去除首尾空格
                if 'trim_spaces' in options:
                    cell_value = cell_value.strip()
                
                df.at[index, col] = cell_value
            
            # 检查是否有修改
            if not row.equals(original_row):
                modified_rows += 1
        
        # 准备返回数据
        headers = df.columns.tolist()
        data = df.to_dict('records')
        
        return jsonify({
            'code': 200,
            'message': '处理成功',
            'data': {
                'data': data,
                'headers': headers,
                'totalRows': total_rows,
                'modifiedRows': modified_rows
            }
        })
        
    except Exception as e:
        return jsonify({'code': 500, 'message': f'处理失败：{str(e)}'}), 500

@excel_bp.route('/download', methods=['POST'])
@cross_origin()
def download_excel():
    """下载处理后的 Excel 文件"""
    try:
        data = request.json
        excel_data = data.get('data', [])
        headers = data.get('headers', [])
        
        if not excel_data:
            return jsonify({'code': 400, 'message': '没有可下载的数据'}), 400
        
        # 创建 DataFrame
        df = pd.DataFrame(excel_data, columns=headers)
        
        # 创建 Excel 文件到内存
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Sheet1')
        
        output.seek(0)
        
        # 发送文件
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='processed_data.xlsx'
        )
        
    except Exception as e:
        return jsonify({'code': 500, 'message': f'生成 Excel 文件失败：{str(e)}'}), 500
