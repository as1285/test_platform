import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const najilu = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');
const najiluHtml = readFileSync(resolve(__dirname, '../../najilu.html'), 'utf8');

describe('纳税记录续页：无二维码、表头同首页', () => {
  it('仅首页绘制二维码 / 查询验证码块', () => {
    expect(najilu).toContain('var isFirstPage = pageNum === 1');
    expect(najilu).toContain('仅首页右上角二维码');
    expect(najilu).toContain('function drawTaxRecordContinuationHeader');
    /* 二维码绘制落在 isFirstPage 分支内 */
    const firstPageBlock = najilu.slice(
      najilu.indexOf('if (isFirstPage) {'),
      najilu.indexOf('} else {\n        drawTaxRecordContinuationHeader')
    );
    expect(firstPageBlock).toContain('drawSharpQr');
    expect(firstPageBlock).toContain('查询验证码');
    const elseBlock = najilu.slice(
      najilu.indexOf('} else {\n        drawTaxRecordContinuationHeader'),
      najilu.indexOf('var name = app.user && app.user.real_name')
    );
    expect(elseBlock).toContain('drawTaxRecordContinuationHeader');
    expect(elseBlock).not.toContain('drawSharpQr');
    expect(elseBlock).not.toContain('查询验证码');
  });

  it('续页标题为「个人所得税纳税记录（续）」且纳税人信息字段与首页一致', () => {
    expect(najilu).toContain('function drawTaxRecordContinuationHeader');
    expect(najilu).toContain('个人所得税纳税记录（续）');
    expect(najilu).toContain('记录期间： ');
    expect(najilu).toContain('纳税人名称： ');
    expect(najilu).toContain('身份证件类型： 居民身份证');
    expect(najilu).toContain('纳税人识别号： ');
    expect(najilu).toContain('身份证件号码： ');
    expect(najilu).toContain("heads = ['申报日期', '实缴(退)金额', '入(退)库日期', '所得项目', '税款所属期', '入库税务机关', '备注']");
    /* 续页与首页共用同一表头占位高度 */
    expect(najilu).toContain('续页与首页共用同一表头占位高度');
  });

  it('缓存戳已刷新', () => {
    expect(najiluHtml).toContain('najilu.js?v=20260920-page2-noqr');
  });
});
