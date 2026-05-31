'use strict';

const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

var UPLOAD_DIR;

function initAdminUpload(deps) {
  UPLOAD_DIR = deps.UPLOAD_DIR;
}

var ADMIN_UPLOAD_MEDIA_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.m4v', '.webm'];
var ADMIN_UPLOAD_INSTALL_EXT = ['.apk', '.mobileconfig'];

const adminUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      var allow = ADMIN_UPLOAD_MEDIA_EXT.concat(ADMIN_UPLOAD_INSTALL_EXT);
      if (allow.indexOf(ext) < 0) {
        ext = '.bin';
      }
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var ok =
      ADMIN_UPLOAD_MEDIA_EXT.indexOf(ext) >= 0 || ADMIN_UPLOAD_INSTALL_EXT.indexOf(ext) >= 0;
    cb(
      ok ? null : new Error('仅支持图片/视频（jpg、png、gif、webp、mp4 等）或安装包（apk、mobileconfig）'),
      ok
    );
  }
});

function handleAdminUploadAsset(req, res) {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '未选择文件或扩展名不支持' });
  }
  return res.json({ code: 200, data: { path: 'uploads/' + req.file.filename } });
}

module.exports = {
  initAdminUpload,
  adminUpload,
  handleAdminUploadAsset
};
