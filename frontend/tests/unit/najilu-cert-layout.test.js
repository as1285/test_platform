import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const najilu = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../najilu.html'), 'utf8');

describe('纳税记录凭证对齐正版圈出项', () => {
  it('备注列按行写原始申报，不合并成一格', () => {
    expect(najilu).toContain("if (!raw || raw === '原申报' || raw === '原始申报') return '原始申报'");
    expect(najilu).not.toContain('var mergedRemark');
    expect(najilu).toContain('drawRemarkCell(v, cx, midY)');
  });

  it('表格按本页行数收缩，金额合计紧贴末行', () => {
    expect(najilu).toContain(
      'var tableBodySlots = Math.max(1, Math.min(CERT_TABLE_BODY_SLOTS, rows.length))'
    );
    expect(najilu).not.toContain('var tableBodySlots = CERT_TABLE_BODY_SLOTS;');
    expect(najilu).toContain("drawText(ctx, '金额合计'");
  });

  it('入库税务机关按市/区两行居中断行', () => {
    expect(najilu).toContain('function splitTaxAuthorityLines');
    expect(najilu).toContain('国家税务总局[\\u4e00-\\u9fa5]{2,10}?[市州盟]');
    expect(najilu).toContain('drawText(ctx, lines[0], cx + cols[i] / 2, y + 22');
    expect(najilu).toContain('drawText(ctx, lines[1], cx + cols[i] / 2, y + 42');
  });

  it('说明段收紧行距并补上句号', () => {
    expect(najilu).toContain("drawText(ctx, '本凭证不作为纳税人记账、抵扣凭证。'");
    expect(najilu).toContain('explainY + 28');
    expect(najilu).toContain('var CERT_FOOTER_BLOCK_H = 236');
    expect(najilu).not.toContain('var CERT_FOOTER_BLOCK_H = 292');
  });

  it('电子章压住开具机关', () => {
    expect(najilu).toContain('width - 248');
    expect(najilu).toContain('explainY + 92');
    expect(najilu).toContain('ctx.globalAlpha = 0.88');
  });

  it('najilu 缓存戳已更新', () => {
    expect(html).toContain('najilu.js?v=20260915-cert-remark-stamp');
    expect(najilu).toContain('consult.html?tab=records');
    expect(najilu).toContain('btnPreviewCloseConsult');
    expect(najilu).not.toContain("href=\"javascript:history.back()\" class=\"header-close-btn\"");
  });

  it('预览页附近按钮都回我要咨询', () => {
    expect(najilu).toContain('id="btnAddToAlbum" href="consult.html?tab=records"');
    expect(najilu).toContain('id="btnPreviewCloseConsult" href="consult.html?tab=records"');
    expect(najilu).toContain('window.location.href = previewConsultHref()');
    expect(najilu).not.toContain('<button type="button" class="preview-album-btn"');
  });
});
